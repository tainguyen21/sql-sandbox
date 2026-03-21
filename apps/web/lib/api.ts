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
};
