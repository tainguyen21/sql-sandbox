# Phase 05 - Query Analyzer Core (Layers 3 + 4)

## Context Links
- [Plan Overview](./plan.md)
- [Spec: Query Analyzer](../../pg-sandbox-prompt%20(1).md) (Section 5)
- [PG Internals Report](../reports/researcher-260321-1008-postgresql-internals-7layer-analyzer.md)

## Overview
- **Priority**: P1
- **Status**: pending
- **Effort**: 16h
- **Blocked by**: Phase 03
- **Description**: Core query analyzer: EXPLAIN plan parsing, plan tree visualization, Layer 3 (execution nodes) and Layer 4 (index report) signal detection.

## Key Insights
- `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` returns recursive plan tree
- Recursive walk to extract all nodes, compute cost heatmap relative to root
- Signal detection rules: disk_spill, seq_scan_candidate, nested_loop_risk, expensive_sort, unused_index, index_type_mismatch
- React Flow for plan tree with cost heatmap coloring
- Two modes: Plan-only (EXPLAIN) and Full Analysis (EXPLAIN ANALYZE)

## Requirements

### Functional
- Parse EXPLAIN JSON output into typed plan tree
- Plan tree visualization: collapsible nodes, cost heatmap, signal badges
- Click node → detail panel with all fields + plain-language explanation
- Layer 3 signals: disk_spill, seq_scan_candidate, nested_loop_risk, expensive_sort
- Layer 4 signals: unused_index, index_type_mismatch
- Index report tab: all indexes on queried tables, used/unused status, scan counts
- Plan-only mode (no execution) and Full Analysis mode

### Non-functional
- Analysis completes < 5s for typical queries
- Plan tree renders smoothly for plans with 50+ nodes

## Architecture
```
POST /analyze ──→ AnalyzerService
                    ├── EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)
                    ├── pg_indexes + pg_stat_user_indexes
                    └── Signal detection engine
                          ├── Layer 3 detector
                          └── Layer 4 detector
                    ↓
              AnalysisResult { plan, signals, indexes }
                    ↓
              Frontend: Plan Tree (React Flow) + Index Tab + Signals
```

## Related Code Files

### Files to Create
- `apps/api/src/modules/analyzer/analyzer.module.ts`
- `apps/api/src/modules/analyzer/analyzer.controller.ts`
- `apps/api/src/modules/analyzer/analyzer.service.ts`
- `apps/api/src/modules/analyzer/plan-parser.service.ts`
- `apps/api/src/modules/analyzer/signal-detector.service.ts`
- `apps/api/src/modules/analyzer/layer3-detector.service.ts`
- `apps/api/src/modules/analyzer/layer4-detector.service.ts`
- `apps/api/src/modules/analyzer/index-report.service.ts`
- `apps/api/src/modules/analyzer/dto/analyze-query.dto.ts`
- `packages/shared/src/types/analyzer.ts` (PlanNode, PlanSignal, AnalysisResult, IndexReport)
- `apps/web/components/analyzer/analyzer-panel.tsx`
- `apps/web/components/analyzer/plan-tree-viewer.tsx`
- `apps/web/components/analyzer/plan-node-component.tsx`
- `apps/web/components/analyzer/plan-node-detail.tsx`
- `apps/web/components/analyzer/signal-badge.tsx`
- `apps/web/components/analyzer/index-report-tab.tsx`
- `apps/web/components/analyzer/cost-heatmap.ts` (utility)
- `apps/web/hooks/use-analyzer.ts`

## Implementation Steps

1. **Shared types** (`packages/shared/src/types/analyzer.ts`)
   ```typescript
   interface PlanNode {
     nodeType: string; relationName?: string; indexName?: string;
     startupCost: number; totalCost: number;
     planRows: number; actualRows?: number;
     actualTotalTime?: number; actualLoops?: number;
     sharedHitBlocks?: number; sharedReadBlocks?: number;
     filter?: string; output?: string[];
     children: PlanNode[];
     signals: PlanSignal[];
     costRatio: number; // 0-1 relative to root
   }
   interface PlanSignal { layer, type, severity, nodeType?, table?, message, explanation, suggestion }
   interface IndexReport { indexName, tableName, columns, type, size, idxScan, used, reason? }
   interface AnalysisResult { plan: PlanNode; signals: PlanSignal[]; indexes: IndexReport[]; executionTime?: number; planningTime?: number; }
   ```

2. **PlanParserService** (`apps/api/src/modules/analyzer/plan-parser.service.ts`)
   - Parse `EXPLAIN ... FORMAT JSON` output (array with one element containing `Plan`)
   - Recursive walk: convert PG JSON keys (e.g. `Node Type`) to camelCase typed `PlanNode`
   - Compute `costRatio` for each node: `node.totalCost / rootNode.totalCost`
   - Extract all table names referenced in plan

3. **Layer3DetectorService** (`apps/api/src/modules/analyzer/layer3-detector.service.ts`)
   - Walk plan tree, check each node:
   - `disk_spill`: Hash node with `Batches > 1` OR Sort node with `Sort Method = external merge`
   - `seq_scan_candidate`: Seq Scan + `Plan Rows > 1000` + filter condition present
   - `nested_loop_risk`: Nested Loop + inner side has no index + `Plan Rows > 100`
   - `expensive_sort`: Sort node cost > 20% of root total cost
   - Each signal includes message, explanation (plain English), suggestion

4. **Layer4DetectorService** (`apps/api/src/modules/analyzer/layer4-detector.service.ts`)
   - Query `pg_indexes` + `pg_stat_user_indexes` for all tables in plan
   - `unused_index`: index exists, `idx_scan = 0`, table rows > 500
   - `index_type_mismatch`: detect LIKE '%...' with btree (needs GIN/pg_trgm), JSONB containment with btree (needs GIN)
   - Parse WHERE clauses from plan nodes to detect operator patterns

5. **IndexReportService** (`apps/api/src/modules/analyzer/index-report.service.ts`)
   - Query `pg_indexes JOIN pg_stat_user_indexes JOIN pg_class` for tables in plan
   - Return: index name, table, columns, type, size, idx_scan count, used/not-used/bitmap status
   - For unused: determine reason (wrong leading column, type mismatch, cost threshold)

6. **AnalyzerService** (`apps/api/src/modules/analyzer/analyzer.service.ts`)
   - `analyze(workspaceId, sql, mode: 'plan' | 'full')`:
     - Plan mode: `EXPLAIN (VERBOSE, FORMAT JSON) ${sql}`
     - Full mode: `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ${sql}`
   - Parse plan with PlanParserService
   - Run Layer3 + Layer4 detection
   - Aggregate signals, return AnalysisResult

7. **AnalyzerController** (`apps/api/src/modules/analyzer/analyzer.controller.ts`)
   - `POST /workspaces/:id/analyze` → full analysis
   - `POST /workspaces/:id/analyze/plan` → plan-only mode

8. **Plan tree viewer** (`apps/web/components/analyzer/plan-tree-viewer.tsx`)
   - React Flow with custom nodes
   - Each node: colored background (cost heatmap: green→yellow→red based on costRatio)
   - Show: node type icon, estimated vs actual rows, time, buffers
   - Signal badges on nodes (warning/critical icons)
   - Collapsible subtrees
   - Auto-layout with dagre (top-to-bottom)

9. **Plan node detail panel** (`apps/web/components/analyzer/plan-node-detail.tsx`)
   - Click node → side panel
   - Full node JSON fields
   - Plain-language explanation of what this node type does
   - List of signals attached to this node

10. **Cost heatmap utility** (`apps/web/components/analyzer/cost-heatmap.ts`)
    - Input: costRatio (0-1), output: RGB color
    - 0.0-0.3: green shades, 0.3-0.7: yellow, 0.7-1.0: red

11. **Index report tab** (`apps/web/components/analyzer/index-report-tab.tsx`)
    - Table: index name, table, columns, type, size, scans, status badge (Used/Unused/Bitmap)
    - Unused indexes highlighted with warning
    - Click → show signal details

12. **Analyzer panel** (`apps/web/components/analyzer/analyzer-panel.tsx`)
    - Tabs: Plan Tree | Index Report | (more tabs added in later phases)
    - "Analyze" button: choose Plan-only or Full Analysis
    - DML warning modal before Full Analysis on INSERT/UPDATE/DELETE
    - Summary bar: total time, planning time, signal count by severity

## Todo List
- [ ] Define shared analyzer types (PlanNode, PlanSignal, IndexReport, AnalysisResult)
- [ ] Implement PlanParserService (recursive JSON → typed tree)
- [ ] Implement Layer3DetectorService (4 signal types)
- [ ] Implement Layer4DetectorService (2 signal types)
- [ ] Implement IndexReportService
- [ ] Implement AnalyzerService (orchestrates parse + detect)
- [ ] Implement AnalyzerController (plan + full endpoints)
- [ ] Build plan tree viewer with React Flow + cost heatmap
- [ ] Build plan node detail panel
- [ ] Build index report tab
- [ ] Build analyzer panel with tabs
- [ ] Test with various query types (simple select, join, subquery, aggregate)

## Success Criteria
- EXPLAIN JSON parsed correctly for all common plan node types
- Cost heatmap visually identifies expensive nodes
- Signal detection catches: seq scan with filter, disk spill, unused index
- Plan tree renders correctly for multi-join queries
- Index report shows all indexes with usage stats

## Risk Assessment
- **Complex plan trees**: Ensure recursive parser handles all PG node types (40+ types)
- **Cost heatmap misleading**: Use actual time when available (ANALYZE mode), fall back to estimated cost
- **DML in full mode**: Wrap in transaction + rollback for SELECT safety (EXPLAIN ANALYZE on DML actually modifies data)

## Security Considerations
- EXPLAIN ANALYZE on DML: warn user, wrap in transaction, auto-rollback
- Don't expose raw system catalog data beyond what's needed for signals
- Rate limit analysis: max 5/min per workspace

## Next Steps
- Phase 06: Layers 1, 2, 5 (planner context, stats, MVCC)
- Phase 07: Index manager (standalone, builds on Layer 4 data)
