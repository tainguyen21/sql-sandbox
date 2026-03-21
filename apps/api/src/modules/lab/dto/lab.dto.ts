import { IsUUID, IsString, IsIn, IsOptional } from 'class-validator';

export class CreateLabDto {
  @IsUUID()
  workspaceId: string;
}

export class ExecuteSqlDto {
  @IsString()
  sql: string;
}

export class BeginTransactionDto {
  @IsOptional()
  @IsIn(['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'])
  isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
}
