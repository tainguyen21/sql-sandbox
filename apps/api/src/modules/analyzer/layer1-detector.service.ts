import { Injectable } from '@nestjs/common';
import type { ParsedPlan } from './plan-parser.service';
import type { PlanSignal } from '@sql-sandbox/shared';

/**
 * Layer 1 — Parse & rewrite detection.
 * Detects: CTE materialization fences.
 */
@Injectable()
export class Layer1DetectorService {
  detect(plan: ParsedPlan): PlanSignal[] {
    const signals: PlanSignal[] = [];
    this.walk(plan, signals);
    return signals;
  }

  private walk(node: ParsedPlan, signals: PlanSignal[]): void {
    if (node.nodeType === 'CTE Scan') {
      const signal: PlanSignal = {
        layer: 1,
        type: 'cte_fence',
        severity: 'info',
        nodeType: node.nodeType,
        table: node.relationName,
        message: `CTE "${node.alias || node.relationName}" is materialized (optimization fence)`,
        explanation:
          'This Common Table Expression is materialized into a temporary result set rather than being inlined into the main query. In PostgreSQL 12+, this means either the MATERIALIZED keyword was used explicitly, or the planner decided inlining would be unsafe (e.g., the CTE is referenced multiple times or contains side effects).',
        suggestion:
          'If performance is a concern, try rewriting the CTE as a subquery or removing the MATERIALIZED keyword to let the planner inline it.',
      };
      signals.push(signal);
      node.signals.push(signal);
    }

    for (const child of node.children) {
      this.walk(child, signals);
    }
  }
}
