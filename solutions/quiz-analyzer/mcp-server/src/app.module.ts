import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { KnowledgePointsModule } from './knowledge-points/knowledge-points.module';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 数据库模块（全局）
    DatabaseModule,

    // 业务模块
    KnowledgePointsModule,
    ToolsModule,
  ],
})
export class AppModule {}
