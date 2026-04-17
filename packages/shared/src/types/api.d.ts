export interface ApiResponse<T> {
    data: T;
    message?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}
export interface WorkspaceInfo {
    id: string;
    name: string;
    schemaName: string;
    description?: string;
    templateId?: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateWorkspaceDto {
    name: string;
    description?: string;
    templateId?: string;
}
export interface ColumnInfo {
    columnName: string;
    dataType: string;
    isNullable: boolean;
    columnDefault: string | null;
    isPrimaryKey: boolean;
    isUnique: boolean;
}
export interface TableInfo {
    tableName: string;
    columns: ColumnInfo[];
    rowCount: number;
}
export interface QueryResult {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    durationMs: number;
    error?: string;
}
