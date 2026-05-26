import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { TypeOrmConfigModule } from '../typeorm/typeorm.module';
import { LessonModule } from './lesson.module';
import { ClassroomModule } from './classroom.module';
import { ProjectModule } from '../project/project.module';
import { ExerciseTypeModule } from '../exercise-type/exercise-type.module';
import { TeachingRequirementsModule } from '../teaching-requirements/teaching-requirements.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'static'),
      serveRoot: '/static',
      serveStaticOptions: { index: false },
    }),
    TypeOrmConfigModule,
    LessonModule,
    ClassroomModule,
    ProjectModule,
    ExerciseTypeModule,
    TeachingRequirementsModule,
  ],
})
export class AppModule {}
