# PostgreSQL Sandbox — System Build Prompt

## Project overview

Build a self-hosted **PostgreSQL Sandbox** web application — an interactive learning and debugging platform where developers can create schemas, seed mock data, write queries, and deeply analyze query execution. The system is also a learning tool, so every technical result (plan nodes, index choices, lock types) must be explained in plain language alongside the raw data.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router, TypeScript) |
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL 15+ |
| ORM / query | Drizzle ORM or raw `pg` driver (no Prisma) |
| Job queue | BullMQ (Redis-backed) for long-running analysis jobs |
| Real-time | Socket.IO or Server-Sent Events for live query progress |
| UI components | shadcn/ui + Tailwind CSS |
| Code editor | Monaco Editor (SQL mode) |
| Diagram / ERD | React Flow or mermaid.js |
| Auth | NextAuth.js (optional for multi-user) |
| Package manager | pnpm (monorepo: `apps/web`, `apps/api`) |

---

## Architecture overview

```
apps/
  web/          # Next.js frontend
  api/          # NestJS backend
packages/
  db/           # Drizzle schema + migrations for the system's own metadata
  shared/       # Shared TypeScript types
```

The NestJS backend manages:
- **System DB**: stores workspaces, saved queries, seed profiles, query history (PostgreSQL)
- **Sandbox connections**: dynamically creates isolated PostgreSQL schemas per workspace (not separate databases — use `search_path` scoped connections via `pg` pool)

Each workspace = one PostgreSQL schema (e.g. `workspace_abc123`). All user-created tables live inside that schema. The system's own metadata lives in the `public` schema (or a dedicated `_system` schema).

---

## Feature specifications

---

### 1. Workspace manager

**Purpose**: Isolate each user's tables, queries, and sessions into independent environments.

**Data model** (system DB):
```sql
workspaces (
  id uuid PK,
  name text,
  schema_name text UNIQUE,  -- e.g. "workspace_abc123"
  description text,
  template_id uuid REFERENCES workspace_templates,
  created_at timestamptz,
  updated_at timestamptz
)

workspace_templates (
  id uuid PK,
  name text,              -- e.g. "E-commerce starter", "Blog schema"
  schema_sql text,        -- DDL to seed the template schema
  description text
)
```

**API endpoints** (NestJS):
- `POST /workspaces` — create workspace, run `CREATE SCHEMA workspace_{id}` on sandbox DB
- `GET /workspaces` — list all workspaces
- `DELETE /workspaces/:id` — drop schema + all tables inside
- `POST /workspaces/:id/export` — pg_dump the schema as SQL string and return for download
- `POST /workspaces/:id/clone` — duplicate schema with all tables and data

**Frontend** (Next.js):
- Workspace switcher in sidebar
- "New workspace" modal with optional template picker
- Export button triggers download of `.sql` file

---

### 2. Schema builder

**Purpose**: Let users define tables without needing to know SQL — or with SQL if they prefer.

**Two creation modes:**

**Mode A — SQL editor:**
- Monaco Editor with PostgreSQL syntax highlighting
- User types `CREATE TABLE ...` and submits
- Backend executes against the active workspace schema using `SET search_path = workspace_{id}`
- Parse and reflect the result back using `information_schema.columns`

**Mode B — Form UI:**
- Dynamic form: table name input + rows for each column
- Each column row has: name, data type (dropdown), nullable toggle, default value, PK toggle, unique toggle
- "Add FK" button opens a column picker referencing existing workspace tables
- On submit, backend generates and executes the `CREATE TABLE` DDL
- Show the generated SQL to the user before executing (preview step)

**Additional operations:**
- **Import schema from CSV/JSON**: infer column names and types from file headers and sample rows. Map JS types to PostgreSQL types (string → `text`, number with decimals → `numeric`, integer → `integer`, ISO date string → `timestamptz`).
- **Clone table structure**: `CREATE TABLE new_name (LIKE existing_name INCLUDING ALL)`
- **ALTER TABLE UI**: add/drop columns, rename, change type (with casting warning), add/drop constraints
- **Drop table** with confirmation dialog

**API endpoints:**
- `POST /workspaces/:id/tables` — execute DDL (SQL mode or form mode)
- `GET /workspaces/:id/tables` — list tables with column metadata from `information_schema`
- `GET /workspaces/:id/tables/:table` — get column details, constraints, indexes
- `PUT /workspaces/:id/tables/:table` — ALTER TABLE operations
- `DELETE /workspaces/:id/tables/:table` — DROP TABLE
- `POST /workspaces/:id/tables/import` — infer schema from uploaded CSV/JSON

---

### 3. Data seeder

**Purpose**: Populate tables with realistic mock data that respects types and constraints.

**Generator strategy** (use `@faker-js/faker`):

Map PostgreSQL column types to faker generators:
```
integer, serial, bigint    → faker.number.int()
numeric, decimal, float    → faker.number.float()
text, varchar              → faker.lorem.words() or context-aware (see below)
uuid                       → faker.string.uuid()
boolean                    → faker.datatype.boolean()
date                       → faker.date.past()
timestamptz                → faker.date.recent()
jsonb                      → faker.helpers.arrayElement([...sample objects])
```

**Context-aware generation** — detect column name patterns:
```
name, full_name            → faker.person.fullName()
first_name                 → faker.person.firstName()
last_name                  → faker.person.lastName()
email                      → faker.internet.email()
phone                      → faker.phone.number()
address                    → faker.location.streetAddress()
city                       → faker.location.city()
country                    → faker.location.country()
url, website               → faker.internet.url()
title                      → faker.lorem.sentence()
description, bio           → faker.lorem.paragraph()
price, amount              → faker.commerce.price()
status                     → faker.helpers.arrayElement(['active','inactive','pending'])
```

**FK-aware seeding order:**
1. Introspect FK constraints from `information_schema.referential_constraints`
2. Build a dependency graph (topological sort)
3. Seed tables in dependency order so FK values always reference existing rows
4. For FK columns, sample random IDs from already-seeded parent tables

**Seed options UI:**
- Row count per table (default: 50)
- Locale selector (faker locale: `en`, `vi`, `ja`, etc.)
- Custom value distribution: e.g. for a `status` column, user can set 70% `active`, 20% `inactive`, 10% `pending`
- Null probability per nullable column (0–100% slider)
- Seed from uploaded CSV/JSON (use file rows as seed data, validate against schema)
- **Save seed profile**: store config as JSON in system DB, replay with one click

**API endpoints:**
- `POST /workspaces/:id/seed` — run seeder with options, return row counts inserted
- `POST /workspaces/:id/seed/preview` — return 5 sample rows without inserting
- `GET /workspaces/:id/seed/profiles` — list saved profiles
- `POST /workspaces/:id/seed/profiles` — save current config as named profile

---

### 4. SQL editor

**Purpose**: Write and run SQL queries with a great editing experience.

**Editor (Monaco):**
- PostgreSQL language mode
- Autocomplete: table names and column names from active workspace schema
- Format on paste / format button (use `sql-formatter` npm package)
- Keyboard shortcut: `Ctrl+Enter` to run
- Multiple tabs (saved as query documents)

**Query execution:**
- Run against workspace schema via `SET search_path = workspace_{id}; <query>`
- Stream results via SSE for long-running queries
- Paginate results (100 rows per page)
- Show execution time in ms
- Handle errors and display PostgreSQL error messages clearly

**Query history:**
- Every executed query saved to system DB with timestamp, duration, row count, workspace ID
- Searchable history panel
- "Save as snippet" with name and tags
- Snippets stored in system DB, shown in a sidebar panel

**API endpoints:**
- `POST /workspaces/:id/query` — execute query, return results + metadata
- `GET /workspaces/:id/query/history` — paginated history
- `POST /workspaces/:id/snippets` — save snippet
- `GET /workspaces/:id/snippets` — list snippets

---

### 5. Query analyzer (core feature)

**Purpose**: Deep inspection of a query's full lifecycle — covering all 7 internal PostgreSQL layers from parse to write path. `EXPLAIN ANALYZE` alone only covers Layer 3 (execution plan nodes) fully. The other 6 layers require separate system catalog queries run in parallel. Every result must be presented with a plain-language explanation, not just raw data.

---

#### Layer coverage map

| Layer | What it covers | Data source |
|---|---|---|
| 1. Parse & rewrite | CTE materialization fence detection, view expansion hints | Inferred from plan node types (e.g. `CTE Scan` = fenced) |
| 2. Planner | Statistics used, cost model GUCs, join order, parallelism | `pg_stats`, `pg_statistic`, `pg_settings` |
| 3. Execution plan nodes | Scan types, join algorithms, node cost/timing, buffer hits | `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` |
| 4. Index internals | Which indexes exist, which were used/skipped, why | `pg_indexes`, `pg_stat_user_indexes` |
| 5. MVCC & storage | Dead tuples, bloat, vacuum state, HOT updates | `pg_stat_user_tables`, `pg_class` |
| 6. Locking | Lock snapshot before/during execution, blocked PIDs | `pg_locks` joined with `pg_stat_activity` |
| 7. Write path (DML) | WAL bytes generated, checkpoint pressure, buffer writes | `pg_stat_wal`, `pg_stat_bgwriter` (delta before/after) |

---

#### Two analysis modes

- **Plan mode** (`EXPLAIN` only) — instant, no data touched, shows estimated plan only. Covers Layer 2 partially + Layer 3 estimated.
- **Full analysis mode** (`EXPLAIN ANALYZE`) — executes the query, runs all 7 catalog queries concurrently, returns complete `AnalysisResult`. Use this by default for SELECT; prompt user before running on DML.

---

#### Analyzer pipeline (NestJS `AnalyzerService`)

```
User submits query
  │
  ├─ [ANALYZE mode only] snapshot WAL + bgwriter stats (Layer 7 pre)
  ├─ [ANALYZE mode only] snapshot pg_locks (Layer 6 pre)
  │
  ├─ Run concurrently via Promise.all:
  │    ├── EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)  → Layer 3
  │    ├── query pg_stats + pg_statistic for filter columns  → Layer 2
  │    ├── query pg_settings (work_mem, random_page_cost, …) → Layer 2
  │    ├── query pg_stat_user_tables for all tables in query → Layer 5
  │    ├── query pg_indexes + pg_stat_user_indexes           → Layer 4
  │    └── query pg_locks snapshot                           → Layer 6
  │
  ├─ [ANALYZE mode only] snapshot WAL + bgwriter stats post → Layer 7 delta
  │
  ├─ Parse plan JSON tree (recursive walk)
  ├─ Detect signals from all sources (see below)
  └─ Return structured AnalysisResult
```

**Key implementation note for Layer 7:** `pg_stat_wal` and `pg_stat_bgwriter` are cumulative counters. Take a snapshot immediately before running the query and another immediately after, then compute the delta. Only meaningful for DML (`INSERT` / `UPDATE` / `DELETE`) — skip for SELECT.

**Key implementation note for Layer 6:** Take a `pg_locks` snapshot before execution and during (poll every 200ms via a parallel interval while the query runs). Diff to show which locks were acquired specifically by this query.

---

#### Signal detection rules

```typescript
interface PlanSignal {
  layer: 1 | 2 | 3 | 4 | 5 | 6 | 7
  type:
    | 'cte_fence'              // Layer 1
    | 'bad_estimate'           // Layer 2
    | 'stale_stats'            // Layer 2
    | 'suboptimal_guc'         // Layer 2
    | 'disk_spill'             // Layer 3
    | 'seq_scan_candidate'     // Layer 3
    | 'nested_loop_risk'       // Layer 3
    | 'expensive_sort'         // Layer 3
    | 'unused_index'           // Layer 4
    | 'index_type_mismatch'    // Layer 4
    | 'dead_tuple_bloat'       // Layer 5
    | 'vacuum_needed'          // Layer 5
    | 'lock_acquired'          // Layer 6
    | 'wal_amplification'      // Layer 7
  severity: 'info' | 'warning' | 'critical'
  nodeType?: string
  table?: string
  message: string       // technical description
  explanation: string   // plain English for learners
  suggestion: string    // actionable fix
}
```

**Detection rules per layer:**

Layer 1:
- `cte_fence`: plan contains a `CTE Scan` node → CTE was materialized as a fence, not inlined. Explain that pre-PG12 this is always the case; post-PG12 it means `MATERIALIZED` was explicit or the planner judged inlining unsafe.

Layer 2:
- `bad_estimate`: for any plan node, `Actual Rows / Plan Rows > 10` or `< 0.1` → statistics are stale or predicates are correlated. Show `n_distinct`, `correlation`, `most_common_vals` from `pg_stats`.
- `stale_stats`: `last_analyze` is null or older than 7 days for any table in the query.
- `suboptimal_guc`: `random_page_cost` = 4.0 (default) but table lives on SSD (heuristic: if table is small and seq scans dominate, suggest lowering to 1.1). `work_mem` < 64MB when disk spill detected.

Layer 3:
- `disk_spill`: Hash node `Batches > 1` or Sort node `Sort Method: external merge` → work_mem exhausted, spilling to disk.
- `seq_scan_candidate`: Seq Scan node on table with `Plan Rows > 1000` and a filter condition present → evaluate if an index would help.
- `nested_loop_risk`: Nested Loop node where inner side has no index and `Plan Rows > 100`.
- `expensive_sort`: Sort node whose cost > 20% of total plan cost.

Layer 4:
- `unused_index`: index exists on a table in the query, `idx_scan = 0`, table has > 500 rows → candidate for removal.
- `index_type_mismatch`: column uses `LIKE '%...'` pattern (requires GIN/pg_trgm) or JSONB containment (requires GIN) but only a B-Tree index exists.

Layer 5:
- `dead_tuple_bloat`: `n_dead_tup / (n_live_tup + n_dead_tup) > 0.2` → table has > 20% dead tuples, VACUUM needed.
- `vacuum_needed`: `last_autovacuum` is null or > 1 day and `n_dead_tup > 1000`.

Layer 6:
- `lock_acquired`: report all locks acquired by the query with their mode and type. For DML, highlight table-level locks that could block concurrent reads.

Layer 7 (DML only):
- `wal_amplification`: WAL bytes delta > 10× the estimated data size of affected rows → trigger from unnecessary full-row updates (e.g. updating every column when only one changed).

---

#### UI panels (one tab per layer group)

**Plan tree tab (Layer 3):**
- Render plan nodes as a collapsible tree (React Flow or d3-hierarchy)
- Node background = cost heatmap (green → yellow → red relative to root total cost)
- Each node shows: node type, estimated vs actual rows, actual time ms, loops, buffers hit/read
- Badge on node if it has a signal (e.g. "DISK SPILL", "BAD ESTIMATE")
- Click node → side panel with full node JSON + plain-language explanation of what this node type does

**Planner context tab (Layer 2):**
- Table of relevant GUC values: `work_mem`, `random_page_cost`, `seq_page_cost`, `effective_cache_size`, `max_parallel_workers_per_gather`
- Per-column stats for columns in WHERE / JOIN / ORDER BY: `n_distinct`, `correlation`, `null_frac`, `most_common_vals` (top 5), histogram buckets count
- Highlight if `correlation` is near 0 for a column used in a range scan (bad for index efficiency)

**Index report tab (Layer 4):**
- All indexes on tables in query
- Status: ✓ Used / ✗ Not used / ~ Bitmap (partial)
- For unused: show reason (wrong leading column, type mismatch, planner cost threshold)
- `idx_scan` count, `idx_tup_read`, `idx_tup_fetch` from `pg_stat_user_indexes`
- Index size from `pg_relation_size(indexrelid)`

**Storage & MVCC tab (Layer 5):**
- Per table: `n_live_tup`, `n_dead_tup`, dead tuple ratio, `last_analyze`, `last_autovacuum`, table size, bloat estimate
- VACUUM recommendation if ratio > 20%
- Explain HOT (Heap Only Tuple) updates: when they apply and when they don't

**Locks tab (Layer 6):**
- Lock snapshot taken during execution
- Table: relation | locktype | mode | granted | duration
- If any lock was not immediately granted (i.e. query waited): highlight as warning

**Write path tab (Layer 7, DML only):**
- WAL bytes generated (delta from `pg_stat_wal.wal_bytes`)
- Shared buffers written (`pg_stat_bgwriter` delta)
- Checkpoint requests triggered (if any)
- Flag `wal_amplification` signal if detected

---

#### A/B query comparison
- Two editor panes side by side
- Run both through the full analyzer pipeline
- Compare: total plan cost, actual execution time, buffer hits, WAL bytes (DML), signals detected
- Diff view highlights which signals appear in A but not B and vice versa
- Verdict badge: which query wins and by what margin on each metric

---

**API endpoints:**
- `POST /workspaces/:id/analyze` — run full 7-layer analysis, return `AnalysisResult`
- `POST /workspaces/:id/analyze/plan` — plan-only mode (no query execution)
- `POST /workspaces/:id/analyze/compare` — run two queries, return side-by-side comparison

---

### 6. AI query optimizer

**Purpose**: Use an LLM to suggest concrete query rewrites based on analyzer signals.

**Flow:**

```
AnalysisResult (signals + plan JSON + schema context)
  → build structured prompt
  → call LLM API (OpenRouter or OpenAI)
  → parse structured response
  → display suggestions with before/after diff
```

**Prompt construction** (NestJS `OptimizerService`):

The optimizer receives the full `AnalysisResult` from all 7 layers — not just the plan JSON. Build the prompt from all available signal sources:

```typescript
const prompt = `
You are a PostgreSQL expert. Analyze the following query using signals from all layers of PostgreSQL's query lifecycle, then suggest concrete improvements.

## Schema context
${schemaContext}
// Includes: table DDL, existing indexes, column types and constraints

## Original query
${originalQuery}

## Detected signals (all 7 layers)
${signals.map(s => `- [Layer ${s.layer}] [${s.severity.toUpperCase()}] ${s.type}: ${s.message}`).join('\n')}

## Planner context (Layer 2)
- work_mem: ${pgSettings.work_mem}
- random_page_cost: ${pgSettings.random_page_cost}
- effective_cache_size: ${pgSettings.effective_cache_size}
- Column stats: ${JSON.stringify(columnStats)}

## EXPLAIN ANALYZE plan (Layer 3)
${JSON.stringify(planJson, null, 2)}

## Storage state (Layer 5)
${tableStats.map(t => `- ${t.table}: ${t.n_dead_tup} dead tuples (${t.bloat_ratio}% bloat), last analyzed: ${t.last_analyze}`).join('\n')}

## Index usage (Layer 4)
${indexStats.map(i => `- ${i.indexname} on ${i.tablename}: ${i.idx_scan} scans, status: ${i.status}`).join('\n')}

## WAL impact (Layer 7, DML only)
${walDelta ? `WAL bytes generated: ${walDelta.wal_bytes}` : 'N/A (SELECT query)'}

Respond with a JSON object with this exact structure:
{
  "suggestions": [
    {
      "title": "short title",
      "layer": 3,
      "problem": "what is wrong and why it hurts performance",
      "solution": "plain English explanation of the fix",
      "rewritten_query": "full rewritten SQL or null if no rewrite needed",
      "ddl_changes": ["CREATE INDEX ...", ...],
      "guc_changes": ["SET work_mem = '256MB'", ...],
      "expected_improvement": "e.g. 10x faster by avoiding full table scan",
      "tradeoffs": ["list of tradeoffs"]
    }
  ]
}
Return only valid JSON, no markdown, no explanation outside the JSON object.
`
```

Note two additional fields vs a basic optimizer: `layer` (which lifecycle layer the suggestion targets) and `guc_changes` (for suggestions like raising `work_mem` or lowering `random_page_cost`).

**Frontend:**
- "Get AI suggestions" button below the analyzer results (clearly labeled as AI-generated)
- Each suggestion renders as a card with: layer badge (e.g. "Layer 4 — Index"), problem description, solution text, before/after SQL diff (use `diff` npm package), DDL changes block, GUC changes block, improvement estimate, tradeoff list
- "Apply DDL" button executes the suggested `CREATE INDEX` etc. against the workspace
- "Apply GUC" button executes the suggested SET statement for the current session
- "Copy rewritten query" button pastes into editor

**API endpoints:**
- `POST /workspaces/:id/analyze/suggest` — run optimizer, return suggestions array
- `POST /workspaces/:id/analyze/apply-ddl` — execute DDL suggestion against workspace
- `POST /workspaces/:id/analyze/apply-guc` — apply GUC change for session

**LLM config** (stored in system DB, configurable per workspace):
- Provider: OpenRouter (recommended for cost efficiency) or OpenAI
- Model: default `deepseek/deepseek-chat` or `gpt-4o-mini`
- API key: stored encrypted in system DB or from env

---

### 7. Index manager

**Purpose**: View, create, and drop indexes with context about their usage and cost.

**Index list view:**
- Source: `pg_indexes` joined with `pg_stat_user_indexes`
- Columns: index name, table, columns, type (btree/hash/gin/gist/brin), size, index scans (since last reset), tuples read, tuples fetched
- Badge: "Unused" if `idx_scan = 0` and table has > 1000 rows (likely dead weight)

**Create index UI:**
- Select table → select columns (multi-select for composite) → choose index type → partial index WHERE clause (optional) → expression input (optional)
- Preview generated DDL before running
- Run `CREATE INDEX CONCURRENTLY` by default (non-blocking)

**API endpoints:**
- `GET /workspaces/:id/indexes` — list all indexes with stats
- `POST /workspaces/:id/indexes` — create index
- `DELETE /workspaces/:id/indexes/:name` — drop index

---

### 8. Transaction lab

**Purpose**: Let users experiment with concurrent transactions, isolation levels, and locking.

**Architecture:**
- Maintain **two persistent database connections** per lab session (ConnectionA, ConnectionB)
- Each connection is a raw `pg.Client` (not pooled) so transaction state persists between commands
- Session state stored in Redis (BullMQ-adjacent) with TTL

**UI:**
- Two-column layout: Session A (left) | Session B (right)
- Each session has its own SQL input + output log
- Transaction state indicator: `IDLE` / `IN TRANSACTION` / `ERROR`
- Buttons: `BEGIN`, `COMMIT`, `ROLLBACK`, `Execute SQL`
- Isolation level picker per session: `READ COMMITTED` | `REPEATABLE READ` | `SERIALIZABLE`

**Demonstration scenarios** (pre-built as guided labs):
- Dirty read (demonstrate with READ UNCOMMITTED — note PG doesn't support, explain why)
- Non-repeatable read
- Phantom read
- Lost update
- Deadlock (intentional — show `ERROR: deadlock detected`)
- `SELECT FOR UPDATE SKIP LOCKED` queue pattern
- MVCC: show same row read differently in two snapshots

**Lock visualizer:**
- Poll `pg_locks` joined with `pg_stat_activity` every 500ms during active lab session
- Show a live table: PID | locktype | relation | mode | granted
- Highlight blocked locks in red
- Show which session is blocking which

**API endpoints (WebSocket or SSE):**
- `POST /labs/:id/sessions/:session/execute` — run SQL on session A or B
- `POST /labs/:id/sessions/:session/begin` — BEGIN with isolation level
- `POST /labs/:id/sessions/:session/commit`
- `POST /labs/:id/sessions/:session/rollback`
- `GET /labs/:id/locks` — current pg_locks state

---

### 9. ERD viewer

**Purpose**: Live visual diagram of the active workspace schema.

**Implementation:**
- Introspect schema from `information_schema` on demand or after any DDL change
- Render with React Flow: each table = a node with column list, PK highlighted, FK columns marked
- Edges = FK relationships with crow's foot notation (use React Flow custom edge)
- Auto-layout with dagre (`@dagrejs/dagre`)
- Click table node → open table detail panel (columns, indexes, row count)
- Export as PNG (html-to-image) or SVG

**API endpoints:**
- `GET /workspaces/:id/erd` — return schema graph: `{ tables: [...], relationships: [...] }`

---

### 10. Import / Export

**Import:**
- CSV → detect delimiter, infer types, create table if not exists or append to existing
- JSON array → same as CSV flow
- SQL file → execute as raw DDL/DML

**Export:**
- Table as CSV (streamed for large tables)
- Full workspace as `.sql` dump (pg_dump equivalent using manual DDL generation)

**API endpoints:**
- `POST /workspaces/:id/import` — multipart upload
- `GET /workspaces/:id/tables/:table/export?format=csv` — stream CSV
- `GET /workspaces/:id/export` — full SQL dump

---

## Database schema (system metadata)

```sql
-- System schema: _system or public

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  schema_name text UNIQUE NOT NULL,
  description text,
  template_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE query_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  sql text NOT NULL,
  duration_ms integer,
  row_count integer,
  error text,
  executed_at timestamptz DEFAULT now()
);

CREATE TABLE saved_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  sql text NOT NULL,
  tags text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE seed_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  config jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE lab_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text,
  scenario_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE llm_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text DEFAULT 'openrouter',
  model text DEFAULT 'deepseek/deepseek-chat',
  api_key_encrypted text,
  created_at timestamptz DEFAULT now()
);
```

---

## Key implementation notes

**Search path isolation:**
Every query against a workspace must be wrapped:
```typescript
await client.query(`SET search_path = ${schemaName}, public`)
await client.query(userSQL)
```
Use a dedicated pg pool per workspace or reset search_path before each query in a shared pool.

**Security:**
- Never allow DDL that references outside the workspace schema
- Validate SQL with a parser (use `pgsql-parser` npm package) before execution
- Block `DROP SCHEMA`, `CREATE DATABASE`, `pg_read_file`, `COPY TO/FROM` filesystem paths
- Run sandbox PostgreSQL as a low-privilege role with no superuser

**EXPLAIN JSON parsing:**
PostgreSQL returns EXPLAIN output as `[{"Plan": {...}}]`. Recursively walk the plan tree to extract all nodes. Key fields per node: `Node Type`, `Startup Cost`, `Total Cost`, `Plan Rows`, `Actual Rows`, `Actual Total Time`, `Loops`, `Shared Hit Blocks`, `Shared Read Blocks`.

**Monaco autocomplete:**
Register a custom completion provider that fetches `GET /workspaces/:id/tables` and injects table names and column names as completion items. Update on schema change.

**Cost heatmap:**
Normalize each node's `Total Cost` relative to the root node's total cost. Map 0–100% to a green → yellow → red color scale. Display as background color of each plan tree node.

---

## Phase build order

| Phase | Features | Analyzer layers covered |
|---|---|---|
| 1 | Workspace manager, Schema builder (SQL mode), SQL editor, Query history | — |
| 2 | Schema builder (form mode + import), Data seeder, ERD viewer | — |
| 3a | Query analyzer: EXPLAIN plan tree + signal detection + index report | Layer 3 (full), Layer 4 (partial) |
| 3b | Query analyzer: planner context panel + column stats + GUC display | Layer 1, Layer 2 |
| 3c | Query analyzer: storage & MVCC panel, vacuum warnings | Layer 5 |
| 3d | Index manager (standalone) | Layer 4 (full) |
| 4a | AI optimizer suggestions (powered by full AnalysisResult) | All layers as input |
| 4b | A/B query comparison | All layers |
| 5a | Transaction lab: dual sessions, isolation levels, deadlock demo | Layer 6 (interactive) |
| 5b | Lock viewer: live pg_locks panel, lock snapshot in analyzer | Layer 6 (in analyzer) |
| 5c | Write path panel: WAL delta, bgwriter stats for DML queries | Layer 7 |
| 6 | Import/Export, pgvector support, pg_stat_statements integration | — |
