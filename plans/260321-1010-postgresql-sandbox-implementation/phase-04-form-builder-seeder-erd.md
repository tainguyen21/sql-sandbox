# Phase 04 - Form Builder, Data Seeder & ERD Viewer

## Context Links
- [Plan Overview](./plan.md)
- [Spec: Schema Builder Mode B](../../pg-sandbox-prompt%20(1).md) (Section 2)
- [Spec: Data Seeder](../../pg-sandbox-prompt%20(1).md) (Section 3)
- [Spec: ERD Viewer](../../pg-sandbox-prompt%20(1).md) (Section 9)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 14h
- **Blocked by**: Phase 02
- **Description**: Form-based table creation UI, faker-powered data seeder with FK-aware ordering, ERD visualization with React Flow.

## Key Insights
- Form builder generates DDL preview before execution
- `@faker-js/faker` with context-aware column name detection
- Topological sort for FK-aware seeding order
- React Flow + dagre for auto-layout ERD
- CSV/JSON import: infer types from sample rows

## Requirements

### Functional
- **Form builder**: table name + dynamic column rows (name, type, nullable, default, PK, unique, FK)
- DDL preview before execution
- **Seeder**: row count, locale, null probability, custom distributions, FK-aware order
- Seed preview (5 sample rows without insert)
- Save/load seed profiles
- **ERD**: React Flow diagram with tables as nodes, FK edges, crow's foot notation
- Auto-layout with dagre, export as PNG/SVG

### Non-functional
- Seeder handles 10K rows in < 10s (batch INSERT)
- ERD renders < 1s for 20 tables

## Architecture
```
Form UI ──generate DDL──→ Preview ──confirm──→ POST /tables (DDL)
Seeder UI ──config──→ POST /seed ──→ SeederService (topo sort → faker → batch insert)
ERD ──GET /erd──→ React Flow (dagre layout)
```

## Related Code Files

### Files to Create
- `apps/web/components/schema/form-table-builder.tsx`
- `apps/web/components/schema/column-row-form.tsx`
- `apps/web/components/schema/ddl-preview-modal.tsx`
- `apps/web/components/schema/csv-json-import-modal.tsx`
- `apps/api/src/modules/workspace/schema-import.service.ts`
- `apps/api/src/modules/seeder/seeder.module.ts`
- `apps/api/src/modules/seeder/seeder.controller.ts`
- `apps/api/src/modules/seeder/seeder.service.ts`
- `apps/api/src/modules/seeder/faker-mapper.service.ts`
- `apps/api/src/modules/seeder/seed-profile.service.ts`
- `apps/api/src/modules/seeder/dto/seed-options.dto.ts`
- `packages/shared/src/types/seeder.ts`
- `apps/web/components/seeder/seed-config-panel.tsx`
- `apps/web/components/seeder/seed-preview-table.tsx`
- `apps/web/components/seeder/seed-profile-selector.tsx`
- `apps/api/src/modules/erd/erd.module.ts`
- `apps/api/src/modules/erd/erd.controller.ts`
- `apps/api/src/modules/erd/erd.service.ts`
- `packages/shared/src/types/erd.ts`
- `apps/web/components/erd/erd-viewer.tsx`
- `apps/web/components/erd/table-node.tsx`
- `apps/web/components/erd/fk-edge.tsx`

## Implementation Steps

1. **Form table builder** (`apps/web/components/schema/form-table-builder.tsx`)
   - Table name input
   - Dynamic column rows with: name (text), type (dropdown: text, integer, bigint, serial, uuid, boolean, numeric, date, timestamptz, jsonb, varchar), nullable toggle, default value, PK toggle, unique toggle
   - "Add FK" per column: opens picker for target table.column
   - "Add Column" / "Remove Column" buttons
   - Generate DDL string from form state
   - Preview modal shows generated SQL, confirm → execute

2. **DDL generator** (client-side utility)
   - Convert form state to `CREATE TABLE ... (columns, constraints)`
   - Handle PK, UNIQUE, NOT NULL, DEFAULT, FK constraints
   - Output formatted SQL string

3. **Schema import service** (`apps/api/src/modules/workspace/schema-import.service.ts`)
   - Accept CSV/JSON upload via multipart
   - Parse headers and sample rows (first 100 rows)
   - Infer PG types: string→text, integer→integer, float→numeric, ISO date→timestamptz, boolean→boolean
   - Return inferred schema as column definitions
   - Optionally create table + insert data

4. **FakerMapperService** (`apps/api/src/modules/seeder/faker-mapper.service.ts`)
   - Map PG type → faker generator
   - Context-aware: detect column name patterns (email, phone, name, city, price, etc.)
   - Support custom distribution: `{ values: ['active', 'inactive'], weights: [0.7, 0.3] }`
   - Support null probability per nullable column

5. **SeederService** (`apps/api/src/modules/seeder/seeder.service.ts`)
   - `seed(workspaceId, options)`:
     1. Introspect FK constraints from `information_schema.referential_constraints`
     2. Build dependency graph, topological sort
     3. Seed tables in order: generate rows with FakerMapper, batch INSERT (500 rows/batch)
     4. FK columns: sample random IDs from already-seeded parent table
   - `preview(workspaceId, options)`: generate 5 sample rows per table, return without inserting
   - Return row counts per table

6. **Seed profile CRUD** (`apps/api/src/modules/seeder/seed-profile.service.ts`)
   - Save/load seed config as JSON in seed_profiles table
   - List profiles per workspace

7. **Seed config UI** (`apps/web/components/seeder/seed-config-panel.tsx`)
   - Per-table row count input
   - Locale selector dropdown
   - Per-column: null probability slider, custom distribution editor
   - Preview button → shows sample rows in table
   - "Seed" button → execute, show progress
   - Profile save/load dropdown

8. **ERD service** (`apps/api/src/modules/erd/erd.service.ts`)
   - Introspect workspace schema: tables, columns, FK relationships
   - Return graph structure: `{ tables: [{ name, columns: [{ name, type, pk, fk }] }], relationships: [{ from, to, fromColumn, toColumn }] }`

9. **ERD React Flow viewer** (`apps/web/components/erd/erd-viewer.tsx`)
   - Custom table node: header with table name, rows for each column (PK icon, FK icon, name, type)
   - Custom FK edge with crow's foot notation
   - Auto-layout with `@dagrejs/dagre`
   - Click node → open table detail panel
   - Export as PNG via `html-to-image`
   - Minimap, zoom controls

## Todo List
- [ ] Build form table builder with dynamic column rows
- [ ] Implement DDL generator from form state
- [ ] Build DDL preview modal
- [ ] Implement CSV/JSON schema import (type inference)
- [ ] Implement FakerMapperService with context-aware mapping
- [ ] Implement SeederService with topological sort + batch insert
- [ ] Implement seed preview (5 rows without inserting)
- [ ] Build seed config UI (row count, locale, distributions)
- [ ] Implement seed profile save/load
- [ ] Build ERD service (schema introspection → graph)
- [ ] Build React Flow ERD viewer with custom nodes/edges
- [ ] Add dagre auto-layout
- [ ] Add ERD export as PNG

## Success Criteria
- Form builder generates correct DDL for tables with PK, FK, constraints
- Seeder respects FK ordering (parent before child)
- Context-aware faker: "email" column gets email-like data
- ERD shows all tables with FK edges and crow's foot notation
- CSV import infers reasonable PG types from sample data

## Risk Assessment
- **Circular FKs**: Detect cycles in topo sort, report error to user
- **Large seed operations**: Use batch inserts (500/batch), wrap in transaction
- **React Flow performance**: Limit to ~50 tables, use virtualization if needed

## Security Considerations
- File upload: validate MIME type (text/csv, application/json), max 10MB
- Seed data doesn't leave workspace schema boundary
- CSV parsing: use established library (`papaparse`), sanitize values

## Next Steps
- Phase 05: Query Analyzer Core (uses tables + data created here)
