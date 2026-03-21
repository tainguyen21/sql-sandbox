'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SessionPanel } from './session-panel';
import { LockViewer } from './lock-viewer';
import { api } from '@/lib/api';

interface TransactionLabPanelProps {
  workspaceId: string;
}

/**
 * Main Transaction Lab panel.
 * Creates a lab session (two persistent pg connections), shows two session
 * panels side-by-side, and a live lock viewer below.
 */
export function TransactionLabPanel({ workspaceId }: TransactionLabPanelProps) {
  const [labId, setLabId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const [showLocks, setShowLocks] = useState(true);

  async function handleStartLab() {
    setStarting(true);
    setError('');
    try {
      const { labId: id } = await api.createLab(workspaceId);
      setLabId(id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  async function handleCloseLab() {
    if (!labId) return;
    setClosing(true);
    try {
      await api.deleteLab(labId);
    } catch {
      // best-effort
    } finally {
      setLabId(null);
      setClosing(false);
    }
  }

  // Not yet started
  if (!labId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-center space-y-2 max-w-md">
          <h3 className="text-lg font-semibold">Transaction Lab</h3>
          <p className="text-sm text-muted-foreground">
            Open two persistent database connections to experiment with transaction
            isolation levels, deadlocks, and lock contention in real time.
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <Button onClick={handleStartLab} disabled={starting}>
          {starting ? 'Starting...' : 'Start Lab Session'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Lab header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Transaction Lab</span>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
            {labId.slice(0, 8)}...
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Active
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowLocks((v) => !v)}
          >
            {showLocks ? 'Hide' : 'Show'} Lock Viewer
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleCloseLab}
            disabled={closing}
          >
            {closing ? 'Closing...' : 'Close Lab'}
          </Button>
        </div>
      </div>

      {/* Two-column session panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" style={{ minHeight: '420px' }}>
        <SessionPanel
          labId={labId}
          session="a"
          label="Session A"
        />
        <SessionPanel
          labId={labId}
          session="b"
          label="Session B"
        />
      </div>

      {/* Lock viewer */}
      {showLocks && (
        <LockViewer labId={labId} pollIntervalMs={2000} />
      )}
    </div>
  );
}
