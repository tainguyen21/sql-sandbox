import { Module } from '@nestjs/common';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';
import { LabSessionManagerService } from './lab-session-manager.service';
import { LockViewerService } from './lock-viewer.service';

/**
 * LabModule — dual-session transaction experimentation.
 * Provides persistent pg.Client pairs per lab session.
 * DatabaseModule is @Global so SandboxPoolService + SqlValidatorService are injected automatically.
 */
@Module({
  controllers: [LabController],
  providers: [LabSessionManagerService, LabService, LockViewerService],
})
export class LabModule {}
