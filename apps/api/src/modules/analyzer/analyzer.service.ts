import { Injectable } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import { SqlValidatorService } from '../database/sql-validator.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { PlanParserService } from './plan-parser.service';
import { Layer1DetectorService } from './layer1-detector.service';
import { Layer2DetectorService } from './layer2-detector.service';
import { Layer3DetectorService } from './layer3-detector.service';
import { Layer4DetectorService } from './layer4-detector.service';
import { Layer5DetectorService } from './layer5-detector.service';
import { Layer6DetectorService } from './layer6-detector.service';
import { Layer7DetectorService } from './layer7-detector.service';
import { IndexReportService } from './index-report.service';
import { CatalogQueryService } from './catalog-query.service';
import type { PlanSignal } from '@sql-sandbox/shared';

@Injectable()
export class AnalyzerService {
  constructor(
    private sandbox: SandboxPoolService,
    private validator: SqlValidatorService,
    private workspaceService: WorkspaceService,
    private planParser: PlanParserService,
    private layer1: Layer1DetectorService,
    private layer2: Layer2DetectorService,
    private layer3: Layer3DetectorService,
    private layer4: Layer4DetectorService,
    private layer5: Layer5DetectorService,
    private layer6: Layer6DetectorService,
    private layer7: Layer7DetectorService,
    private indexReport: IndexReportService,
    private catalogQuery: CatalogQueryService,
  ) {}

  /** Run query analysis (plan-only or full with ANALYZE) */
  async analyze(workspaceId: string, sql: string, mode: 'plan' | 'full' = 'full') {
    this.validator.validate(sql);
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;

    // Build EXPLAIN command
    const explainOpts = mode === 'full'
      ? 'ANALYZE, BUFFERS, VERBOSE, FORMAT JSON'
      : 'VERBOSE, FORMAT JSON';

    // For DML in full mode, wrap in transaction + rollback
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

    // Parse plan JSON
    const planJson = explainResult[0]['QUERY PLAN'] || explainResult;
    const { plan, planningTime, executionTime } = this.planParser.parse(
      Array.isArray(planJson) ? planJson : [planJson],
    );

    // Extract tables and used indexes from plan
    const tables = this.planParser.extractTables(plan);
    const usedIndexes = new Set<string>();
    this.planParser.walkTree(plan, (node) => {
      if (node.indexName) usedIndexes.add(node.indexName);
    });

    // Run all catalog queries + detectors in parallel
    // Layer 6+7 only run in full mode
    const layer6Promise = mode === 'full'
      ? this.layer6.detect(schema, sql)
      : Promise.resolve({ locks: [], signals: [] as PlanSignal[] });

    const layer7Promise = (mode === 'full' && isDml)
      ? this.layer7.detect(schema, sql)
      : Promise.resolve({ walStats: null, signals: [] as PlanSignal[] });

    const [
      layer3Signals,
      layer4Signals,
      indexes,
      columnStats,
      gucValues,
      tableStorageStats,
      layer6Result,
      layer7Result,
    ] = await Promise.all([
      Promise.resolve(this.layer3.detect(plan, plan.totalCost)),
      this.layer4.detect(schema, tables),
      this.indexReport.getReport(schema, tables, usedIndexes),
      this.catalogQuery.getColumnStats(schema, tables),
      this.catalogQuery.getGUCValues(),
      this.catalogQuery.getTableStorageStats(schema, tables),
      layer6Promise,
      layer7Promise,
    ]);

    // Layer 1: CTE fence detection (synchronous, plan-only)
    const layer1Signals = this.layer1.detect(plan);

    // Layer 2: Planner context (needs layer3 signals for cross-reference)
    const layer2Signals = this.layer2.detect(plan, tableStorageStats, gucValues, layer3Signals);

    // Layer 5: MVCC/storage
    const layer5Signals = this.layer5.detect(tableStorageStats);

    const allSignals: PlanSignal[] = [
      ...layer1Signals,
      ...layer2Signals,
      ...layer3Signals,
      ...layer4Signals,
      ...layer5Signals,
      ...layer6Result.signals,
      ...layer7Result.signals,
    ];

    return {
      plan,
      signals: allSignals,
      indexes,
      columnStats,
      gucValues,
      tableStorageStats,
      locks: layer6Result.locks,
      walStats: layer7Result.walStats
        ? {
            walDelta: Number(layer7Result.walStats.walDelta),
            walBytesBefore: Number(layer7Result.walStats.walBytesBefore),
            walBytesAfter: Number(layer7Result.walStats.walBytesAfter),
          }
        : null,
      executionTime,
      planningTime,
      mode,
      query: sql,
      isDml,
    };
  }
}
