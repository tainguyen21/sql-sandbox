'use client';

import { Button } from '@/components/ui/button';

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  page: number;
  totalPages: number;
  error: string | null;
}

interface Props {
  result: QueryResult | null;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export function QueryResultsTable({ result, loading, onPageChange }: Props) {
  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Executing query...</div>;
  }

  if (!result) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Run a query to see results. Press Ctrl+Enter to execute.
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="p-4 border border-destructive/50 rounded-md bg-destructive/5">
        <p className="text-sm font-medium text-destructive">Error</p>
        <pre className="text-sm mt-1 whitespace-pre-wrap font-mono">{result.error}</pre>
        <p className="text-xs text-muted-foreground mt-2">{result.durationMs}ms</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Status bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} returned in {result.durationMs}ms
        </span>
        {result.totalPages > 1 && (
          <span>
            Page {result.page} of {result.totalPages}
          </span>
        )}
      </div>

      {/* Table */}
      {result.columns.length > 0 && (
        <div className="border rounded-md overflow-auto max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                {result.columns.map((col) => (
                  <th key={col} className="text-left px-3 py-2 font-medium border-b whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                  {result.columns.map((col) => (
                    <td key={col} className="px-3 py-1.5 font-mono text-xs whitespace-nowrap max-w-[300px] truncate">
                      {row[col] === null ? (
                        <span className="text-muted-foreground italic">NULL</span>
                      ) : (
                        String(row[col])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={result.page <= 1}
            onClick={() => onPageChange(result.page - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={result.page >= result.totalPages}
            onClick={() => onPageChange(result.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
