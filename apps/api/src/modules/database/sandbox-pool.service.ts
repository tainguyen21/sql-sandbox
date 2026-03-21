import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';

/** Schema name validation regex — only allows workspace_<alphanumeric> */
const SCHEMA_NAME_REGEX = /^workspace_[a-z0-9]+$/;

/**
 * Manages a dedicated pg Pool for sandbox (user workspace) queries.
 * Separate from the Drizzle system DB pool.
 * All queries are scoped to a workspace schema via SET search_path.
 */
@Injectable()
export class SandboxPoolService implements OnModuleDestroy {
  private pool: Pool;

  constructor(private config: ConfigService) {
    this.pool = new Pool({
      connectionString:
        this.config.get<string>('SANDBOX_DB_URL') ||
        'postgresql://sandbox_user:sandbox_pass@localhost:5432/sql_sandbox',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /** Validate schema name to prevent injection */
  private validateSchemaName(name: string): void {
    if (!SCHEMA_NAME_REGEX.test(name)) {
      throw new Error(`Invalid schema name: ${name}`);
    }
  }

  /** Execute SQL within a workspace schema's search_path */
  async executeInWorkspace(schemaName: string, sql: string): Promise<{ rows: any[]; rowCount: number }> {
    this.validateSchemaName(schemaName);
    const client = await this.pool.connect();
    try {
      // Set search_path and statement timeout (30s max per query)
      await client.query(`SET search_path = "${schemaName}", public`);
      await client.query(`SET statement_timeout = '30s'`);
      const result = await client.query(sql);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    } finally {
      // Reset all session state before returning client to pool
      await client.query('RESET ALL').catch(() => {});
      client.release();
    }
  }

  /** Create a workspace schema */
  async createSchema(name: string): Promise<void> {
    this.validateSchemaName(name);
    const client = await this.pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${name}"`);
    } finally {
      client.release();
    }
  }

  /** Drop a workspace schema and all its objects */
  async dropSchema(name: string): Promise<void> {
    this.validateSchemaName(name);
    const client = await this.pool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    } finally {
      client.release();
    }
  }

  /** Get a raw client for multi-statement transactions (caller must release) */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
