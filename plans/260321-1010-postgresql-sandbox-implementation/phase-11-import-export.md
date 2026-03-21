# Phase 11 - Import/Export

## Context Links
- [Plan Overview](./plan.md)
- [Spec: Import/Export](../../pg-sandbox-prompt%20(1).md) (Section 10)

## Overview
- **Priority**: P3
- **Status**: completed
- **Effort**: 8h
- **Blocked by**: Phase 02
- **Description**: CSV/JSON/SQL file import, CSV export per table (streamed), full workspace SQL dump export.

## Key Insights
- CSV import: detect delimiter with `csv-parse`, infer types from sample rows (reuse schema-import logic from Phase 04)
- JSON import: array of objects → same as CSV flow
- SQL import: execute raw DDL/DML after validation
- Export: manual DDL generation (not pg_dump CLI) for portability
- Stream large CSV exports to avoid memory issues

## Requirements

### Functional
- **Import CSV**: detect delimiter, infer types, create table or append to existing
- **Import JSON**: array of objects → column inference → create/append
- **Import SQL**: validate, execute as DDL/DML
- **Export table as CSV**: streamed download
- **Export workspace as SQL**: generate DDL + INSERT statements for all tables
- File upload via multipart, max 50MB

### Non-functional
- CSV export streams (no full load in memory)
- SQL dump generates valid, re-importable SQL

## Related Code Files

### Files to Create
- `apps/api/src/modules/import-export/import-export.module.ts`
- `apps/api/src/modules/import-export/import-export.controller.ts`
- `apps/api/src/modules/import-export/import.service.ts`
- `apps/api/src/modules/import-export/export.service.ts`
- `apps/api/src/modules/import-export/csv-parser.service.ts`
- `apps/api/src/modules/import-export/sql-dump-generator.service.ts`
- `apps/api/src/modules/import-export/dto/import-options.dto.ts`
- `packages/shared/src/types/import-export.ts`
- `apps/web/components/import-export/import-modal.tsx`
- `apps/web/components/import-export/import-preview.tsx`
- `apps/web/components/import-export/export-menu.tsx`

## Implementation Steps

1. **CsvParserService** (`apps/api/src/modules/import-export/csv-parser.service.ts`)
   - Use `csv-parse` (or `papaparse` server-side) to parse uploaded CSV
   - Auto-detect delimiter (comma, semicolon, tab)
   - Return headers + sample rows (first 100)
   - Reuse type inference from Phase 04 schema-import

2. **ImportService** (`apps/api/src/modules/import-export/import.service.ts`)
   - `importCSV(workspaceId, file, options)`:
     1. Parse CSV → headers + types
     2. If `createTable`: generate CREATE TABLE DDL, execute
     3. Batch INSERT rows (500/batch)
   - `importJSON(workspaceId, file, options)`: convert JSON array to rows, same flow as CSV
   - `importSQL(workspaceId, file)`: read SQL, validate with SqlValidator, execute statements
   - Return: { rowsInserted, tableName, errors }

3. **ExportService** (`apps/api/src/modules/import-export/export.service.ts`)
   - `exportTableCSV(workspaceId, tableName)`:
     1. Query row count
     2. Stream with cursor: `DECLARE cursor FOR SELECT * FROM table`
     3. Pipe to CSV string via `csv-stringify`
     4. Return as streamed response
   - `exportWorkspaceSQL(workspaceId)`:
     1. Get all tables in dependency order (topo sort by FK)
     2. For each table: generate CREATE TABLE DDL from information_schema
     3. For each table: SELECT all rows, generate INSERT statements (500/batch)
     4. Include CREATE INDEX statements
     5. Return combined SQL string

4. **SqlDumpGeneratorService** (`apps/api/src/modules/import-export/sql-dump-generator.service.ts`)
   - `generateTableDDL(schemaName, tableName)`: build CREATE TABLE from info schema
   - `generateInserts(schemaName, tableName, rows)`: build INSERT VALUES statements
   - `generateIndexDDL(schemaName, tableName)`: build CREATE INDEX statements
   - Handle: proper escaping, NULL values, array types, JSONB

5. **ImportExportController**
   - `POST /workspaces/:id/import` → multipart upload (CSV/JSON/SQL)
   - `GET /workspaces/:id/tables/:table/export?format=csv` → stream CSV
   - `GET /workspaces/:id/export` → full SQL dump download

6. **Import modal** (`apps/web/components/import-export/import-modal.tsx`)
   - File picker (drag & drop)
   - Auto-detect format (CSV/JSON/SQL by extension)
   - For CSV/JSON: show preview of inferred schema + sample rows
   - Options: create new table or append to existing
   - Confirm → upload and import

7. **Export menu** (`apps/web/components/import-export/export-menu.tsx`)
   - Per-table: "Export as CSV" button
   - Workspace level: "Export workspace as SQL" button
   - Triggers file download

## Todo List
- [ ] Implement CsvParserService (delimiter detection, parsing)
- [ ] Implement ImportService (CSV, JSON, SQL)
- [ ] Implement ExportService (CSV stream, SQL dump)
- [ ] Implement SqlDumpGeneratorService
- [ ] Implement ImportExportController
- [ ] Build import modal with preview
- [ ] Build export menu (per-table CSV + workspace SQL)
- [ ] Test CSV import with various delimiters and types
- [ ] Test SQL dump roundtrip (export → import → verify)

## Success Criteria
- CSV import detects delimiter and infers reasonable PG types
- JSON array import creates correct table structure
- SQL import executes valid DDL/DML
- CSV export streams without loading full table in memory
- SQL dump export generates re-importable SQL
- Roundtrip: export → import into new workspace → identical schema + data

## Risk Assessment
- **Large file uploads**: 50MB limit, stream parsing (don't load full file in memory)
- **SQL injection via CSV values**: Use parameterized INSERT ($1, $2...), never string interpolation
- **Encoding issues**: Default UTF-8, detect BOM, handle common encodings

## Security Considerations
- File type validation (extension + content sniffing)
- SQL import goes through full SqlValidator validation
- CSV values parameterized (no injection)
- Upload size limit: 50MB configurable
- No filesystem access (COPY TO/FROM blocked)

## Next Steps
- This is the final phase. All features complete.
- Consider: pgvector support, pg_stat_statements integration (stretch goals)
