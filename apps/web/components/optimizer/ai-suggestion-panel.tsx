'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SuggestionCard } from './suggestion-card';

interface Props {
  workspaceId: string;
  sql: string;
  onCopyQuery: (sql: string) => void;
}

export function AiSuggestionPanel({ workspaceId, sql, onCopyQuery }: Props) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getSuggestions = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError('');
    setSuggestions([]);
    try {
      const data = await api.getAiSuggestions(workspaceId, sql.trim());
      setSuggestions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to get suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDdl = async (ddl: string) => {
    try {
      await api.applyDdl(workspaceId, ddl);
      alert('DDL applied successfully');
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  const handleApplyGuc = async (guc: string) => {
    try {
      await api.applyGuc(workspaceId, guc);
      alert('Configuration applied');
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button onClick={getSuggestions} disabled={loading || !sql.trim()}>
          {loading ? 'Analyzing with AI...' : 'Get AI Suggestions'}
        </Button>
        <span className="text-xs text-muted-foreground">
          AI-generated suggestions — review before applying
        </span>
      </div>

      {error && (
        <div className="text-sm text-destructive border border-destructive/30 rounded p-3">{error}</div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <SuggestionCard
              key={i}
              suggestion={s}
              onApplyDdl={handleApplyDdl}
              onApplyGuc={handleApplyGuc}
              onCopyQuery={onCopyQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}
