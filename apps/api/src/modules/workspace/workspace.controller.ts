import {
  Controller, Get, Post, Put, Delete,
  Param, Body, ParseUUIDPipe,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { ExecuteDdlDto } from './dto/execute-ddl.dto';
import { AlterTableDto } from './dto/alter-table.dto';

@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  create(@Body() dto: CreateWorkspaceDto) {
    return this.workspaceService.create(dto);
  }

  @Get()
  findAll() {
    return this.workspaceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workspaceService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workspaceService.remove(id);
  }

  /** Execute DDL (CREATE TABLE, ALTER, etc.) in workspace */
  @Post(':id/tables')
  executeDdl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteDdlDto,
  ) {
    return this.workspaceService.executeDdl(id, dto.sql);
  }

  /** List tables in workspace */
  @Get(':id/tables')
  getTables(@Param('id', ParseUUIDPipe) id: string) {
    return this.workspaceService.getTables(id);
  }

  /** Get table detail (columns, constraints, indexes) */
  @Get(':id/tables/:table')
  getTableDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('table') table: string,
  ) {
    return this.workspaceService.getTableDetail(id, table);
  }

  /** ALTER TABLE operations */
  @Put(':id/tables/:table')
  alterTable(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('table') table: string,
    @Body() dto: AlterTableDto,
  ) {
    return this.workspaceService.alterTable(id, table, dto);
  }

  /** Drop a table */
  @Delete(':id/tables/:table')
  dropTable(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('table') table: string,
  ) {
    return this.workspaceService.dropTable(id, table);
  }
}
