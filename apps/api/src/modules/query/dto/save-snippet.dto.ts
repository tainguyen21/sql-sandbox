import { IsString, IsOptional, IsArray, MinLength } from 'class-validator';

export class SaveSnippetDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  sql: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
