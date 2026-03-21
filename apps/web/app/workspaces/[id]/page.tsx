'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { SqlSchemaEditor } from '@/components/schema/sql-schema-editor';
import { TableListPanel } from '@/components/schema/table-list-panel';
import { TableDetailPanel } from '@/components/schema/table-detail-panel';
import { Button } from '@/components/ui/button';

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const [workspace, setWorkspace] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getWorkspace(workspaceId)
      .then(setWorkspace)
      .catch((err) => setError(err.message));
  }, [workspaceId]);

  if (error) {
    return <div className="p-6 text-destructive">{error}</div>;
  }

  if (!workspace) {
    return <div className="p-6 text-muted-foreground">Loading workspace...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{workspace.name}</h2>
          {workspace.description && (
            <p className="text-sm text-muted-foreground mt-1">{workspace.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            Schema: {workspace.schemaName}
          </p>
        </div>
      </div>

      {/* SQL Editor for DDL */}
      <SqlSchemaEditor
        workspaceId={workspaceId}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />

      {/* Tables + Detail panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TableListPanel
          workspaceId={workspaceId}
          onSelectTable={setSelectedTable}
          refreshKey={refreshKey}
        />
        <TableDetailPanel
          workspaceId={workspaceId}
          tableName={selectedTable}
        />
      </div>
    </div>
  );
}
