'use client';

import { useState } from 'react';
import { costToColor } from './cost-heatmap';
import { SignalBadge } from './signal-badge';

interface PlanNode {
  id: string;
  nodeType: string;
  relationName?: string;
  indexName?: string;
  startupCost: number;
  totalCost: number;
  planRows: number;
  actualRows?: number;
  actualTotalTime?: number;
  actualLoops?: number;
  sharedHitBlocks?: number;
  sharedReadBlocks?: number;
  costRatio: number;
  children: PlanNode[];
  signals: any[];
  [key: string]: any;
}

interface Props {
  plan: PlanNode;
  onSelectNode: (node: PlanNode) => void;
  selectedNodeId?: string;
}

/** Recursive plan tree rendered as indented nodes */
export function PlanTreeViewer({ plan, onSelectNode, selectedNodeId }: Props) {
  return (
    <div className="space-y-0.5 font-mono text-sm">
      <TreeNode node={plan} depth={0} onSelect={onSelectNode} selectedId={selectedNodeId} />
    </div>
  );
}

function TreeNode({
  node,
  depth,
  onSelect,
  selectedId,
}: {
  node: PlanNode;
  depth: number;
  onSelect: (n: PlanNode) => void;
  selectedId?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const bgColor = costToColor(node.costRatio);
  const isSelected = node.id === selectedId;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all ${
          isSelected ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-border'
        }`}
        style={{
          marginLeft: depth * 24,
          backgroundColor: bgColor,
          color: node.costRatio > 0.5 ? 'white' : 'inherit',
        }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren && (
          <button
            className="w-4 h-4 flex items-center justify-center text-xs opacity-70"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}

        {/* Node info */}
        <span className="font-semibold">{node.nodeType}</span>
        {node.relationName && (
          <span className="opacity-80">on {node.relationName}</span>
        )}
        {node.indexName && (
          <span className="opacity-70 text-xs">using {node.indexName}</span>
        )}

        {/* Metrics */}
        <span className="ml-auto flex items-center gap-3 text-xs opacity-80">
          <span>rows: {node.actualRows ?? node.planRows}</span>
          {node.actualTotalTime != null && (
            <span>{node.actualTotalTime.toFixed(2)}ms</span>
          )}
          {(node.sharedHitBlocks != null || node.sharedReadBlocks != null) && (
            <span>
              buf: {node.sharedHitBlocks ?? 0}h/{node.sharedReadBlocks ?? 0}r
            </span>
          )}
          <span>cost: {Math.round(node.costRatio * 100)}%</span>
        </span>

        {/* Signal badges */}
        {node.signals.map((s, i) => (
          <SignalBadge key={i} type={s.type} severity={s.severity} message={s.message} />
        ))}
      </div>

      {/* Children */}
      {expanded &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            selectedId={selectedId}
          />
        ))}
    </div>
  );
}
