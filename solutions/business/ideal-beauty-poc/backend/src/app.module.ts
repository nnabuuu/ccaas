import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { SseModule } from './sse/sse.module';
import { EvaluatorModule } from './evaluator/evaluator.module';
import { SessionsModule } from './sessions/sessions.module';
import { StudentsModule } from './students/students.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    SseModule,
    EvaluatorModule,
    SessionsModule,
    StudentsModule,
  ],
})
export class AppModule {}
