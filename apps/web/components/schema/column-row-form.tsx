'use client';

import { Button } from '@/components/ui/button';

export const PG_TYPES = [
  'integer', 'bigint', 'smallint', 'serial', 'bigserial',
  'text', 'varchar(255)', 'char(1)',
  'boolean',
  'numeric(10,2)', 'real', 'double precision',
  'uuid', 'date', 'timestamp', 'timestamptz',
  'jsonb', 'json',
] as const;

export interface ColumnDef {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  isPk: boolean;
  isUnique: boolean;
  defaultValue: string;
  fkTable: string;
  fkColumn: string;
}

interface Props {
  col: ColumnDef;
  index: number;
  tables: string[];
  onChange: (col: ColumnDef) => void;
  onRemove: () => void;
}

export function ColumnRowForm({ col, index, tables, onChange, onRemove }: Props) {
  const update = (patch: Partial<ColumnDef>) => onChange({ ...col, ...patch });

  return (
    <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto_auto] gap-2 items-center py-1 border-b border-border/40">
      {/* Index label */}
      <span className="text-xs text-muted-foreground w-5 text-right">{index + 1}</span>

      {/* Column name */}
      <input
        className="border rounded px-2 py-1 text-sm font-mono bg-background"
        placeholder="column_name"
        value={col.name}
        onChange={(e) => update({ name: e.target.value })}
      />

      {/* Type */}
      <select
        className="border rounded px-2 py-1 text-sm bg-background"
        value={col.type}
        onChange={(e) => update({ type: e.target.value })}
      >
        {PG_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {/* PK */}
      <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
        <input
          type="checkbox"
          checked={col.isPk}
          onChange={(e) => update({ isPk: e.target.checked, nullable: e.target.checked ? false : col.nullable })}
        />
        PK
      </label>

      {/* Nullable */}
      <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
        <input
          type="checkbox"
          checked={col.nullable}
          disabled={col.isPk}
          onChange={(e) => update({ nullable: e.target.checked })}
        />
        Null
      </label>

      {/* Unique */}
      <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
        <input
          type="checkbox"
          checked={col.isUnique}
          onChange={(e) => update({ isUnique: e.target.checked })}
        />
        UQ
      </label>

      {/* FK picker (compact) */}
      {tables.length > 0 && (
        <div className="flex items-center gap-1">
          <select
            className="border rounded px-1 py-1 text-xs bg-background max-w-[90px]"
            value={col.fkTable}
            onChange={(e) => update({ fkTable: e.target.value, fkColumn: '' })}
          >
            <option value="">FK table</option>
            {tables.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {col.fkTable && (
            <input
              className="border rounded px-1 py-1 text-xs font-mono bg-background w-20"
              placeholder="column"
              value={col.fkColumn}
              onChange={(e) => update({ fkColumn: e.target.value })}
            />
          )}
        </div>
      )}

      {/* Remove */}
      <Button variant="ghost" size="sm" className="text-destructive h-7 px-2" onClick={onRemove}>
        -
      </Button>
    </div>
  );
}
