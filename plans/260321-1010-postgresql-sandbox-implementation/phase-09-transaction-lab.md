# Phase 09 - Transaction Lab

## Context Links
- [Plan Overview](./plan.md)
- [Spec: Transaction Lab](../../pg-sandbox-prompt%20(1).md) (Section 8)

## Overview
- **Priority**: P2
- **Status**: completed
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

### Files Created
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

## Implementation

1. **LabSessionManagerService** - Persistent pg.Client pairs per session with Redis TTL
2. **LabService** - Execute, begin, commit, rollback with transaction state tracking
3. **LockViewerService** - Real-time pg_locks polling with session annotation
4. **Scenario registry** - Pre-built lab scenarios (dirty-read, phantom-read, lost-update, deadlock, skip-locked)
5. **LabController** - 7 endpoints for session CRUD and lock viewing
6. **Lab layout** - Dual-panel interface with lock viewer
7. **Session panel** - SQL editor, transaction controls, output log
8. **Lock viewer panel** - Real-time lock table with 500ms polling
9. **Scenario guide** - Step-by-step walkthrough for each lab scenario

## Completion

All requirements implemented and integrated:
- Dual-session transaction lab with persistent connections
- Isolation level support (READ COMMITTED, REPEATABLE READ, SERIALIZABLE)
- Real-time lock visualization with pg_locks polling (500ms)
- Transaction state tracking (IDLE/IN TRANSACTION/ERROR)
- Pre-built lab scenarios with step-by-step guidance
- Session cleanup with Redis TTL (30min default)
- Blocking detection and visualization
- Integration with workspace interface

## Next Steps
- Phase 10: Lock viewer integration into query analyzer (Layers 6+7)
