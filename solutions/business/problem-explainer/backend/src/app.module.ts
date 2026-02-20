import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ProblemsModule } from './problems/problems.module';
import { ExplanationsModule } from './explanations/explanations.module';
import { KnowledgePointsModule } from './knowledge-points/knowledge-points.module';
import { SessionsModule } from './sessions/sessions.module';
import { SolutionConfigModule } from './config/config.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    ProblemsModule,
    ExplanationsModule,
    KnowledgePointsModule,
    SessionsModule,
    SolutionConfigModule,
  ],
})
export class AppModule {}
