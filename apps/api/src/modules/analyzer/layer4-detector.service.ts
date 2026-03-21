import { Injectable } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import type { PlanSignal } from '@sql-sandbox/shared';

interface IndexStat {
  indexname: string;
  tablename: string;
  indexdef: string;
  idx_scan: number;
  reltuples: number;
}

/**
 * Layer 4 — Index usage signal detector.
 * Detects: unused_index, index_type_mismatch
 */
@Injectable()
export class Layer4DetectorService {
  constructor(private sandbox: SandboxPoolService) {}

  async detect(schemaName: string, tables: string[]): Promise<PlanSignal[]> {
    if (tables.length === 0) return [];

    const signals: PlanSignal[] = [];

    // Get index stats using parameterized query
    const { rows } = await this.sandbox.executeInWorkspace(
      schemaName,
      `SELECT
         i.indexname, i.tablename, i.indexdef,
         COALESCE(s.idx_scan, 0)::int AS idx_scan,
         COALESCE(c.reltuples, 0)::int AS reltuples
       FROM pg_indexes i
       LEFT JOIN pg_stat_user_indexes s
         ON s.indexrelname = i.indexname AND s.schemaname = current_schema()
       LEFT JOIN pg_class c ON c.relname = i.tablename
         AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
       WHERE i.schemaname = current_schema()
         AND i.tablename = ANY($1::text[])`,
      [tables],
    );

    for (const idx of rows as IndexStat[]) {
      // Unused index: idx_scan = 0, table has > 500 rows
      if (idx.idx_scan === 0 && idx.reltuples > 500) {
        // Skip primary key indexes — they're structural
        if (/PRIMARY KEY/i.test(idx.indexdef) || /_pkey$/.test(idx.indexname)) continue;

        signals.push({
          layer: 4,
          type: 'unused_index',
          severity: 'info',
          table: idx.tablename,
          message: `Index "${idx.indexname}" on "${idx.tablename}" has never been scanned (0 scans, ${idx.reltuples} rows)`,
          explanation:
            'This index exists but the query planner has never chosen to use it. It still has write overhead (slows INSERT/UPDATE/DELETE) and consumes disk space.',
          suggestion:
            'Consider dropping this index if it is not needed for unique constraints. If it should be used, check if the leading column matches your WHERE conditions.',
        });
      }

      // Index type mismatch: detect btree on patterns needing GIN
      if (/btree/i.test(idx.indexdef) || !idx.indexdef.includes('USING')) {
        // Check for LIKE/ILIKE pattern columns (would need GIN pg_trgm)
        // This is a heuristic — full detection requires plan node filter analysis
        if (/jsonb/i.test(idx.indexdef) && !/gin/i.test(idx.indexdef)) {
          signals.push({
            layer: 4,
            type: 'index_type_mismatch',
            severity: 'warning',
            table: idx.tablename,
            message: `Index "${idx.indexname}" uses B-Tree on JSONB column — GIN index recommended`,
            explanation:
              'B-Tree indexes cannot efficiently handle JSONB containment operators (@>, ?). A GIN index is specifically designed for JSONB operations.',
            suggestion: `CREATE INDEX CONCURRENTLY ON "${idx.tablename}" USING GIN (<column>);`,
          });
        }
      }
    }

    return signals;
  }
}
