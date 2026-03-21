/** Shared types for the Index Manager feature */

export type IndexType = 'btree' | 'hash' | 'gin' | 'gist' | 'brin';

/** Index info with usage stats returned by list endpoint */
export interface IndexInfo {
  indexName: string;
  tableName: string;
  /** Columns included in the index (comma-separated) */
  columns: string;
  indexType: IndexType;
  /** Human-readable size (pg_size_pretty) */
  indexSize: string;
  indexDef: string;
  /** Total number of index scans */
  idxScan: number;
  /** Tuples read via index */
  idxTupRead: number;
  /** Tuples fetched (heap) via index */
  idxTupFetch: number;
  /** Row count of the table — used for "Unused" badge logic */
  tableRows: number;
  isUnique: boolean;
  isPrimary: boolean;
}

/** Payload for creating a new index */
export interface CreateIndexPayload {
  tableName: string;
  columns: string[];
  indexType: IndexType;
  unique: boolean;
  concurrently: boolean;
  whereClause?: string;
}

/** Response after creating/dropping an index */
export interface IndexActionResult {
  success: boolean;
  indexName: string;
  ddl?: string;
  message?: string;
}
