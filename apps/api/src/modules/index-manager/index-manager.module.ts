import { Module } from '@nestjs/common';
import { IndexManagerController } from './index-manager.controller';
import { IndexManagerService } from './index-manager.service';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [WorkspaceModule],
  controllers: [IndexManagerController],
  providers: [IndexManagerService],
})
export class IndexManagerModule {}
