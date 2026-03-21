import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ImportExportService } from './import-export.service';

@Controller('workspaces/:id')
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  /**
   * POST /workspaces/:id/import
   * Accepts multipart CSV file upload. Body field: file (CSV), tableName (optional).
   */
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @Param('id') workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('tableName') tableName?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Send CSV as multipart field "file".');
    }
    const derivedName = tableName || deriveTableName(file.originalname);
    return this.importExportService.importCsv(workspaceId, derivedName, file.buffer);
  }

  /**
   * POST /workspaces/:id/import/preview
   * Returns inferred schema without inserting data.
   */
  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file'))
  previewImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }
    return this.importExportService.previewCsvSchema(file.buffer);
  }

  /**
   * GET /workspaces/:id/tables/:table/export?format=csv
   * Streams table rows as CSV download.
   */
  @Get('tables/:table/export')
  async exportTableCsv(
    @Param('id') workspaceId: string,
    @Param('table') tableName: string,
    @Query('format') format: string = 'csv',
    @Res() res: Response,
  ) {
    if (format !== 'csv') {
      throw new BadRequestException('Only format=csv is supported for table export');
    }
    const csv = await this.importExportService.exportTableCsv(workspaceId, tableName);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${tableName}.csv"`);
    res.send(csv);
  }

  /**
   * GET /workspaces/:id/export
   * Returns full workspace SQL dump as .sql file download.
   */
  @Get('export')
  async exportWorkspaceSql(@Param('id') workspaceId: string, @Res() res: Response) {
    const sql = await this.importExportService.exportWorkspaceSql(workspaceId);
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="workspace-${workspaceId}.sql"`);
    res.send(sql);
  }
}

/** Derive a table name from a filename (strip extension, sanitize) */
function deriveTableName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1')
    .slice(0, 63) || 'imported_table';
}
