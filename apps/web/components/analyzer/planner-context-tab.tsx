'use client';

import { SignalBadge } from './signal-badge';

interface Props {
  gucValues: any[];
  columnStats: any[];
  signals: any[];
}

/** Recommended GUC values for SSD-based systems */
const GUC_HINTS: Record<string, string> = {
  random_page_cost: '1.1 (SSD) or 4.0 (HDD)',
  seq_page_cost: '1.0 (default)',
  work_mem: '64MB-256MB for complex queries',
  effective_cache_size: '75% of available RAM',
  max_parallel_workers_per_gather: '2-4 for parallel queries',
};

export function PlannerContextTab({ gucValues, columnStats, signals }: Props) {
  const layer2Signals = signals.filter((s: any) => s.layer === 2);

  return (
    <div className="space-y-6">
      {/* GUC Values */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Planner Configuration (GUCs)</h4>
        <div className="border rounded-md overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Setting</th>
                <th className="text-left px-3 py-2 font-medium">Value</th>
                <th className="text-left px-3 py-2 font-medium">Unit</th>
                <th className="text-left px-3 py-2 font-medium">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {gucValues.map((g: any) => (
                <tr key={g.name} className="border-b border-border/30">
                  <td className="px-3 py-1.5 font-mono text-xs">{g.name}</td>
                  <td className="px-3 py-1.5 font-mono">{g.setting}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">{g.unit || '-'}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">
                    {GUC_HINTS[g.name] || g.short_desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column Statistics */}
      {columnStats.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Column Statistics</h4>
          <div className="border rounded-md overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Table</th>
                  <th className="text-left px-3 py-2 font-medium">Column</th>
                  <th className="text-right px-3 py-2 font-medium">Distinct</th>
                  <th className="text-right px-3 py-2 font-medium">Correlation</th>
                  <th className="text-right px-3 py-2 font-medium">Null %</th>
                  <th className="text-right px-3 py-2 font-medium">Histogram</th>
                </tr>
              </thead>
              <tbody>
                {columnStats.map((c: any, i: number) => {
                  const lowCorrelation = c.correlation != null && Math.abs(c.correlation) < 0.3;
                  return (
                    <tr key={i} className="border-b border-border/30">
                      <td className="px-3 py-1.5">{c.tablename}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{c.attname}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {c.n_distinct != null ? Number(c.n_distinct).toFixed(0) : '-'}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono ${lowCorrelation ? 'text-yellow-600 font-semibold' : ''}`}>
                        {c.correlation != null ? Number(c.correlation).toFixed(3) : '-'}
                        {lowCorrelation && ' ⚠'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {c.null_frac != null ? `${(Number(c.null_frac) * 100).toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{c.histogram_buckets || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ⚠ Low correlation (&lt;0.3) on range-scanned columns reduces index efficiency.
          </p>
        </div>
      )}

      {/* Layer 2 Signals */}
      {layer2Signals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Planner Signals</h4>
          {layer2Signals.map((s: any, i: number) => (
            <div key={i} className="border rounded p-3 space-y-1">
              <SignalBadge type={s.type} severity={s.severity} />
              <p className="text-xs">{s.explanation}</p>
              <p className="text-xs text-muted-foreground"><strong>Suggestion:</strong> {s.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
