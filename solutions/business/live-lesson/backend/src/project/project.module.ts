import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseProject } from '../adapters/persistence/entities/course-project.entity';
import { ProjectFile } from '../adapters/persistence/entities/project-file.entity';
import { Lesson } from '../adapters/persistence/entities/lesson.entity';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { CcaasProxyController } from '../adapters/http/ccaas-proxy.controller';
import { CcaasChatProxyController } from '../adapters/http/ccaas-chat-proxy.controller';
import { CcaasUpstream } from '../adapters/http/ccaas-upstream.service';
import { LESSON_REPO_PORT } from '../domain/ports/lesson-repo.port';
import { TypeOrmLessonRepository } from '../adapters/persistence/repositories/lesson.repository';
import { TeachingRequirementsModule } from '../teaching-requirements/teaching-requirements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseProject, ProjectFile, Lesson]),
    // TeachingRequirementsModule exports both L1 (TeachingRequirementsService)
    // and L2 (RequirementInterpretationService). ProjectService uses these
    // to append `_lib/*.md` files into the artifact response when the
    // calling user has a userId AND a lesson-plan subject is configured.
    TeachingRequirementsModule,
  ],
  // - CcaasProxyController shares the `projects/:projectId` prefix with
  //   ProjectController. Disjoint routes: proxy adds `changes` (SSE) +
  //   `invalidate`; ProjectController owns CRUD + files + artifacts.
  // - CcaasChatProxyController owns `sessions/:sessionId/*` (history,
  //   send + SSE, bind-project). Same architectural rationale: the
  //   browser must never hold a ccaas key — env-held CCAAS_API_KEY +
  //   server-side solutionId injection via CcaasUpstream.
  controllers: [ProjectController, CcaasProxyController, CcaasChatProxyController],
  providers: [
    ProjectService,
    // Port → adapter wiring missed when ProjectService was migrated to the
    // LessonRepoPort interface (commit 71a7df95). Without this the module
    // can't construct ProjectService, blocking backend boot.
    TypeOrmLessonRepository,
    { provide: LESSON_REPO_PORT, useExisting: TypeOrmLessonRepository },
    // Shared helper for both proxy controllers (env resolution, solutionId
    // lazy-cache, error wrapping with token scrub).
    CcaasUpstream,
  ],
  exports: [ProjectService],
})
export class ProjectModule {}
