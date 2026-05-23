import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as posixPath from 'path/posix';
import { CourseProject } from '../adapters/persistence/entities/course-project.entity';
import { ProjectFile } from '../adapters/persistence/entities/project-file.entity';
import { Lesson } from '../adapters/persistence/entities/lesson.entity';
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
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
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
    const existing = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (existing) {
      existing.title = validated.title || project.title;
      existing.subject = validated.subject || '';
      existing.gradeLevel = validated.gradeLevel || '';
      existing.description = (validated as any).description || validated.teachingNotes || '';
      existing.lessonType = validated.lessonType || 'interactive';
      existing.teachingNotes = validated.teachingNotes || '';
      existing.manifestJson = manifestRaw;
      existing.updatedAt = this.now();
      await this.lessonRepo.save(existing);
      this.logger.log(`Updated lesson: ${lessonId}`);
    } else {
      const lesson = this.lessonRepo.create({
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
      await this.lessonRepo.save(lesson);
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
