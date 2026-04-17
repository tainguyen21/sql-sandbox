import { Pool } from 'pg';
import * as schema from './schema';
export declare function getPool(): Pool;
export declare function getDb(): import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: Pool;
};
export declare function closePool(): Promise<void>;
