import { IsString, MinLength } from 'class-validator';

export class ExecuteDdlDto {
  @IsString()
  @MinLength(1)
  sql: string;
}
