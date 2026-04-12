import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SolutionRegisterService } from './solution-register.service';
import { TypeOrmConfigModule } from './typeorm/typeorm.module';
import { LessonPlanModule } from './lesson-plan/lesson-plan.module';
import { TemplateModule } from './template/template.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ActivityModule } from './activity/activity.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    TypeOrmConfigModule,
    CurriculumModule,
    UsersModule,
    AuthModule,
    LessonPlanModule,
    TemplateModule,
    DashboardModule,
    ActivityModule,
  ],
  providers: [SolutionRegisterService],
})
export class AppModule {}
