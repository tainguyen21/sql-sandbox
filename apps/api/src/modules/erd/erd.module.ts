import { Module } from '@nestjs/common';
import { ErdController } from './erd.controller';
import { ErdService } from './erd.service';
import { DatabaseModule } from '../database/database.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [DatabaseModule, WorkspaceModule],
  controllers: [ErdController],
  providers: [ErdService],
})
export class ErdModule {}
