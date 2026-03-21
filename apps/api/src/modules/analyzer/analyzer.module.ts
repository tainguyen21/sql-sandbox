import { Module } from '@nestjs/common';
import { AnalyzerController } from './analyzer.controller';
import { AnalyzerService } from './analyzer.service';
import { PlanParserService } from './plan-parser.service';
import { CatalogQueryService } from './catalog-query.service';
import { Layer1DetectorService } from './layer1-detector.service';
import { Layer2DetectorService } from './layer2-detector.service';
import { Layer3DetectorService } from './layer3-detector.service';
import { Layer4DetectorService } from './layer4-detector.service';
import { Layer5DetectorService } from './layer5-detector.service';
import { Layer6DetectorService } from './layer6-detector.service';
import { Layer7DetectorService } from './layer7-detector.service';
import { IndexReportService } from './index-report.service';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [WorkspaceModule],
  controllers: [AnalyzerController],
  providers: [
    AnalyzerService,
    PlanParserService,
    CatalogQueryService,
    Layer1DetectorService,
    Layer2DetectorService,
    Layer3DetectorService,
    Layer4DetectorService,
    Layer5DetectorService,
    Layer6DetectorService,
    Layer7DetectorService,
    IndexReportService,
  ],
  exports: [AnalyzerService],
})
export class AnalyzerModule {}
