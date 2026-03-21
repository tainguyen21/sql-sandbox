import { Injectable } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import { SqlValidatorService } from '../database/sql-validator.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { QueryHistoryService } from './query-history.service';

const DEFAULT_PAGE_SIZE = 100;

@Injectable()
export class QueryService {
  constructor(
    private sandbox: SandboxPoolService,
    private validator: SqlValidatorService,
    private workspaceService: WorkspaceService,
    private historyService: QueryHistoryService,
  ) {}

  /** Execute a SQL query in a workspace, return paginated results */
  async execute(workspaceId: string, sql: string, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
    this.validator.validate(sql);
    const workspace = await this.workspaceService.findOne(workspaceId);
    const start = performance.now();

    try {
      // Wrap user SQL with LIMIT/OFFSET for DB-level pagination (only for SELECT)
      const isSelect = /^\s*SELECT\b/i.test(sql);
      const offset = (page - 1) * pageSize;
      const paginatedSql = isSelect
        ? `WITH _user_query AS (${sql}) SELECT * FROM _user_query LIMIT ${pageSize + 1} OFFSET ${offset}`
        : sql;

      const { rows } = await this.sandbox.executeInWorkspace(
        workspace.schemaName,
        paginatedSql,
      );
      const durationMs = Math.round(performance.now() - start);

      // Check if there are more rows beyond current page
      const hasMore = isSelect && rows.length > pageSize;
      const resultRows = hasMore ? rows.slice(0, pageSize) : rows;

      // Extract column names
      const columns = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];

      // Record to history (fire-and-forget)
      this.historyService
        .record({
          workspaceId,
          sql,
          durationMs,
          rowCount: resultRows.length,
          error: null,
        })
        .catch(() => {});

      return {
        columns,
        rows: resultRows,
        rowCount: resultRows.length,
        durationMs,
        page,
        pageSize,
        hasMore,
        error: null,
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      const errorMsg = err.message || 'Query execution failed';

      // Record failed query to history
      this.historyService
        .record({
          workspaceId,
          sql,
          durationMs,
          rowCount: 0,
          error: errorMsg,
        })
        .catch(() => {});

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs,
        page,
        pageSize,
        hasMore: false,
        error: errorMsg,
      };
    }
  }
}
