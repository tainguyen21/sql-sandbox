'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PlanTreeViewer } from './plan-tree-viewer';
import { PlanNodeDetail } from './plan-node-detail';
import { IndexReportTab } from './index-report-tab';
import { PlannerContextTab } from './planner-context-tab';
import { StorageMvccTab } from './storage-mvcc-tab';
import { SignalBadge } from './signal-badge';

interface Props {
  workspaceId: string;
  sql: string;
}

export function AnalyzerPanel({ workspaceId, sql }: Props) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'plan' | 'indexes' | 'planner' | 'storage'>('plan');

  const runAnalysis = async (mode: 'plan' | 'full') => {
    if (!sql.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSelectedNode(null);
    try {
      const data = await api.analyzeQuery(workspaceId, sql.trim(), mode);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  // Count signals by severity
  const signalCounts = result?.signals?.reduce(
    (acc: any, s: any) => ({ ...acc, [s.severity]: (acc[s.severity] || 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => runAnalysis('plan')} disabled={loading || !sql.trim()}>
          Plan Only
        </Button>
        <Button size="sm" onClick={() => runAnalysis('full')} disabled={loading || !sql.trim()}>
          {loading ? 'Analyzing...' : 'Full Analysis'}
        </Button>
        {result && (
          <span className="text-xs text-muted-foreground ml-2">
            {result.planningTime != null && `Planning: ${result.planningTime.toFixed(2)}ms`}
            {result.executionTime != null && ` | Execution: ${result.executionTime.toFixed(2)}ms`}
            {` | ${result.signals.length} signal(s)`}
          </span>
        )}
      </div>

      {error && <div className="text-sm text-destructive border border-destructive/30 rounded p-3">{error}</div>}

      {result && (
        <>
          {/* Signal summary */}
          {result.signals.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {result.signals.map((s: any, i: number) => (
                <SignalBadge key={i} type={s.type} severity={s.severity} message={s.message} />
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b">
            <button
              className={`px-3 py-1.5 text-sm font-medium border-b-2 ${
                activeTab === 'plan' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
              }`}
              onClick={() => setActiveTab('plan')}
            >
              Plan Tree
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium border-b-2 ${
                activeTab === 'indexes' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
              }`}
              onClick={() => setActiveTab('indexes')}
            >
              Index Report ({result.indexes.length})
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium border-b-2 ${
                activeTab === 'planner' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
              }`}
              onClick={() => setActiveTab('planner')}
            >
              Planner Context
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium border-b-2 ${
                activeTab === 'storage' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
              }`}
              onClick={() => setActiveTab('storage')}
            >
              Storage & MVCC
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'plan' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-4">
              <div className="border rounded-md p-2 overflow-auto max-h-[500px]">
                <PlanTreeViewer
                  plan={result.plan}
                  onSelectNode={setSelectedNode}
                  selectedNodeId={selectedNode?.id}
                />
              </div>
              <PlanNodeDetail node={selectedNode} />
            </div>
          )}

          {activeTab === 'indexes' && (
            <IndexReportTab indexes={result.indexes} signals={result.signals} />
          )}

          {activeTab === 'planner' && (
            <PlannerContextTab
              gucValues={result.gucValues || []}
              columnStats={result.columnStats || []}
              signals={result.signals}
            />
          )}

          {activeTab === 'storage' && (
            <StorageMvccTab
              tableStorageStats={result.tableStorageStats || []}
              signals={result.signals}
            />
          )}
        </>
      )}
    </div>
  );
}
