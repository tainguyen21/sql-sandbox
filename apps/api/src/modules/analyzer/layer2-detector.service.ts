import { Injectable } from '@nestjs/common';
import { PlanParserService, type ParsedPlan } from './plan-parser.service';
import type { PlanSignal } from '@sql-sandbox/shared';

/**
 * Layer 2 — Planner context signal detector.
 * Detects: bad_estimate, stale_stats, suboptimal_guc
 */
@Injectable()
export class Layer2DetectorService {
  constructor(private planParser: PlanParserService) {}

  detect(
    plan: ParsedPlan,
    tableStats: any[],
    gucValues: any[],
    layer3Signals: PlanSignal[],
  ): PlanSignal[] {
    const signals: PlanSignal[] = [];

    // Bad estimate: actual/plan rows ratio > 10 or < 0.1
    this.planParser.walkTree(plan, (node) => {
      if (node.actualRows != null && node.planRows > 0) {
        const ratio = node.actualRows / node.planRows;
        if (ratio > 10 || ratio < 0.1) {
          const signal: PlanSignal = {
            layer: 2,
            type: 'bad_estimate',
            severity: 'warning',
            nodeType: node.nodeType,
            table: node.relationName,
            message: `Row estimate off by ${ratio > 1 ? Math.round(ratio) : (1 / ratio).toFixed(0)}x on "${node.nodeType}"${node.relationName ? ` (${node.relationName})` : ''}: estimated ${node.planRows}, actual ${node.actualRows}`,
            explanation:
              'The planner significantly misjudged how many rows this operation would produce. This usually means column statistics are stale, or the WHERE condition involves correlated columns that the planner cannot model.',
            suggestion:
              'Run ANALYZE on the table to refresh statistics. If estimates remain poor, consider creating extended statistics (CREATE STATISTICS) for correlated columns.',
          };
          signals.push(signal);
          node.signals.push(signal);
        }
      }
    });

    // Stale stats: last_analyze > 7 days or null
    for (const ts of tableStats) {
      const lastAnalyze = ts.last_analyze || ts.last_autoanalyze;
      if (!lastAnalyze) {
        signals.push({
          layer: 2,
          type: 'stale_stats',
          severity: 'warning',
          table: ts.table_name,
          message: `Table "${ts.table_name}" has never been analyzed`,
          explanation:
            'PostgreSQL uses column statistics to choose optimal query plans. Without ANALYZE, the planner uses default assumptions that may be very wrong.',
          suggestion: `Run: ANALYZE "${ts.table_name}";`,
        });
      } else {
        const age = Date.now() - new Date(lastAnalyze).getTime();
        const days = age / (1000 * 60 * 60 * 24);
        if (days > 7) {
          signals.push({
            layer: 2,
            type: 'stale_stats',
            severity: 'info',
            table: ts.table_name,
            message: `Table "${ts.table_name}" statistics are ${Math.round(days)} days old`,
            explanation:
              'Column statistics may be outdated if significant data changes have occurred since the last ANALYZE.',
            suggestion: `Run: ANALYZE "${ts.table_name}";`,
          });
        }
      }
    }

    // Suboptimal GUC: random_page_cost still at default 4.0
    const rpc = gucValues.find((g: any) => g.name === 'random_page_cost');
    if (rpc && rpc.setting === '4') {
      signals.push({
        layer: 2,
        type: 'suboptimal_guc',
        severity: 'info',
        message: 'random_page_cost is at default (4.0) — may be too high for SSD storage',
        explanation:
          'The default value of 4.0 assumes spinning disks. On SSDs, random I/O is nearly as fast as sequential I/O, so a value of 1.1-1.5 is more appropriate.',
        suggestion: "SET random_page_cost = 1.1;",
      });
    }

    // Suboptimal GUC: work_mem too low when disk spill detected
    const hasDiskSpill = layer3Signals.some((s) => s.type === 'disk_spill');
    const wm = gucValues.find((g: any) => g.name === 'work_mem');
    if (hasDiskSpill && wm) {
      const wmMb = parseInt(wm.setting, 10) / 1024; // setting is in kB
      if (wmMb < 64) {
        signals.push({
          layer: 2,
          type: 'suboptimal_guc',
          severity: 'warning',
          message: `work_mem is ${wmMb}MB — disk spill detected, consider increasing`,
          explanation:
            'The current work_mem is too small for this query, causing sort/hash operations to spill to disk. Increasing it allows more operations to complete in memory.',
          suggestion: "SET work_mem = '256MB';",
        });
      }
    }

    return signals;
  }
}
