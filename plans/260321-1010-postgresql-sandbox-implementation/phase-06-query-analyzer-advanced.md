# Phase 06 - Query Analyzer Advanced (Layers 1, 2, 5)

## Context Links
- [Plan Overview](./plan.md)
- [Spec: Query Analyzer Layers](../../pg-sandbox-prompt%20(1).md) (Section 5)
- [PG Internals Report](../reports/researcher-260321-1008-postgresql-internals-7layer-analyzer.md)

## Overview
- **Priority**: P1
- **Status**: pending
- **Effort**: 12h
- **Blocked by**: Phase 05
- **Description**: Extend analyzer with Layer 1 (parse/rewrite - CTE detection), Layer 2 (planner context - pg_stats, GUCs, estimate accuracy), Layer 5 (MVCC/storage - dead tuples, vacuum state, bloat).

## Key Insights
- Layer 1: CTE fence detection from plan node types (CTE Scan = materialized)
- Layer 2: `pg_stats` for column statistics, `pg_settings` for GUC values, estimate accuracy = actual/plan rows ratio
- Layer 5: `pg_stat_user_tables` for dead tuples, vacuum state; `pg_class` for table size/bloat
- All catalog queries run in parallel with EXPLAIN via `Promise.all`

## Requirements

### Functional
- **Layer 1**: Detect CTE materialization fences, explain PG12+ behavior
- **Layer 2**: Show GUC values (work_mem, random_page_cost, etc.), per-column stats (n_distinct, correlation, null_frac, most_common_vals), bad estimate detection
- **Layer 5**: Per-table dead tuples, bloat ratio, vacuum state, HOT update explanation
- Planner context tab in analyzer UI
- Storage & MVCC tab in analyzer UI
- Signals: cte_fence, bad_estimate, stale_stats, suboptimal_guc, dead_tuple_bloat, vacuum_needed

### Non-functional
- Catalog queries execute in < 1s each
- UI tabs load lazily

## Related Code Files

### Files to Create
- `apps/api/src/modules/analyzer/layer1-detector.service.ts`
- `apps/api/src/modules/analyzer/layer2-detector.service.ts`
- `apps/api/src/modules/analyzer/layer5-detector.service.ts`
- `apps/api/src/modules/analyzer/catalog-query.service.ts`
- `packages/shared/src/types/analyzer-advanced.ts`
- `apps/web/components/analyzer/planner-context-tab.tsx`
- `apps/web/components/analyzer/guc-display.tsx`
- `apps/web/components/analyzer/column-stats-table.tsx`
- `apps/web/components/analyzer/storage-mvcc-tab.tsx`
- `apps/web/components/analyzer/vacuum-status.tsx`

### Files to Modify
- `apps/api/src/modules/analyzer/analyzer.service.ts` (add layers 1, 2, 5 to pipeline)
- `packages/shared/src/types/analyzer.ts` (extend AnalysisResult)
- `apps/web/components/analyzer/analyzer-panel.tsx` (add new tabs)

## Implementation Steps

1. **CatalogQueryService** (`apps/api/src/modules/analyzer/catalog-query.service.ts`)
   - `getColumnStats(schemaName, tables, columns)`: query `pg_stats` for filter/join/orderby columns → n_distinct, correlation, null_frac, most_common_vals (top 5), histogram bounds count
   - `getGUCValues()`: query `pg_settings` for: work_mem, random_page_cost, seq_page_cost, effective_cache_size, max_parallel_workers_per_gather, enable_seqscan, enable_indexscan
   - `getTableStorageStats(schemaName, tables)`: query `pg_stat_user_tables` → n_live_tup, n_dead_tup, last_analyze, last_autovacuum, seq_scan, idx_scan; `pg_class` → reltuples, relpages, table size
   - All queries scoped to workspace schema

2. **Layer1DetectorService** (`apps/api/src/modules/analyzer/layer1-detector.service.ts`)
   - Walk plan tree for `CTE Scan` nodes → `cte_fence` signal
   - Explain: pre-PG12 always materializes; post-PG12 means explicit `MATERIALIZED` or planner chose it
   - Suggestion: try removing MATERIALIZED keyword or rewrite CTE as subquery

3. **Layer2DetectorService** (`apps/api/src/modules/analyzer/layer2-detector.service.ts`)
   - `bad_estimate`: for each node with actual rows, check `actualRows / planRows > 10 || < 0.1` → show pg_stats for that column
   - `stale_stats`: `last_analyze IS NULL OR last_analyze < now() - interval '7 days'`
   - `suboptimal_guc`: `random_page_cost = 4.0` (default, suggest 1.1 for SSD); `work_mem < 64MB` when disk_spill detected (cross-reference Layer 3 signals)

4. **Layer5DetectorService** (`apps/api/src/modules/analyzer/layer5-detector.service.ts`)
   - `dead_tuple_bloat`: `n_dead_tup / (n_live_tup + n_dead_tup) > 0.2` → warning
   - `vacuum_needed`: `last_autovacuum IS NULL OR > 1 day AND n_dead_tup > 1000`
   - Include bloat estimate: `(relpages - expected_pages) / relpages`

5. **Update AnalyzerService** — extend `analyze()`:
   - Extract table names + column names from plan (filter columns, join columns, ORDER BY columns)
   - Run in parallel: EXPLAIN + getColumnStats + getGUCValues + getTableStorageStats
   - Run Layer 1, 2, 5 detectors
   - Merge all signals into AnalysisResult

6. **Planner context tab** (`apps/web/components/analyzer/planner-context-tab.tsx`)
   - GUC values table with current vs recommended values
   - Per-column stats table: column, n_distinct, correlation, null_frac, most_common_vals, histogram buckets
   - Highlight: low correlation on range scan columns, stale stats warning

7. **Storage & MVCC tab** (`apps/web/components/analyzer/storage-mvcc-tab.tsx`)
   - Per-table: live tuples, dead tuples, dead ratio (progress bar), table size, last analyze, last autovacuum
   - VACUUM recommendation if ratio > 20%
   - HOT update explanation card (educational content)

## Todo List
- [ ] Implement CatalogQueryService (pg_stats, pg_settings, pg_stat_user_tables)
- [ ] Implement Layer1DetectorService (CTE fence detection)
- [ ] Implement Layer2DetectorService (bad estimates, stale stats, suboptimal GUCs)
- [ ] Implement Layer5DetectorService (dead tuples, vacuum needed)
- [ ] Update AnalyzerService to run all layers in parallel
- [ ] Extend AnalysisResult type with layer 1, 2, 5 data
- [ ] Build planner context tab (GUCs + column stats)
- [ ] Build storage & MVCC tab (dead tuples, vacuum)
- [ ] Test with tables having stale stats and bloat

## Success Criteria
- Bad estimate signals fire when actual/plan ratio > 10x
- Stale stats detected when last_analyze > 7 days
- Dead tuple bloat detected when ratio > 20%
- GUC display shows current values with optimization hints
- All catalog queries run in parallel (no sequential bottleneck)

## Risk Assessment
- **pg_stats access**: Requires SELECT on pg_catalog; sandbox role needs GRANT SELECT
- **Empty stats**: New tables have no pg_stats until ANALYZE runs; handle gracefully
- **Cross-layer signal correlation**: Layer 2 detector needs Layer 3 signals (disk_spill) → run Layer 3 first, pass results

## Security Considerations
- Catalog queries read-only, scoped to workspace schema
- Don't expose pg_settings values that could leak system info (only show relevant GUCs)

## Next Steps
- Phase 08: AI optimizer (uses full AnalysisResult from all layers)
