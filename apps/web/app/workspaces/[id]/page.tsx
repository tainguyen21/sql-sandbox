'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { SqlEditorPanel } from '@/components/editor/sql-editor-panel';
import { QueryHistoryPanel } from '@/components/editor/query-history-panel';
import { SnippetSidebar } from '@/components/editor/snippet-sidebar';
import { TableListPanel } from '@/components/schema/table-list-panel';
import { TableDetailPanel } from '@/components/schema/table-detail-panel';
import { FormTableBuilder } from '@/components/schema/form-table-builder';
import { AnalyzerPanel } from '@/components/analyzer/analyzer-panel';
import { AiSuggestionPanel } from '@/components/optimizer/ai-suggestion-panel';
import { AbComparePanel } from '@/components/compare/ab-compare-panel';
import { IndexManagerPanel } from '@/components/index-manager/index-manager-panel';
import { TransactionLabPanel } from '@/components/lab/transaction-lab-panel';
import { SeedConfigPanel } from '@/components/seeder/seed-config-panel';
import { ImportPanel } from '@/components/import-export/import-panel';
import { ExportButtons } from '@/components/import-export/export-buttons';

/** ReactFlow uses browser-only APIs — must be loaded client-side only */
const ErdViewer = dynamic(
  () => import('@/components/erd/erd-viewer').then((m) => m.ErdViewer),
  { ssr: false, loading: () => <div className="p-6 text-muted-foreground text-sm">Loading ERD...</div> },
);

type Tab = 'editor' | 'schema' | 'analyze' | 'optimize' | 'compare' | 'indexes' | 'txlab' | 'seed' | 'erd' | 'importexport';

const TABS: { id: Tab; label: string }[] = [
  { id: 'editor', label: 'SQL Editor' },
  { id: 'analyze', label: 'Analyze' },
  { id: 'schema', label: 'Schema' },
  { id: 'optimize', label: 'AI Optimize' },
  { id: 'compare', label: 'A/B Compare' },
  { id: 'indexes', label: 'Indexes' },
  { id: 'txlab', label: 'Transaction Lab' },
  { id: 'seed', label: 'Seed Data' },
  { id: 'erd', label: 'ERD' },
  { id: 'importexport', label: 'Import / Export' },
];

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const [workspace, setWorkspace] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [editorSql, setEditorSql] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [error, setError] = useState('');
  const [tables, setTables] = useState<string[]>([]);

  useEffect(() => {
    api.getWorkspace(workspaceId).then(setWorkspace).catch((err) => setError(err.message));
  }, [workspaceId]);

  // Keep tables list in sync for seed config and form builder
  useEffect(() => {
    api.getTables(workspaceId).then(setTables).catch(() => {});
  }, [workspaceId, refreshKey]);

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
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
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

      {/* Schema tab — table list + detail + form builder */}
      {activeTab === 'schema' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TableListPanel
              workspaceId={workspaceId}
              onSelectTable={setSelectedTable}
              refreshKey={refreshKey}
            />
            <TableDetailPanel workspaceId={workspaceId} tableName={selectedTable} />
          </div>
          <FormTableBuilder
            workspaceId={workspaceId}
            existingTables={tables}
            onCreated={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      )}

      {/* AI Optimize tab */}
      {activeTab === 'optimize' && (
        <AiSuggestionPanel
          workspaceId={workspaceId}
          sql={editorSql}
          onCopyQuery={setEditorSql}
        />
      )}

      {/* A/B Compare tab */}
      {activeTab === 'compare' && (
        <AbComparePanel workspaceId={workspaceId} />
      )}

      {/* Indexes tab */}
      {activeTab === 'indexes' && (
        <IndexManagerPanel workspaceId={workspaceId} />
      )}

      {/* Transaction Lab tab */}
      {activeTab === 'txlab' && (
        <TransactionLabPanel workspaceId={workspaceId} />
      )}

      {/* Seed Data tab */}
      {activeTab === 'seed' && (
        <div className="border rounded-md p-4">
          <h3 className="text-sm font-semibold mb-4">Seed Data with Faker</h3>
          {tables.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tables found. Create tables in the Schema tab first.
            </p>
          ) : (
            <SeedConfigPanel workspaceId={workspaceId} tables={tables} />
          )}
        </div>
      )}

      {/* ERD tab */}
      {activeTab === 'erd' && (
        <ErdViewer workspaceId={workspaceId} />
      )}

      {/* Import / Export tab */}
      {activeTab === 'importexport' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border rounded-md p-4">
            <ImportPanel
              workspaceId={workspaceId}
              onImported={() => setRefreshKey((k) => k + 1)}
            />
          </div>
          <div className="border rounded-md p-4">
            <ExportButtons workspaceId={workspaceId} tables={tables} />
          </div>
        </div>
      )}
    </div>
  );
}
