import { Injectable, BadRequestException } from '@nestjs/common';
import { SqlValidatorService } from '../database/sql-validator.service';
import { LabSessionManagerService, TxState } from './lab-session-manager.service';
import { Client } from 'pg';

export interface ExecuteResult {
  rows: any[];
  rowCount: number;
  error?: string;
  txState: TxState;
  durationMs: number;
}

/** Derive transaction state from pg client's connection status field */
function getTxState(client: Client): TxState {
  // pg.Client exposes connection._transactionStatus as a Buffer/string: 'I', 'T', 'E'
  const conn = (client as any).connection;
  if (!conn) return 'IDLE';
  const status: string =
    typeof conn._transactionStatus === 'string'
      ? conn._transactionStatus
      : conn._transactionStatus?.toString?.() ?? 'I';
  if (status === 'T') return 'IN TRANSACTION';
  if (status === 'E') return 'ERROR';
  return 'IDLE';
}

/**
 * Executes SQL and transaction control commands on persistent lab session clients.
 */
@Injectable()
export class LabService {
  constructor(
    private readonly sessionManager: LabSessionManagerService,
    private readonly sqlValidator: SqlValidatorService,
  ) {}

  /** Execute arbitrary SQL on a session client */
  async execute(labId: string, clientId: 'a' | 'b', sql: string): Promise<ExecuteResult> {
    const session = this.sessionManager.getSession(labId);
    const client = this.sessionManager.getClient(session, clientId);

    // Validate SQL — allow transaction control keywords
    const trimmed = sql.trim().toUpperCase();
    const isTxControl = /^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|START\s+TRANSACTION)/i.test(trimmed);
    if (!isTxControl) {
      try {
        this.sqlValidator.validate(sql);
      } catch (err: any) {
        return { rows: [], rowCount: 0, error: err.message, txState: getTxState(client), durationMs: 0 };
      }
    }

    const start = Date.now();
    try {
      const result = await client.query(sql);
      return {
        rows: result.rows ?? [],
        rowCount: result.rowCount ?? 0,
        txState: getTxState(client),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        rows: [],
        rowCount: 0,
        error: err.message,
        txState: getTxState(client),
        durationMs: Date.now() - start,
      };
    }
  }

  /** BEGIN [ISOLATION LEVEL ...] */
  async begin(
    labId: string,
    clientId: 'a' | 'b',
    isolationLevel?: string,
  ): Promise<ExecuteResult> {
    const validLevels = ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'];
    if (isolationLevel && !validLevels.includes(isolationLevel.toUpperCase())) {
      throw new BadRequestException(`Invalid isolation level: ${isolationLevel}`);
    }

    const sql = isolationLevel
      ? `BEGIN ISOLATION LEVEL ${isolationLevel}`
      : 'BEGIN';

    return this.execute(labId, clientId, sql);
  }

  /** COMMIT */
  async commit(labId: string, clientId: 'a' | 'b'): Promise<ExecuteResult> {
    return this.execute(labId, clientId, 'COMMIT');
  }

  /** ROLLBACK */
  async rollback(labId: string, clientId: 'a' | 'b'): Promise<ExecuteResult> {
    return this.execute(labId, clientId, 'ROLLBACK');
  }
}
