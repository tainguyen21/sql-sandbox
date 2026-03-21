import { Injectable } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';

/** Relevant GUC names for query analysis */
const PLANNER_GUCS = [
  'work_mem', 'random_page_cost', 'seq_page_cost',
  'effective_cache_size', 'max_parallel_workers_per_gather',
  'enable_seqscan', 'enable_indexscan', 'enable_hashjoin',
  'enable_mergejoin', 'enable_nestloop',
];

@Injectable()
export class CatalogQueryService {
  constructor(private sandbox: SandboxPoolService) {}

  /** Get column statistics from pg_stats for specified tables */
  async getColumnStats(schemaName: string, tables: string[]) {
    if (tables.length === 0) return [];
    const { rows } = await this.sandbox.executeInWorkspace(
      schemaName,
      `SELECT
         tablename, attname,
         n_distinct, correlation, null_frac, avg_width,
         most_common_vals::text AS most_common_vals,
         most_common_freqs::text AS most_common_freqs,
         CASE WHEN histogram_bounds IS NOT NULL
           THEN array_length(histogram_bounds, 1)
           ELSE 0
         END AS histogram_buckets
       FROM pg_stats
       WHERE schemaname = current_schema()
         AND tablename = ANY($1::text[])
       ORDER BY tablename, attname`,
      [tables],
    );
    return rows;
  }

  /** Get relevant GUC (Grand Unified Configuration) values */
  async getGUCValues() {
    const { rows } = await this.sandbox.executeInWorkspace(
      'public', // GUCs are global, but we still need a valid schema
      `SELECT name, setting, unit, short_desc, boot_val, reset_val
       FROM pg_settings
       WHERE name = ANY($1::text[])
       ORDER BY name`,
      [PLANNER_GUCS],
    );
    return rows;
  }

  /** Get table storage/MVCC stats from pg_stat_user_tables */
  async getTableStorageStats(schemaName: string, tables: string[]) {
    if (tables.length === 0) return [];
    const { rows } = await this.sandbox.executeInWorkspace(
      schemaName,
      `SELECT
         s.relname AS table_name,
         s.n_live_tup::int, s.n_dead_tup::int,
         s.last_analyze, s.last_autovacuum, s.last_autoanalyze,
         s.seq_scan::int, s.idx_scan::int,
         s.n_tup_ins::int, s.n_tup_upd::int, s.n_tup_del::int,
         s.n_tup_hot_upd::int,
         pg_size_pretty(pg_table_size(quote_ident(current_schema()) || '.' || quote_ident(s.relname))) AS table_size,
         c.relpages, c.reltuples::int
       FROM pg_stat_user_tables s
       JOIN pg_class c ON c.relname = s.relname
         AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
       WHERE s.schemaname = current_schema()
         AND s.relname = ANY($1::text[])`,
      [tables],
    );
    return rows;
  }
}
