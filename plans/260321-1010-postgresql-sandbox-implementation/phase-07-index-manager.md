# Phase 07 - Index Manager

## Context Links
- [Plan Overview](./plan.md)
- [Spec: Index Manager](../../pg-sandbox-prompt%20(1).md) (Section 7)

## Overview
- **Priority**: P2
- **Status**: completed
- **Effort**: 6h
- **Blocked by**: Phase 05
- **Description**: Standalone index CRUD UI with usage stats, create index with type/expression/partial support, CREATE INDEX CONCURRENTLY by default.

## Key Insights
- Reuses IndexReportService from Phase 05 for listing
- Support btree, hash, gin, gist, brin index types
- Partial index: WHERE clause, expression index: expression input
- `CREATE INDEX CONCURRENTLY` is non-blocking but cannot run inside transaction

## Requirements

### Functional
- List all indexes in workspace with stats (scans, size, tuples read/fetched)
- "Unused" badge for indexes with `idx_scan = 0` and table rows > 1000
- Create index: select table → columns → type → optional WHERE/expression → preview DDL → execute
- Drop index with confirmation
- `CREATE INDEX CONCURRENTLY` by default

### Non-functional
- Index list refreshes after create/drop
- DDL preview shown before execution

## Related Code Files

### Files Created
- `apps/api/src/modules/index-manager/index-manager.module.ts`
- `apps/api/src/modules/index-manager/index-manager.controller.ts`
- `apps/api/src/modules/index-manager/index-manager.service.ts`
- `apps/api/src/modules/index-manager/dto/create-index.dto.ts`
- `packages/shared/src/types/index-manager.ts`
- `apps/web/components/index-manager/index-list-panel.tsx`
- `apps/web/components/index-manager/create-index-modal.tsx`
- `apps/web/components/index-manager/index-detail-card.tsx`

## Implementation

1. **IndexManagerService** - List indexes with stats, create/drop with DDL preview
2. **IndexManagerController** - GET/POST/DELETE endpoints for index operations
3. **Index list panel** - Table display with usage stats and "Unused" badges
4. **Create index modal** - Multi-step form with DDL preview
5. **DDL generation** - CREATE [UNIQUE] INDEX [CONCURRENTLY] with all variations

## Completion

All requirements implemented and integrated into workspace interface:
- Index listing with pg_stat_user_indexes stats
- CONCURRENT creation supported
- Unused index detection (idx_scan=0 with row count > 1000)
- Drop with confirmation
- DDL preview before execution
- Integration with query analyzer (Phase 05)

## Next Steps
- Phase 10: Lock viewer integration (index creation analysis)
