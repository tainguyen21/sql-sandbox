# Phase 07 - Index Manager

## Context Links
- [Plan Overview](./plan.md)
- [Spec: Index Manager](../../pg-sandbox-prompt%20(1).md) (Section 7)

## Overview
- **Priority**: P2
- **Status**: pending
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

### Files to Create
- `apps/api/src/modules/index-manager/index-manager.module.ts`
- `apps/api/src/modules/index-manager/index-manager.controller.ts`
- `apps/api/src/modules/index-manager/index-manager.service.ts`
- `apps/api/src/modules/index-manager/dto/create-index.dto.ts`
- `packages/shared/src/types/index-manager.ts`
- `apps/web/components/index-manager/index-list-panel.tsx`
- `apps/web/components/index-manager/create-index-modal.tsx`
- `apps/web/components/index-manager/index-detail-card.tsx`

## Implementation Steps

1. **IndexManagerService** (`apps/api/src/modules/index-manager/index-manager.service.ts`)
   - `listIndexes(workspaceId)`: reuse IndexReportService query (pg_indexes + pg_stat_user_indexes + pg_class for size)
   - `createIndex(workspaceId, dto)`: generate DDL from dto (table, columns, type, unique, concurrent, where, expression), validate, execute
   - `dropIndex(workspaceId, indexName)`: `DROP INDEX IF EXISTS`
   - DDL generation: `CREATE [UNIQUE] INDEX [CONCURRENTLY] idx_name ON table [USING type] (columns|expression) [WHERE clause]`

2. **IndexManagerController**
   - `GET /workspaces/:id/indexes` → listIndexes
   - `POST /workspaces/:id/indexes` → createIndex
   - `DELETE /workspaces/:id/indexes/:name` → dropIndex

3. **Index list panel** (`apps/web/components/index-manager/index-list-panel.tsx`)
   - Table: index name, table, columns, type (btree/hash/gin/gist/brin), size, idx_scan, tuples read, tuples fetched
   - "Unused" badge (red) for idx_scan=0 + rows > 1000
   - Drop button per index
   - "Create Index" button → opens modal

4. **Create index modal** (`apps/web/components/index-manager/create-index-modal.tsx`)
   - Step 1: Select table (dropdown)
   - Step 2: Select columns (multi-select for composite) OR enter expression
   - Step 3: Choose index type (btree default, hash, gin, gist, brin)
   - Step 4: Options: unique toggle, concurrent toggle (default on), partial WHERE clause input
   - Preview: show generated DDL
   - Confirm → execute

## Todo List
- [ ] Implement IndexManagerService (list, create, drop)
- [ ] Implement IndexManagerController
- [ ] Build index list panel with usage stats
- [ ] Build create index modal (multi-step form)
- [ ] Add DDL preview before execution
- [ ] Add "Unused" badge logic
- [ ] Test with various index types (btree, gin, partial)

## Success Criteria
- Index list shows all workspace indexes with accurate stats
- Create index generates correct DDL for all types
- CONCURRENTLY works (not inside transaction)
- Unused badges appear for indexes with 0 scans

## Risk Assessment
- **CONCURRENTLY limitation**: Cannot run in transaction, need separate connection or autocommit
- **Expression indexes**: Validate expression syntax before execution
- **Index naming**: Auto-generate sensible names `idx_{table}_{columns}_{type}`

## Security Considerations
- Index DDL validated by SqlValidatorService
- Only workspace-scoped tables allowed
- Block index creation on system tables

## Next Steps
- Phase 08: AI optimizer can suggest index creation
