import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmConfigModule } from './typeorm/typeorm.module';
import { LessonModule } from './lesson/lesson.module';
import { ClassroomModule } from './classroom/classroom.module';
import { ProjectModule } from './project/project.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmConfigModule,
    LessonModule,
    ClassroomModule,
    ProjectModule,
  ],
})
export class AppModule {}
