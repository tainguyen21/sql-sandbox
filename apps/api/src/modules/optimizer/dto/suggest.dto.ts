import { IsString, MinLength } from 'class-validator';

export class SuggestDto {
  @IsString()
  @MinLength(1)
  sql: string;
}

export class ApplyDdlDto {
  @IsString()
  @MinLength(1)
  ddl: string;
}

export class ApplyGucDto {
  @IsString()
  @MinLength(1)
  guc: string;
}

export class CompareDto {
  @IsString()
  @MinLength(1)
  sqlA: string;

  @IsString()
  @MinLength(1)
  sqlB: string;
}
