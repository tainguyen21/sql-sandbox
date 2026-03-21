# Phase 01 - Project Scaffolding

## Context Links
- [Monorepo Architecture Report](../reports/researcher-260321-1008-monorepo-architecture-guide.md)
- [Plan Overview](./plan.md)

## Overview
- **Priority**: P1 (critical path)
- **Status**: completed
- **Effort**: 8h
- **Description**: Bootstrap pnpm monorepo with Next.js 14, NestJS, Drizzle, shared packages, Docker Compose, and CI scaffolding.

## Key Insights
- Use Turborepo for build orchestration (caching, parallel builds)
- `packages/db` exports Drizzle client + schema; `packages/shared` exports TS types; `packages/ui` wraps shadcn components
- Docker Compose for local PG 15 + Redis

## Requirements

### Functional
- pnpm workspace with `apps/web`, `apps/api`, `packages/{db,shared,ui}`
- Next.js 14 App Router with Tailwind + shadcn/ui
- NestJS with module structure for workspace, query, analyzer
- Drizzle ORM configured against system DB
- Docker Compose: PostgreSQL 15, Redis 7
- Shared ESLint + Prettier config
- TypeScript strict mode across all packages

### Non-functional
- `pnpm dev` starts both apps in parallel
- `pnpm build` produces production bundles
- Hot reload works cross-package

## Architecture
```
sql-sandbox/
├── pnpm-workspace.yaml
├── turbo.json
├── package.json (root)
├── docker-compose.yml
├── .env.example
├── apps/
│   ├── web/          # Next.js 14
│   └── api/          # NestJS
├── packages/
│   ├── db/           # Drizzle schema + migrations
│   ├── shared/       # TS types + constants
│   └── ui/           # shadcn components
└── tools/scripts/    # Migration/seed scripts
```

## Related Code Files

### Files to Create
- `pnpm-workspace.yaml`
- `turbo.json`
- `package.json` (root)
- `.npmrc`
- `.env.example`
- `docker-compose.yml`
- `tsconfig.json` (root)
- `.eslintrc.js` (root)
- `.prettierrc`
- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.js`, `apps/web/tailwind.config.ts`
- `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/app/globals.css`
- `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json`
- `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/app.controller.ts`
- `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`
- `packages/db/src/index.ts`, `packages/db/src/connection.ts`, `packages/db/src/schema.ts`
- `packages/shared/package.json`, `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts`, `packages/shared/src/types/api.ts`, `packages/shared/src/types/database.ts`
- `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/tailwind.config.ts`
- `packages/ui/src/index.ts`

## Implementation Steps

1. **Initialize pnpm workspace**
   - Create `pnpm-workspace.yaml` with `apps/*`, `packages/*`, `tools/scripts`
   - Create root `package.json` with workspace scripts (`dev`, `build`, `lint`, `test`)
   - Create `.npmrc` with `shamefully-hoist=true`, `strict-peer-dependencies=false`
   - Create root `tsconfig.json` with `paths` aliases

2. **Setup Turborepo**
   - `turbo.json` with `dev` (persistent, no cache), `build` (depends on ^build), `lint`, `test` pipelines
   - Install `turbo` as root devDependency

3. **Bootstrap Next.js 14 frontend (`apps/web`)**
   - `npx create-next-app@latest --typescript --tailwind --app --src-dir=false`
   - Configure `next.config.js` with `transpilePackages: ['@sql-sandbox/ui', '@sql-sandbox/shared']`
   - Install shadcn/ui, configure `components.json`
   - Create minimal layout with sidebar placeholder

4. **Bootstrap NestJS backend (`apps/api`)**
   - `nest new api --package-manager pnpm --skip-git`
   - Configure CORS, global prefix `/api`, validation pipe
   - Create module stubs: `WorkspaceModule`, `QueryModule`, `AnalyzerModule`
   - Install `pg`, `@nestjs/config`, `class-validator`, `class-transformer`

5. **Setup `packages/db`**
   - Install `drizzle-orm`, `drizzle-kit`, `pg`
   - Create `connection.ts` with pool config from env vars
   - Create `schema.ts` with system tables (workspaces, query_history, saved_snippets, seed_profiles, lab_sessions, llm_configs)
   - Create `drizzle.config.ts` pointing to system schema
   - Add `migrate` and `generate` scripts

6. **Setup `packages/shared`**
   - Define API request/response types for workspace, query, analyzer
   - Export `PlanSignal`, `AnalysisResult`, `WorkspaceInfo` types
   - Export constants (severity levels, node type labels)

7. **Setup `packages/ui`**
   - Configure Tailwind to extend from root config
   - Add shadcn base components: Button, Card, Dialog, Input, Select, Tabs, Badge
   - Export from `src/index.ts`

8. **Docker Compose**
   - PostgreSQL 15 with `POSTGRES_DB=sql_sandbox`, low-privilege sandbox role
   - Redis 7 for BullMQ
   - Volume mounts for data persistence
   - Health checks

9. **Environment config**
   - `.env.example` with `DATABASE_URL`, `REDIS_URL`, `SANDBOX_DB_URL`, `LLM_API_KEY`
   - NestJS `ConfigModule` with validation schema (joi or zod)

10. **Verify end-to-end**
    - `docker compose up -d`
    - `pnpm install && pnpm dev`
    - Frontend loads at `localhost:3000`, API responds at `localhost:3001/api`
    - Drizzle migration runs against system DB

## Todo List
- [x] Create pnpm workspace config
- [x] Setup Turborepo
- [x] Bootstrap Next.js 14 app
- [x] Bootstrap NestJS app
- [x] Setup packages/db with Drizzle schema
- [x] Setup packages/shared with types
- [x] Setup packages/ui with shadcn
- [x] Create Docker Compose (PG 15 + Redis)
- [x] Configure environment variables
- [x] Verify dev server runs end-to-end

## Success Criteria
- `pnpm dev` starts both apps with hot reload
- `pnpm build` succeeds with no TS errors
- Docker Compose spins up PG 15 + Redis
- Drizzle migration creates system tables
- Cross-package imports work (web imports from ui, api imports from db)

## Risk Assessment
- **pnpm/Turbo version conflicts**: Pin versions in `.npmrc` and root `package.json`
- **Tailwind config sharing**: Use preset pattern from ui package
- **Module resolution**: `transpilePackages` in next.config.js critical for shadcn

## Security Considerations
- `.env` in `.gitignore`, only `.env.example` committed
- PG sandbox role has no superuser, no CREATEDB
- Redis password set in Docker Compose

## Next Steps
- Phase 02: Workspace CRUD + Schema builder (SQL mode)
