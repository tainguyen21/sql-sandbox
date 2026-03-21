import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './modules/database/database.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { QueryModule } from './modules/query/query.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    DatabaseModule,
    WorkspaceModule,
    QueryModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
