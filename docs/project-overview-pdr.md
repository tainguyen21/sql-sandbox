# PostgreSQL Sandbox — Project Overview & PDR

## Vision

Self-hosted PostgreSQL learning and debugging platform. Enables developers to create isolated sandbox workspaces, write and test SQL queries, seed mock data, and analyze query execution in depth across 7 layers (parsing, validation, optimization, execution, caching, performance, security).

## Goals

1. **Isolation** — Each workspace maps to isolated PostgreSQL schema. Sandbox role with restricted permissions prevents damage.
2. **Learning** — Interactive environment for SQL mastery: schema design, complex queries, transaction handling.
3. **Analysis** — Deep execution insight: query plans, performance metrics, caching behavior, lock contention.
4. **Productivity** — Save snippets, reuse profiles, share workspaces. Integrate AI optimization suggestions.
5. **Safety** — No data leakage between workspaces. Sandbox user cannot access system tables.

## Features (Phase 01 Complete)

### Completed
- Multi-tenant monorepo architecture (pnpm + Turborepo)
- PostgreSQL 15 with pre-configured sandbox role
- Drizzle ORM with 7 system tables
- Next.js 14 frontend scaffold with Tailwind + shadcn/ui
- NestJS API scaffold with ConfigModule + validation
- Redis 7 for async job queue (BullMQ ready)
- Docker Compose dev environment

### Planned (Phases 02–08)
- Phase 02: Workspace CRUD + template engine
- Phase 03: Query execution + history logging
- Phase 04: Mock data seeder + profiles
- Phase 05: Snippet library + SQL editor UI
- Phase 06: Transaction lab + scenario engine
- Phase 07: Query analyzer (7-layer execution)
- Phase 08: AI optimizer (LLM integration)

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui, Monaco Editor |
| **API** | NestJS, TypeScript, class-validator, class-transformer |
| **Database** | PostgreSQL 15, Drizzle ORM, pg driver |
| **Async** | BullMQ, Redis 7 |
| **Build** | pnpm 9.15, Turborepo 2.3, TypeScript 5.7 |
| **Dev** | Docker Compose, ESLint, Jest, Prettier |

## Architecture Highlights

### Monorepo Structure
```
apps/
  ├── web/       → Next.js frontend (http://localhost:3000)
  └── api/       → NestJS backend (http://localhost:3001/api)

packages/
  ├── db/        → Drizzle schema + connection pool
  ├── shared/    → TypeScript types (API, database)
  └── ui/        → Tailwind utils (cn function) + shadcn/ui setup
```

### Database Design
- **Workspaces** — User sandbox containers, each has isolated schema
- **Workspace Templates** — Pre-built SQL schemas (e.g., e-commerce, CRM)
- **Query History** — Execution logs (SQL, duration, row count, errors)
- **Saved Snippets** — Reusable SQL queries with tags
- **Seed Profiles** — Mock data configurations (e.g., "100 users + 500 orders")
- **Lab Sessions** — Transaction simulation environments
- **LLM Configs** — AI provider settings per workspace

### Security
- **PostgreSQL Sandbox Role** — Limited privileges. Cannot:
  - Create/drop schemas outside own workspace
  - Access information_schema
  - Execute admin functions
  - See other workspaces' data
- **Connection Pooling** — Reuses connections, prevents exhaustion
- **Input Validation** — NestJS ValidationPipe strips unknown fields

## Deployment

### Development
```bash
docker-compose up              # Start PostgreSQL + Redis
pnpm install                   # Install deps
pnpm db:generate               # Generate Drizzle types
pnpm dev                        # Run web + api (Turborepo)
```

### Production
- Frontend: Vercel/Next.js hosting
- API: Container (Docker) on K8s or VPS
- Database: Managed PostgreSQL (e.g., AWS RDS)
- Redis: Cache layer (e.g., AWS ElastiCache)

## Success Metrics (MVP)

- [ ] 3+ workspace templates (SQL standard, e-commerce, analytics)
- [ ] Query analyzer shows all 7 layers
- [ ] <100ms query execution (99th percentile)
- [ ] Sandbox role prevents privilege escalation (security audit)
- [ ] AI optimizer suggests indexing improvements
- [ ] Zero data leakage between workspaces (pen test)

## Dependencies & Constraints

### External
- PostgreSQL 15+ (supports EXPLAIN ANALYZE JSON, modern types)
- Redis 7+ (BullMQ compatibility)
- Node.js 18+ (async/await, native streams)

### Internal
- **db** → consumed by **api** (schema, connection)
- **shared** → consumed by **web**, **api** (types)
- **ui** → consumed by **web** (components, utils)

### Risks
1. **Connection exhaustion** — Workspace schemas may leak pool connections. Mitigation: per-workspace connection limits.
2. **Query timeout** — Long-running user queries block analyzer. Mitigation: async execution + Redis queue.
3. **LLM cost** — Unlimited AI optimization queries. Mitigation: rate limiting + cost tracking.

## Ownership

| Area | Owner |
|------|-------|
| Database schema | Backend team |
| Frontend components | Frontend team |
| API routes | Backend team |
| Shared types | Architecture |
| DevOps/Docker | DevOps |

## Timeline

- **Phase 01** (Week 1): Scaffolding ✓
- **Phase 02** (Week 2): Workspaces + templates
- **Phase 03** (Week 3): Query execution
- **Phase 04** (Week 4): Seeding
- **Phase 05** (Week 5): Snippet library
- **Phase 06** (Week 6): Transaction lab
- **Phase 07** (Week 7): Query analyzer
- **Phase 08** (Week 8): AI optimizer

**Target Launch:** Week 8 (MVP ready)
