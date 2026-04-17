import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

let pool: Pool | null = null;

/** Get or create the system DB connection pool */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/sql_sandbox',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

/** Get the Drizzle ORM instance for system DB queries */
export function getDb() {
  return drizzle(getPool(), { schema });
}

/** Gracefully close the pool */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
