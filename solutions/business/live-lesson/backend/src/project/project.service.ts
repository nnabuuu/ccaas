import { ForbiddenException, Inject, Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as posixPath from 'path/posix';
import { CourseProject } from '../adapters/persistence/entities/course-project.entity';
import { ProjectFile } from '../adapters/persistence/entities/project-file.entity';
import { Lesson } from '../adapters/persistence/entities/lesson.entity';
import { LESSON_REPO_PORT, type LessonRepoPort } from '../domain/ports/lesson-repo.port';
import { ManifestSchema } from '../schemas';
import { CreateProjectDto, CreateFileDto, UpdateProjectDto } from './project.dto';
import { TeachingRequirementsService } from '../teaching-requirements/teaching-requirements.service';
import { RequirementInterpretationService } from '../teaching-requirements/requirement-interpretation.service';
import { renderLibrary, renderInterpretations } from '../teaching-requirements/lib-renderer';
import type { TeachingRequirementsLibrary } from '../teaching-requirements/types';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(CourseProject)
    private readonly projectRepo: Repository<CourseProject>,
    @InjectRepository(ProjectFile)
    private readonly fileRepo: Repository<ProjectFile>,
    @Inject(LESSON_REPO_PORT)
    private readonly lessonRepo: LessonRepoPort,
    // L1 / L2 services used to append `_lib/*.md` to the artifact
    // response — lets the agent path see canonical lib + user
    // interpretations alongside project files via the existing
    // artifact-sync pipeline (no domain knowledge in ccaas).
    private readonly teachingRequirements: TeachingRequirementsService,
    private readonly interpretations: RequirementInterpretationService,
  ) {}

  // ── Project CRUD ──

  async create(dto: CreateProjectDto): Promise<CourseProject> {
    const subjects = this.normalizeSubjects(dto.subjects ?? []);
    const project = this.projectRepo.create({
      title: dto.title,
      description: dto.description || '',
      subjects,
    });
    const saved = await this.projectRepo.save(project);

    // Scaffold default files
    await this.fileRepo.save([
      this.fileRepo.create({
        projectId: saved.id,
        path: 'plan/lesson-plan.md',
        // The HTML comment header is §4.2 layer 1 of the lesson-plan
        // format design — agent's first `cat` of this file always sees
        // the syntax contract without depending on a skill loading or
        // a system prompt being fresh. Lib files are materialized by
        // ccaas via the artifact sync at session start — one file per
        // project subject under `artifacts/_lib/teaching-requirements/`
        // and `artifacts/_lib/my-interpretations/`. The recursive grep
        // works whether the project has one subject or several.
        content:
          '<!--\n' +
          '教学要求引用语法: [文本](req://r-X.Y.Z "课标 X.Y · 分类")\n' +
          '查 id:   Grep -r "<关键词>" artifacts/_lib/teaching-requirements/\n' +
          '查解读:  Grep -r "r-X.Y.Z" artifacts/_lib/my-interpretations/\n' +
          '-->\n\n' +
          `# ${dto.title}\n\n` +
          `## 教学目标\n\n` +
          `## 教学要求\n\n` +
          `## 模块概要\n`,
        fileType: 'md',
      }),
      this.fileRepo.create({
        projectId: saved.id,
        path: 'execution/manifest.json',
        // Scaffold with ONE quiz example so the agent has a concrete
        // pattern to extend rather than authoring an 11-type-aware
        // answerKey from zero. The placeholder text + 'TODO: replace
        // or delete' note signals to both the agent and the teacher
        // that the example is template-only.
        content: JSON.stringify({
          id: saved.id,
          title: dto.title,
          subject: '',
          gradeLevel: '',
          lessonType: 'interactive',
          readingSteps: [
            // Single quiz example — schema-valid so a fresh project is
            // already publishable + classroom-ready. Agent uses this as
            // a concrete pattern to extend instead of authoring an
            // 11-type-aware answerKey from zero. The 'TODO' label
            // signals to both agent and teacher that it's template-only.
            //
            // Required fields per ManifestSchema:
            //   ReadingStep: id, idx (others optional)
            //   QuizAnswerItem: questionIdx, questionText, options (>=2), correct
            //
            // Convention (per demo lessons): questionIdx is ZERO-INDEXED
            // (matches how QuizGrader indexes studentAnswers[a.questionIdx]).
            // correct is also zero-indexed into options[].
            {
              id: 'step-1',
              idx: 1,
              label: 'TODO: replace or delete this example step',
              type: 'task',
              answerKey: {
                type: 'quiz',
                answers: [
                  {
                    questionIdx: 0,
                    questionText: 'Example question — change me',
                    options: ['Option A', 'Option B', 'Option C'],
                    correct: 0,
                  },
                ],
              },
            },
          ],
        }, null, 2),
        fileType: 'json',
      }),
    ]);

    return saved;
  }

  /**
   * List projects by status. Returns each project with a `fileCount`
   * field (count of associated ProjectFile rows) via
   * loadRelationCountAndMap so the list page can show "N files" badges
   * without an N+1 query.
   *
   * `status='active'` (default) returns draft + published; `'archived'`
   * returns only archived (for the recovery view); `'all'` is unfiltered
   * (used by tests + admin tooling).
   */
  async findAll(
    opts: { status?: 'active' | 'archived' | 'all' } = {},
  ): Promise<Array<CourseProject & { fileCount: number }>> {
    const status = opts.status ?? 'active';
    const qb = this.projectRepo
      .createQueryBuilder('project')
      .loadRelationCountAndMap('project.fileCount', 'project.files')
      .orderBy('project.updatedAt', 'DESC');
    if (status === 'active') {
      qb.where('project.status IN (:...statuses)', { statuses: ['draft', 'published'] });
    } else if (status === 'archived') {
      qb.where('project.status = :status', { status: 'archived' });
    }
    return qb.getMany() as Promise<Array<CourseProject & { fileCount: number }>>;
  }

  async findOne(id: string): Promise<CourseProject & { files: { path: string; fileType: string; updatedAt: string }[] }> {
    const project = await this.ensureProject(id);

    const files = await this.fileRepo.find({
      where: { projectId: id },
      select: ['id', 'path', 'fileType', 'updatedAt'],
      order: { path: 'ASC' },
    });

    return { ...project, files };
  }

  async archive(id: string): Promise<void> {
    const project = await this.ensureProject(id);
    project.status = 'archived';
    project.updatedAt = this.now();
    await this.projectRepo.save(project);
  }

  /**
   * Restore an archived project to `draft` status. Called from the
   * Archived tab in creator. 404 if no such project; 400 if the project
   * is not currently archived (idempotency guard — keeps the API honest
   * instead of silently no-op'ing on a draft project).
   */
  async restore(id: string): Promise<CourseProject> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    if (project.status !== 'archived') {
      throw new BadRequestException(`Project ${id} is not archived (status=${project.status})`);
    }
    project.status = 'draft';
    project.updatedAt = this.now();
    return this.projectRepo.save(project);
  }

  /**
   * Partial update for project metadata. Only fields present in `dto`
   * are touched. `subjects` is validated against the L1 catalog —
   * unknown values throw 400 with the catalog attached so the client
   * can surface a clear picker error.
   *
   * Goes through `ensureProject`, so archived projects throw 400
   * (consistent with create + writeFile behavior). Restore the project
   * first if you need to edit its metadata.
   */
  async update(id: string, dto: UpdateProjectDto): Promise<CourseProject> {
    const project = await this.ensureProject(id);
    if (dto.subjects !== undefined) {
      project.subjects = this.normalizeSubjects(dto.subjects);
    }
    if (dto.title !== undefined) project.title = dto.title;
    if (dto.description !== undefined) project.description = dto.description;
    project.updatedAt = this.now();
    return this.projectRepo.save(project);
  }

  // ── File operations ──

  async listFiles(projectId: string): Promise<Pick<ProjectFile, 'id' | 'path' | 'fileType' | 'updatedAt'>[]> {
    await this.ensureProject(projectId);
    return this.fileRepo.find({
      where: { projectId },
      select: ['id', 'path', 'fileType', 'updatedAt'],
      order: { path: 'ASC' },
    });
  }

  async readFile(projectId: string, filePath: string): Promise<{ content: string; fileType: string }> {
    const safePath = this.sanitizePath(filePath);
    const file = await this.fileRepo.findOne({ where: { projectId, path: safePath } });
    if (!file) throw new NotFoundException(`File not found: ${safePath}`);
    return { content: file.content, fileType: file.fileType };
  }

  async writeFile(projectId: string, filePath: string, content: string): Promise<void> {
    const safePath = this.sanitizePath(filePath);
    await this.ensureProject(projectId);
    const file = await this.fileRepo.findOne({ where: { projectId, path: safePath } });
    if (!file) throw new NotFoundException(`File not found: ${safePath}`);
    file.content = content;
    file.updatedAt = this.now();
    await this.fileRepo.save(file);

    await this.projectRepo.update(projectId, { updatedAt: this.now() });
  }

  async createFile(projectId: string, dto: CreateFileDto): Promise<ProjectFile> {
    await this.ensureProject(projectId);
    const safePath = this.sanitizePath(dto.path);

    const exists = await this.fileRepo.findOne({ where: { projectId, path: safePath } });
    if (exists) throw new BadRequestException(`File already exists: ${safePath}`);

    const fileType = dto.fileType || (safePath.endsWith('.md') ? 'md' : 'json');
    const file = this.fileRepo.create({
      projectId,
      path: safePath,
      content: dto.content,
      fileType,
    });
    return this.fileRepo.save(file);
  }

  /**
   * Agent-runtime contract: list ALL project artifacts WITH content as a flat
   * shape `{path, content, type, attributes?}[]`. Distinct from `listFiles`
   * which is lightweight (no content) for the GUI's file tree.
   *
   * Called by ccaas's `RestWorkspaceArtifactSource.loadArtifacts` at each
   * turn boundary, so keep this query cheap. Live-lesson projects are
   * small (5-10 files); a single SELECT * is fine.
   *
   * **Per-subject lib append** (`opts.userId` present + project has
   * `subjects` configured): for each subject, append a rendered library
   * file at `_lib/teaching-requirements/<subject>.md` and a
   * (subject-filtered) user-interpretation file at
   * `_lib/my-interpretations/<subject>.md`. Implements design §4.1
   * path B (bash-free agent access) via the existing artifact-sync —
   * no platform-side materializer needed.
   *
   * Subject configuration lives on the project row (`course_projects.subjects`)
   * so the same backend can serve English + Math projects concurrently.
   * When userId is absent (anonymous session) or the project has zero
   * subjects, the lib append is skipped silently.
   */
  async listArtifactsWithContent(
    projectId: string,
    opts: { userId?: string } = {},
  ): Promise<Array<{ path: string; content: string; type: string }>> {
    const project = await this.ensureProject(projectId);
    const rows = await this.fileRepo.find({
      where: { projectId },
      order: { path: 'ASC' },
    });
    const out: Array<{ path: string; content: string; type: string }> = rows.map((r) => ({
      path: r.path,
      content: r.content,
      type: r.fileType,
    }));

    // `?? []` is intentional defense, not paranoia. The `subjects` column
    // was added via TypeORM `synchronize:true` with `default: '[]'`. SQLite
    // is *supposed* to backfill existing rows with that default on ALTER
    // TABLE ADD COLUMN, but the behavior across synchronize's
    // recreate-table fallback path isn't verified — see decision-archive
    // OQ-01 (docs/decision-archive-project-subjects-2026-05-27.html). If
    // a pre-migration row surfaces as `null`, `subjects.length` would
    // throw and break the entire artifact sync. Keep this until verified
    // on a real legacy DB.
    const subjects = project.subjects ?? [];
    if (opts.userId && subjects.length > 0) {
      const userInterps = await this.interpretations.listForUser(opts.userId);

      for (const subject of subjects) {
        const library = this.teachingRequirements.getLibrary(subject);
        // Defensive: if the project references a subject that was removed
        // from the L1 catalog after the project was last updated, skip
        // that one — write-time validator should have caught it, but
        // platform upgrades can drop libraries.
        if (!library) continue;

        out.push({
          path: `_lib/teaching-requirements/${subject}.md`,
          content: renderLibrary(library),
          type: 'md',
        });

        // L2: filter the user's interpretations to reqIds belonging to
        // THIS subject's library so an English project doesn't surface
        // the teacher's Math notes (and vice versa). Per-subject file
        // also means agents can grep by file path to scope a search.
        const reqIdsInSubject = collectReqIds(library);
        const subjectInterps = userInterps
          .filter((row) => reqIdsInSubject.has(row.reqId))
          .map((row) => ({
            reqId: row.reqId,
            notes: row.notes,
            updatedAt: row.updatedAt,
            text: this.teachingRequirements.tryFindItemById(row.reqId)?.text,
          }));

        // Always emit (even when zero interpretations) so the agent sees
        // the file's presence as a signal that lib materialization ran;
        // renderInterpretations' placeholder text handles the empty case.
        out.push({
          path: `_lib/my-interpretations/${subject}.md`,
          content: renderInterpretations(subjectInterps),
          type: 'md',
        });
      }
    }
    return out;
  }

  /**
   * Agent-runtime contract: upsert one artifact. Creates if not exists,
   * overwrites if it does. Updates `fileType` on each call so the agent
   * can promote a `.txt` to a `.md` by changing the path's extension.
   *
   * Called by ccaas's `RestWorkspaceArtifactSource.saveArtifact` when the
   * agent edits a file. Idempotent — repeating with the same content is
   * a no-op-ish write.
   *
   * **Reserved prefix `_lib/`**: paths under `_lib/` are platform-rendered
   * lib materializations (see `listArtifactsWithContent`'s user-aware
   * append) — they appear in `loadArtifacts` output but writes back
   * would cause round-trip pollution (the next `loadArtifacts` would
   * return both the stored row AND the freshly-rendered lib content,
   * creating a duplicate-path conflict). Reject writes to `_lib/` so
   * any agent-side edit becomes a no-op visible only to the agent
   * in-session.
   */
  async upsertArtifact(
    projectId: string,
    filePath: string,
    content: string,
    fileType: string,
  ): Promise<{ path: string; fileType: string }> {
    await this.ensureProject(projectId);
    const safePath = this.sanitizePath(filePath);
    if (isReservedLibPath(safePath)) {
      throw new ForbiddenException(
        `path "${safePath}" is platform-rendered (reserved _lib/ prefix); ` +
          `edits must go through the L2 interpretation API, not artifact writes`,
      );
    }
    const existing = await this.fileRepo.findOne({
      where: { projectId, path: safePath },
    });
    if (existing) {
      existing.content = content;
      existing.fileType = fileType;
      existing.updatedAt = this.now();
      await this.fileRepo.save(existing);
    } else {
      await this.fileRepo.save(
        this.fileRepo.create({
          projectId,
          path: safePath,
          content,
          fileType,
        }),
      );
    }
    await this.projectRepo.update(projectId, { updatedAt: this.now() });
    // Return the canonical (sanitized) path so ccaas's
    // RestProjectArtifactSource snapshot uses the actual persisted
    // key, not the (possibly differently-shaped) sent path.
    // Phase 1 review M1 / Phase 2b-1.
    return { path: safePath, fileType };
  }

  async deleteFile(projectId: string, filePath: string): Promise<void> {
    const safePath = this.sanitizePath(filePath);
    if (isReservedLibPath(safePath)) {
      // Reserved prefix — there's no row to delete (platform-rendered
      // content, not stored). Surfaced as 403 so agents notice rather
      // than silently no-op'ing on a delete the engine planned.
      throw new ForbiddenException(
        `path "${safePath}" is platform-rendered (reserved _lib/ prefix); cannot delete`,
      );
    }
    const file = await this.fileRepo.findOne({ where: { projectId, path: safePath } });
    if (!file) throw new NotFoundException(`File not found: ${safePath}`);
    await this.fileRepo.remove(file);
  }

  // ── Validation (stateless pre-flight) ──

  /**
   * Run ManifestSchema validation on a manifest JSON string. No DB
   * touch, no projectId required — pure schema check.
   *
   * Returns the same shape on both success and failure so the agent's
   * shell wrapper script can pipe it to jq without branching on HTTP
   * status. The endpoint always returns HTTP 200; check `valid`.
   *
   * Used by the manifest-editor skill's `scripts/validate-manifest.sh`
   * after every edit. Reuses the SAME `ManifestSchema` the publish
   * flow runs — guarantees alignment between "self-check passed" and
   * "publish will accept".
   */
  validateManifestContent(content: string): {
    valid: boolean;
    stepCount?: number;
    issues?: Array<{ path: string; message: string }>;
  } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return {
        valid: false,
        issues: [
          {
            path: '$',
            message: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
    const result = ManifestSchema.safeParse(parsed);
    if (result.success) {
      return {
        valid: true,
        stepCount: result.data.readingSteps?.length ?? 0,
      };
    }
    return {
      valid: false,
      issues: result.error.issues.map((i) => ({
        // '$' is the JSON-Path convention for root; keeps issues with
        // empty path readable instead of an empty string.
        path: i.path.length ? i.path.join('.') : '$',
        message: i.message,
      })),
    };
  }

  // ── Publish ──

  async publish(projectId: string): Promise<{ lessonId: string }> {
    const project = await this.ensureProject(projectId);

    const manifestFile = await this.fileRepo.findOne({
      where: { projectId, path: 'execution/manifest.json' },
    });
    if (!manifestFile) {
      throw new BadRequestException('No execution/manifest.json found in project');
    }

    let manifest: any;
    try {
      manifest = JSON.parse(manifestFile.content);
    } catch {
      throw new BadRequestException('Invalid JSON in execution/manifest.json');
    }

    const result = ManifestSchema.safeParse(manifest);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new BadRequestException(`Manifest validation failed: ${issues}`);
    }

    // Always use projectId as lessonId to prevent hijacking other lessons
    const lessonId = projectId;
    const validated = result.data;

    // Ensure manifest.id matches projectId in the stored content
    manifest.id = lessonId;
    const manifestRaw = JSON.stringify(manifest, null, 2);

    // Upsert into lessons table
    const existing = await this.lessonRepo.findById(lessonId);
    if (existing) {
      await this.lessonRepo.update(lessonId, {
        title: validated.title || project.title,
        subject: validated.subject || '',
        gradeLevel: validated.gradeLevel || '',
        description: (validated as any).description || validated.teachingNotes || '',
        lessonType: validated.lessonType || 'interactive',
        teachingNotes: validated.teachingNotes || '',
        manifestJson: manifestRaw,
        updatedAt: this.now(),
      });
      this.logger.log(`Updated lesson: ${lessonId}`);
    } else {
      await this.lessonRepo.insert({
        id: lessonId,
        title: validated.title || project.title,
        subject: validated.subject || '',
        gradeLevel: validated.gradeLevel || '',
        description: (validated as any).description || validated.teachingNotes || '',
        emoji: '📖',
        lessonType: validated.lessonType || 'interactive',
        teachingNotes: validated.teachingNotes || '',
        manifestJson: manifestRaw,
      });
      this.logger.log(`Created lesson: ${lessonId}`);
    }

    project.status = 'published';
    project.updatedAt = this.now();
    await this.projectRepo.save(project);

    return { lessonId };
  }

  // ── Helpers ──

  /**
   * Validate + normalize subjects for write. Rejects entries not in the
   * L1 catalog (BadRequest with the valid set attached so a frontend
   * picker can recover without a round-trip). De-dupes input so persisted
   * rows stay clean — duplicates would otherwise emit duplicate artifact
   * paths from the materializer and confuse sync.
   *
   * Empty input is allowed and returns `[]`: a project explicitly not
   * using any teaching-requirement library is valid.
   */
  private normalizeSubjects(subjects: string[]): string[] {
    const valid = new Set(this.teachingRequirements.listSubjects());
    const unknown = subjects.filter((s) => !valid.has(s));
    if (unknown.length > 0) {
      throw new BadRequestException({
        message: `Unknown subjects: ${unknown.join(', ')}`,
        unknownSubjects: unknown,
        validSubjects: [...valid].sort(),
      });
    }
    return [...new Set(subjects)];
  }

  private async ensureProject(id: string): Promise<CourseProject> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    if (project.status === 'archived') {
      throw new BadRequestException(`Project ${id} is archived`);
    }
    return project;
  }

  private sanitizePath(p: string): string {
    // Defense in depth — block escape attempts that posix.normalize alone
    // misses on weird platforms / mixed-OS clients.
    if (p.includes('\0') || p.includes('\\')) {
      throw new BadRequestException('Invalid file path: null bytes and backslashes are not allowed');
    }
    const normalized = posixPath.normalize(p);
    if (normalized.startsWith('..') || normalized.startsWith('/')) {
      throw new BadRequestException('Invalid file path: must be relative and not escape project root');
    }
    return normalized;
  }

  private now(): string {
    return new Date().toISOString();
  }
}

/**
 * Paths reserved for platform-rendered lib materializations
 * (`_lib/teaching-requirements/<subject>.md`,
 * `_lib/my-interpretations/<subject>.md`, …).
 *
 * These appear in `loadArtifacts` output as derived content (rendered
 * from L1+L2 services per project subject) but are NOT stored in
 * `project_files`. Writes are rejected so a save-back from the agent
 * (after the engine spuriously plans `save_db` for a transient fs
 * touch) doesn't persist them — which would cause duplicate-path
 * conflicts on the next `loadArtifacts` (stored row + freshly-rendered
 * content). The prefix match also covers the per-subject sub-paths
 * without needing per-suffix awareness.
 */
function isReservedLibPath(safePath: string): boolean {
  return safePath === '_lib' || safePath.startsWith('_lib/');
}

/**
 * Flatten a library's `categories[].items[].id` into a Set for O(1)
 * "does this interpretation belong to this subject?" filtering.
 *
 * Cross-subject collision note: if two libraries declare the same reqId
 * (intentional by convention — `r-*` for english, `m-*` for math — but
 * not enforced at L1 load), both subjects' interpretation files surface
 * the same note. That's arguably correct (the user did write it about
 * that id) but worth knowing if you see "leaks" in tests.
 *
 * Module-private (vs a method on TeachingRequirementsService) because
 * it's a one-line traversal and the materializer is the only caller —
 * exposing it on the service would invite re-use in code paths that
 * really want a smarter API (e.g. one that respects category filters).
 */
function collectReqIds(library: TeachingRequirementsLibrary): Set<string> {
  const ids = new Set<string>();
  for (const cat of library.categories) {
    for (const item of cat.items) {
      ids.add(item.id);
    }
  }
  return ids;
}
