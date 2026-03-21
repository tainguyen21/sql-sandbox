import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AddColumnDto {
  @IsString()
  name: string;

  @IsString()
  dataType: string;

  @IsOptional()
  @IsBoolean()
  nullable?: boolean;

  @IsOptional()
  @IsString()
  defaultValue?: string;
}

export class AlterTableDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddColumnDto)
  addColumns?: AddColumnDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dropColumns?: string[];

  @IsOptional()
  @IsString()
  renameTable?: string;
}
