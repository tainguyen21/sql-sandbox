'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Snippet {
  id: string;
  name: string;
  sql: string;
  tags: string[] | null;
}

interface Props {
  workspaceId: string;
  onLoadSql: (sql: string) => void;
}

export function SnippetSidebar({ workspaceId, onLoadSql }: Props) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSnippets = () => {
    setLoading(true);
    api
      .getSnippets(workspaceId)
      .then(setSnippets)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSnippets();
  }, [workspaceId]);

  const handleDelete = async (id: string) => {
    await api.deleteSnippet(workspaceId, id);
    fetchSnippets();
  };

  return (
    <div className="border rounded-md p-3 space-y-2">
      <h3 className="text-sm font-semibold">Saved Snippets</h3>
      {loading && <p className="text-xs text-muted-foreground">Loading...</p>}
      <ul className="space-y-1 max-h-[200px] overflow-auto">
        {snippets.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent/50 group"
          >
            <button
              className="text-xs text-left flex-1 truncate"
              onClick={() => onLoadSql(s.sql)}
            >
              <span className="font-medium">{s.name}</span>
              {s.tags && s.tags.length > 0 && (
                <span className="text-muted-foreground ml-1">
                  [{s.tags.join(', ')}]
                </span>
              )}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 text-destructive h-6 px-1"
              onClick={() => handleDelete(s.id)}
            >
              ×
            </Button>
          </li>
        ))}
        {!loading && snippets.length === 0 && (
          <p className="text-xs text-muted-foreground">No snippets saved yet.</p>
        )}
      </ul>
    </div>
  );
}
