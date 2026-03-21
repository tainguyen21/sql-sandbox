import { Injectable, OnModuleDestroy, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

/** Schema name validation regex */
const SCHEMA_NAME_REGEX = /^workspace_[a-z0-9]+$/;

/** Transaction state of a pg client */
export type TxState = 'IDLE' | 'IN TRANSACTION' | 'ERROR';

/** Persistent pair of pg.Client connections for a lab session */
export interface LabSession {
  labId: string;
  workspaceId: string;
  clientA: Client;
  clientB: Client;
  pidA: number;
  pidB: number;
  lastActiveAt: number;
}

/** 30 minutes TTL in milliseconds */
const SESSION_TTL_MS = 30 * 60 * 1000;
/** Cleanup interval: 5 minutes */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Manages two persistent pg.Client connections per lab session.
 * Raw clients (not pooled) so transaction state persists between commands.
 */
@Injectable()
export class LabSessionManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(LabSessionManagerService.name);
  private readonly sessions = new Map<string, LabSession>();
  private cleanupTimer: NodeJS.Timeout;

  constructor(private readonly config: ConfigService) {
    // Periodic cleanup of expired sessions
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL_MS);
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupTimer);
    // Close all sessions on shutdown
    const ids = Array.from(this.sessions.keys());
    await Promise.allSettled(ids.map((id) => this.destroySession(id)));
  }

  /** Create a new lab session with two persistent pg.Client connections */
  async createSession(workspaceId: string): Promise<string> {
    if (!SCHEMA_NAME_REGEX.test(workspaceId.replace(/-/g, ''))) {
      // workspaceId is a UUID, need schema name — accept it and derive schema
    }

    const labId = uuidv4();
    const connectionString =
      this.config.get<string>('SANDBOX_DB_URL') ||
      'postgresql://sandbox_user:sandbox_pass@localhost:5432/sql_sandbox';

    const clientA = new Client({ connectionString });
    const clientB = new Client({ connectionString });

    await clientA.connect();
    await clientB.connect();

    // Set up each client with workspace schema + statement timeout
    const schemaName = `workspace_${workspaceId.replace(/-/g, '')}`;
    for (const client of [clientA, clientB]) {
      await client.query(`SET search_path = "${schemaName}", public`);
      await client.query(`SET statement_timeout = '30s'`);
    }

    // Get backend PIDs for lock viewer queries
    const resA = await clientA.query('SELECT pg_backend_pid() AS pid');
    const resB = await clientB.query('SELECT pg_backend_pid() AS pid');

    const session: LabSession = {
      labId,
      workspaceId,
      clientA,
      clientB,
      pidA: resA.rows[0].pid,
      pidB: resB.rows[0].pid,
      lastActiveAt: Date.now(),
    };

    this.sessions.set(labId, session);
    this.logger.log(`Lab session created: ${labId} (pids: ${session.pidA}, ${session.pidB})`);
    return labId;
  }

  /** Get a lab session, throws if not found */
  getSession(labId: string): LabSession {
    const session = this.sessions.get(labId);
    if (!session) {
      throw new NotFoundException(`Lab session not found: ${labId}`);
    }
    session.lastActiveAt = Date.now();
    return session;
  }

  /** Destroy a lab session — rollback, close connections */
  async destroySession(labId: string): Promise<void> {
    const session = this.sessions.get(labId);
    if (!session) return;

    this.sessions.delete(labId);

    await Promise.allSettled([
      session.clientA.query('ROLLBACK').catch(() => {}),
      session.clientB.query('ROLLBACK').catch(() => {}),
    ]);
    await Promise.allSettled([
      session.clientA.end(),
      session.clientB.end(),
    ]);

    this.logger.log(`Lab session destroyed: ${labId}`);
  }

  /** Check if session exists */
  hasSession(labId: string): boolean {
    return this.sessions.has(labId);
  }

  /** Remove expired sessions (idle for > 30min) */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    for (const [labId, session] of this.sessions.entries()) {
      if (now - session.lastActiveAt > SESSION_TTL_MS) {
        this.logger.log(`Cleaning up expired lab session: ${labId}`);
        await this.destroySession(labId);
      }
    }
  }

  /** Get client for given session identifier ('a' | 'b') */
  getClient(session: LabSession, clientId: 'a' | 'b'): Client {
    return clientId === 'a' ? session.clientA : session.clientB;
  }
}
