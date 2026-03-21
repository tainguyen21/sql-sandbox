'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';

export interface TableNodeData {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    isPk: boolean;
    isNullable: boolean;
    isFk: boolean;
    fkRef?: string;
  }>;
}

/** Custom React Flow node representing a database table */
export const TableNode = memo(function TableNode({ data }: { data: TableNodeData }) {
  return (
    <div className="bg-background border-2 border-border rounded-lg shadow-md min-w-[180px] max-w-[260px] text-xs">
      {/* Table header */}
      <div className="bg-primary text-primary-foreground font-semibold px-3 py-1.5 rounded-t-md font-mono truncate">
        {data.name}
      </div>

      {/* Columns */}
      <div className="divide-y divide-border/40">
        {data.columns.map((col) => (
          <div
            key={col.name}
            className="flex items-center gap-1 px-3 py-1 hover:bg-accent/30 transition-colors"
          >
            {/* PK badge */}
            {col.isPk && (
              <span className="shrink-0 text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-1 rounded font-bold">
                PK
              </span>
            )}
            {/* FK badge */}
            {col.isFk && !col.isPk && (
              <span className="shrink-0 text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1 rounded font-bold">
                FK
              </span>
            )}
            {/* Column name */}
            <span className="font-mono truncate flex-1" title={col.name}>
              {col.name}
            </span>
            {/* Type */}
            <span className="text-muted-foreground shrink-0 ml-1">{col.type}</span>
            {/* Nullable indicator */}
            {col.isNullable && (
              <span className="text-muted-foreground shrink-0">?</span>
            )}
          </div>
        ))}
      </div>

      {/* React Flow handles — one on each side for edges */}
      <Handle type="target" position={Position.Left} className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2 !h-2" />
    </div>
  );
});
