import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import { Lesson } from '../adapters/persistence/entities/lesson.entity';
import { Student } from '../adapters/persistence/entities/student.entity';
import { Submission } from '../adapters/persistence/entities/submission.entity';
import { ClassroomSession } from '../adapters/persistence/entities/classroom-session.entity';
import { AiQuestion } from '../adapters/persistence/entities/ai-question.entity';
import { ChatMessage } from '../adapters/persistence/entities/chat-message.entity';
import { ClassroomSnapshot } from '../adapters/persistence/entities/classroom-snapshot.entity';
import { DiscussHighlight } from '../adapters/persistence/entities/discuss-highlight.entity';
import { DiscussTargetHit } from '../adapters/persistence/entities/discuss-target-hit.entity';
import { CourseProject } from '../adapters/persistence/entities/course-project.entity';
import { ProjectFile } from '../adapters/persistence/entities/project-file.entity';
import { ExerciseTypeDef } from '../adapters/persistence/entities/exercise-type-def.entity';
import { TaskDemoAttempt } from '../adapters/persistence/entities/task-demo-attempt.entity';
import { RequirementInterpretation } from '../teaching-requirements/requirement-interpretation.entity';
import { OntologyEventOutbox } from '../adapters/persistence/entities/ontology-event-outbox.entity';

// M6 pass-1 S6: legacy `observations` + `observer_events` tables are
// no longer written or read from the live-lesson side. Existing
// databases retain the tables (no migration); new databases skip them.

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: path.resolve(process.cwd(), 'data/live-lesson.db'),
      entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ClassroomSnapshot, DiscussHighlight, DiscussTargetHit, CourseProject, ProjectFile, ExerciseTypeDef, TaskDemoAttempt, RequirementInterpretation, OntologyEventOutbox],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: false,
    }),
  ],
})
export class TypeOrmConfigModule {}
