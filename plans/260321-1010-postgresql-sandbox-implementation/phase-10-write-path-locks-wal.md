# Phase 10 - Write Path, Locks & WAL (Layers 6 + 7)

## Context Links
- [Plan Overview](./plan.md)
- [Spec: Query Analyzer Layers 6 & 7](../../pg-sandbox-prompt%20(1).md) (Section 5)
- [PG Internals Report](../reports/researcher-260321-1008-postgresql-internals-7layer-analyzer.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 10h
- **Blocked by**: Phase 06, Phase 09
- **Description**: Complete the 7-layer analyzer with Layer 6 (locks during query execution) and Layer 7 (WAL/write path for DML). Integrate lock viewer into analyzer and add write path panel.

## Key Insights
- **Layer 6**: Snapshot pg_locks before execution, poll during (200ms interval), diff to find query-specific locks
- **Layer 7**: `pg_stat_wal` + `pg_stat_bgwriter` are cumulative counters; take delta before/after DML
- Layer 7 only meaningful for DML (INSERT/UPDATE/DELETE), skip for SELECT
- Lock viewer already exists in Transaction Lab (Phase 09); reuse service, add to analyzer tabs

## Requirements

### Functional
- **Layer 6 in analyzer**: lock snapshot during query execution, show acquired locks, detect blocked locks
- Signal: `lock_acquired` — report all locks with mode and type
- **Layer 7**: WAL bytes delta, shared buffers written, checkpoint requests
- Signal: `wal_amplification` — WAL bytes > 10x estimated row data
- Locks tab in analyzer UI
- Write path tab in analyzer UI (DML only)

### Non-functional
- Lock polling at 200ms intervals during query execution
- WAL delta calculation accurate to query scope

## Related Code Files

### Files to Create
- `apps/api/src/modules/analyzer/layer6-detector.service.ts`
- `apps/api/src/modules/analyzer/layer7-detector.service.ts`
- `apps/api/src/modules/analyzer/wal-stats.service.ts`
- `apps/api/src/modules/analyzer/lock-snapshot.service.ts`
- `packages/shared/src/types/analyzer-write-path.ts`
- `apps/web/components/analyzer/locks-tab.tsx`
- `apps/web/components/analyzer/write-path-tab.tsx`

### Files to Modify
- `apps/api/src/modules/analyzer/analyzer.service.ts` (add Layer 6 + 7 to pipeline)
- `packages/shared/src/types/analyzer.ts` (extend with lock + WAL types)
- `apps/web/components/analyzer/analyzer-panel.tsx` (add Locks + Write Path tabs)

## Implementation Steps

1. **LockSnapshotService** (`apps/api/src/modules/analyzer/lock-snapshot.service.ts`)
   - `snapshotBefore(client)`: query `pg_locks JOIN pg_stat_activity` → baseline locks
   - `pollDuring(client, pid, intervalMs=200)`: start interval, collect lock snapshots until query completes
   - `diff(before, during)`: find locks acquired specifically by the query PID
   - Return: `[{ locktype, relation, mode, granted, duration }]`

2. **Layer6DetectorService** (`apps/api/src/modules/analyzer/layer6-detector.service.ts`)
   - `lock_acquired`: report all locks from diff with mode and type
   - For DML: highlight table-level locks that could block concurrent reads (e.g., RowExclusiveLock)
   - If any lock `granted = false` during execution → warning: query was blocked

3. **WalStatsService** (`apps/api/src/modules/analyzer/wal-stats.service.ts`)
   - `snapshotBefore(client)`: `SELECT * FROM pg_stat_wal` (PG 14+) + `SELECT * FROM pg_stat_bgwriter`
   - `snapshotAfter(client)`: same queries
   - `computeDelta(before, after)`: wal_bytes, wal_records, buffers_checkpoint, buffers_clean, buffers_backend
   - Only run for DML queries (detect via SQL parsing or EXPLAIN output)

4. **Layer7DetectorService** (`apps/api/src/modules/analyzer/layer7-detector.service.ts`)
   - `wal_amplification`: WAL bytes delta > 10x estimated row data size
   - Estimate row data: `affected_rows * average_row_width` (from plan or pg_stats)
   - Explain: unnecessary full-row updates cause WAL bloat

5. **Update AnalyzerService pipeline** for full analysis mode:
   ```
   1. Snapshot WAL + bgwriter stats (Layer 7 pre) — DML only
   2. Snapshot pg_locks (Layer 6 pre)
   3. Start lock polling (200ms interval)
   4. Execute EXPLAIN ANALYZE
   5. Stop lock polling
   6. Snapshot WAL + bgwriter stats (Layer 7 post) — DML only
   7. Compute lock diff (Layer 6)
   8. Compute WAL delta (Layer 7)
   9. Run Layer 6 + 7 detectors
   10. Merge all signals
   ```

6. **Locks tab** (`apps/web/components/analyzer/locks-tab.tsx`)
   - Table: relation, locktype, mode, granted, duration
   - Blocked locks (granted=false) highlighted red
   - Info card explaining lock modes for learning

7. **Write path tab** (`apps/web/components/analyzer/write-path-tab.tsx`)
   - Only shown for DML queries
   - WAL bytes generated (human-readable: KB/MB)
   - Shared buffers written
   - Checkpoint requests triggered (if any)
   - `wal_amplification` signal card if detected
   - Educational: explain what WAL is and why it matters

## Todo List
- [ ] Implement LockSnapshotService (before/during/diff)
- [ ] Implement Layer6DetectorService (lock_acquired signal)
- [ ] Implement WalStatsService (pg_stat_wal + pg_stat_bgwriter delta)
- [ ] Implement Layer7DetectorService (wal_amplification signal)
- [ ] Update AnalyzerService pipeline for Layers 6 + 7
- [ ] Build locks tab in analyzer UI
- [ ] Build write path tab (DML only)
- [ ] Test with INSERT/UPDATE/DELETE queries
- [ ] Test lock detection with concurrent operations

## Success Criteria
- Lock tab shows locks acquired during query execution
- Blocked locks highlighted when concurrent access occurs
- WAL delta accurately reflects DML write impact
- wal_amplification fires for full-row updates when only one column changed
- Write path tab hidden for SELECT queries

## Risk Assessment
- **pg_stat_wal availability**: PG 14+ only; check version, gracefully degrade for PG 13
- **Lock polling timing**: 200ms may miss short-lived locks; acceptable for learning tool
- **WAL delta noise**: Other concurrent operations may affect delta; best-effort for sandbox

## Security Considerations
- pg_stat_wal and pg_stat_bgwriter are read-only system views
- Lock polling scoped to query PID only
- No way to see other users' locks (single-tenant sandbox)

## Next Steps
- All 7 layers now complete
- Phase 08 optimizer can use full AnalysisResult including WAL data
