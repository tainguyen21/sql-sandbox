import { Injectable, BadRequestException } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import { SqlValidatorService } from '../database/sql-validator.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { PlanParserService } from './plan-parser.service';
import { Layer3DetectorService } from './layer3-detector.service';
import { Layer4DetectorService } from './layer4-detector.service';
import { IndexReportService } from './index-report.service';
import type { AnalysisResult, PlanSignal } from '@sql-sandbox/shared';

@Injectable()
export class AnalyzerService {
  constructor(
    private sandbox: SandboxPoolService,
    private validator: SqlValidatorService,
    private workspaceService: WorkspaceService,
    private planParser: PlanParserService,
    private layer3: Layer3DetectorService,
    private layer4: Layer4DetectorService,
    private indexReport: IndexReportService,
  ) {}

  /** Run query analysis (plan-only or full with ANALYZE) */
  async analyze(workspaceId: string, sql: string, mode: 'plan' | 'full' = 'full'): Promise<AnalysisResult> {
    this.validator.validate(sql);
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;

    // Build EXPLAIN command
    const explainOpts = mode === 'full'
      ? 'ANALYZE, BUFFERS, VERBOSE, FORMAT JSON'
      : 'VERBOSE, FORMAT JSON';

    // For DML in full mode, wrap in transaction + rollback to avoid data changes
    const isDml = this.validator.isDMLWrite(sql);
    let explainResult: any;

    if (isDml && mode === 'full') {
      const client = await this.sandbox.getClient();
      try {
        await client.query(`SET search_path = "${schema}", public`);
        await client.query(`SET statement_timeout = '30s'`);
        await client.query('BEGIN');
        const result = await client.query(`EXPLAIN (${explainOpts}) ${sql}`);
        explainResult = result.rows;
      } finally {
        // Always rollback to undo DML side effects, even on error
        await client.query('ROLLBACK').catch(() => {});
        await client.query('RESET ALL').catch(() => {});
        client.release();
      }
    } else {
      const { rows } = await this.sandbox.executeInWorkspace(
        schema,
        `EXPLAIN (${explainOpts}) ${sql}`,
      );
      explainResult = rows;
    }

    // PG returns EXPLAIN JSON as rows with a single column "QUERY PLAN"
    const planJson = explainResult[0]['QUERY PLAN'] || explainResult;

    // Parse the plan tree
    const { plan, planningTime, executionTime } = this.planParser.parse(
      Array.isArray(planJson) ? planJson : [planJson],
    );

    // Extract tables referenced in the plan
    const tables = this.planParser.extractTables(plan);

    // Collect used indexes from plan nodes
    const usedIndexes = new Set<string>();
    this.planParser.walkTree(plan, (node) => {
      if (node.indexName) usedIndexes.add(node.indexName);
    });

    // Run signal detectors in parallel
    const [layer3Signals, layer4Signals, indexes] = await Promise.all([
      Promise.resolve(this.layer3.detect(plan, plan.totalCost)),
      this.layer4.detect(schema, tables),
      this.indexReport.getReport(schema, tables, usedIndexes),
    ]);

    const allSignals: PlanSignal[] = [...layer3Signals, ...layer4Signals];

    return {
      plan,
      signals: allSignals,
      indexes,
      executionTime,
      planningTime,
      mode,
      query: sql,
    };
  }
}
