import {
  Controller, Get, Post, Delete,
  Param, Body, Query as QueryParam, ParseUUIDPipe,
} from '@nestjs/common';
import { QueryService } from './query.service';
import { QueryHistoryService } from './query-history.service';
import { SnippetService } from './snippet.service';
import { ExecuteQueryDto } from './dto/execute-query.dto';
import { SaveSnippetDto } from './dto/save-snippet.dto';

@Controller('workspaces/:workspaceId')
export class QueryController {
  constructor(
    private readonly queryService: QueryService,
    private readonly historyService: QueryHistoryService,
    private readonly snippetService: SnippetService,
  ) {}

  /** Execute a SQL query */
  @Post('query')
  execute(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ExecuteQueryDto,
  ) {
    return this.queryService.execute(workspaceId, dto.sql, dto.page, dto.pageSize);
  }

  /** Get query history */
  @Get('query/history')
  getHistory(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @QueryParam('search') search?: string,
    @QueryParam('page') page?: string,
    @QueryParam('limit') limit?: string,
  ) {
    return this.historyService.findAll(workspaceId, {
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** Delete a history entry (scoped to workspace) */
  @Delete('query/history/:historyId')
  deleteHistory(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('historyId', ParseUUIDPipe) historyId: string,
  ) {
    return this.historyService.delete(historyId, workspaceId);
  }

  /** Save a snippet */
  @Post('snippets')
  createSnippet(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: SaveSnippetDto,
  ) {
    return this.snippetService.create(workspaceId, dto);
  }

  /** List snippets */
  @Get('snippets')
  getSnippets(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.snippetService.findAll(workspaceId);
  }

  /** Delete a snippet */
  @Delete('snippets/:snippetId')
  deleteSnippet(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('snippetId', ParseUUIDPipe) snippetId: string,
  ) {
    return this.snippetService.delete(snippetId, workspaceId);
  }
}
