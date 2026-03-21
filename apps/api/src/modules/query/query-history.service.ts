import { Injectable } from '@nestjs/common';
import { eq, desc, ilike, and, sql } from 'drizzle-orm';
import { getDb, queryHistory } from '@sql-sandbox/db';

interface RecordEntry {
  workspaceId: string;
  sql: string;
  durationMs: number;
  rowCount: number;
  error: string | null;
}

@Injectable()
export class QueryHistoryService {
  /** Record a query execution to history */
  async record(entry: RecordEntry) {
    const db = getDb();
    await db.insert(queryHistory).values({
      workspaceId: entry.workspaceId,
      sql: entry.sql,
      durationMs: entry.durationMs,
      rowCount: entry.rowCount,
      error: entry.error,
    });
  }

  /** Get paginated query history for a workspace */
  async findAll(
    workspaceId: string,
    opts: { search?: string; page?: number; limit?: number } = {},
  ) {
    const db = getDb();
    const page = opts.page || 1;
    const limit = opts.limit || 50;
    const offset = (page - 1) * limit;

    const conditions = [eq(queryHistory.workspaceId, workspaceId)];
    if (opts.search) {
      // Escape LIKE wildcards to prevent pattern injection
      const escaped = opts.search.replace(/[%_\\]/g, '\\$&');
      conditions.push(ilike(queryHistory.sql, `%${escaped}%`));
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(queryHistory)
        .where(where)
        .orderBy(desc(queryHistory.executedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(queryHistory)
        .where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      page,
      limit,
    };
  }

  /** Delete a single history entry (scoped to workspace) */
  async delete(id: string, workspaceId: string) {
    const db = getDb();
    await db
      .delete(queryHistory)
      .where(and(eq(queryHistory.id, id), eq(queryHistory.workspaceId, workspaceId)));
    return { deleted: true };
  }
}
