# Codebase Summary

## Current State (Phase 01 - Scaffolding Complete)

PostgreSQL Sandbox monorepo with foundational setup: pnpm workspaces, Turborepo, database schema, API bootstrap, and frontend structure.

## Directory Structure

### Root Configuration Files
| File | Purpose |
|------|---------|
| `package.json` | Root workspace, scripts: dev, build, lint, test, db:* |
| `pnpm-workspace.yaml` | Workspace declaration: apps/*, packages/* |
| `turbo.json` | Build orchestration: dev, build, lint, test tasks |
| `tsconfig.json` | Root TypeScript settings (extends in each package) |
| `docker-compose.yml` | PostgreSQL 15 + Redis 7 dev environment |
| `.env.example` | Environment template (DATABASE_URL, REDIS_URL, etc.) |

### Root Scripts
| Script | Command | Purpose |
|--------|---------|---------|
| `pnpm dev` | `turbo run dev` | Start web + api in parallel |
| `pnpm build` | `turbo run build` | Build all packages |
| `pnpm lint` | `turbo run lint` | Lint all packages |
| `pnpm test` | `turbo run test` | Run tests all packages |
| `pnpm format` | `prettier --write "**/*.{ts,tsx,js,jsx,json,yaml,md}"` | Format all files |
| `pnpm db:generate` | `pnpm --filter @sql-sandbox/db generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | `pnpm --filter @sql-sandbox/db migrate` | Apply Drizzle migrations |
| `pnpm db:studio` | `pnpm --filter @sql-sandbox/db studio` | Open Drizzle Studio (visual DB editor) |

## Apps

### apps/web — Next.js 14 Frontend

**Package**: `@sql-sandbox/web`

**Key Dependencies**
- `next@14.2.0` — Framework
- `react@18.3.0`, `react-dom@18.3.0` — UI library
- `tailwindcss@3.4.0` — Styling
- `typescript@5.7.0` — Type safety
- `eslint@8.57.0`, `eslint-config-next@14.2.0` — Linting

**Structure**
```
apps/web/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (providers, meta)
│   ├── page.tsx                # Home page
│   └── [workspace]/            # Dynamic workspace routes (Phase 02+)
├── public/                     # Static assets
├── next.config.js              # Next config (rewrites, env)
├── tailwind.config.ts          # Tailwind design tokens
├── package.json
└── tsconfig.json
```

**Scripts**
```bash
pnpm dev          # Start dev server (localhost:3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

**Exports** (via workspace reference)
- Imports: `@sql-sandbox/shared` (types), `@sql-sandbox/ui` (components)

**Key Features (Phase 01)**
- App Router (pages as directories)
- Tailwind CSS configured
- TypeScript strict mode
- Ready for shadcn/ui components (Phase 05)

**TODO (Phase 02+)**
- Create workspace pages (`app/workspaces/[id]/page.tsx`)
- Add Monaco SQL editor
- Integrate React Flow for query visualization
- Build seed form UI
- Build query history table

### apps/api — NestJS Backend

**Package**: `@sql-sandbox/api`

**Key Dependencies**
- `@nestjs/core@10.4.0`, `@nestjs/common@10.4.0` — Framework
- `@nestjs/config@3.3.0` — Environment config
- `@nestjs/platform-express@10.4.0` — HTTP adapter
- `class-validator@0.14.0`, `class-transformer@0.5.1` — DTO validation
- `pg@8.13.0` — PostgreSQL driver
- `typescript@5.7.0` — Type safety
- `jest@29.7.0`, `ts-jest@29.2.0` — Testing
- `eslint@8.57.0` — Linting

**Structure**
```
apps/api/
├── src/
│   ├── main.ts                 # Bootstrap (GlobalPrefix, CORS, ValidationPipe)
│   ├── app.module.ts           # Root module (ConfigModule)
│   ├── app.controller.ts       # Health check endpoint
│   ├── workspace/              # Feature module (Phase 02)
│   ├── query/                  # Feature module (Phase 03)
│   ├── seed/                   # Feature module (Phase 04)
│   ├── snippet/                # Feature module (Phase 05)
│   ├── lab/                    # Feature module (Phase 06)
│   └── analyzer/               # Feature module (Phase 07)
├── test/
│   └── jest-e2e.json           # E2E test config
├── jest.config.js              # Unit test config
├── tsconfig.json
└── package.json
```

**Scripts**
```bash
pnpm dev          # Start with hot-reload (watch mode)
pnpm build        # Compile to dist/
pnpm start        # Run compiled code
pnpm start:prod   # Production mode
pnpm lint         # Fix linting errors
pnpm test         # Run unit tests
pnpm test:e2e     # Run E2E tests
```

**Configuration (from .env)**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sql_sandbox
SANDBOX_DB_URL=postgresql://sandbox_user:sandbox_pass@localhost:5432/sql_sandbox
REDIS_URL=redis://localhost:6379
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

**Key Features (Phase 01)**
- ConfigModule for environment injection (isGlobal: true)
- Global ValidationPipe (whitelist, forbidNonWhitelisted, transform)
- CORS enabled for localhost:3000
- Health check endpoint: `GET /api`

**Endpoint Structure (to be implemented)**
```
POST   /api/workspaces              # Create workspace
GET    /api/workspaces/:id          # Get workspace
DELETE /api/workspaces/:id          # Delete workspace

POST   /api/workspaces/:id/queries  # Execute query
GET    /api/workspaces/:id/queries  # List query history

POST   /api/workspaces/:id/seeds    # Run seeder
GET    /api/workspaces/:id/seeds    # List seed profiles

POST   /api/workspaces/:id/snippets # Save snippet
GET    /api/workspaces/:id/snippets # List snippets

POST   /api/workspaces/:id/analyze  # Execute 7-layer analysis
```

**TODO (Phase 02+)**
- Create workspace modules (service, controller, dto)
- Implement database integration (getDb, getPool)
- Add BullMQ workers for async jobs
- Implement guards for workspace ownership
- Add database transaction handling

## Packages

### packages/db — Drizzle ORM + Schema

**Package**: `@sql-sandbox/db`

**Key Dependencies**
- `drizzle-orm@0.36.0` — Type-safe ORM
- `pg@8.13.0` — PostgreSQL driver
- `drizzle-kit@0.28.0` (dev) — Schema generation & migration

**Exports** (in package.json)
```json
{
  ".": "./src/index.ts",
  "./schema": "./src/schema.ts",
  "./connection": "./src/connection.ts"
}
```

**Files**

#### src/index.ts
```typescript
export * from './schema';                              // All table definitions
export { getPool, getDb, closePool } from './connection';
```

**Exports:**
- `workspaces` — Workspace table
- `workspaceTemplates` — Template table
- `queryHistory` — Query logs
- `savedSnippets` — SQL snippets
- `seedProfiles` — Seeder configs
- `labSessions` — Transaction lab sessions
- `llmConfigs` — LLM provider settings
- `getPool()` — Get connection pool instance
- `getDb(workspaceId)` — Get Drizzle client scoped to workspace schema
- `closePool()` — Close pool (graceful shutdown)

#### src/schema.ts
Drizzle table definitions (7 tables, all with cascading deletes on workspace deletion):

| Table | Purpose |
|-------|---------|
| `workspaces` | Workspace metadata (name, schemaName, templateId) |
| `workspaceTemplates` | Pre-built SQL schemas for quick start |
| `queryHistory` | Execution logs (sql, durationMs, rowCount, error) |
| `savedSnippets` | Reusable SQL queries (with tags array) |
| `seedProfiles` | Mock data configs (jsonb) |
| `labSessions` | Transaction simulation environments |
| `llmConfigs` | LLM provider settings (encrypted keys) |

#### src/connection.ts
PostgreSQL connection pool + Drizzle instance:

```typescript
export const getPool(): Pool
  // Returns pg.Pool instance with 10 max connections

export const getDb(workspaceId: string): Database
  // Returns Drizzle client with SET search_path = workspace_xyz
  // All queries scoped to workspace schema

export const closePool(): Promise<void>
  // Gracefully closes pool (called on app shutdown)
```

**Scripts**
```bash
pnpm generate   # Generate Drizzle migrations (drizzle-kit generate)
pnpm migrate    # Apply pending migrations (drizzle-kit migrate)
pnpm push       # Push schema to database (drizzle-kit push)
pnpm studio     # Open visual DB editor (http://localhost:5555)
```

**Migrations Directory**
```
migrations/
└── 0000_YYYYMMDD_init.sql  # Initial schema (auto-generated)
```

**Configuration** (drizzle.config.ts)
```typescript
export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
});
```

### packages/shared — TypeScript Types

**Package**: `@sql-sandbox/shared`

**Exports** (in package.json)
```json
{
  ".": "./src/index.ts",
  "./types/*": "./src/types/*.ts"
}
```

**Files**

#### src/index.ts
```typescript
export * from './types/api';
export * from './types/database';
```

#### src/types/api.ts (to be created)
API request/response types:
- CreateWorkspaceRequest, CreateWorkspaceResponse
- ExecuteQueryRequest, ExecuteQueryResponse
- ListQueryHistoryResponse
- CreateSnippetRequest, SaveSnippetResponse
- AnalyzerResponse (7 layers)

#### src/types/database.ts (to be created)
Database entity types inferred from Drizzle schema:
- Workspace, WorkspaceTemplate
- QueryHistory, SavedSnippet
- SeedProfile, LabSession
- LLMConfig

**Usage**
```typescript
import { CreateWorkspaceRequest } from '@sql-sandbox/shared';
import { Workspace } from '@sql-sandbox/shared/types/database';
```

### packages/ui — Tailwind Utilities + shadcn/ui

**Package**: `@sql-sandbox/ui`

**Key Dependencies**
- `react@18.3.0`, `react-dom@18.3.0` — UI library
- `tailwindcss@3.4.0` — Styling framework
- `clsx@2.1.0`, `tailwind-merge@2.5.0` — Class merging
- `class-variance-authority@0.7.0` — Component variants
- `lucide-react@0.460.0` — Icon library
- `tailwindcss-animate@1.0.7` — Animation utilities

**Exports** (in package.json)
```json
{
  ".": "./src/index.ts",
  "./components/*": "./src/components/*.tsx"
}
```

**Files**

#### src/index.ts
```typescript
export { cn } from './utils';
export * from './components';
```

**Exports:**
- `cn()` — Tailwind merge utility function

#### src/utils.ts
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with conflict resolution
 * @example cn('px-2 px-4', 'py-1') → 'px-4 py-1'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

**Components Directory** (Phase 05+)
```
src/components/
├── button.tsx              # shadcn/ui Button wrapper
├── input.tsx               # shadcn/ui Input wrapper
├── textarea.tsx            # shadcn/ui TextArea wrapper
├── select.tsx              # shadcn/ui Select wrapper
├── card.tsx                # shadcn/ui Card wrapper
├── dialog.tsx              # shadcn/ui Dialog wrapper
└── ...                     # Other shadcn/ui components
```

**Usage**
```typescript
import { cn } from '@sql-sandbox/ui';
import { Button } from '@sql-sandbox/ui/components/button';

// In component
<Button className={cn('px-4', disabled && 'opacity-50')} />
```

## Database Schema Details

### Tables Overview

```sql
-- workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  schema_name TEXT UNIQUE NOT NULL,
  description TEXT,
  template_id UUID REFERENCES workspace_templates(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- workspace_templates
CREATE TABLE workspace_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  schema_sql TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- query_history
CREATE TABLE query_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sql TEXT NOT NULL,
  duration_ms INTEGER,
  row_count INTEGER,
  error TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_query_history_workspace_id ON query_history(workspace_id, executed_at);

-- saved_snippets
CREATE TABLE saved_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sql TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- seed_profiles
CREATE TABLE seed_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- lab_sessions
CREATE TABLE lab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT,
  scenario_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- llm_configs
CREATE TABLE llm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'openrouter' NOT NULL,
  model TEXT DEFAULT 'deepseek/deepseek-chat' NOT NULL,
  api_key_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Environment Variables

```
# Database connections
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sql_sandbox
SANDBOX_DB_URL=postgresql://sandbox_user:sandbox_pass@localhost:5432/sql_sandbox

# Cache
REDIS_URL=redis://localhost:6379

# API
API_PORT=3001
CORS_ORIGIN=http://localhost:3000

# LLM (Phase 08)
LLM_PROVIDER=openrouter
LLM_MODEL=deepseek/deepseek-chat
LLM_API_KEY=

# Node
NODE_ENV=development
```

## Key Files Not Yet Created

| File | Phase | Purpose |
|------|-------|---------|
| `apps/api/src/workspace/*` | 02 | Workspace CRUD module |
| `apps/api/src/query/*` | 03 | Query execution module |
| `apps/api/src/seed/*` | 04 | Seeding module |
| `apps/api/src/snippet/*` | 05 | Snippet management |
| `apps/api/src/lab/*` | 06 | Lab session module |
| `apps/api/src/analyzer/*` | 07 | 7-layer analyzer |
| `apps/web/app/workspaces/[id]/*` | 02 | Workspace pages |
| `apps/web/components/*` | 05 | UI components |
| `packages/db/migrations/*` | 02 | SQL migrations |
| `packages/shared/src/types/*` | 02 | Type definitions |

## Dependencies Graph

```
apps/web
├─ depends on: @sql-sandbox/shared (types)
├─ depends on: @sql-sandbox/ui (components, utils)
└─ no backend dependency (API via HTTP)

apps/api
├─ depends on: @sql-sandbox/db (schema, connection)
├─ depends on: @sql-sandbox/shared (types, DTOs)
└─ no frontend dependency

@sql-sandbox/shared
├─ depends on: nothing (pure types)
└─ consumed by: web, api

@sql-sandbox/ui
├─ depends on: react, tailwindcss
└─ consumed by: web

@sql-sandbox/db
├─ depends on: drizzle-orm, pg
└─ consumed by: api
```

## Build & Development Commands

| Command | What It Does |
|---------|--------------|
| `pnpm install` | Install all dependencies across workspaces |
| `pnpm dev` | Start web + api in development (watch mode) |
| `pnpm build` | Compile all packages (web → .next, api → dist) |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm test` | Run Jest tests across all packages |
| `pnpm format` | Format all files with Prettier |
| `pnpm db:generate` | Create Drizzle migrations from schema |
| `pnpm db:migrate` | Apply migrations to database |
| `pnpm db:studio` | Open Drizzle Studio (visual editor) |

## Next Steps (Phase 02)

1. Create workspace service + controller
2. Implement workspace CRUD endpoints
3. Add workspace template engine
4. Create workspace pages in Next.js
5. Write integration tests for workspace routes
6. Update shared types with API responses
