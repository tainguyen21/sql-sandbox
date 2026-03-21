import { Injectable, BadRequestException } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { FakerMapperService, ColumnInfo } from './faker-mapper.service';
import { SeedOptionsDto } from './dto/seed-options.dto';

interface FkRelation {
  table: string;
  column: string;
  refTable: string;
  refColumn: string;
}

/** Topological sort using Kahn's algorithm. Throws on cycle. */
function topoSort(tables: string[], deps: Map<string, Set<string>>): string[] {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const t of tables) {
    inDegree.set(t, 0);
    graph.set(t, []);
  }

  for (const [child, parents] of deps.entries()) {
    for (const parent of parents) {
      if (!graph.has(parent)) continue; // external table — ignore
      graph.get(parent)!.push(child);
      inDegree.set(child, (inDegree.get(child) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [t, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(t);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const neighbor of graph.get(node) || []) {
      const deg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== tables.length) {
    throw new BadRequestException(
      'Circular foreign key references detected — cannot determine seed order.',
    );
  }

  return sorted;
}

@Injectable()
export class SeederService {
  constructor(
    private sandbox: SandboxPoolService,
    private workspaceService: WorkspaceService,
    private fakerMapper: FakerMapperService,
  ) {}

  /** Introspect all tables in workspace schema */
  private async getTables(schema: string): Promise<string[]> {
    const { rows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    return rows.map((r) => r.table_name as string);
  }

  /** Introspect FK constraints for topological ordering */
  private async getFkRelations(schema: string): Promise<FkRelation[]> {
    const { rows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT
         kcu.table_name AS "table",
         kcu.column_name AS "column",
         ccu.table_name AS "refTable",
         ccu.column_name AS "refColumn"
       FROM information_schema.referential_constraints rc
       JOIN information_schema.key_column_usage kcu
         ON rc.constraint_name = kcu.constraint_name
         AND kcu.constraint_schema = current_schema()
       JOIN information_schema.constraint_column_usage ccu
         ON rc.unique_constraint_name = ccu.constraint_name
         AND ccu.constraint_schema = current_schema()
       WHERE rc.constraint_schema = current_schema()`,
    );
    return rows.map((r) => ({
      table: r.table,
      column: r.column,
      refTable: r.refTable,
      refColumn: r.refColumn,
    }));
  }

  /** Introspect columns for a table */
  private async getColumns(schema: string, tableName: string): Promise<ColumnInfo[]> {
    const { rows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT
         c.column_name,
         c.data_type,
         c.is_nullable,
         c.column_default,
         CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
       FROM information_schema.columns c
       LEFT JOIN (
         SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = current_schema()
           AND tc.table_name = $1
           AND tc.constraint_type = 'PRIMARY KEY'
       ) pk ON pk.column_name = c.column_name
       WHERE c.table_schema = current_schema() AND c.table_name = $1
       ORDER BY c.ordinal_position`,
      [tableName],
    );

    return rows.map((r) => ({
      columnName: r.column_name as string,
      dataType: r.data_type as string,
      isNullable: r.is_nullable === 'YES',
      isPrimaryKey: r.is_primary_key as boolean,
      isSerial: typeof r.column_default === 'string' &&
        (r.column_default.startsWith('nextval(') || r.column_default.startsWith('gen_random_uuid')),
    }));
  }

  /** Fetch a sample of existing PKs from a parent table for FK sampling */
  private async samplePks(
    schema: string,
    tableName: string,
    pkColumn: string,
    limit = 1000,
  ): Promise<any[]> {
    const { rows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT "${pkColumn.replace(/"/g, '""')}" FROM "${tableName.replace(/"/g, '""')}" LIMIT $1`,
      [limit],
    );
    return rows.map((r) => r[pkColumn]);
  }

  /** Generate rows for one table and return them (no insert) */
  private generateRows(
    columns: ColumnInfo[],
    fkColumns: Map<string, any[]>, // colName → sampled parent values
    count: number,
    locale: string,
  ): Record<string, any>[] {
    const faker = this.fakerMapper.buildFaker(locale);
    const rows: Record<string, any>[] = [];

    for (let i = 0; i < count; i++) {
      const row: Record<string, any> = {};
      for (const col of columns) {
        if (col.isPrimaryKey && col.isSerial) continue; // DB-generated

        if (fkColumns.has(col.columnName)) {
          const parentValues = fkColumns.get(col.columnName)!;
          if (parentValues.length === 0) {
            row[col.columnName] = null;
          } else {
            row[col.columnName] = faker.helpers.arrayElement(parentValues);
          }
        } else {
          const val = this.fakerMapper.generateValue(faker, col);
          if (val !== undefined) {
            row[col.columnName] = val;
          }
        }
      }
      rows.push(row);
    }
    return rows;
  }

  /** Batch INSERT rows into a table */
  private async batchInsert(
    schema: string,
    tableName: string,
    columns: string[],
    rows: Record<string, any>[],
    batchSize = 500,
  ): Promise<number> {
    if (columns.length === 0 || rows.length === 0) return 0;

    let inserted = 0;
    const safeTable = `"${tableName.replace(/"/g, '""')}"`;
    const colList = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ');

    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      const valuePlaceholders: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      for (const row of batch) {
        const placeholders = columns.map(() => `$${paramIndex++}`).join(', ');
        valuePlaceholders.push(`(${placeholders})`);
        for (const col of columns) {
          params.push(row[col] ?? null);
        }
      }

      const sql = `INSERT INTO ${safeTable} (${colList}) VALUES ${valuePlaceholders.join(', ')}`;
      const result = await this.sandbox.executeInWorkspace(schema, sql, params);
      inserted += result.rowCount;
    }

    return inserted;
  }

  /** Seed workspace tables with faker data, respecting FK ordering */
  async seed(
    workspaceId: string,
    dto: SeedOptionsDto,
  ): Promise<{ seeded: Record<string, number> }> {
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;
    const rowCount = dto.rowCount ?? 100;
    const locale = dto.locale ?? 'en';

    const allTables = await this.getTables(schema);
    const targetTables = dto.tables?.length
      ? dto.tables.filter((t) => allTables.includes(t))
      : allTables;

    const fkRelations = await this.getFkRelations(schema);

    // Build dependency graph: table → set of tables it depends on (parents)
    const deps = new Map<string, Set<string>>();
    const fkMap = new Map<string, FkRelation[]>(); // table → FK relations

    for (const t of targetTables) {
      deps.set(t, new Set());
      fkMap.set(t, []);
    }
    for (const fk of fkRelations) {
      if (deps.has(fk.table) && targetTables.includes(fk.refTable)) {
        deps.get(fk.table)!.add(fk.refTable);
        fkMap.get(fk.table)!.push(fk);
      }
    }

    const sortedTables = topoSort(targetTables, deps);
    const seededCounts: Record<string, number> = {};
    // Cache sampled PKs per table
    const pkCache = new Map<string, any[]>();

    for (const tableName of sortedTables) {
      const columns = await this.getColumns(schema, tableName);
      const tableFks = fkMap.get(tableName) || [];

      // Build FK column → parent PK values map
      const fkColumns = new Map<string, any[]>();
      for (const fk of tableFks) {
        if (!pkCache.has(fk.refTable)) {
          pkCache.set(fk.refTable, await this.samplePks(schema, fk.refTable, fk.refColumn));
        }
        fkColumns.set(fk.column, pkCache.get(fk.refTable)!);
      }

      const insertableColumns = columns.filter(
        (c) => !(c.isPrimaryKey && c.isSerial),
      );
      const colNames = insertableColumns.map((c) => c.columnName);

      const rows = this.generateRows(columns, fkColumns, rowCount, locale);
      const count = await this.batchInsert(schema, tableName, colNames, rows);
      seededCounts[tableName] = count;

      // Cache PKs for this table in case other tables reference it
      const pkCols = columns.filter((c) => c.isPrimaryKey);
      if (pkCols.length > 0) {
        pkCache.set(tableName, await this.samplePks(schema, tableName, pkCols[0].columnName));
      }
    }

    return { seeded: seededCounts };
  }

  /** Preview 5 sample rows per table without inserting */
  async preview(
    workspaceId: string,
    dto: SeedOptionsDto,
  ): Promise<{ preview: Record<string, Record<string, any>[]> }> {
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;
    const locale = dto.locale ?? 'en';
    const PREVIEW_COUNT = 5;

    const allTables = await this.getTables(schema);
    const targetTables = dto.tables?.length
      ? dto.tables.filter((t) => allTables.includes(t))
      : allTables;

    const result: Record<string, Record<string, any>[]> = {};

    for (const tableName of targetTables) {
      const columns = await this.getColumns(schema, tableName);
      const rows = this.generateRows(columns, new Map(), PREVIEW_COUNT, locale);
      result[tableName] = rows;
    }

    return { preview: result };
  }
}
