import type { PlanSignal } from './database';

/** Parsed EXPLAIN plan node (recursive tree) */
export interface PlanNode {
  id: string;
  nodeType: string;
  relationName?: string;
  indexName?: string;
  schema?: string;
  alias?: string;
  startupCost: number;
  totalCost: number;
  planRows: number;
  planWidth: number;
  actualStartupTime?: number;
  actualTotalTime?: number;
  actualRows?: number;
  actualLoops?: number;
  sharedHitBlocks?: number;
  sharedReadBlocks?: number;
  sharedDirtiedBlocks?: number;
  tempReadBlocks?: number;
  tempWrittenBlocks?: number;
  filter?: string;
  joinFilter?: string;
  hashCondition?: string;
  indexCondition?: string;
  sortKey?: string[];
  sortMethod?: string;
  sortSpaceUsed?: number;
  hashBatches?: number;
  hashBuckets?: number;
  output?: string[];
  children: PlanNode[];
  signals: PlanSignal[];
  /** Cost ratio 0-1 relative to root node total cost */
  costRatio: number;
}

/** Index usage report for tables in the analyzed query */
export interface IndexReport {
  indexName: string;
  tableName: string;
  indexDef: string;
  indexType: string;
  indexSize: string;
  idxScan: number;
  idxTupRead: number;
  idxTupFetch: number;
  /** Whether this index was used in the plan */
  status: 'used' | 'unused' | 'bitmap';
  /** Reason for unused status */
  reason?: string;
}

/** Full analysis result from the analyzer service */
export interface AnalysisResult {
  plan: PlanNode;
  signals: PlanSignal[];
  indexes: IndexReport[];
  executionTime?: number;
  planningTime?: number;
  mode: 'plan' | 'full';
  query: string;
}
