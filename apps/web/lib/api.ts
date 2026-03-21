/** API client for communicating with the NestJS backend */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Workspaces
  getWorkspaces: () => fetcher<any[]>('/workspaces'),
  getWorkspace: (id: string) => fetcher<any>(`/workspaces/${id}`),
  createWorkspace: (data: { name: string; description?: string }) =>
    fetcher<any>('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  deleteWorkspace: (id: string) =>
    fetcher<any>(`/workspaces/${id}`, { method: 'DELETE' }),

  // Tables
  getTables: (workspaceId: string) =>
    fetcher<string[]>(`/workspaces/${workspaceId}/tables`),
  getTableDetail: (workspaceId: string, table: string) =>
    fetcher<any>(`/workspaces/${workspaceId}/tables/${table}`),
  executeDdl: (workspaceId: string, sql: string) =>
    fetcher<any>(`/workspaces/${workspaceId}/tables`, {
      method: 'POST',
      body: JSON.stringify({ sql }),
    }),
  alterTable: (workspaceId: string, table: string, ops: any) =>
    fetcher<any>(`/workspaces/${workspaceId}/tables/${table}`, {
      method: 'PUT',
      body: JSON.stringify(ops),
    }),
  dropTable: (workspaceId: string, table: string) =>
    fetcher<any>(`/workspaces/${workspaceId}/tables/${table}`, { method: 'DELETE' }),

  // Query execution
  executeQuery: (workspaceId: string, sql: string, page?: number) =>
    fetcher<any>(`/workspaces/${workspaceId}/query`, {
      method: 'POST',
      body: JSON.stringify({ sql, page }),
    }),

  // Query history
  getQueryHistory: (workspaceId: string, search?: string, page?: number) =>
    fetcher<any>(
      `/workspaces/${workspaceId}/query/history?${new URLSearchParams({
        ...(search ? { search } : {}),
        ...(page ? { page: String(page) } : {}),
      })}`,
    ),

  // Snippets
  getSnippets: (workspaceId: string) =>
    fetcher<any[]>(`/workspaces/${workspaceId}/snippets`),
  saveSnippet: (workspaceId: string, data: { name: string; sql: string; tags?: string[] }) =>
    fetcher<any>(`/workspaces/${workspaceId}/snippets`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteSnippet: (workspaceId: string, id: string) =>
    fetcher<any>(`/workspaces/${workspaceId}/snippets/${id}`, { method: 'DELETE' }),

  // Analyzer
  analyzeQuery: (workspaceId: string, sql: string, mode: 'plan' | 'full' = 'full') =>
    fetcher<any>(`/workspaces/${workspaceId}/analyze${mode === 'plan' ? '/plan' : ''}`, {
      method: 'POST',
      body: JSON.stringify({ sql, mode }),
    }),

  // AI Optimizer
  getAiSuggestions: (workspaceId: string, sql: string) =>
    fetcher<any[]>(`/workspaces/${workspaceId}/analyze/suggest`, {
      method: 'POST',
      body: JSON.stringify({ sql }),
    }),
  applyDdl: (workspaceId: string, ddl: string) =>
    fetcher<any>(`/workspaces/${workspaceId}/analyze/apply-ddl`, {
      method: 'POST',
      body: JSON.stringify({ ddl }),
    }),
  applyGuc: (workspaceId: string, guc: string) =>
    fetcher<any>(`/workspaces/${workspaceId}/analyze/apply-guc`, {
      method: 'POST',
      body: JSON.stringify({ guc }),
    }),

  // A/B Comparison
  compareQueries: (workspaceId: string, sqlA: string, sqlB: string) =>
    fetcher<any>(`/workspaces/${workspaceId}/analyze/compare`, {
      method: 'POST',
      body: JSON.stringify({ sqlA, sqlB }),
    }),

  // Index Manager
  listIndexes: (workspaceId: string) =>
    fetcher<any[]>(`/workspaces/${workspaceId}/indexes`),
  createIndex: (
    workspaceId: string,
    data: {
      tableName: string;
      columns: string[];
      indexType: 'btree' | 'hash' | 'gin' | 'gist' | 'brin';
      unique: boolean;
      concurrently: boolean;
      whereClause?: string;
    },
  ) =>
    fetcher<any>(`/workspaces/${workspaceId}/indexes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  dropIndex: (workspaceId: string, indexName: string) =>
    fetcher<any>(`/workspaces/${workspaceId}/indexes/${indexName}`, {
      method: 'DELETE',
    }),

  // Seeder
  seedWorkspace: (
    workspaceId: string,
    options: { rowCount?: number; locale?: string; tables?: string[] },
  ) =>
    fetcher<{ seeded: Record<string, number> }>(`/workspaces/${workspaceId}/seed`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  previewSeed: (
    workspaceId: string,
    options: { rowCount?: number; locale?: string; tables?: string[] },
  ) =>
    fetcher<{ preview: Record<string, Record<string, any>[]> }>(
      `/workspaces/${workspaceId}/seed/preview`,
      { method: 'POST', body: JSON.stringify(options) },
    ),

  // ERD
  getErd: (workspaceId: string) =>
    fetcher<{
      tables: Array<{
        name: string;
        columns: Array<{
          name: string;
          type: string;
          isPk: boolean;
          isNullable: boolean;
          isFk: boolean;
          fkRef?: string;
        }>;
      }>;
      relationships: Array<{
        from: string;
        to: string;
        fromColumn: string;
        toColumn: string;
      }>;
    }>(`/workspaces/${workspaceId}/erd`),

  // Import / Export
  previewImport: (workspaceId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_BASE}/workspaces/${workspaceId}/import/preview`, {
      method: 'POST',
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || `API error: ${res.status}`);
      }
      return res.json() as Promise<Array<{ name: string; type: string }>>;
    });
  },

  importCsv: (workspaceId: string, file: File, tableName?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (tableName) form.append('tableName', tableName);
    return fetch(`${API_BASE}/workspaces/${workspaceId}/import`, {
      method: 'POST',
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || `API error: ${res.status}`);
      }
      return res.json() as Promise<{ tableName: string; rowsInserted: number; columns: any[] }>;
    });
  },

  // Transaction Lab
  createLab: (workspaceId: string) =>
    fetcher<{ labId: string }>('/labs', {
      method: 'POST',
      body: JSON.stringify({ workspaceId }),
    }),
  labExecute: (labId: string, session: 'a' | 'b', sql: string) =>
    fetcher<any>(`/labs/${labId}/sessions/${session}/execute`, {
      method: 'POST',
      body: JSON.stringify({ sql }),
    }),
  labBegin: (labId: string, session: 'a' | 'b', isolationLevel?: string) =>
    fetcher<any>(`/labs/${labId}/sessions/${session}/begin`, {
      method: 'POST',
      body: JSON.stringify({ isolationLevel }),
    }),
  labCommit: (labId: string, session: 'a' | 'b') =>
    fetcher<any>(`/labs/${labId}/sessions/${session}/commit`, { method: 'POST' }),
  labRollback: (labId: string, session: 'a' | 'b') =>
    fetcher<any>(`/labs/${labId}/sessions/${session}/rollback`, { method: 'POST' }),
  labGetLocks: (labId: string) =>
    fetcher<any>(`/labs/${labId}/locks`),
  deleteLab: (labId: string) =>
    fetcher<any>(`/labs/${labId}`, { method: 'DELETE' }),
};
