# Phase 02 - Workspace & Schema Builder (SQL Mode)

## Context Links
- [Plan Overview](./plan.md)
- [Spec: Workspace Manager](../../pg-sandbox-prompt%20(1).md) (Section 1)
- [Spec: Schema Builder](../../pg-sandbox-prompt%20(1).md) (Section 2)

## Overview
- **Priority**: P1
- **Status**: pending
- **Effort**: 12h
- **Blocked by**: Phase 01
- **Description**: Workspace CRUD with schema isolation, SQL-mode table creation via Monaco, table introspection.

## Key Insights
- Each workspace = one PG schema (`workspace_{uuid_short}`)
- `SET search_path` before every sandbox query
- Use `information_schema.columns` + `information_schema.table_constraints` for introspection
- `pgsql-parser` npm package for SQL validation before execution

## Requirements

### Functional
- Create/list/delete workspaces (each creates/drops a PG schema)
- SQL-mode schema builder: execute DDL against workspace schema
- Introspect tables: list tables, column details, constraints, indexes
- ALTER TABLE: add/drop columns, rename, change type
- DROP TABLE with confirmation
- Clone table structure

### Non-functional
- Schema operations < 500ms
- Search path isolation must be bulletproof (no cross-workspace leakage)

## Architecture
```
Frontend (Next.js)                    Backend (NestJS)
┌─────────────────┐                  ┌──────────────────────┐
│ WorkspaceSidebar │ ──POST/GET───→  │ WorkspaceController  │
│ SchemaEditor     │                 │   WorkspaceService   │
│ TableList        │                 │   SandboxPoolService │
└─────────────────┘                  └──────────────────────┘
                                              │
                                     ┌────────┴────────┐
                                     │ System DB        │ Sandbox DB
                                     │ (Drizzle ORM)    │ (raw pg)
                                     └─────────────────┘
```

## Related Code Files

### Files to Create
- `apps/api/src/modules/workspace/workspace.module.ts`
- `apps/api/src/modules/workspace/workspace.controller.ts`
- `apps/api/src/modules/workspace/workspace.service.ts`
- `apps/api/src/modules/workspace/dto/create-workspace.dto.ts`
- `apps/api/src/modules/workspace/dto/alter-table.dto.ts`
- `apps/api/src/modules/database/sandbox-pool.service.ts`
- `apps/api/src/modules/database/database.module.ts`
- `apps/api/src/modules/database/sql-validator.service.ts`
- `packages/shared/src/types/workspace.ts`
- `packages/shared/src/types/schema.ts`
- `apps/web/app/workspaces/page.tsx`
- `apps/web/app/workspaces/[id]/page.tsx`
- `apps/web/app/workspaces/[id]/layout.tsx`
- `apps/web/components/workspace/workspace-sidebar.tsx`
- `apps/web/components/workspace/workspace-create-modal.tsx`
- `apps/web/components/schema/table-list-panel.tsx`
- `apps/web/components/schema/sql-schema-editor.tsx`
- `apps/web/components/schema/table-detail-panel.tsx`

## Implementation Steps

1. **SandboxPoolService** (`apps/api/src/modules/database/sandbox-pool.service.ts`)
   - Manage a pg Pool for sandbox DB (separate from Drizzle system pool)
   - `executeInWorkspace(schemaName: string, sql: string)`: acquires client, sets search_path, executes, releases
   - `createSchema(name: string)`: `CREATE SCHEMA IF NOT EXISTS`
   - `dropSchema(name: string)`: `DROP SCHEMA CASCADE`
   - Connection pooling: max 20 connections, idle timeout 30s

2. **SqlValidatorService** (`apps/api/src/modules/database/sql-validator.service.ts`)
   - Use `pgsql-parser` to parse SQL before execution
   - Block: `DROP SCHEMA`, `CREATE DATABASE`, `pg_read_file`, `COPY TO/FROM`, `SET ROLE`
   - Reject any DDL referencing schemas outside workspace

3. **WorkspaceService** (`apps/api/src/modules/workspace/workspace.service.ts`)
   - `create(dto)`: insert into system DB (Drizzle), create PG schema
   - `findAll()`: query system DB
   - `findOne(id)`: query system DB
   - `remove(id)`: drop PG schema, delete from system DB
   - `getTables(id)`: query `information_schema.tables` WHERE `table_schema = schemaName`
   - `getTableDetail(id, table)`: query columns, constraints, indexes from info schema
   - `executeDDL(id, sql)`: validate with SqlValidator, execute in workspace
   - `alterTable(id, table, ops)`: build ALTER TABLE from dto, execute
   - `dropTable(id, table)`: `DROP TABLE IF EXISTS`
   - `cloneTable(id, source, target)`: `CREATE TABLE target (LIKE source INCLUDING ALL)`

4. **WorkspaceController** (`apps/api/src/modules/workspace/workspace.controller.ts`)
   - `POST /workspaces` → create
   - `GET /workspaces` → findAll
   - `GET /workspaces/:id` → findOne
   - `DELETE /workspaces/:id` → remove
   - `POST /workspaces/:id/tables` → executeDDL
   - `GET /workspaces/:id/tables` → getTables
   - `GET /workspaces/:id/tables/:table` → getTableDetail
   - `PUT /workspaces/:id/tables/:table` → alterTable
   - `DELETE /workspaces/:id/tables/:table` → dropTable

5. **Frontend: Workspace sidebar** (`apps/web/components/workspace/workspace-sidebar.tsx`)
   - Fetch workspaces list, display in sidebar
   - Active workspace highlighted
   - "New workspace" button → modal

6. **Frontend: Workspace create modal** (`apps/web/components/workspace/workspace-create-modal.tsx`)
   - Name, description inputs
   - Template picker (Phase 2 stretch, can be empty initially)
   - Submit → POST /workspaces → redirect to workspace page

7. **Frontend: Table list panel** (`apps/web/components/schema/table-list-panel.tsx`)
   - List tables in active workspace
   - Click table → show columns, constraints, indexes in detail panel
   - Delete button per table

8. **Frontend: SQL schema editor** (`apps/web/components/schema/sql-schema-editor.tsx`)
   - Monaco editor in SQL mode (basic, full autocomplete in Phase 03)
   - Execute button runs DDL against workspace
   - Show success/error toast
   - Refresh table list on success

## Todo List
- [ ] Create SandboxPoolService with search_path isolation
- [ ] Create SqlValidatorService with blocklist
- [ ] Implement WorkspaceService (CRUD + table introspection)
- [ ] Implement WorkspaceController with all endpoints
- [ ] Create shared types for workspace and schema
- [ ] Build workspace sidebar component
- [ ] Build workspace create modal
- [ ] Build table list panel
- [ ] Build SQL schema editor with Monaco (basic)
- [ ] Build table detail panel
- [ ] Write integration tests for workspace CRUD
- [ ] Test schema isolation (workspace A cannot see workspace B tables)

## Success Criteria
- Create workspace → PG schema created → tables visible only in that workspace
- DDL execution works with search_path scoping
- Blocked SQL (DROP SCHEMA, etc.) returns 400 error
- Table introspection returns columns, types, constraints, indexes
- ALTER TABLE operations work (add/drop/rename columns)

## Risk Assessment
- **Search path injection**: Always parameterize schema names, use allowlist regex `^workspace_[a-z0-9]+$`
- **Pool exhaustion**: Set max connections, release clients in finally blocks
- **Orphaned schemas**: If system DB delete succeeds but schema drop fails, add cleanup job

## Security Considerations
- SQL validation blocks dangerous operations before execution
- Schema name validation: alphanumeric + underscore only
- No superuser access from sandbox pool
- Rate limit DDL operations (10/min per workspace)

## Next Steps
- Phase 03: Monaco SQL editor with autocomplete, query execution, history
- Phase 04: Form-mode table builder, data seeder, ERD viewer
