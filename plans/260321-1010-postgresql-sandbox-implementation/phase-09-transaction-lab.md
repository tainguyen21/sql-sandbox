# Phase 09 - Transaction Lab

## Context Links
- [Plan Overview](./plan.md)
- [Spec: Transaction Lab](../../pg-sandbox-prompt%20(1).md) (Section 8)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 12h
- **Blocked by**: Phase 03
- **Description**: Dual-session transaction experimentation with isolation levels, deadlock demos, lock visualizer, and guided lab scenarios.

## Key Insights
- Two persistent `pg.Client` connections (NOT pooled) per lab session for transaction state persistence
- Session state in Redis with TTL for cleanup
- Lock visualizer polls `pg_locks JOIN pg_stat_activity` every 500ms
- Pre-built scenarios: dirty read, phantom read, lost update, deadlock, SKIP LOCKED

## Requirements

### Functional
- Two-column layout: Session A (left) + Session B (right)
- Each session: SQL input, output log, transaction state indicator (IDLE/IN TRANSACTION/ERROR)
- Buttons: BEGIN, COMMIT, ROLLBACK, Execute SQL
- Isolation level picker: READ COMMITTED, REPEATABLE READ, SERIALIZABLE
- Lock visualizer: live table showing PID, locktype, relation, mode, granted
- Pre-built guided lab scenarios (step-by-step instructions)
- Session cleanup on lab close

### Non-functional
- Lock viewer updates every 500ms
- Sessions timeout after 30min of inactivity
- Max 2 concurrent lab sessions per workspace

## Architecture
```
Frontend (2 panels)          Backend (NestJS)              PostgreSQL
┌──────┐ ┌──────┐          ┌──────────────────┐
│Sess A│ │Sess B│ ──SSE──→ │ LabController    │ ──→ pg.Client A (persistent)
│      │ │      │          │ LabService       │ ──→ pg.Client B (persistent)
│Locks │ │      │ ←─poll── │ LockViewerSvc    │ ──→ pg_locks query
└──────┘ └──────┘          └──────────────────┘
                                    │
                               Redis (session state + TTL)
```

## Related Code Files

### Files to Create
- `apps/api/src/modules/lab/lab.module.ts`
- `apps/api/src/modules/lab/lab.controller.ts`
- `apps/api/src/modules/lab/lab.service.ts`
- `apps/api/src/modules/lab/lab-session-manager.service.ts`
- `apps/api/src/modules/lab/lock-viewer.service.ts`
- `apps/api/src/modules/lab/dto/lab-execute.dto.ts`
- `apps/api/src/modules/lab/scenarios/scenario-registry.ts`
- `apps/api/src/modules/lab/scenarios/dirty-read.scenario.ts`
- `apps/api/src/modules/lab/scenarios/phantom-read.scenario.ts`
- `apps/api/src/modules/lab/scenarios/lost-update.scenario.ts`
- `apps/api/src/modules/lab/scenarios/deadlock.scenario.ts`
- `apps/api/src/modules/lab/scenarios/skip-locked.scenario.ts`
- `packages/shared/src/types/lab.ts`
- `apps/web/app/workspaces/[id]/lab/page.tsx`
- `apps/web/components/lab/lab-layout.tsx`
- `apps/web/components/lab/session-panel.tsx`
- `apps/web/components/lab/session-output-log.tsx`
- `apps/web/components/lab/transaction-state-badge.tsx`
- `apps/web/components/lab/isolation-level-picker.tsx`
- `apps/web/components/lab/lock-viewer-panel.tsx`
- `apps/web/components/lab/scenario-picker.tsx`
- `apps/web/components/lab/scenario-guide.tsx`
- `apps/web/hooks/use-lab-session.ts`
- `apps/web/hooks/use-lock-viewer.ts`

## Implementation Steps

1. **LabSessionManagerService** (`apps/api/src/modules/lab/lab-session-manager.service.ts`)
   - Manage persistent `pg.Client` pairs (A + B) per lab session
   - Store session metadata in Redis with 30min TTL
   - `createSession(workspaceId)`: create 2 pg.Client connections, SET search_path, store in Map
   - `getSession(labId)`: retrieve client pair
   - `destroySession(labId)`: ROLLBACK on both, close connections, remove from Redis
   - Cleanup: periodic job removes expired sessions

2. **LabService** (`apps/api/src/modules/lab/lab.service.ts`)
   - `execute(labId, session: 'A' | 'B', sql)`: get client, execute, return result + new transaction state
   - `begin(labId, session, isolationLevel)`: `BEGIN ISOLATION LEVEL ...`
   - `commit(labId, session)`: COMMIT
   - `rollback(labId, session)`: ROLLBACK
   - Track transaction state per session: IDLE, IN_TRANSACTION, ERROR
   - Record to lab_sessions table in system DB

3. **LockViewerService** (`apps/api/src/modules/lab/lock-viewer.service.ts`)
   - `getLocksSnapshot(labId)`: query `pg_locks JOIN pg_stat_activity` filtered to lab PIDs
   - Return: `[{ pid, locktype, relation, mode, granted, waitStart, query }]`
   - Highlight blocked locks (granted = false)
   - Show which session (A or B) holds each lock via PID mapping

4. **Scenario registry** (`apps/api/src/modules/lab/scenarios/scenario-registry.ts`)
   - Each scenario: `{ id, name, description, steps: [{ session, instruction, sql, explanation }] }`
   - Scenarios: dirty-read (explain PG doesn't support READ UNCOMMITTED), non-repeatable-read, phantom-read, lost-update, deadlock, skip-locked
   - Frontend shows step-by-step guide, user executes each step

5. **LabController**
   - `POST /labs` → createSession (returns labId)
   - `POST /labs/:id/sessions/:session/execute` → execute SQL
   - `POST /labs/:id/sessions/:session/begin` → begin with isolation level
   - `POST /labs/:id/sessions/:session/commit`
   - `POST /labs/:id/sessions/:session/rollback`
   - `GET /labs/:id/locks` → lock snapshot (polled by frontend)
   - `DELETE /labs/:id` → destroy session

6. **Lab layout** (`apps/web/components/lab/lab-layout.tsx`)
   - Two-column layout: Session A | Session B
   - Lock viewer panel below (collapsible)
   - Scenario picker in header

7. **Session panel** (`apps/web/components/lab/session-panel.tsx`)
   - SQL input (Monaco mini editor)
   - Execute button + keyboard shortcut
   - BEGIN/COMMIT/ROLLBACK buttons
   - Isolation level dropdown
   - Transaction state badge (green=IDLE, yellow=IN_TRANSACTION, red=ERROR)
   - Output log: scrollable list of executed commands + results

8. **Lock viewer panel** (`apps/web/components/lab/lock-viewer-panel.tsx`)
   - Poll `GET /labs/:id/locks` every 500ms when lab is active
   - Table: PID (mapped to Session A/B), locktype, relation, mode, granted
   - Blocked locks highlighted in red
   - Show "Session A is blocking Session B" when applicable

9. **Scenario guide** (`apps/web/components/lab/scenario-guide.tsx`)
   - Step-by-step walkthrough panel
   - Each step shows: which session, instruction, SQL to execute, explanation
   - "Run this step" auto-fills SQL in correct session panel
   - Progress indicator

## Todo List
- [ ] Implement LabSessionManagerService (persistent pg.Client pairs + Redis)
- [ ] Implement LabService (execute, begin, commit, rollback)
- [ ] Implement LockViewerService (pg_locks polling)
- [ ] Create scenario definitions (5 scenarios)
- [ ] Implement LabController
- [ ] Build lab layout (two-column)
- [ ] Build session panel with SQL input + controls
- [ ] Build transaction state badge
- [ ] Build lock viewer panel with polling
- [ ] Build scenario picker + guide
- [ ] Add session cleanup on timeout/close
- [ ] Test deadlock scenario end-to-end

## Success Criteria
- Two sessions can run transactions independently
- Isolation levels affect visibility (repeatable read shows snapshot)
- Deadlock scenario triggers PG deadlock detection error
- Lock viewer shows real-time lock state with blocking info
- Sessions clean up on close/timeout

## Risk Assessment
- **Connection leaks**: Must guarantee cleanup on disconnect/timeout; use Redis TTL + periodic cleanup job
- **Deadlock in cleanup**: ROLLBACK with timeout on cleanup
- **Polling overhead**: 500ms polling is fine for 1-2 concurrent labs; throttle if more

## Security Considerations
- Lab sessions scoped to workspace schema
- SQL validation same as regular query execution
- Session timeout prevents resource exhaustion
- Max 2 concurrent labs per workspace

## Next Steps
- Phase 10: Lock viewer integration into analyzer (Layer 6)
