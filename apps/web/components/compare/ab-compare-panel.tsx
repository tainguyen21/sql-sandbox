'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SignalBadge } from '@/components/analyzer/signal-badge';

interface Props {
  workspaceId: string;
}

export function AbComparePanel({ workspaceId }: Props) {
  const [sqlA, setSqlA] = useState('');
  const [sqlB, setSqlB] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runComparison = async () => {
    if (!sqlA.trim() || !sqlB.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.compareQueries(workspaceId, sqlA.trim(), sqlB.trim());
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Two editors side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Query A</label>
          <textarea
            value={sqlA}
            onChange={(e) => setSqlA(e.target.value)}
            className="w-full h-32 px-3 py-2 border rounded-md bg-background font-mono text-sm resize-y"
            placeholder="SELECT * FROM ..."
            spellCheck={false}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Query B</label>
          <textarea
            value={sqlB}
            onChange={(e) => setSqlB(e.target.value)}
            className="w-full h-32 px-3 py-2 border rounded-md bg-background font-mono text-sm resize-y"
            placeholder="SELECT * FROM ..."
            spellCheck={false}
          />
        </div>
      </div>

      <Button onClick={runComparison} disabled={loading || !sqlA.trim() || !sqlB.trim()}>
        {loading ? 'Comparing...' : 'Run Comparison'}
      </Button>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {result && (
        <div className="space-y-4">
          {/* Metrics table */}
          <div className="border rounded-md overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Metric</th>
                  <th className="text-right px-3 py-2 font-medium">Query A</th>
                  <th className="text-right px-3 py-2 font-medium">Query B</th>
                  <th className="text-center px-3 py-2 font-medium">Winner</th>
                  <th className="text-left px-3 py-2 font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {result.metrics.map((m: any) => (
                  <tr key={m.name} className="border-b border-border/30">
                    <td className="px-3 py-2">{m.name}</td>
                    <td className={`px-3 py-2 text-right font-mono ${m.winner === 'A' ? 'text-green-600 font-semibold' : ''}`}>
                      {typeof m.valueA === 'number' ? m.valueA.toFixed(2) : m.valueA}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${m.winner === 'B' ? 'text-green-600 font-semibold' : ''}`}>
                      {typeof m.valueB === 'number' ? m.valueB.toFixed(2) : m.valueB}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.winner === 'tie' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-green-600 font-bold">{m.winner}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{m.improvement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signal diffs */}
          {(result.signalsOnlyA.length > 0 || result.signalsOnlyB.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Signals only in A</h4>
                {result.signalsOnlyA.map((s: any, i: number) => (
                  <div key={i} className="mb-1">
                    <SignalBadge type={s.type} severity={s.severity} message={s.message} />
                  </div>
                ))}
                {result.signalsOnlyA.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Signals only in B</h4>
                {result.signalsOnlyB.map((s: any, i: number) => (
                  <div key={i} className="mb-1">
                    <SignalBadge type={s.type} severity={s.severity} message={s.message} />
                  </div>
                ))}
                {result.signalsOnlyB.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
