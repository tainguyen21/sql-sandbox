import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    // WorkspaceModule, QueryModule, AnalyzerModule — added in Phase 02+
  ],
  controllers: [AppController],
})
export class AppModule {}
