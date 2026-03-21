import { Injectable, BadRequestException } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import { SqlValidatorService } from '../database/sql-validator.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { CreateIndexDto } from './dto/create-index.dto';
import type { IndexInfo } from '@sql-sandbox/shared';

/** Validates table/index names: alphanumeric + underscore only */
const SAFE_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** System schemas that must not be targeted */
const BLOCKED_SCHEMAS = ['pg_catalog', 'information_schema', 'pg_toast'];

@Injectable()
export class IndexManagerService {
  constructor(
    private sandbox: SandboxPoolService,
    private validator: SqlValidatorService,
    private workspaceService: WorkspaceService,
  ) {}

  // ---------------------------------------------------------------------------
  // List all indexes in the workspace with usage stats
  // ---------------------------------------------------------------------------
  async listIndexes(workspaceId: string): Promise<IndexInfo[]> {
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;

    const { rows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT
         i.indexname,
         i.tablename,
         i.indexdef,
         COALESCE(s.idx_scan, 0)::bigint        AS idx_scan,
         COALESCE(s.idx_tup_read, 0)::bigint    AS idx_tup_read,
         COALESCE(s.idx_tup_fetch, 0)::bigint   AS idx_tup_fetch,
         pg_size_pretty(
           pg_relation_size(
             quote_ident(i.schemaname) || '.' || quote_ident(i.indexname)
           )
         )                                       AS index_size,
         COALESCE(c.reltuples::bigint, 0)        AS table_rows,
         ix.indisunique                          AS is_unique,
         ix.indisprimary                         AS is_primary,
         CASE
           WHEN i.indexdef LIKE '%USING gin%'  THEN 'gin'
           WHEN i.indexdef LIKE '%USING gist%' THEN 'gist'
           WHEN i.indexdef LIKE '%USING hash%' THEN 'hash'
           WHEN i.indexdef LIKE '%USING brin%' THEN 'brin'
           ELSE 'btree'
         END AS index_type,
         -- Extract column list from pg_index catalog
         (
           SELECT string_agg(a.attname, ', ' ORDER BY ord)
           FROM unnest(ix.indkey) WITH ORDINALITY AS u(attnum, ord)
           JOIN pg_attribute a
             ON a.attrelid = ix.indrelid AND a.attnum = u.attnum
           WHERE u.attnum > 0
         ) AS columns
       FROM pg_indexes i
       JOIN pg_class tc  ON tc.relname = i.tablename
                        AND tc.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
       JOIN pg_index ix  ON ix.indexrelid = (
                             SELECT c2.oid FROM pg_class c2
                             JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
                             WHERE c2.relname = i.indexname
                               AND n2.nspname = i.schemaname
                           )
       JOIN pg_class c   ON c.oid = ix.indrelid
       LEFT JOIN pg_stat_user_indexes s
         ON s.indexrelname = i.indexname AND s.schemaname = i.schemaname
       WHERE i.schemaname = current_schema()
       ORDER BY i.tablename, i.indexname`,
    );

    return rows.map((r: any): IndexInfo => ({
      indexName: r.indexname,
      tableName: r.tablename,
      columns: r.columns ?? '',
      indexType: r.index_type,
      indexSize: r.index_size,
      indexDef: r.indexdef,
      idxScan: Number(r.idx_scan),
      idxTupRead: Number(r.idx_tup_read),
      idxTupFetch: Number(r.idx_tup_fetch),
      tableRows: Number(r.table_rows),
      isUnique: r.is_unique,
      isPrimary: r.is_primary,
    }));
  }

  // ---------------------------------------------------------------------------
  // Create a new index — generates DDL then validates + executes
  // ---------------------------------------------------------------------------
  async createIndex(workspaceId: string, dto: CreateIndexDto): Promise<{ indexName: string; ddl: string }> {
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;

    // Extra security: ensure names are safe identifiers
    this.assertSafeIdentifier(dto.tableName, 'tableName');
    for (const col of dto.columns) {
      this.assertSafeIdentifier(col, `column "${col}"`);
    }

    // Block creation on system tables
    if (BLOCKED_SCHEMAS.some((s) => dto.tableName.startsWith(s))) {
      throw new BadRequestException('Cannot create index on system tables');
    }

    // Build auto-generated index name: idx_{table}_{cols}_{type}
    const colSlug = dto.columns.join('_').substring(0, 30);
    const indexName = `idx_${dto.tableName}_${colSlug}_${dto.indexType}`;

    // Build DDL
    const ddl = this.buildDdl(indexName, dto);

    // Validate via SqlValidator (blocks dangerous keywords)
    this.validator.validate(ddl);

    // CREATE INDEX CONCURRENTLY cannot run inside a transaction.
    // executeInWorkspace uses autocommit (no explicit BEGIN), so it is safe.
    await this.sandbox.executeInWorkspace(schema, ddl);

    return { indexName, ddl };
  }

  // ---------------------------------------------------------------------------
  // Drop an index by name
  // ---------------------------------------------------------------------------
  async dropIndex(workspaceId: string, indexName: string): Promise<{ indexName: string }> {
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;

    this.assertSafeIdentifier(indexName, 'indexName');

    // Use schema-qualified name to target correct index
    const ddl = `DROP INDEX IF EXISTS "${schema}"."${indexName}"`;
    await this.sandbox.executeInWorkspace(schema, ddl);

    return { indexName };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private assertSafeIdentifier(value: string, field: string): void {
    if (!SAFE_IDENTIFIER_RE.test(value)) {
      throw new BadRequestException(`Invalid identifier for ${field}: only alphanumeric and underscore allowed`);
    }
  }

  /** Build CREATE INDEX DDL from DTO */
  private buildDdl(indexName: string, dto: CreateIndexDto): string {
    const parts: string[] = ['CREATE'];

    if (dto.unique) parts.push('UNIQUE');
    parts.push('INDEX');
    if (dto.concurrently) parts.push('CONCURRENTLY');

    parts.push(`"${indexName}"`);
    parts.push(`ON "${dto.tableName}"`);
    parts.push(`USING ${dto.indexType}`);

    const colList = dto.columns.map((c) => `"${c}"`).join(', ');
    parts.push(`(${colList})`);

    if (dto.whereClause?.trim()) {
      parts.push(`WHERE ${dto.whereClause.trim()}`);
    }

    return parts.join(' ');
  }
}
