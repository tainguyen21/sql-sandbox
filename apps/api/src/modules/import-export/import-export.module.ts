import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ImportExportController } from './import-export.controller';
import { ImportExportService } from './import-export.service';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [
    WorkspaceModule,
    // Use memory storage — CSV files are processed in-memory, no disk writes
    MulterModule.register({ storage: undefined }),
  ],
  controllers: [ImportExportController],
  providers: [ImportExportService],
})
export class ImportExportModule {}
