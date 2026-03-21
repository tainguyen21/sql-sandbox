import { IsInt, IsOptional, IsString, Min, Max, IsArray } from 'class-validator';

export class SeedOptionsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  rowCount?: number = 100;

  @IsOptional()
  @IsString()
  locale?: string = 'en';

  /** Specific tables to seed; if omitted, all tables are seeded */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tables?: string[];
}
