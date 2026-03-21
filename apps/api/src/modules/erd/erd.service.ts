import { Injectable } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import { WorkspaceService } from '../workspace/workspace.service';

export interface ErdColumn {
  name: string;
  type: string;
  isPk: boolean;
  isNullable: boolean;
  isFk: boolean;
  /** e.g. "orders.user_id" */
  fkRef?: string;
}

export interface ErdTable {
  name: string;
  columns: ErdColumn[];
}

export interface ErdRelationship {
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
}

export interface ErdGraph {
  tables: ErdTable[];
  relationships: ErdRelationship[];
}

@Injectable()
export class ErdService {
  constructor(
    private sandbox: SandboxPoolService,
    private workspaceService: WorkspaceService,
  ) {}

  async getErd(workspaceId: string): Promise<ErdGraph> {
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;

    // All columns with PK flag
    const { rows: columnRows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT
         c.table_name,
         c.column_name,
         c.data_type,
         c.is_nullable,
         CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_pk
       FROM information_schema.columns c
       LEFT JOIN (
         SELECT kcu.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = current_schema()
           AND tc.constraint_type = 'PRIMARY KEY'
       ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
       WHERE c.table_schema = current_schema()
       ORDER BY c.table_name, c.ordinal_position`,
    );

    // FK relationships
    const { rows: fkRows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT
         kcu.table_name AS from_table,
         kcu.column_name AS from_column,
         ccu.table_name AS to_table,
         ccu.column_name AS to_column
       FROM information_schema.referential_constraints rc
       JOIN information_schema.key_column_usage kcu
         ON rc.constraint_name = kcu.constraint_name
         AND kcu.constraint_schema = current_schema()
       JOIN information_schema.constraint_column_usage ccu
         ON rc.unique_constraint_name = ccu.constraint_name
         AND ccu.constraint_schema = current_schema()
       WHERE rc.constraint_schema = current_schema()`,
    );

    // Build FK lookup: "table.column" → "refTable.refColumn"
    const fkLookup = new Map<string, string>();
    for (const row of fkRows) {
      fkLookup.set(`${row.from_table}.${row.from_column}`, `${row.to_table}.${row.to_column}`);
    }

    // Group columns by table
    const tableMap = new Map<string, ErdColumn[]>();
    for (const row of columnRows) {
      const key = `${row.table_name}.${row.column_name}`;
      const fkRef = fkLookup.get(key);
      const col: ErdColumn = {
        name: row.column_name as string,
        type: row.data_type as string,
        isPk: row.is_pk as boolean,
        isNullable: row.is_nullable === 'YES',
        isFk: !!fkRef,
        fkRef,
      };
      if (!tableMap.has(row.table_name)) {
        tableMap.set(row.table_name, []);
      }
      tableMap.get(row.table_name)!.push(col);
    }

    const tables: ErdTable[] = Array.from(tableMap.entries()).map(([name, columns]) => ({
      name,
      columns,
    }));

    const relationships: ErdRelationship[] = fkRows.map((row) => ({
      from: row.from_table as string,
      to: row.to_table as string,
      fromColumn: row.from_column as string,
      toColumn: row.to_column as string,
    }));

    return { tables, relationships };
  }
}
