export type IndexType = 'btree' | 'hash' | 'gin' | 'gist' | 'brin';
export interface IndexInfo {
    indexName: string;
    tableName: string;
    columns: string;
    indexType: IndexType;
    indexSize: string;
    indexDef: string;
    idxScan: number;
    idxTupRead: number;
    idxTupFetch: number;
    tableRows: number;
    isUnique: boolean;
    isPrimary: boolean;
}
export interface CreateIndexPayload {
    tableName: string;
    columns: string[];
    indexType: IndexType;
    unique: boolean;
    concurrently: boolean;
    whereClause?: string;
}
export interface IndexActionResult {
    success: boolean;
    indexName: string;
    ddl?: string;
    message?: string;
}
