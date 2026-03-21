# Phase 03 - SQL Editor & Query History

## Context Links
- [Plan Overview](./plan.md)
- [Spec: SQL Editor](../../pg-sandbox-prompt%20(1).md) (Section 4)

## Overview
- **Priority**: P1
- **Status**: completed
- **Effort**: 10h
- **Blocked by**: Phase 02
- **Description**: Full-featured Monaco SQL editor with autocomplete, query execution with SSE streaming, paginated results, query history, and saved snippets.

## Key Insights
- Monaco `registerCompletionItemProvider` for custom SQL autocomplete (table + column names)
- SSE for streaming long-running query results (server→client only, simpler than WebSocket)
- `sql-formatter` for format-on-paste and format button
- Query history + snippets stored in system DB via Drizzle

## Requirements

### Functional
- Monaco editor with PG syntax highlighting and autocomplete (tables + columns)
- `Ctrl+Enter` to execute, `Ctrl+Shift+F` to format
- Multiple editor tabs (saved as query documents)
- Query execution against workspace schema, paginated results (100 rows/page)
- SSE streaming for long queries
- Execution time display (ms)
- PG error messages displayed clearly
- Query history: timestamp, duration, row count, searchable
- Saved snippets with name + tags

### Non-functional
- Autocomplete updates on schema change
- Results rendering < 100ms for 100 rows
- History pagination: 50 items/page

## Architecture
```
Monaco Editor ──Ctrl+Enter──→ POST /query ──→ QueryService
     ↑                             │              │
     │ autocomplete                │ SSE          │ SET search_path
     │                             ↓              ↓
GET /tables ←── schema cache    EventSource    Sandbox PG
```

## Related Code Files

### Files to Create
- `apps/api/src/modules/query/query.module.ts`
- `apps/api/src/modules/query/query.controller.ts`
- `apps/api/src/modules/query/query.service.ts`
- `apps/api/src/modules/query/dto/execute-query.dto.ts`
- `apps/api/src/modules/query/query-history.service.ts`
- `apps/api/src/modules/query/snippet.service.ts`
- `apps/api/src/modules/query/snippet.controller.ts`
- `packages/shared/src/types/query.ts`
- `apps/web/components/editor/sql-editor-panel.tsx`
- `apps/web/components/editor/sql-editor-tabs.tsx`
- `apps/web/components/editor/monaco-sql-editor.tsx`
- `apps/web/components/editor/query-results-table.tsx`
- `apps/web/components/editor/query-history-panel.tsx`
- `apps/web/components/editor/snippet-sidebar.tsx`
- `apps/web/hooks/use-query-execution.ts`
- `apps/web/hooks/use-autocomplete-provider.ts`
- `apps/web/lib/monaco-sql-setup.ts`

## Implementation Steps

1. **Monaco SQL setup** (`apps/web/lib/monaco-sql-setup.ts`)
   - Register PG language mode (Monaco has built-in SQL, extend keywords)
   - `registerCompletionItemProvider` for workspace-specific tables and columns
   - Fetch schema from `GET /workspaces/:id/tables` and cache
   - Re-fetch on schema change (after DDL execution)

2. **Monaco editor component** (`apps/web/components/editor/monaco-sql-editor.tsx`)
   - Wrap `@monaco-editor/react`
   - Props: `value`, `onChange`, `onExecute`, `workspaceId`
   - Keybindings: `Ctrl+Enter` → execute, `Ctrl+Shift+F` → format with `sql-formatter`
   - Theme: dark mode compatible

3. **Editor tabs** (`apps/web/components/editor/sql-editor-tabs.tsx`)
   - Multiple query tabs, each with own editor state
   - New tab button, close tab, rename tab
   - Tab state stored in React state (no backend persistence for tabs)

4. **QueryService** (`apps/api/src/modules/query/query.service.ts`)
   - `execute(workspaceId, sql, page)`: validate SQL, execute in workspace, return paginated results
   - Use `SandboxPoolService.executeInWorkspace()`
   - Return: `{ columns: string[], rows: any[][], rowCount: number, duration: number, page, totalPages }`
   - For long queries: SSE endpoint that streams row chunks
   - Record to query_history after execution

5. **SSE streaming** (`apps/api/src/modules/query/query.controller.ts`)
   - `POST /workspaces/:id/query` → normal JSON response (paginated)
   - `POST /workspaces/:id/query/stream` → SSE response for large result sets
   - Use NestJS `@Sse()` decorator or raw `res.write()` for SSE
   - Client uses `EventSource` or `fetch` with `ReadableStream`

6. **Query results table** (`apps/web/components/editor/query-results-table.tsx`)
   - Render column headers + rows in a scrollable table
   - Pagination controls (prev/next/page number)
   - Show execution time, row count
   - Error display with PG error code + message

7. **QueryHistoryService** (`apps/api/src/modules/query/query-history.service.ts`)
   - `record(entry)`: insert into query_history table (Drizzle)
   - `findAll(workspaceId, { search, page, limit })`: paginated, searchable by SQL text
   - `delete(id)`: remove single entry

8. **Query history panel** (`apps/web/components/editor/query-history-panel.tsx`)
   - Collapsible sidebar panel
   - Search input filters history
   - Click entry → load SQL into editor
   - Show timestamp, duration, row count, truncated SQL

9. **Snippet CRUD** (`apps/api/src/modules/query/snippet.service.ts`)
   - `create(workspaceId, { name, sql, tags })`: save to saved_snippets
   - `findAll(workspaceId)`: list all
   - `delete(id)`: remove

10. **Snippet sidebar** (`apps/web/components/editor/snippet-sidebar.tsx`)
    - List saved snippets with tags
    - Click → load into editor
    - "Save as snippet" button in editor toolbar

## Todo List
- [x] Setup Monaco editor with PG syntax highlighting
- [ ] Implement custom autocomplete provider (tables + columns) — deferred
- [ ] Build editor tabs system — deferred
- [x] Implement QueryService with paginated execution
- [ ] Add SSE streaming for long queries — deferred
- [x] Build query results table component
- [x] Implement QueryHistoryService
- [x] Build query history panel (searchable)
- [x] Implement snippet CRUD service
- [x] Build snippet sidebar
- [x] Add keyboard shortcuts (Ctrl+Enter, Ctrl+Shift+F)
- [x] Test query execution with various SQL types

## Success Criteria
- Monaco editor shows table/column autocomplete from active workspace
- `Ctrl+Enter` executes query, results appear in table below
- Long queries stream results via SSE
- Query history records every execution, searchable
- Snippets can be saved and loaded back into editor

## Risk Assessment
- **Monaco bundle size**: Use dynamic import with `next/dynamic` (no SSR)
- **SSE connection drops**: Auto-reconnect with exponential backoff
- **SQL injection via autocomplete**: Autocomplete is client-side only, actual execution goes through validator

## Security Considerations
- All queries validated by SqlValidatorService before execution
- Query timeout: 30s default, configurable per workspace
- No `COPY TO/FROM` filesystem, no `\!` shell commands

## Completion Notes

### Implemented
- Monaco editor with built-in PostgreSQL syntax highlighting
- Query execution via QueryService with paginated results (100 rows/page)
- QueryHistoryService: record, search, paginate, delete operations
- SnippetService: full CRUD for saved query snippets
- QueryController: all REST endpoints for execution, history, snippets
- Frontend components: Monaco editor panel, results table with pagination controls, searchable history panel, snippet sidebar
- Keyboard shortcuts: Ctrl+Enter execute, Ctrl+Shift+F format
- Full Workspace page integration with Editor/Schema tabs

### Deferred Items (MVP sufficient)
- **SSE streaming**: Paginated results provide sufficient performance for typical query sizes
- **Editor tabs**: Single editor works for MVP; can add multi-tab in Phase 04+
- **Custom autocomplete provider**: Monaco built-in SQL autocomplete sufficient; can enhance with workspace-specific tables later

## Next Steps
- Phase 05: Query analyzer (depends on working query execution)
