import { IsString, IsOptional, IsIn, MinLength } from 'class-validator';

export class AnalyzeQueryDto {
  @IsString()
  @MinLength(1)
  sql: string;

  @IsOptional()
  @IsIn(['plan', 'full'])
  mode?: 'plan' | 'full';
}
