import { Injectable } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import type { IndexReport } from '@sql-sandbox/shared';

/**
 * Generates index usage report for tables referenced in a query plan.
 */
@Injectable()
export class IndexReportService {
  constructor(private sandbox: SandboxPoolService) {}

  async getReport(schemaName: string, tables: string[], usedIndexes: Set<string>): Promise<IndexReport[]> {
    if (tables.length === 0) return [];

    const { rows } = await this.sandbox.executeInWorkspace(
      schemaName,
      `SELECT
         i.indexname,
         i.tablename,
         i.indexdef,
         COALESCE(s.idx_scan, 0)::int AS idx_scan,
         COALESCE(s.idx_tup_read, 0)::int AS idx_tup_read,
         COALESCE(s.idx_tup_fetch, 0)::int AS idx_tup_fetch,
         pg_size_pretty(pg_relation_size(quote_ident(i.schemaname) || '.' || quote_ident(i.indexname))) AS index_size,
         CASE
           WHEN i.indexdef LIKE '%USING gin%' THEN 'gin'
           WHEN i.indexdef LIKE '%USING gist%' THEN 'gist'
           WHEN i.indexdef LIKE '%USING hash%' THEN 'hash'
           WHEN i.indexdef LIKE '%USING brin%' THEN 'brin'
           ELSE 'btree'
         END AS index_type
       FROM pg_indexes i
       LEFT JOIN pg_stat_user_indexes s
         ON s.indexrelname = i.indexname AND s.schemaname = i.schemaname
       WHERE i.schemaname = current_schema()
         AND i.tablename = ANY($1::text[])
       ORDER BY i.tablename, i.indexname`,
      [tables],
    );

    return rows.map((r: any) => {
      let status: IndexReport['status'] = 'unused';
      if (usedIndexes.has(r.indexname)) {
        status = 'used';
      } else if (r.idx_scan > 0) {
        // Has been used historically but not in this specific query
        status = 'unused';
      }

      return {
        indexName: r.indexname,
        tableName: r.tablename,
        indexDef: r.indexdef,
        indexType: r.index_type,
        indexSize: r.index_size,
        idxScan: r.idx_scan,
        idxTupRead: r.idx_tup_read,
        idxTupFetch: r.idx_tup_fetch,
        status,
      };
    });
  }
}
