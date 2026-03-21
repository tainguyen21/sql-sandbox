import { Injectable } from '@nestjs/common';
import { LabSessionManagerService } from './lab-session-manager.service';
import { SandboxPoolService } from '../database/sandbox-pool.service';

export interface LockRow {
  pid: number;
  session: 'A' | 'B' | 'other';
  locktype: string;
  relation: string | null;
  mode: string;
  granted: boolean;
  state: string | null;
  query: string | null;
}

/** Query pg_locks joined with pg_stat_activity filtered to lab session PIDs */
const LOCK_QUERY = `
  SELECT
    l.pid,
    l.locktype,
    l.relation::regclass::text AS relation,
    l.mode,
    l.granted,
    a.state,
    a.query
  FROM pg_locks l
  JOIN pg_stat_activity a ON l.pid = a.pid
  WHERE l.pid IN ($1, $2)
  ORDER BY l.granted, l.pid
`;

/**
 * Queries pg_locks for the two session PIDs of a lab.
 * Results annotate each row with 'A' or 'B' session label.
 */
@Injectable()
export class LockViewerService {
  constructor(
    private readonly sessionManager: LabSessionManagerService,
    private readonly sandboxPool: SandboxPoolService,
  ) {}

  /** Get lock snapshot for a lab session's two PIDs */
  async getLocksSnapshot(labId: string): Promise<{ locks: LockRow[]; pidA: number; pidB: number }> {
    const session = this.sessionManager.getSession(labId);
    const { pidA, pidB } = session;

    try {
      // Use sandbox pool (system-level query on pg_locks — not workspace-scoped)
      const client = await this.sandboxPool.getClient();
      let rows: any[] = [];
      try {
        const result = await client.query(LOCK_QUERY, [pidA, pidB]);
        rows = result.rows;
      } finally {
        client.release();
      }

      const locks: LockRow[] = rows.map((row) => ({
        pid: row.pid,
        session: row.pid === pidA ? 'A' : row.pid === pidB ? 'B' : 'other',
        locktype: row.locktype,
        relation: row.relation,
        mode: row.mode,
        granted: row.granted,
        state: row.state,
        query: row.query,
      }));

      return { locks, pidA, pidB };
    } catch (err: any) {
      return { locks: [], pidA, pidB };
    }
  }
}
