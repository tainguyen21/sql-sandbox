import { Injectable } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import { WorkspaceService } from '../workspace/workspace.service';

/**
 * Builds structured prompts for the LLM optimizer from AnalysisResult.
 */
@Injectable()
export class PromptBuilderService {
  constructor(
    private sandbox: SandboxPoolService,
    private workspaceService: WorkspaceService,
  ) {}

  /** Build the full optimizer prompt */
  async build(workspaceId: string, sql: string, analysisResult: any): Promise<string> {
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schemaDdl = await this.getSchemaContext(workspace.schemaName);

    const signals = analysisResult.signals || [];
    const gucValues = analysisResult.gucValues || [];
    const columnStats = analysisResult.columnStats || [];
    const tableStats = analysisResult.tableStorageStats || [];
    const indexes = analysisResult.indexes || [];

    // Trim plan JSON to avoid token overflow (keep top 3 levels)
    const planSummary = this.trimPlan(analysisResult.plan, 3);

    return `You are a PostgreSQL expert. Analyze the following query using signals from all layers of PostgreSQL's query lifecycle, then suggest concrete improvements.

## Schema context
${schemaDdl}

## Original query
${sql}

## Detected signals (all layers)
${signals.map((s: any) => `- [Layer ${s.layer}] [${(s.severity || '').toUpperCase()}] ${s.type}: ${s.message}`).join('\n') || 'No signals detected.'}

## Planner context (Layer 2)
${gucValues.map((g: any) => `- ${g.name}: ${g.setting}${g.unit ? ' ' + g.unit : ''}`).join('\n') || 'N/A'}
Column stats: ${JSON.stringify(columnStats.slice(0, 20))}

## EXPLAIN plan summary (Layer 3)
${JSON.stringify(planSummary, null, 2)}

## Storage state (Layer 5)
${tableStats.map((t: any) => `- ${t.table_name}: ${t.n_dead_tup} dead tuples, last analyzed: ${t.last_analyze || 'never'}`).join('\n') || 'N/A'}

## Index usage (Layer 4)
${indexes.map((i: any) => `- ${i.indexName} on ${i.tableName}: ${i.idxScan} scans, status: ${i.status}`).join('\n') || 'N/A'}

Respond with a JSON object with this exact structure:
{
  "suggestions": [
    {
      "title": "short title",
      "layer": 3,
      "problem": "what is wrong and why it hurts performance",
      "solution": "plain English explanation of the fix",
      "rewritten_query": "full rewritten SQL or null if no rewrite needed",
      "ddl_changes": ["CREATE INDEX ...", ...],
      "guc_changes": ["SET work_mem = '256MB'", ...],
      "expected_improvement": "e.g. 10x faster by avoiding full table scan",
      "tradeoffs": ["list of tradeoffs"]
    }
  ]
}
Return only valid JSON, no markdown, no explanation outside the JSON object.`;
  }

  /** Get schema DDL for all tables in workspace */
  private async getSchemaContext(schemaName: string): Promise<string> {
    try {
      const { rows } = await this.sandbox.executeInWorkspace(
        schemaName,
        `SELECT
           'CREATE TABLE ' || quote_ident(table_name) || ' (' ||
           string_agg(
             quote_ident(column_name) || ' ' || data_type ||
             CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
             COALESCE(' DEFAULT ' || column_default, ''),
             ', ' ORDER BY ordinal_position
           ) || ');' AS ddl
         FROM information_schema.columns
         WHERE table_schema = current_schema()
         GROUP BY table_name
         ORDER BY table_name`,
      );
      return rows.map((r: any) => r.ddl).join('\n') || '-- No tables';
    } catch {
      return '-- Schema context unavailable';
    }
  }

  /** Trim plan tree to max depth to keep prompt within token limits */
  private trimPlan(node: any, maxDepth: number, depth = 0): any {
    if (!node) return null;
    const trimmed: any = {
      nodeType: node.nodeType,
      totalCost: node.totalCost,
      planRows: node.planRows,
      actualRows: node.actualRows,
      actualTotalTime: node.actualTotalTime,
      relationName: node.relationName,
      filter: node.filter,
      indexName: node.indexName,
    };
    if (depth < maxDepth && node.children?.length > 0) {
      trimmed.children = node.children.map((c: any) => this.trimPlan(c, maxDepth, depth + 1));
    }
    return trimmed;
  }
}
