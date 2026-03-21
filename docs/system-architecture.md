# System Architecture

## High-Level Overview

PostgreSQL Sandbox is a 3-tier monorepo architecture with isolated data layers, async queue processing, and workspace-scoped isolation.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client (Browser)                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 @ localhost:3000)                         │
│  ├─ App Router (pages, layouts)                                 │
│  ├─ React 18 components (shadcn/ui)                             │
│  ├─ Monaco SQL editor                                           │
│  └─ React Flow for query visualization                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│  API Layer (NestJS @ localhost:3001/api)                        │
│  ├─ WorkspaceController (CRUD workspaces)                       │
│  ├─ QueryController (execute queries)                           │
│  ├─ SeedController (run seeders)                                │
│  ├─ AnalyzerController (7-layer analysis)                       │
│  ├─ SnippetController (save/list queries)                       │
│  ├─ LabController (transaction scenarios)                       │
│  └─ ConfigModule (env-based settings)                           │
└─────────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
    ┌────────┐          ┌────────┐          ┌─────────┐
    │ Database│          │ Redis  │          │ Cache   │
    │ Layer   │          │ Queue  │          │ (tbd)   │
    └────────┘          └────────┘          └─────────┘
         ↓ Drizzle ORM        ↓ BullMQ
```

## Monorepo Structure

```
sql-sandbox/
├── apps/
│   ├── web/
│   │   ├── app/                    # Next.js App Router
│   │   │   ├── layout.tsx          # Root layout + providers
│   │   │   ├── page.tsx            # Home page
│   │   │   └── [workspace]/        # Workspace pages
│   │   ├── public/                 # Static assets
│   │   ├── package.json            # Dependencies: next, react, @sql-sandbox/*
│   │   ├── tsconfig.json           # TypeScript config
│   │   ├── tailwind.config.ts      # Tailwind setup
│   │   └── next.config.js          # Next config
│   │
│   └── api/
│       ├── src/
│       │   ├── main.ts             # Bootstrap, GlobalPrefix, CORS, ValidationPipe
│       │   ├── app.module.ts       # Root module, ConfigModule
│       │   ├── app.controller.ts   # Health check endpoint
│       │   ├── workspace/          # Workspace feature (Phase 02)
│       │   ├── query/              # Query execution (Phase 03)
│       │   ├── seed/               # Data seeding (Phase 04)
│       │   ├── snippet/            # SQL library (Phase 05)
│       │   ├── lab/                # Transaction lab (Phase 06)
│       │   └── analyzer/           # Query analyzer (Phase 07)
│       ├── test/                   # Jest e2e tests
│       ├── package.json            # Dependencies: @nestjs/*, class-validator
│       ├── tsconfig.json
│       └── jest.config.js
│
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── index.ts            # Exports: schema, getPool, getDb, closePool
│   │   │   ├── schema.ts           # Drizzle table definitions (7 tables)
│   │   │   └── connection.ts       # PG pool + Drizzle instance
│   │   ├── drizzle.config.ts       # Drizzle kit config
│   │   ├── migrations/             # Auto-generated SQL migrations
│   │   └── package.json            # Dependencies: drizzle-orm, pg
│   │
│   ├── shared/
│   │   ├── src/
│   │   │   ├── index.ts            # Exports all types
│   │   │   └── types/
│   │   │       ├── api.ts          # API request/response types
│   │   │       └── database.ts     # Database entity types
│   │   └── package.json            # No runtime deps (pure types)
│   │
│   └── ui/
│       ├── src/
│       │   ├── index.ts            # Exports: cn, components
│       │   ├── utils.ts            # cn() — tailwind-merge utility
│       │   └── components/         # shadcn/ui wrapped components (Phase 05+)
│       └── package.json            # Dependencies: react, tailwindcss, clsx, lucide-react
│
├── .claude/                         # AI agent rules & skills
├── plans/                           # Project planning docs
├── scripts/
│   └── init-sandbox-role.sql       # PostgreSQL sandbox role setup
├── docker-compose.yml              # Dev environment
├── .env.example                    # Environment template
├── turbo.json                      # Turborepo task definitions
├── pnpm-workspace.yaml             # Workspace packages
├── tsconfig.json                   # Root TS config
├── CLAUDE.md                       # Agent instructions
└── package.json                    # Root scripts: dev, build, db:*
```

## Data Flow

### Workspace Creation (Phase 02)
```
User → Web UI → POST /api/workspaces
  ↓
NestJS Controller validates DTO
  ↓
WorkspaceService.create()
  ├─ Insert into workspaces table
  ├─ Create isolated schema in PostgreSQL (CREATE SCHEMA workspace_xxx)
  └─ Apply template if provided
  ↓
Redis job queued (schema initialization)
  ↓
Response: { id, name, schemaName, createdAt }
```

### Query Execution (Phase 03)
```
User → Monaco Editor → POST /api/queries
  ↓
NestJS validates SQL, workspace ownership
  ↓
QueryService.execute()
  ├─ Parse SQL (validate syntax)
  ├─ Get workspace connection (sandbox role, scoped to schema)
  ├─ Execute query with EXPLAIN ANALYZE
  ├─ Log to queryHistory table
  └─ Return result + metrics
  ↓
Redis job: QueryAnalyzerJob
  ├─ Run 7-layer analysis
  ├─ Cache result in Redis
  └─ Publish results to WebSocket (Phase 07)
  ↓
Response: { data: [], duration: 45, rowCount: 10, explainPlan: {...} }
```

### Seeding (Phase 04)
```
User → Seed Form → POST /api/seeds/execute
  ↓
NestJS validates seed profile
  ↓
SeedService.execute()
  ├─ Fetch seed profile from seedProfiles table
  ├─ Parse template (e.g., "100 users, 500 orders")
  ├─ Generate INSERT statements
  └─ Queue BullMQ job
  ↓
AsyncWorker processes SeedJob
  ├─ Connect to workspace schema
  ├─ Execute INSERTs in batches
  ├─ Track progress in Redis
  └─ Update queryHistory
  ↓
Response: { jobId, status: "queued" }
```

## Workspace Isolation

Each workspace is isolated at 3 levels:

### 1. Schema Level (PostgreSQL)
```sql
-- System DB (sql_sandbox)
CREATE SCHEMA workspace_abc123;

-- User can only access their schema
-- sandbox_user CANNOT:
-- - CREATE SCHEMA outside workspace
-- - ALTER other workspaces
-- - Access information_schema
```

### 2. Connection Level (Drizzle + PG)
```typescript
// Connection scoped to workspace schema
const client = getDb(workspaceId);
// Internally sets: SET search_path = workspace_abc123;
// All queries default to workspace_abc123
```

### 3. Application Level (NestJS Guards)
```typescript
@UseGuards(WorkspaceGuard)
@Post('/workspaces/:id/queries')
async execute(@Param('id') workspaceId: string) {
  // Guard verifies user owns workspace
  // Cannot access other workspace queries
}
```

## Database Schema (7 Tables)

```
workspaces
├─ id: UUID (PK)
├─ name: text
├─ schemaName: text (UNIQUE) — e.g., "workspace_abc123"
├─ description: text
├─ templateId: UUID (FK → workspace_templates)
├─ createdAt: timestamptz
└─ updatedAt: timestamptz

workspace_templates
├─ id: UUID (PK)
├─ name: text
├─ schemaSql: text — e.g., CREATE TABLE users...
├─ description: text
└─ createdAt: timestamptz

query_history
├─ id: UUID (PK)
├─ workspaceId: UUID (FK → workspaces) [CASCADE]
├─ sql: text
├─ durationMs: integer
├─ rowCount: integer
├─ error: text
└─ executedAt: timestamptz

saved_snippets
├─ id: UUID (PK)
├─ workspaceId: UUID (FK) [CASCADE]
├─ name: text
├─ sql: text
├─ tags: text[] — e.g., ["joins", "optimization"]
└─ createdAt: timestamptz

seed_profiles
├─ id: UUID (PK)
├─ workspaceId: UUID (FK) [CASCADE]
├─ name: text
├─ config: jsonb — e.g., { "users": 100, "orders": 500 }
└─ createdAt: timestamptz

lab_sessions
├─ id: UUID (PK)
├─ workspaceId: UUID (FK) [CASCADE]
├─ name: text
├─ scenarioId: text — e.g., "deadlock-scenario-1"
└─ createdAt: timestamptz

llm_configs
├─ id: UUID (PK)
├─ workspaceId: UUID (FK) [CASCADE]
├─ provider: text (default: "openrouter")
├─ model: text (default: "deepseek/deepseek-chat")
├─ apiKeyEncrypted: text
└─ createdAt: timestamptz
```

## Async Job Queue (BullMQ + Redis)

Jobs processed asynchronously:

1. **SchemaInitializationJob** — Create workspace schema
2. **QueryAnalyzerJob** — 7-layer execution analysis
3. **SeedDataJob** — Batch insert mock data
4. **SnapshotJob** — Export workspace state
5. **LLMOptimizeJob** — AI query suggestions

## Environment Variables

```
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sql_sandbox
SANDBOX_DB_URL=postgresql://sandbox_user:sandbox_pass@localhost:5432/sql_sandbox

# Redis
REDIS_URL=redis://localhost:6379

# API
API_PORT=3001
CORS_ORIGIN=http://localhost:3000

# LLM
LLM_PROVIDER=openrouter
LLM_MODEL=deepseek/deepseek-chat
LLM_API_KEY=...

# Node
NODE_ENV=development
```

## Security Model

### PostgreSQL Sandbox Role
- Limited to workspace schema
- Cannot execute superuser functions
- Cannot access pg_catalog or information_schema
- Connection timeout: 30 minutes
- Row-level security ready (Phase 08+)

### API Validation
- NestJS `ValidationPipe` strips unknown fields
- Class validators enforce types (e.g., @IsUUID())
- SQL parsing (no direct query execution)

### Secrets Management
- LLM API keys encrypted at rest
- Never logged or returned to client
- Environment-based injection

## Deployment Architecture

### Development
```
├─ docker-compose (PostgreSQL 15 + Redis 7)
├─ pnpm dev (Turborepo parallelizes web + api)
└─ localhost:3000 (web) + localhost:3001 (api)
```

### Staging
```
├─ PostgreSQL managed (e.g., AWS RDS)
├─ Redis managed (e.g., AWS ElastiCache)
├─ API: Docker container on K8s
└─ Web: Vercel preview deployment
```

### Production
```
├─ PostgreSQL managed (replicated, backup)
├─ Redis managed (cluster mode)
├─ API: K8s pods (auto-scaling, health checks)
├─ Web: Vercel production (CDN, edge caching)
└─ Monitoring: DataDog / Prometheus
```

## Performance Considerations

1. **Connection Pooling** — PG pool reuses connections (10 per workspace max)
2. **Query Timeout** — 5 min default (configurable per workspace)
3. **Redis Caching** — Query results + analysis cached 1 hour
4. **Batch Operations** — Seeds insert in 1000-row batches
5. **Indexes** — queryHistory indexed on (workspaceId, executedAt)

## Testing Strategy

- **Unit tests** — Service layer (Jest)
- **Integration tests** — API endpoints + DB (Jest + test containers)
- **E2E tests** — Full workflow with Docker Compose (Playwright)
- **Security tests** — Sandbox role validation (SQL injection, privilege escalation)
- **Load tests** — 100+ concurrent workspaces (Artillery)

## Roadmap Integration

- **Phase 01** ✓ Scaffolding
- **Phase 02** Workspace CRUD + templates
- **Phase 03** Query execution + history
- **Phase 04** Seeding + profiles
- **Phase 05** Snippet library + Monaco
- **Phase 06** Transaction lab
- **Phase 07** 7-layer analyzer
- **Phase 08** AI optimizer + caching
