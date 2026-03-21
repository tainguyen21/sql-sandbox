import { Controller, Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { AnalyzerService } from './analyzer.service';
import { AnalyzeQueryDto } from './dto/analyze-query.dto';

@Controller('workspaces/:workspaceId')
export class AnalyzerController {
  constructor(private readonly analyzerService: AnalyzerService) {}

  /** Full analysis (EXPLAIN ANALYZE) — executes the query */
  @Post('analyze')
  analyze(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: AnalyzeQueryDto,
  ) {
    return this.analyzerService.analyze(workspaceId, dto.sql, dto.mode || 'full');
  }

  /** Plan-only analysis (EXPLAIN) — does not execute */
  @Post('analyze/plan')
  analyzePlan(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: AnalyzeQueryDto,
  ) {
    return this.analyzerService.analyze(workspaceId, dto.sql, 'plan');
  }
}
