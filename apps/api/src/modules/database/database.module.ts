import { Module, Global } from '@nestjs/common';
import { SandboxPoolService } from './sandbox-pool.service';
import { SqlValidatorService } from './sql-validator.service';

/** Global database module — provides SandboxPoolService to all modules */
@Global()
@Module({
  providers: [SandboxPoolService, SqlValidatorService],
  exports: [SandboxPoolService, SqlValidatorService],
})
export class DatabaseModule {}
