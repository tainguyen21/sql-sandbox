import { Injectable } from '@nestjs/common';
import type { PlanSignal } from '@sql-sandbox/shared';

/**
 * Layer 5 — MVCC & storage signal detector.
 * Detects: dead_tuple_bloat, vacuum_needed
 */
@Injectable()
export class Layer5DetectorService {
  detect(tableStats: any[]): PlanSignal[] {
    const signals: PlanSignal[] = [];

    for (const ts of tableStats) {
      const live = ts.n_live_tup || 0;
      const dead = ts.n_dead_tup || 0;
      const total = live + dead;

      // Dead tuple bloat: > 20% dead tuples
      if (total > 0 && dead / total > 0.2) {
        const ratio = Math.round((dead / total) * 100);
        signals.push({
          layer: 5,
          type: 'dead_tuple_bloat',
          severity: ratio > 50 ? 'critical' : 'warning',
          table: ts.table_name,
          message: `Table "${ts.table_name}" has ${ratio}% dead tuples (${dead} dead / ${total} total)`,
          explanation:
            'Dead tuples are old row versions left behind by UPDATE/DELETE operations. They consume disk space and slow down sequential scans because PostgreSQL must skip over them. VACUUM reclaims this space.',
          suggestion: `Run: VACUUM ANALYZE "${ts.table_name}";`,
        });
      }

      // Vacuum needed: no recent vacuum and significant dead tuples
      const lastVacuum = ts.last_autovacuum;
      if (!lastVacuum && dead > 1000) {
        signals.push({
          layer: 5,
          type: 'vacuum_needed',
          severity: 'warning',
          table: ts.table_name,
          message: `Table "${ts.table_name}" has never been vacuumed (${dead} dead tuples)`,
          explanation:
            'VACUUM removes dead tuples and updates the visibility map. Without it, table bloat accumulates and queries slow down.',
          suggestion: `Run: VACUUM ANALYZE "${ts.table_name}";`,
        });
      } else if (lastVacuum) {
        const age = Date.now() - new Date(lastVacuum).getTime();
        const hours = age / (1000 * 60 * 60);
        if (hours > 24 && dead > 1000) {
          signals.push({
            layer: 5,
            type: 'vacuum_needed',
            severity: 'info',
            table: ts.table_name,
            message: `Table "${ts.table_name}" last vacuumed ${Math.round(hours)}h ago with ${dead} dead tuples`,
            explanation:
              'Autovacuum may not be keeping up with the rate of updates/deletes on this table.',
            suggestion: `Run: VACUUM ANALYZE "${ts.table_name}"; or tune autovacuum settings for this table.`,
          });
        }
      }
    }

    return signals;
  }
}
