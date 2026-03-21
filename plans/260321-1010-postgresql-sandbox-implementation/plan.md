---
title: "PostgreSQL Sandbox - Full Implementation Plan"
description: "Interactive PG learning platform: schema builder, query analyzer (7 layers), transaction lab, AI optimizer"
status: pending
priority: P1
effort: 120h
branch: main
tags: [postgresql, sandbox, monorepo, nestjs, nextjs, drizzle, query-analyzer]
created: 2026-03-21
---

# PostgreSQL Sandbox - Implementation Plan

## Research Reports
- [Monorepo Architecture](../reports/researcher-260321-1008-monorepo-architecture-guide.md)
- [PostgreSQL Internals / 7-Layer Analyzer](../reports/researcher-260321-1008-postgresql-internals-7layer-analyzer.md)

## Architecture Summary
- **Monorepo**: pnpm + Turborepo | `apps/web` (Next.js 14), `apps/api` (NestJS), `packages/{db,shared,ui}`
- **DB isolation**: schema-per-workspace (`SET search_path`), Drizzle ORM for system DB, raw `pg` for sandbox
- **Real-time**: SSE for query progress, polling for lock viewer
- **Jobs**: BullMQ + Redis for long-running analysis
- **Editor**: Monaco with custom SQL autocomplete
- **Visualization**: React Flow for ERD + plan tree, dagre for auto-layout

## Phases

| # | Phase | Est. | Status | Blocked By |
|---|-------|------|--------|------------|
| 01 | [Project Scaffolding](./phase-01-project-scaffolding.md) | 8h | completed | - |
| 02 | [Workspace & Schema Builder](./phase-02-workspace-and-schema-builder.md) | 12h | completed | 01 |
| 03 | [SQL Editor & Query History](./phase-03-sql-editor-and-query-history.md) | 10h | completed | 02 |
| 04 | [Form Builder, Seeder & ERD](./phase-04-form-builder-seeder-erd.md) | 14h | pending | 02 |
| 05 | [Query Analyzer Core](./phase-05-query-analyzer-core.md) | 16h | completed | 03 |
| 06 | [Query Analyzer Advanced](./phase-06-query-analyzer-advanced.md) | 12h | pending | 05 |
| 07 | [Index Manager](./phase-07-index-manager.md) | 6h | pending | 05 |
| 08 | [AI Optimizer & A/B Compare](./phase-08-ai-optimizer-ab-compare.md) | 10h | pending | 06 |
| 09 | [Transaction Lab](./phase-09-transaction-lab.md) | 12h | pending | 03 |
| 10 | [Write Path, Locks & WAL](./phase-10-write-path-locks-wal.md) | 10h | pending | 06, 09 |
| 11 | [Import/Export](./phase-11-import-export.md) | 8h | pending | 02 |

## Key Dependencies
- PostgreSQL 15+ (local or Docker)
- Redis (for BullMQ)
- Node.js 20+ / pnpm 9+
- LLM API key (Phase 8 only)

## Dependency Graph
```
01 → 02 → 03 → 05 → 06 → 08
            │         └→ 07
            │         └→ 10
            ├→ 04
            └→ 09 → 10
      02 → 11
```
