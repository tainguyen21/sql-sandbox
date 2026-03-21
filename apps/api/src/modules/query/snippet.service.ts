import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { getDb, savedSnippets } from '@sql-sandbox/db';

@Injectable()
export class SnippetService {
  /** Save a new snippet */
  async create(workspaceId: string, data: { name: string; sql: string; tags?: string[] }) {
    const db = getDb();
    const [snippet] = await db
      .insert(savedSnippets)
      .values({
        workspaceId,
        name: data.name,
        sql: data.sql,
        tags: data.tags || [],
      })
      .returning();
    return snippet;
  }

  /** List all snippets for a workspace */
  async findAll(workspaceId: string) {
    const db = getDb();
    return db
      .select()
      .from(savedSnippets)
      .where(eq(savedSnippets.workspaceId, workspaceId))
      .orderBy(savedSnippets.createdAt);
  }

  /** Delete a snippet */
  async delete(id: string, workspaceId: string) {
    const db = getDb();
    const [deleted] = await db
      .delete(savedSnippets)
      .where(and(eq(savedSnippets.id, id), eq(savedSnippets.workspaceId, workspaceId)))
      .returning();
    if (!deleted) throw new NotFoundException('Snippet not found');
    return { deleted: true };
  }
}
