import { Injectable } from '@nestjs/common';
import type { ParsedPlan } from './plan-parser.service';
import type { PlanSignal } from '@sql-sandbox/shared';

/**
 * Layer 3 — Execution plan node signal detector.
 * Detects: disk_spill, seq_scan_candidate, nested_loop_risk, expensive_sort
 */
@Injectable()
export class Layer3DetectorService {
  detect(plan: ParsedPlan, rootTotalCost: number): PlanSignal[] {
    const signals: PlanSignal[] = [];
    this.walk(plan, rootTotalCost, signals);
    return signals;
  }

  private walk(node: ParsedPlan, rootTotalCost: number, signals: PlanSignal[]): void {
    const nodeSignals: PlanSignal[] = [];

    // Disk spill: Hash with Batches > 1 OR Sort with external merge
    if (node.nodeType === 'Hash' && node.hashBatches && node.hashBatches > 1) {
      nodeSignals.push({
        layer: 3,
        type: 'disk_spill',
        severity: 'warning',
        nodeType: node.nodeType,
        table: node.relationName,
        message: `Hash node used ${node.hashBatches} batches (spilling to disk)`,
        explanation:
          'The hash table did not fit in work_mem, so PostgreSQL split it into multiple batches written to disk. This is much slower than an in-memory hash.',
        suggestion:
          'Increase work_mem (SET work_mem = \'256MB\') or reduce the dataset with better WHERE conditions.',
      });
    }

    if (node.nodeType === 'Sort' && node.sortMethod && /external/i.test(node.sortMethod)) {
      nodeSignals.push({
        layer: 3,
        type: 'disk_spill',
        severity: 'warning',
        nodeType: node.nodeType,
        table: node.relationName,
        message: `Sort spilled to disk (method: ${node.sortMethod})`,
        explanation:
          'The data being sorted did not fit in work_mem, so PostgreSQL used disk-based sorting. This is significantly slower.',
        suggestion: 'Increase work_mem or add an index that matches the sort order.',
      });
    }

    // Seq scan candidate: Seq Scan with many rows and a filter condition
    if (
      node.nodeType === 'Seq Scan' &&
      node.planRows > 1000 &&
      node.filter
    ) {
      nodeSignals.push({
        layer: 3,
        type: 'seq_scan_candidate',
        severity: 'info',
        nodeType: node.nodeType,
        table: node.relationName,
        message: `Sequential scan on "${node.relationName}" with filter (${node.planRows} estimated rows)`,
        explanation:
          'PostgreSQL is reading every row in the table and then filtering. An index on the filtered column(s) could allow it to read only matching rows.',
        suggestion: `Consider creating an index on the column(s) in the WHERE clause for table "${node.relationName}".`,
      });
    }

    // Nested loop risk: inner side has no index and many rows
    if (node.nodeType === 'Nested Loop' && node.children.length >= 2) {
      const inner = node.children[1]; // inner side is second child
      if (
        inner &&
        inner.nodeType === 'Seq Scan' &&
        inner.planRows > 100
      ) {
        nodeSignals.push({
          layer: 3,
          type: 'nested_loop_risk',
          severity: 'warning',
          nodeType: node.nodeType,
          table: inner.relationName,
          message: `Nested Loop with sequential scan on inner side "${inner.relationName}" (${inner.planRows} rows)`,
          explanation:
            'For each row from the outer side, PostgreSQL scans the entire inner table. With no index, this is O(N*M) complexity.',
          suggestion: `Create an index on "${inner.relationName}" for the join column to enable index lookup instead of sequential scan.`,
        });
      }
    }

    // Expensive sort: sort incremental cost > 20% of total plan cost
    if (node.nodeType === 'Sort' && rootTotalCost > 0) {
      // Use incremental cost (subtract max child cost) since totalCost is cumulative
      const maxChildCost = node.children.reduce((max, c) => Math.max(max, c.totalCost), 0);
      const sortCostRatio = (node.totalCost - maxChildCost) / rootTotalCost;
      if (sortCostRatio > 0.2) {
        nodeSignals.push({
          layer: 3,
          type: 'expensive_sort',
          severity: 'warning',
          nodeType: node.nodeType,
          table: node.relationName,
          message: `Sort operation accounts for ${Math.round(sortCostRatio * 100)}% of total plan cost`,
          explanation:
            'This sort is a significant portion of the query cost. If the data is frequently queried in this order, an index could eliminate the sort entirely.',
          suggestion:
            'Create an index that matches the ORDER BY columns to avoid the sort step.',
        });
      }
    }

    // Attach signals directly to this node and add to global list
    node.signals.push(...nodeSignals);
    signals.push(...nodeSignals);

    for (const child of node.children) {
      this.walk(child, rootTotalCost, signals);
    }
  }
}
