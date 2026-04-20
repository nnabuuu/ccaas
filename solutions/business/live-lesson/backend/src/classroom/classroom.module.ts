import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { ClassroomService } from './classroom.service';
import { ClassroomController } from './classroom.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Student, Submission, ClassroomSession])],
  controllers: [ClassroomController],
  providers: [ClassroomService],
})
export class ClassroomModule {}
