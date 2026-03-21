'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { ColumnRowForm, ColumnDef, PG_TYPES } from './column-row-form';
import { DdlPreviewModal } from './ddl-preview-modal';

interface Props {
  workspaceId: string;
  existingTables: string[];
  onCreated: () => void;
}

let _idCounter = 0;
function newId() {
  return `col_${++_idCounter}`;
}

function makeDefaultColumn(): ColumnDef {
  return {
    id: newId(),
    name: '',
    type: PG_TYPES[0],
    nullable: true,
    isPk: false,
    isUnique: false,
    defaultValue: '',
    fkTable: '',
    fkColumn: '',
  };
}

/** Generate CREATE TABLE DDL from form state */
function buildDdl(tableName: string, columns: ColumnDef[]): string {
  const lines: string[] = [];
  const fkLines: string[] = [];

  for (const col of columns) {
    if (!col.name.trim()) continue;
    const parts: string[] = [`  "${col.name}" ${col.type}`];
    if (col.isPk) parts.push('PRIMARY KEY');
    if (!col.nullable && !col.isPk) parts.push('NOT NULL');
    if (col.isUnique && !col.isPk) parts.push('UNIQUE');
    if (col.defaultValue.trim()) parts.push(`DEFAULT ${col.defaultValue.trim()}`);
    lines.push(parts.join(' '));

    if (col.fkTable && col.fkColumn) {
      fkLines.push(
        `  FOREIGN KEY ("${col.name}") REFERENCES "${col.fkTable}" ("${col.fkColumn}")`,
      );
    }
  }

  const allLines = [...lines, ...fkLines];
  return `CREATE TABLE "${tableName}" (\n${allLines.join(',\n')}\n);`;
}

export function FormTableBuilder({ workspaceId, existingTables, onCreated }: Props) {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([makeDefaultColumn()]);
  const [showPreview, setShowPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState('');
  const [success, setSuccess] = useState('');

  const ddl = buildDdl(tableName, columns);
  const isValid = tableName.trim().length > 0 && columns.some((c) => c.name.trim().length > 0);

  const addColumn = () => setColumns((prev) => [...prev, makeDefaultColumn()]);

  const updateColumn = (id: string, updated: ColumnDef) =>
    setColumns((prev) => prev.map((c) => (c.id === id ? updated : c)));

  const removeColumn = (id: string) =>
    setColumns((prev) => prev.filter((c) => c.id !== id));

  const handleExecute = async () => {
    setExecuting(true);
    setExecError('');
    try {
      await api.executeDdl(workspaceId, ddl);
      setShowPreview(false);
      setSuccess(`Table "${tableName}" created.`);
      setTableName('');
      setColumns([makeDefaultColumn()]);
      onCreated();
    } catch (err: any) {
      setExecError(err.message || 'Failed to execute DDL');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="border rounded-md p-4 space-y-4">
      <h3 className="text-sm font-semibold">Create Table (Form Builder)</h3>

      {/* Table name */}
      <div className="flex items-center gap-2">
        <label className="text-sm w-24 shrink-0">Table name</label>
        <input
          className="border rounded px-2 py-1 text-sm font-mono bg-background flex-1"
          placeholder="my_table"
          value={tableName}
          onChange={(e) => { setTableName(e.target.value); setSuccess(''); }}
        />
      </div>

      {/* Column header row */}
      <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto_auto] gap-2 text-xs text-muted-foreground px-0 mt-2">
        <span className="w-5" />
        <span>Name</span>
        <span>Type</span>
        <span>PK</span>
        <span>Null</span>
        <span>UQ</span>
        <span>FK</span>
        <span />
      </div>

      {/* Column rows */}
      <div className="space-y-0">
        {columns.map((col, i) => (
          <ColumnRowForm
            key={col.id}
            col={col}
            index={i}
            tables={existingTables}
            onChange={(updated) => updateColumn(col.id, updated)}
            onRemove={() => removeColumn(col.id)}
          />
        ))}
      </div>

      {/* Add column + Preview buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={addColumn}>
          + Add Column
        </Button>
        <Button
          size="sm"
          disabled={!isValid}
          onClick={() => { setExecError(''); setShowPreview(true); }}
        >
          Preview DDL
        </Button>
      </div>

      {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

      {showPreview && (
        <DdlPreviewModal
          sql={ddl}
          onConfirm={handleExecute}
          onClose={() => setShowPreview(false)}
          loading={executing}
          error={execError}
        />
      )}
    </div>
  );
}
