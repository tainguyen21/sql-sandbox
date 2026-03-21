import {
  Controller, Get, Post, Delete,
  Param, Body, ParseUUIDPipe,
} from '@nestjs/common';
import { IndexManagerService } from './index-manager.service';
import { CreateIndexDto } from './dto/create-index.dto';

@Controller('workspaces')
export class IndexManagerController {
  constructor(private readonly indexManagerService: IndexManagerService) {}

  /** List all indexes with usage stats for a workspace */
  @Get(':id/indexes')
  listIndexes(@Param('id', ParseUUIDPipe) id: string) {
    return this.indexManagerService.listIndexes(id);
  }

  /** Create a new index in the workspace */
  @Post(':id/indexes')
  createIndex(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIndexDto,
  ) {
    return this.indexManagerService.createIndex(id, dto);
  }

  /** Drop an index by name */
  @Delete(':id/indexes/:name')
  dropIndex(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('name') name: string,
  ) {
    return this.indexManagerService.dropIndex(id, name);
  }
}
