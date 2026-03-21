import { Injectable } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import type { PlanSignal } from '@sql-sandbox/shared';

interface LockRow {
  locktype: string;
  relation: string | null;
  mode: string;
  granted: boolean;
}

export interface LockSnapshot {
  locktype: string;
  relation: string | null;
  mode: string;
  granted: boolean;
}

/**
 * Layer 6 — Lock detector.
 * Snapshots pg_locks for the current backend PID before and during query execution.
 * Reports all acquired locks with mode/type and flags table-level locks that block reads.
 */
@Injectable()
export class Layer6DetectorService {
  constructor(private sandbox: SandboxPoolService) {}

  /** Query that returns pg_locks for current backend */
  private readonly LOCK_QUERY = `
    SELECT
      l.locktype,
      l.relation::regclass::text AS relation,
      l.mode,
      l.granted
    FROM pg_locks l
    WHERE l.pid = pg_backend_pid()
      AND l.locktype = 'relation'
  `;

  /**
   * Detect locks acquired during DML or SELECT execution.
   * Uses a dedicated client to capture locks mid-flight.
   */
  async detect(schemaName: string, sql: string): Promise<{ locks: LockSnapshot[]; signals: PlanSignal[] }> {
    const client = await this.sandbox.getClient();
    let locks: LockSnapshot[] = [];

    try {
      await client.query(`SET search_path = "${schemaName}", public`);
      await client.query(`SET statement_timeout = '30s'`);

      // Run the query (wrapped in transaction so we can inspect mid-state)
      await client.query('BEGIN');

      // Execute the actual query to acquire locks
      await client.query(sql).catch(() => {
        // Ignore errors — we only care about lock state
      });

      // Snapshot locks while transaction is open
      const { rows } = await client.query<LockRow>(this.LOCK_QUERY);
      locks = rows.map((r) => ({
        locktype: r.locktype,
        relation: r.relation,
        mode: r.mode,
        granted: r.granted,
      }));
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      await client.query('RESET ALL').catch(() => {});
      client.release();
    }

    const signals = this.buildSignals(locks);
    return { locks, signals };
  }

  private buildSignals(locks: LockSnapshot[]): PlanSignal[] {
    const signals: PlanSignal[] = [];

    // Table-level locks that block concurrent reads (ShareLock and above)
    const blockingModes = ['ShareLock', 'ShareRowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock'];

    for (const lock of locks) {
      if (!lock.granted) {
        signals.push({
          layer: 6,
          type: 'lock_acquired',
          severity: 'critical',
          table: lock.relation ?? undefined,
          message: `Lock "${lock.mode}" on "${lock.relation}" is WAITING (not granted) — possible deadlock or contention`,
          explanation:
            'A lock is being waited on. This means another transaction holds a conflicting lock, causing this query to block until that transaction completes.',
          suggestion: 'Review concurrent transactions and ensure short transaction durations. Consider using SELECT ... FOR UPDATE SKIP LOCKED for queue patterns.',
        });
      } else if (blockingModes.includes(lock.mode)) {
        signals.push({
          layer: 6,
          type: 'lock_acquired',
          severity: lock.mode === 'AccessExclusiveLock' ? 'critical' : 'warning',
          table: lock.relation ?? undefined,
          message: `Table-level lock "${lock.mode}" acquired on "${lock.relation}" — blocks concurrent operations`,
          explanation:
            'This lock mode conflicts with concurrent reads (AccessShareLock) or writes. AccessExclusiveLock (used by DDL, TRUNCATE, VACUUM FULL) blocks all access.',
          suggestion:
            lock.mode === 'AccessExclusiveLock'
              ? 'Avoid DDL/TRUNCATE on busy tables. Use CREATE INDEX CONCURRENTLY instead of CREATE INDEX.'
              : 'Consider using row-level locks (SELECT ... FOR UPDATE) instead of table-level locks when possible.',
        });
      }
    }

    return signals;
  }
}
