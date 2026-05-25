import { Inject, Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as posixPath from 'path/posix';
import { CourseProject } from '../adapters/persistence/entities/course-project.entity';
import { ProjectFile } from '../adapters/persistence/entities/project-file.entity';
import { Lesson } from '../adapters/persistence/entities/lesson.entity';
import { LESSON_REPO_PORT, type LessonRepoPort } from '../domain/ports/lesson-repo.port';
import { ManifestSchema } from '../schemas';
import { CreateProjectDto, CreateFileDto } from './project.dto';

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
  ) {}

  // ── Project CRUD ──

  async create(dto: CreateProjectDto): Promise<CourseProject> {
    const project = this.projectRepo.create({
      title: dto.title,
      description: dto.description || '',
    });
    const saved = await this.projectRepo.save(project);

    // Scaffold default files
    await this.fileRepo.save([
      this.fileRepo.create({
        projectId: saved.id,
        path: 'plan/lesson-plan.md',
        content: `# ${dto.title}\n\n## 教学目标\n\n## 教学要求\n\n## 模块概要\n`,
        fileType: 'md',
      }),
      this.fileRepo.create({
        projectId: saved.id,
        path: 'execution/manifest.json',
        content: JSON.stringify({
          id: saved.id,
          title: dto.title,
          subject: '',
          gradeLevel: '',
          lessonType: 'interactive',
          readingSteps: [],
        }, null, 2),
        fileType: 'json',
      }),
    ]);

    return saved;
  }

  async findAll(): Promise<CourseProject[]> {
    return this.projectRepo.find({
      where: [{ status: 'draft' as const }, { status: 'published' as const }],
      order: { updatedAt: 'DESC' },
    });
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
   * Called by ccaas's `RestProjectArtifactSource.loadArtifacts` at each turn
   * boundary, so keep this query cheap. Live-lesson projects are small
   * (5-10 files); a single SELECT * is fine.
   */
  async listArtifactsWithContent(
    projectId: string,
  ): Promise<Array<{ path: string; content: string; type: string }>> {
    await this.ensureProject(projectId);
    const rows = await this.fileRepo.find({
      where: { projectId },
      order: { path: 'ASC' },
    });
    return rows.map((r) => ({
      path: r.path,
      content: r.content,
      type: r.fileType,
    }));
  }

  /**
   * Agent-runtime contract: upsert one artifact. Creates if not exists,
   * overwrites if it does. Updates `fileType` on each call so the agent
   * can promote a `.txt` to a `.md` by changing the path's extension.
   *
   * Called by ccaas's `RestProjectArtifactSource.saveArtifact` when the
   * agent edits a file. Idempotent — repeating with the same content is
   * a no-op-ish write.
   */
  async upsertArtifact(
    projectId: string,
    filePath: string,
    content: string,
    fileType: string,
  ): Promise<void> {
    await this.ensureProject(projectId);
    const safePath = this.sanitizePath(filePath);
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
  }

  async deleteFile(projectId: string, filePath: string): Promise<void> {
    const safePath = this.sanitizePath(filePath);
    const file = await this.fileRepo.findOne({ where: { projectId, path: safePath } });
    if (!file) throw new NotFoundException(`File not found: ${safePath}`);
    await this.fileRepo.remove(file);
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

  private async ensureProject(id: string): Promise<CourseProject> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    if (project.status === 'archived') {
      throw new BadRequestException(`Project ${id} is archived`);
    }
    return project;
  }

  private sanitizePath(p: string): string {
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
