'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { WorkspaceCreateModal } from './workspace-create-modal';

interface Workspace {
  id: string;
  name: string;
  schemaName: string;
  description?: string;
}

export function WorkspaceSidebar() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchWorkspaces = async () => {
    try {
      const data = await api.getWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const activeId = pathname?.match(/\/workspaces\/([^/]+)/)?.[1];

  return (
    <aside className="w-64 border-r bg-muted/40 flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">SQL Sandbox</h1>
      </div>

      <div className="p-3">
        <Button
          size="sm"
          className="w-full"
          onClick={() => setShowCreate(true)}
        >
          + New Workspace
        </Button>
      </div>

      <nav className="flex-1 overflow-auto px-2">
        {loading && <p className="text-sm text-muted-foreground px-2">Loading...</p>}
        {workspaces.map((ws) => (
          <Link
            key={ws.id}
            href={`/workspaces/${ws.id}`}
            className={`block px-3 py-2 rounded-md text-sm mb-1 transition-colors ${
              activeId === ws.id
                ? 'bg-accent text-accent-foreground font-medium'
                : 'hover:bg-accent/50 text-foreground'
            }`}
          >
            {ws.name}
          </Link>
        ))}
        {!loading && workspaces.length === 0 && (
          <p className="text-sm text-muted-foreground px-2 py-4">
            No workspaces yet. Create one to get started.
          </p>
        )}
      </nav>

      {showCreate && (
        <WorkspaceCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchWorkspaces();
          }}
        />
      )}
    </aside>
  );
}
