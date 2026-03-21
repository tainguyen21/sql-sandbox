'use client';

import { SignalBadge } from './signal-badge';

interface IndexReport {
  indexName: string;
  tableName: string;
  indexDef: string;
  indexType: string;
  indexSize: string;
  idxScan: number;
  idxTupRead: number;
  idxTupFetch: number;
  status: 'used' | 'unused' | 'bitmap';
  reason?: string;
}

interface Props {
  indexes: IndexReport[];
  signals: any[];
}

const STATUS_BADGE: Record<string, string> = {
  used: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  unused: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  bitmap: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

export function IndexReportTab({ indexes, signals }: Props) {
  if (indexes.length === 0) {
    return <div className="text-sm text-muted-foreground p-4">No indexes found for tables in this query.</div>;
  }

  // Find Layer 4 signals for each index
  const indexSignals = new Map<string, any[]>();
  for (const s of signals.filter((s) => s.layer === 4)) {
    const key = s.table || '';
    if (!indexSignals.has(key)) indexSignals.set(key, []);
    indexSignals.get(key)!.push(s);
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-md overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Index</th>
              <th className="text-left px-3 py-2 font-medium">Table</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-left px-3 py-2 font-medium">Size</th>
              <th className="text-right px-3 py-2 font-medium">Scans</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {indexes.map((idx) => (
              <tr key={idx.indexName} className="border-b border-border/30 hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{idx.indexName}</td>
                <td className="px-3 py-2">{idx.tableName}</td>
                <td className="px-3 py-2 uppercase text-xs">{idx.indexType}</td>
                <td className="px-3 py-2 text-xs">{idx.indexSize}</td>
                <td className="px-3 py-2 text-right font-mono">{idx.idxScan}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[idx.status]}`}>
                    {idx.status === 'used' ? 'Used' : idx.status === 'bitmap' ? 'Bitmap' : 'Not Used'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Layer 4 signals */}
      {signals.filter((s) => s.layer === 4).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Index Signals</h4>
          {signals
            .filter((s) => s.layer === 4)
            .map((s, i) => (
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
