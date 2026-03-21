import { Injectable } from '@nestjs/common';

interface RawPlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Schema'?: string;
  'Alias'?: string;
  'Startup Cost': number;
  'Total Cost': number;
  'Plan Rows': number;
  'Plan Width': number;
  'Actual Startup Time'?: number;
  'Actual Total Time'?: number;
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  'Shared Dirtied Blocks'?: number;
  'Temp Read Blocks'?: number;
  'Temp Written Blocks'?: number;
  'Filter'?: string;
  'Join Filter'?: string;
  'Hash Cond'?: string;
  'Index Cond'?: string;
  'Sort Key'?: string[];
  'Sort Method'?: string;
  'Sort Space Used'?: number;
  'Hash Batches'?: number;
  'Hash Buckets'?: number;
  'Output'?: string[];
  Plans?: RawPlanNode[];
  [key: string]: any;
}

export interface ParsedPlan {
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
  children: ParsedPlan[];
  signals: any[];
  costRatio: number;
}

@Injectable()
export class PlanParserService {
  /**
   * Parse EXPLAIN JSON output into typed plan tree.
   * PG returns: [{ "Plan": {...}, "Planning Time": ..., "Execution Time": ... }]
   */
  parse(explainJson: any[]): { plan: ParsedPlan; planningTime?: number; executionTime?: number } {
    const root = explainJson[0];
    const counter = { value: 0 };
    const rootTotalCost = root.Plan['Total Cost'] || 1;
    const plan = this.parseNode(root.Plan, rootTotalCost, counter);

    return {
      plan,
      planningTime: root['Planning Time'],
      executionTime: root['Execution Time'],
    };
  }

  /** Recursively parse a plan node */
  private parseNode(raw: RawPlanNode, rootTotalCost: number, counter: { value: number }): ParsedPlan {
    const node: ParsedPlan = {
      id: `node_${counter.value++}`,
      nodeType: raw['Node Type'],
      relationName: raw['Relation Name'],
      indexName: raw['Index Name'],
      schema: raw['Schema'],
      alias: raw['Alias'],
      startupCost: raw['Startup Cost'],
      totalCost: raw['Total Cost'],
      planRows: raw['Plan Rows'],
      planWidth: raw['Plan Width'] || 0,
      actualStartupTime: raw['Actual Startup Time'],
      actualTotalTime: raw['Actual Total Time'],
      actualRows: raw['Actual Rows'],
      actualLoops: raw['Actual Loops'],
      sharedHitBlocks: raw['Shared Hit Blocks'],
      sharedReadBlocks: raw['Shared Read Blocks'],
      sharedDirtiedBlocks: raw['Shared Dirtied Blocks'],
      tempReadBlocks: raw['Temp Read Blocks'],
      tempWrittenBlocks: raw['Temp Written Blocks'],
      filter: raw['Filter'],
      joinFilter: raw['Join Filter'],
      hashCondition: raw['Hash Cond'],
      indexCondition: raw['Index Cond'],
      sortKey: raw['Sort Key'],
      sortMethod: raw['Sort Method'],
      sortSpaceUsed: raw['Sort Space Used'],
      hashBatches: raw['Hash Batches'],
      hashBuckets: raw['Hash Buckets'],
      output: raw['Output'],
      children: (raw.Plans || []).map((child) => this.parseNode(child, rootTotalCost, counter)),
      signals: [],
      costRatio: rootTotalCost > 0 ? raw['Total Cost'] / rootTotalCost : 0,
    };
    return node;
  }

  /** Extract all unique table names from the plan tree */
  extractTables(plan: ParsedPlan): string[] {
    const tables = new Set<string>();
    this.walkTree(plan, (node) => {
      if (node.relationName) tables.add(node.relationName);
    });
    return Array.from(tables);
  }

  /** Walk tree, call visitor on each node */
  walkTree(node: ParsedPlan, visitor: (n: ParsedPlan) => void): void {
    visitor(node);
    for (const child of node.children) {
      this.walkTree(child, visitor);
    }
  }
}
