import { Module } from '@nestjs/common';
import { OptimizerController } from './optimizer.controller';
import { OptimizerService } from './optimizer.service';
import { LlmClientService } from './llm-client.service';
import { PromptBuilderService } from './prompt-builder.service';
import { AnalyzerModule } from '../analyzer/analyzer.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [AnalyzerModule, WorkspaceModule],
  controllers: [OptimizerController],
  providers: [OptimizerService, LlmClientService, PromptBuilderService],
})
export class OptimizerModule {}
