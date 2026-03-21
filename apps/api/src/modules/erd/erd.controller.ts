import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ErdService } from './erd.service';

@Controller('workspaces')
export class ErdController {
  constructor(private readonly erdService: ErdService) {}

  /** Get ERD graph data: tables, columns, FK relationships */
  @Get(':id/erd')
  getErd(@Param('id', ParseUUIDPipe) id: string) {
    return this.erdService.getErd(id);
  }
}
