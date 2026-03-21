/** Standard API response wrapper */
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Workspace info returned by API */
export interface WorkspaceInfo {
  id: string;
  name: string;
  schemaName: string;
  description?: string;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Create workspace request */
export interface CreateWorkspaceDto {
  name: string;
  description?: string;
  templateId?: string;
}

/** Table column metadata from information_schema */
export interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
}

/** Table metadata */
export interface TableInfo {
  tableName: string;
  columns: ColumnInfo[];
  rowCount: number;
}

/** Query execution result */
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  error?: string;
}
