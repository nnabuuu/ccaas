import { Inject, Injectable, NotFoundException, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LESSON_REPO_PORT, type LessonRepoPort } from '../../domain/ports/lesson-repo.port';
import { validateAnswerKey, ManifestSchema } from '../../schemas';
import { ExerciseTypeRegistry } from '../exercise/exercise-type-registry';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LessonService implements OnModuleInit {
  private readonly logger = new Logger(LessonService.name);

  constructor(
    @Inject(LESSON_REPO_PORT)
    private readonly repo: LessonRepoPort,
    private readonly registry: ExerciseTypeRegistry,
  ) {}

  async onModuleInit() {
    await this.seedLessons();
  }

  private async seedLessons() {
    const dataDir = path.resolve(process.cwd(), '../data/lessons');
    if (!fs.existsSync(dataDir)) {
      this.logger.warn(`Lessons data directory not found: ${dataDir}`);
      return;
    }

    const dirs = fs.readdirSync(dataDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    const existingLessons = await this.repo.findAllSeedFields();
    const existingMap = new Map(existingLessons.map(l => [l.id, l]));

    for (const dir of dirs) {
      const manifestPath = path.join(dataDir, dir.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;

      const existing = existingMap.get(dir.name);
      if (existing) {
        // Backfill lessonType and description from manifest
        try {
          const raw = fs.readFileSync(manifestPath, 'utf-8');
          const manifest = JSON.parse(raw);
          const patch: Partial<{ lessonType: string; description: string }> = {};
          if (manifest.lessonType && existing.lessonType !== manifest.lessonType) {
            patch.lessonType = manifest.lessonType;
          }
          const newDesc = manifest.description || manifest.teachingNotes || '';
          if (newDesc && (!existing.description || existing.description !== newDesc)) {
            patch.description = newDesc;
          }
          if (Object.keys(patch).length) {
            await this.repo.update(existing.id, patch);
            this.logger.log(`Updated fields for ${existing.id}`);
          }
        } catch { /* skip */ }
        continue;
      }

      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(raw);

        // Validate full manifest structure (warn but don't block)
        const parseResult = ManifestSchema.safeParse(manifest);
        if (!parseResult.success) {
          this.logger.warn(
            `Lesson ${dir.name} manifest validation issues: ${parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          );
        }

        // Validate answerKeys at seed time (warn but don't block)
        for (const step of (manifest.readingSteps || [])) {
          if (!step.answerKey) continue;
          const result = validateAnswerKey(step.answerKey);
          if (!result.valid) {
            this.logger.warn(
              `Lesson ${dir.name} step ${step.idx} answerKey validation failed: ${result.errors.join('; ')}`,
            );
          }
        }

        const lessonId = manifest.id || dir.name;
        await this.repo.insert({
          id: lessonId,
          title: manifest.title || dir.name,
          subject: manifest.subject || '',
          gradeLevel: manifest.gradeLevel || '',
          description: manifest.description || manifest.teachingNotes || '',
          emoji: '📖',
          lessonType: manifest.lessonType || 'interactive',
          teachingNotes: manifest.teachingNotes || '',
          manifestJson: raw,
        });
        this.logger.log(`Seeded lesson: ${lessonId}`);
      } catch (e) {
        this.logger.error(`Failed to seed lesson ${dir.name}: ${e}`);
      }
    }
  }

  async findAll() {
    const rows = await this.repo.findAllForList();
    return { lessons: rows };
  }

  async findManifest(id: string) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      throw new NotFoundException('Invalid lesson ID format');
    }
    const lesson = await this.repo.findById(id);
    if (!lesson) {
      throw new NotFoundException(`Lesson ${id} not found`);
    }
    try {
      const manifest = JSON.parse(lesson.manifestJson);
      return this.registry.sanitizeManifest(manifest);
    } catch {
      throw new InternalServerErrorException(`Lesson ${id} has corrupted manifest data`);
    }
  }
}
