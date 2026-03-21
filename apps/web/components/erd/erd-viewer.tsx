'use client';

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';

import { api } from '@/lib/api';
import { TableNode, TableNodeData } from './table-node';
import { Button } from '@/components/ui/button';

const NODE_TYPES = { tableNode: TableNode };

const NODE_WIDTH = 220;
const NODE_HEIGHT_BASE = 36; // header
const NODE_ROW_HEIGHT = 24; // per column

/** Compute positions using dagre top-to-bottom layout */
function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'LR',
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 80 });

  for (const node of nodes) {
    const colCount = (node.data as TableNodeData).columns.length;
    const h = NODE_HEIGHT_BASE + colCount * NODE_ROW_HEIGHT;
    g.setNode(node.id, { width: NODE_WIDTH, height: h });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const { x, y } = g.node(node.id);
    const colCount = (node.data as TableNodeData).columns.length;
    const h = NODE_HEIGHT_BASE + colCount * NODE_ROW_HEIGHT;
    return {
      ...node,
      position: { x: x - NODE_WIDTH / 2, y: y - h / 2 },
    };
  });
}

interface Props {
  workspaceId: string;
}

export function ErdViewer({ workspaceId }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadErd = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getErd(workspaceId);

      if (data.tables.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }

      // Build nodes
      const rawNodes: Node[] = data.tables.map((t) => ({
        id: t.name,
        type: 'tableNode',
        position: { x: 0, y: 0 },
        data: { name: t.name, columns: t.columns } satisfies TableNodeData,
      }));

      // Build edges
      const rawEdges: Edge[] = data.relationships.map((rel, i) => ({
        id: `fk_${i}_${rel.from}_${rel.fromColumn}_${rel.to}`,
        source: rel.from,
        target: rel.to,
        label: `${rel.fromColumn} → ${rel.toColumn}`,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 1.5 },
        labelStyle: { fontSize: 10 },
        labelBgStyle: { fill: 'transparent' },
      }));

      const layoutedNodes = applyDagreLayout(rawNodes, rawEdges, 'LR');
      setNodes(layoutedNodes);
      setEdges(rawEdges);
    } catch (err: any) {
      setError(err.message || 'Failed to load ERD');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { loadErd(); }, [loadErd]);

  if (loading) {
    return <div className="text-sm text-muted-foreground p-6">Loading ERD...</div>;
  }
  if (error) {
    return <div className="text-sm text-destructive p-6">{error}</div>;
  }
  if (nodes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-6">
        No tables found. Create tables in the Schema tab first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {nodes.length} table{nodes.length !== 1 ? 's' : ''}, {edges.length} relationship{edges.length !== 1 ? 's' : ''}
        </p>
        <Button variant="outline" size="sm" onClick={loadErd}>Refresh</Button>
      </div>

      <div className="border rounded-lg overflow-hidden" style={{ height: 560 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap
            nodeColor={() => 'hsl(var(--primary))'}
            maskColor="rgba(0,0,0,0.05)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
