import { Controller, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { SeederService } from './seeder.service';
import { SeedOptionsDto } from './dto/seed-options.dto';

@Controller('workspaces')
export class SeederController {
  constructor(private readonly seederService: SeederService) {}

  /** Seed workspace tables with faker data */
  @Post(':id/seed')
  seed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SeedOptionsDto,
  ) {
    return this.seederService.seed(id, dto);
  }

  /** Preview sample rows without inserting */
  @Post(':id/seed/preview')
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SeedOptionsDto,
  ) {
    return this.seederService.preview(id, dto);
  }
}
