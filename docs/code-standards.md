# Code Standards & Conventions

## File Naming

### TypeScript/JavaScript
- **kebab-case** for all files: `query-analyzer.service.ts`, `workspace.controller.ts`
- Self-documenting names preferred over abbreviations
- Group related files: `src/workspace/workspace.service.ts`, `src/workspace/workspace.controller.ts`

### Example Structure
```
src/
├── workspace/
│   ├── workspace.module.ts
│   ├── workspace.service.ts
│   ├── workspace.controller.ts
│   ├── dto/
│   │   ├── create-workspace.dto.ts
│   │   └── update-workspace.dto.ts
│   └── entities/
│       └── workspace.entity.ts
├── query/
│   ├── query-executor.service.ts
│   ├── query-analyzer.service.ts
│   └── query.controller.ts
```

### Markdown
- **kebab-case** for docs: `project-overview-pdr.md`, `system-architecture.md`

## Module Structure (NestJS)

Each feature is self-contained:

```typescript
// workspace.module.ts
import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],  // If consumed by other modules
})
export class WorkspaceModule {}
```

### Service Layer
```typescript
// workspace.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { getDb } from '@sql-sandbox/db';

@Injectable()
export class WorkspaceService {
  async create(dto: CreateWorkspaceDto) {
    // Business logic here
    // Throw typed exceptions: BadRequestException, NotFoundException, etc.
  }

  async findById(id: string) {
    // Always validate existence
  }

  async delete(id: string) {
    // Cascade cleanup
  }
}
```

### Controller Layer
```typescript
// workspace.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  async create(@Body() dto: CreateWorkspaceDto) {
    return await this.workspaceService.create(dto);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return await this.workspaceService.findById(id);
  }
}
```

### DTO (Data Transfer Objects)
```typescript
// dto/create-workspace.dto.ts
import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  templateId?: string;
}
```

## TypeScript Standards

### Strict Mode
- **Required**: All files use strict mode
- All variables must have explicit types
- No implicit `any`

```typescript
// ✓ Good
const workspaceId: string = 'abc123';
const count: number = workspaces.length;
const config: Record<string, unknown> = {};

// ✗ Bad
const workspaceId = 'abc123';  // Inferred, but ambiguous
const data: any = {};           // Never use any
```

### Imports/Exports
```typescript
// ✓ Good — explicit, organized
import { Injectable } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { getDb, getPool } from '@sql-sandbox/db';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

// ✗ Bad — wildcard imports
import * as common from '@nestjs/common';
```

### Error Handling
```typescript
// ✓ Good — typed exceptions
import { BadRequestException, NotFoundException } from '@nestjs/common';

async findById(id: string) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, id),
  });

  if (!workspace) {
    throw new NotFoundException(`Workspace ${id} not found`);
  }

  return workspace;
}

// ✗ Bad — generic errors
throw new Error('Not found');
```

### Async/Await
```typescript
// ✓ Good
async execute(sql: string): Promise<QueryResult[]> {
  const start = Date.now();
  const result = await pool.query(sql);
  const duration = Date.now() - start;
  return result.rows;
}

// ✗ Bad — mixing promises
execute(sql: string) {
  return pool.query(sql).then(r => r.rows);
}
```

## Drizzle ORM Patterns

### Query Examples
```typescript
// ✓ Good — type-safe queries
import { eq, desc } from 'drizzle-orm';
import { getDb } from '@sql-sandbox/db';
import { queryHistory } from '@sql-sandbox/db';

const db = getDb(workspaceId);

// Single query
const workspace = await db.query.workspaces.findFirst({
  where: eq(workspaces.id, id),
});

// List with filter
const recent = await db.query.queryHistory.findMany({
  where: eq(queryHistory.workspaceId, workspaceId),
  orderBy: desc(queryHistory.executedAt),
  limit: 10,
});

// Insert
await db.insert(queryHistory).values({
  workspaceId,
  sql: 'SELECT * FROM users',
  durationMs: 45,
  rowCount: 100,
});

// Update
await db.update(workspaces)
  .set({ name: newName, updatedAt: new Date() })
  .where(eq(workspaces.id, id));

// Delete with cascade
await db.delete(workspaces).where(eq(workspaces.id, id));
```

### Connection Management
```typescript
// ✓ Good — proper cleanup
import { getDb, closePool } from '@sql-sandbox/db';

async executeQuery(sql: string) {
  const db = getDb(workspaceId);
  try {
    const result = await db.execute(sql);
    return result;
  } catch (error) {
    throw new BadRequestException(`Query error: ${error.message}`);
  }
  // Pool is reused, don't close per query
}

// At app shutdown
process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
```

## React/Next.js Standards

### Component Structure
```typescript
// ✓ Good — functional component with clear exports
'use client';  // Mark as client component if needed

import { ReactNode } from 'react';
import { cn } from '@sql-sandbox/ui';

interface QueryEditorProps {
  initialSql?: string;
  onExecute: (sql: string) => Promise<void>;
  isLoading?: boolean;
}

export function QueryEditor({
  initialSql = '',
  onExecute,
  isLoading = false,
}: QueryEditorProps) {
  const [sql, setSql] = useState(initialSql);

  const handleExecute = async () => {
    try {
      await onExecute(sql);
    } catch (error) {
      console.error('Execution failed:', error);
    }
  };

  return (
    <div className={cn('p-4', { 'opacity-50': isLoading })}>
      <textarea value={sql} onChange={(e) => setSql(e.target.value)} />
      <button onClick={handleExecute} disabled={isLoading}>
        Execute
      </button>
    </div>
  );
}
```

### API Routes (App Router)
```typescript
// app/api/workspaces/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/services/workspace.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspace = await WorkspaceService.create(body);
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
```

### Tailwind + shadcn/ui
```typescript
// ✓ Good — using cn() utility
import { cn } from '@sql-sandbox/ui';
import { Button } from '@sql-sandbox/ui/components/button';

export function QueryButton({ variant, disabled }: Props) {
  return (
    <Button
      className={cn(
        'px-4 py-2',
        disabled && 'opacity-50 cursor-not-allowed',
        variant === 'primary' && 'bg-blue-600'
      )}
      disabled={disabled}
    >
      Execute
    </Button>
  );
}
```

## Testing Standards

### Unit Tests (Jest)
```typescript
// workspace.service.spec.ts
import { Test } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [WorkspaceService],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  it('should create a workspace', async () => {
    const result = await service.create({
      name: 'test-workspace',
    });

    expect(result).toHaveProperty('id');
    expect(result.name).toBe('test-workspace');
  });

  it('should throw on duplicate name', async () => {
    await service.create({ name: 'duplicate' });

    await expect(
      service.create({ name: 'duplicate' })
    ).rejects.toThrow('Workspace already exists');
  });
});
```

### E2E Tests
```typescript
// test/workspace.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';

describe('Workspace (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/workspaces (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/workspaces')
      .send({ name: 'e2e-test' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

## Documentation Standards

### JSDoc Comments
```typescript
/**
 * Execute SQL query in workspace context with analysis
 * @param workspaceId - Workspace ID to scope query
 * @param sql - SQL query string
 * @returns Query result with execution metrics
 * @throws BadRequestException if SQL is invalid
 */
async executeQuery(
  workspaceId: string,
  sql: string
): Promise<QueryResult> {
  // Implementation
}
```

### Complex Logic Comments
```typescript
// Only comment WHY, not WHAT (code already shows what)

// ✓ Good
// Batch inserts to avoid connection exhaustion
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  await db.insert(users).values(batch);
}

// ✗ Bad
// Loop through records in batches
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  await db.insert(users).values(batch);
}
```

## Commit Message Format

Use Conventional Commits:

```
feat: add workspace creation endpoint
fix: resolve query timeout on large result sets
docs: update API documentation with examples
refactor: extract database connection logic
test: add unit tests for seeding service
chore: upgrade dependencies
```

Format: `<type>: <subject (max 50 chars)>`

## Linting & Formatting

### ESLint Rules
- No unused variables
- No explicit `any`
- No console logs in production code
- Require await on async functions

### Prettier Configuration
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### Run Before Commit
```bash
pnpm lint          # ESLint
pnpm format        # Prettier
pnpm test          # Jest
pnpm build         # TypeScript compilation
```

## Performance Guidelines

### Database Queries
- Always paginate list endpoints (default 20 items)
- Index queryHistory on (workspaceId, executedAt)
- Use connection pooling (max 10 per workspace)
- Avoid N+1 queries (use joins)

### API Responses
- Compress payloads (gzip enabled)
- Cache frequent queries (1-hour TTL in Redis)
- Lazy-load related data (separate endpoints)
- Limit result set: `SELECT ... LIMIT 1000`

### Frontend
- Use React.memo for expensive components
- Lazy-load code with dynamic imports
- Preload Monaco editor on workspace load
- Cache query results in browser storage (1 hour)

## Security Guidelines

### Input Validation
- Never trust user input
- Always validate via DTO + class-validator
- Sanitize SQL before execution (no direct queries)
- Validate UUIDs before database operations

### Secrets
- Never log sensitive data
- Environment-based injection only
- Encrypt LLM API keys at rest
- Use sandbox role for queries (no superuser)

### Database
- Row-level security ready (Phase 08)
- Always use parameterized queries (Drizzle)
- Limit sandbox role privileges
- Audit logs for admin operations

## Size Limits

### Code Files
- Keep individual files under 200 LOC
- Split large services into focused modules
- Move utilities to separate files

### Documentation
- Keep each markdown under 800 lines
- Split large topics into subtopics
- Link between related docs

## Checklist Before Commit

- [ ] No TypeScript errors (`pnpm build`)
- [ ] All tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Code formatted (`pnpm format`)
- [ ] No console.log in production code
- [ ] No hardcoded values (use env vars)
- [ ] Error messages are user-friendly
- [ ] Related docs updated
- [ ] Commit message follows Conventional Commits
