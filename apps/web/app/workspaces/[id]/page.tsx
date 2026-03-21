'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { SqlEditorPanel } from '@/components/editor/sql-editor-panel';
import { QueryHistoryPanel } from '@/components/editor/query-history-panel';
import { SnippetSidebar } from '@/components/editor/snippet-sidebar';
import { TableListPanel } from '@/components/schema/table-list-panel';
import { TableDetailPanel } from '@/components/schema/table-detail-panel';
import { AnalyzerPanel } from '@/components/analyzer/analyzer-panel';

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const [workspace, setWorkspace] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [editorSql, setEditorSql] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'schema' | 'analyze'>('editor');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getWorkspace(workspaceId).then(setWorkspace).catch((err) => setError(err.message));
  }, [workspaceId]);

  if (error) return <div className="p-6 text-destructive">{error}</div>;
  if (!workspace) return <div className="p-6 text-muted-foreground">Loading workspace...</div>;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{workspace.name}</h2>
        {workspace.description && (
          <p className="text-sm text-muted-foreground mt-1">{workspace.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Schema: {workspace.schemaName}
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'editor'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('editor')}
        >
          SQL Editor
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'analyze'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('analyze')}
        >
          Analyze
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'schema'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('schema')}
        >
          Schema
        </button>
      </div>

      {/* Editor tab */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
          <div className="space-y-4">
            <SqlEditorPanel
              workspaceId={workspaceId}
              onQueryExecuted={() => setHistoryRefreshKey((k) => k + 1)}
              initialSql={editorSql}
            />
          </div>
          <div className="space-y-4">
            <QueryHistoryPanel
              workspaceId={workspaceId}
              onLoadSql={setEditorSql}
              refreshKey={historyRefreshKey}
            />
            <SnippetSidebar
              workspaceId={workspaceId}
              onLoadSql={setEditorSql}
            />
          </div>
        </div>
      )}

      {/* Analyze tab */}
      {activeTab === 'analyze' && (
        <AnalyzerPanel workspaceId={workspaceId} sql={editorSql} />
      )}

      {/* Schema tab */}
      {activeTab === 'schema' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TableListPanel
            workspaceId={workspaceId}
            onSelectTable={setSelectedTable}
            refreshKey={refreshKey}
          />
          <TableDetailPanel workspaceId={workspaceId} tableName={selectedTable} />
        </div>
      )}
    </div>
  );
}
