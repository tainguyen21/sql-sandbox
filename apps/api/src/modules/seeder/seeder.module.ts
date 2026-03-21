import { Module } from '@nestjs/common';
import { SeederController } from './seeder.controller';
import { SeederService } from './seeder.service';
import { FakerMapperService } from './faker-mapper.service';
import { DatabaseModule } from '../database/database.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [DatabaseModule, WorkspaceModule],
  controllers: [SeederController],
  providers: [SeederService, FakerMapperService],
})
export class SeederModule {}
