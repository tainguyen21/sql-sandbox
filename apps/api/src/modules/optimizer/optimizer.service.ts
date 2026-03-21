import { Injectable, BadRequestException } from '@nestjs/common';
import { AnalyzerService } from '../analyzer/analyzer.service';
import { SqlValidatorService } from '../database/sql-validator.service';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { LlmClientService } from './llm-client.service';
import { PromptBuilderService } from './prompt-builder.service';
import type { OptimizationSuggestion } from '@sql-sandbox/shared';

@Injectable()
export class OptimizerService {
  constructor(
    private analyzer: AnalyzerService,
    private llm: LlmClientService,
    private promptBuilder: PromptBuilderService,
    private validator: SqlValidatorService,
    private sandbox: SandboxPoolService,
    private workspaceService: WorkspaceService,
  ) {}

  /** Get AI optimization suggestions for a query */
  async suggest(workspaceId: string, sql: string): Promise<OptimizationSuggestion[]> {
    // First run the full analysis
    const analysisResult = await this.analyzer.analyze(workspaceId, sql, 'full');

    // Build prompt and call LLM
    const prompt = await this.promptBuilder.build(workspaceId, sql, analysisResult);
    const response = await this.llm.complete(prompt);

    // Parse JSON response
    try {
      // Strip markdown fences if present
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        throw new Error('Invalid response structure');
      }

      return parsed.suggestions.map((s: any) => ({
        title: s.title || 'Suggestion',
        layer: s.layer || 0,
        problem: s.problem || '',
        solution: s.solution || '',
        rewrittenQuery: s.rewritten_query || null,
        ddlChanges: s.ddl_changes || [],
        gucChanges: s.guc_changes || [],
        expectedImprovement: s.expected_improvement || '',
        tradeoffs: s.tradeoffs || [],
      }));
    } catch {
      throw new BadRequestException('Failed to parse AI response. Please try again.');
    }
  }

  /** Apply a DDL suggestion (CREATE INDEX, etc.) to the workspace */
  async applyDdl(workspaceId: string, ddl: string) {
    this.validator.validate(ddl);
    const workspace = await this.workspaceService.findOne(workspaceId);
    await this.sandbox.executeInWorkspace(workspace.schemaName, ddl);
    return { applied: true, ddl };
  }

  /** Apply a GUC change for the current session */
  async applyGuc(workspaceId: string, guc: string) {
    // Only allow SET statements for specific GUCs
    if (!/^SET\s+(work_mem|random_page_cost|seq_page_cost|effective_cache_size|max_parallel_workers_per_gather)\s*=/i.test(guc)) {
      throw new BadRequestException('Only specific planner GUC changes are allowed');
    }
    const workspace = await this.workspaceService.findOne(workspaceId);
    await this.sandbox.executeInWorkspace(workspace.schemaName, guc);
    return { applied: true, guc };
  }

  /** A/B comparison: run analyzer on both queries, compute diffs */
  async compare(workspaceId: string, sqlA: string, sqlB: string) {
    const [resultA, resultB] = await Promise.all([
      this.analyzer.analyze(workspaceId, sqlA, 'full'),
      this.analyzer.analyze(workspaceId, sqlB, 'full'),
    ]);

    // Compute metric comparisons
    const metrics = [
      this.compareMetric('Total Cost', resultA.plan.totalCost, resultB.plan.totalCost, true),
      this.compareMetric('Execution Time (ms)', resultA.executionTime, resultB.executionTime, true),
      this.compareMetric('Planning Time (ms)', resultA.planningTime, resultB.planningTime, true),
      this.compareMetric('Signals Count', resultA.signals.length, resultB.signals.length, true),
    ];

    // Diff signals
    const sigTypesA = new Set(resultA.signals.map((s: any) => s.type));
    const sigTypesB = new Set(resultB.signals.map((s: any) => s.type));

    return {
      queryA: sqlA,
      queryB: sqlB,
      metrics,
      signalsOnlyA: resultA.signals.filter((s: any) => !sigTypesB.has(s.type)),
      signalsOnlyB: resultB.signals.filter((s: any) => !sigTypesA.has(s.type)),
      signalsBoth: resultA.signals.filter((s: any) => sigTypesB.has(s.type)),
      resultA,
      resultB,
    };
  }

  private compareMetric(
    name: string,
    valueA: number | undefined | null,
    valueB: number | undefined | null,
    lowerIsBetter: boolean,
  ) {
    const a = valueA ?? 0;
    const b = valueB ?? 0;
    let winner: 'A' | 'B' | 'tie' = 'tie';
    if (a < b) winner = lowerIsBetter ? 'A' : 'B';
    if (b < a) winner = lowerIsBetter ? 'B' : 'A';

    const diff = a === 0 ? 0 : ((b - a) / a) * 100;
    const improvement = winner === 'tie' ? 'Equal' : `${Math.abs(diff).toFixed(0)}% ${winner === 'A' ? 'better' : 'worse'}`;

    return { name, valueA: a, valueB: b, winner, improvement };
  }
}
