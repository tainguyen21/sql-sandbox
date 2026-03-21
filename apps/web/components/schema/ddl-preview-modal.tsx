'use client';

interface Props {
  sql: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  error?: string;
}

export function DdlPreviewModal({ sql, onConfirm, onClose, loading, error }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold">DDL Preview</h3>
        <p className="text-sm text-muted-foreground">Review the generated SQL before executing.</p>

        <pre className="bg-muted rounded p-4 text-sm font-mono overflow-auto max-h-64 whitespace-pre-wrap">
          {sql}
        </pre>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 text-sm border rounded hover:bg-accent transition-colors"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Executing...' : 'Execute'}
          </button>
        </div>
      </div>
    </div>
  );
}
