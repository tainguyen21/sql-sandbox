import { Module } from '@nestjs/common';
import { AnalyzerController } from './analyzer.controller';
import { AnalyzerService } from './analyzer.service';
import { PlanParserService } from './plan-parser.service';
import { Layer3DetectorService } from './layer3-detector.service';
import { Layer4DetectorService } from './layer4-detector.service';
import { IndexReportService } from './index-report.service';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [WorkspaceModule],
  controllers: [AnalyzerController],
  providers: [
    AnalyzerService,
    PlanParserService,
    Layer3DetectorService,
    Layer4DetectorService,
    IndexReportService,
  ],
  exports: [AnalyzerService],
})
export class AnalyzerModule {}
