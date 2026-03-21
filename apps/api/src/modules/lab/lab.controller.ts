import {
  Controller, Post, Get, Delete,
  Param, Body, ParseUUIDPipe,
} from '@nestjs/common';
import { LabService } from './lab.service';
import { LockViewerService } from './lock-viewer.service';
import { LabSessionManagerService } from './lab-session-manager.service';
import { CreateLabDto, ExecuteSqlDto, BeginTransactionDto } from './dto/lab.dto';

/** Validates session param is 'a' or 'b' */
function parseSession(session: string): 'a' | 'b' {
  const s = session.toLowerCase();
  if (s !== 'a' && s !== 'b') {
    throw new Error(`Invalid session: must be 'a' or 'b'`);
  }
  return s;
}

/**
 * Lab endpoints for dual-session transaction experimentation.
 * Each lab has two persistent pg.Client connections (A and B).
 */
@Controller('labs')
export class LabController {
  constructor(
    private readonly labService: LabService,
    private readonly lockViewer: LockViewerService,
    private readonly sessionManager: LabSessionManagerService,
  ) {}

  /** Create a new lab session with two persistent connections */
  @Post()
  async createLab(@Body() dto: CreateLabDto) {
    const labId = await this.sessionManager.createSession(dto.workspaceId);
    return { labId };
  }

  /** Execute SQL on session A or B */
  @Post(':id/sessions/:session/execute')
  execute(
    @Param('id') labId: string,
    @Param('session') session: string,
    @Body() dto: ExecuteSqlDto,
  ) {
    return this.labService.execute(labId, parseSession(session), dto.sql);
  }

  /** BEGIN [ISOLATION LEVEL ...] on session A or B */
  @Post(':id/sessions/:session/begin')
  begin(
    @Param('id') labId: string,
    @Param('session') session: string,
    @Body() dto: BeginTransactionDto,
  ) {
    return this.labService.begin(labId, parseSession(session), dto.isolationLevel);
  }

  /** COMMIT on session A or B */
  @Post(':id/sessions/:session/commit')
  commit(
    @Param('id') labId: string,
    @Param('session') session: string,
  ) {
    return this.labService.commit(labId, parseSession(session));
  }

  /** ROLLBACK on session A or B */
  @Post(':id/sessions/:session/rollback')
  rollback(
    @Param('id') labId: string,
    @Param('session') session: string,
  ) {
    return this.labService.rollback(labId, parseSession(session));
  }

  /** Get pg_locks snapshot for both session PIDs */
  @Get(':id/locks')
  getLocks(@Param('id') labId: string) {
    return this.lockViewer.getLocksSnapshot(labId);
  }

  /** Destroy lab session — close both connections */
  @Delete(':id')
  async deleteLab(@Param('id') labId: string) {
    await this.sessionManager.destroySession(labId);
    return { success: true };
  }
}
