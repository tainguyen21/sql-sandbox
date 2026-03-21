import { Controller, Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { OptimizerService } from './optimizer.service';
import { SuggestDto, ApplyDdlDto, ApplyGucDto, CompareDto } from './dto/suggest.dto';

@Controller('workspaces/:workspaceId/analyze')
export class OptimizerController {
  constructor(private readonly optimizer: OptimizerService) {}

  /** Get AI optimization suggestions */
  @Post('suggest')
  suggest(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: SuggestDto,
  ) {
    return this.optimizer.suggest(workspaceId, dto.sql);
  }

  /** Apply a DDL suggestion */
  @Post('apply-ddl')
  applyDdl(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ApplyDdlDto,
  ) {
    return this.optimizer.applyDdl(workspaceId, dto.ddl);
  }

  /** Apply a GUC change */
  @Post('apply-guc')
  applyGuc(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ApplyGucDto,
  ) {
    return this.optimizer.applyGuc(workspaceId, dto.guc);
  }

  /** A/B query comparison */
  @Post('compare')
  compare(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CompareDto,
  ) {
    return this.optimizer.compare(workspaceId, dto.sqlA, dto.sqlB);
  }
}
