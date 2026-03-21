import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { getDb, workspaces } from '@sql-sandbox/db';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import { SqlValidatorService } from '../database/sql-validator.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { AlterTableDto } from './dto/alter-table.dto';

/** Generate a schema name from workspace ID (first 12 chars of UUID, no dashes) */
function toSchemaName(id: string): string {
  return `workspace_${id.replace(/-/g, '').slice(0, 12)}`;
}

/** Escape identifier for safe use in SQL (double-quote wrapping) */
function escapeIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Validate table/column name — alphanumeric + underscore only */
const SAFE_IDENT_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
function validateIdent(name: string, label: string): void {
  if (!SAFE_IDENT_REGEX.test(name)) {
    throw new BadRequestException(`Invalid ${label}: ${name}`);
  }
}

/** Validate PG data type — only allow known safe type names */
const SAFE_TYPE_REGEX = /^[a-zA-Z][a-zA-Z0-9_ [\](),.]+$/;
function validateDataType(type: string): void {
  if (!SAFE_TYPE_REGEX.test(type) || type.length > 100) {
    throw new BadRequestException(`Invalid data type: ${type}`);
  }
}

/** Escape a literal value for DEFAULT clause */
function escapeLiteral(value: string): string {
  // Only allow simple literals — quoted strings or numeric/boolean
  if (/^-?\d+(\.\d+)?$/.test(value)) return value; // numeric
  if (/^(true|false|null)$/i.test(value)) return value.toUpperCase(); // bool/null
  // String literal — escape single quotes
  return `'${value.replace(/'/g, "''")}'`;
}

@Injectable()
export class WorkspaceService {
  constructor(
    private sandbox: SandboxPoolService,
    private validator: SqlValidatorService,
  ) {}

  /** Create a new workspace with an isolated PG schema */
  async create(dto: CreateWorkspaceDto) {
    const db = getDb();

    // Generate a unique schema name upfront using a random suffix
    const suffix = Math.random().toString(36).slice(2, 14);
    const schemaName = `workspace_${suffix}`;

    // Insert into system DB first
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: dto.name,
        schemaName,
        description: dto.description || null,
        templateId: dto.templateId || null,
      })
      .returning();

    // Create the actual PG schema — if this fails, clean up the DB row
    try {
      await this.sandbox.createSchema(schemaName);
    } catch (err) {
      await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
      throw err;
    }

    return workspace;
  }

  /** List all workspaces */
  async findAll() {
    const db = getDb();
    return db.select().from(workspaces).orderBy(workspaces.createdAt);
  }

  /** Get a single workspace by ID */
  async findOne(id: string) {
    const db = getDb();
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id));
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  /** Delete workspace: drop PG schema then remove from system DB */
  async remove(id: string) {
    const workspace = await this.findOne(id);
    await this.sandbox.dropSchema(workspace.schemaName);
    const db = getDb();
    await db.delete(workspaces).where(eq(workspaces.id, id));
    return { deleted: true };
  }

  /** List tables in a workspace schema */
  async getTables(id: string) {
    const workspace = await this.findOne(id);
    const { rows } = await this.sandbox.executeInWorkspace(
      workspace.schemaName,
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    return rows.map((r) => r.table_name as string);
  }

  /** Get detailed column/constraint/index info for a table */
  async getTableDetail(id: string, tableName: string) {
    validateIdent(tableName, 'table name');
    const workspace = await this.findOne(id);
    const schema = workspace.schemaName;

    // Columns
    const { rows: columns } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT
         c.column_name, c.data_type, c.is_nullable, c.column_default,
         CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key,
         CASE WHEN uq.column_name IS NOT NULL THEN true ELSE false END AS is_unique
       FROM information_schema.columns c
       LEFT JOIN (
         SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = current_schema()
           AND tc.table_name = '${tableName.replace(/'/g, "''")}'
           AND tc.constraint_type = 'PRIMARY KEY'
       ) pk ON pk.column_name = c.column_name
       LEFT JOIN (
         SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = current_schema()
           AND tc.table_name = '${tableName.replace(/'/g, "''")}'
           AND tc.constraint_type = 'UNIQUE'
       ) uq ON uq.column_name = c.column_name
       WHERE c.table_schema = current_schema()
         AND c.table_name = '${tableName.replace(/'/g, "''")}'
       ORDER BY c.ordinal_position`,
    );

    // Indexes
    const { rows: indexes } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = current_schema()
         AND tablename = '${tableName.replace(/'/g, "''")}'`,
    );

    // Row count estimate
    const { rows: countRows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT reltuples::bigint AS estimate
       FROM pg_class
       WHERE relname = '${tableName.replace(/'/g, "''")}'
         AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())`,
    );

    return {
      tableName,
      columns: columns.map((c) => ({
        columnName: c.column_name,
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
        columnDefault: c.column_default,
        isPrimaryKey: c.is_primary_key,
        isUnique: c.is_unique,
      })),
      indexes: indexes.map((i) => ({
        indexName: i.indexname,
        indexDef: i.indexdef,
      })),
      rowCountEstimate: countRows[0]?.estimate ?? 0,
    };
  }

  /** Execute DDL (CREATE TABLE, etc.) against workspace */
  async executeDdl(id: string, sql: string) {
    this.validator.validate(sql);
    const workspace = await this.findOne(id);
    const { rowCount } = await this.sandbox.executeInWorkspace(workspace.schemaName, sql);
    return { success: true, rowCount };
  }

  /** ALTER TABLE operations */
  async alterTable(id: string, tableName: string, dto: AlterTableDto) {
    validateIdent(tableName, 'table name');
    const workspace = await this.findOne(id);
    const schema = workspace.schemaName;
    const table = escapeIdent(tableName);
    const statements: string[] = [];

    if (dto.addColumns) {
      for (const col of dto.addColumns) {
        validateIdent(col.name, 'column name');
        validateDataType(col.dataType);
        const nullable = col.nullable !== false ? '' : ' NOT NULL';
        const def = col.defaultValue ? ` DEFAULT ${escapeLiteral(col.defaultValue)}` : '';
        statements.push(
          `ALTER TABLE ${table} ADD COLUMN ${escapeIdent(col.name)} ${col.dataType}${nullable}${def}`,
        );
      }
    }

    if (dto.dropColumns) {
      for (const col of dto.dropColumns) {
        validateIdent(col, 'column name');
        statements.push(`ALTER TABLE ${table} DROP COLUMN ${escapeIdent(col)}`);
      }
    }

    if (dto.renameTable) {
      validateIdent(dto.renameTable, 'table name');
      statements.push(`ALTER TABLE ${table} RENAME TO ${escapeIdent(dto.renameTable)}`);
    }

    if (statements.length === 0) {
      throw new BadRequestException('No alter operations specified');
    }

    for (const stmt of statements) {
      this.validator.validate(stmt);
      await this.sandbox.executeInWorkspace(schema, stmt);
    }

    return { success: true, operationsExecuted: statements.length };
  }

  /** Drop a table in workspace */
  async dropTable(id: string, tableName: string) {
    validateIdent(tableName, 'table name');
    const workspace = await this.findOne(id);
    const sql = `DROP TABLE IF EXISTS ${escapeIdent(tableName)}`;
    this.validator.validate(sql);
    await this.sandbox.executeInWorkspace(workspace.schemaName, sql);
    return { dropped: true };
  }

  /** Clone table structure (no data) */
  async cloneTable(id: string, source: string, target: string) {
    validateIdent(source, 'source table name');
    validateIdent(target, 'target table name');
    const workspace = await this.findOne(id);
    const sql = `CREATE TABLE ${escapeIdent(target)} (LIKE ${escapeIdent(source)} INCLUDING ALL)`;
    await this.sandbox.executeInWorkspace(workspace.schemaName, sql);
    return { cloned: true, source, target };
  }
}
