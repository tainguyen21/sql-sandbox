import { Module } from '@nestjs/common';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { QueryHistoryService } from './query-history.service';
import { SnippetService } from './snippet.service';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [WorkspaceModule],
  controllers: [QueryController],
  providers: [QueryService, QueryHistoryService, SnippetService],
  exports: [QueryService],
})
export class QueryModule {}
