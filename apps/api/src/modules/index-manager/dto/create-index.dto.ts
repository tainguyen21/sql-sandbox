import {
  IsString,
  IsArray,
  IsBoolean,
  IsOptional,
  IsIn,
  ArrayMinSize,
  Matches,
  MaxLength,
} from 'class-validator';
import type { IndexType } from '@sql-sandbox/shared';

const VALID_INDEX_TYPES: IndexType[] = ['btree', 'hash', 'gin', 'gist', 'brin'];

/** Safe identifier: alphanumeric + underscore only */
const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export class CreateIndexDto {
  @IsString()
  @Matches(IDENTIFIER_REGEX, { message: 'tableName must be a valid identifier' })
  @MaxLength(63)
  tableName: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(IDENTIFIER_REGEX, { each: true, message: 'Each column must be a valid identifier' })
  columns: string[];

  @IsIn(VALID_INDEX_TYPES)
  indexType: IndexType;

  @IsBoolean()
  unique: boolean;

  @IsBoolean()
  concurrently: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  whereClause?: string;
}
