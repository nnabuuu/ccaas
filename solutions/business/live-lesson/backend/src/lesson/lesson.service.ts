import { Injectable, NotFoundException, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from '../entities/lesson.entity';
import { validateAnswerKey, ManifestSchema } from '../schemas';
import { sanitizeManifest } from '../schemas/manifest.utils';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LessonService implements OnModuleInit {
  private readonly logger = new Logger(LessonService.name);

  constructor(
    @InjectRepository(Lesson)
    private readonly repo: Repository<Lesson>,
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

    const existingLessons = await this.repo.find({ select: ['id', 'lessonType', 'description'] });
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
          let changed = false;
          if (manifest.lessonType && existing.lessonType !== manifest.lessonType) {
            existing.lessonType = manifest.lessonType;
            changed = true;
          }
          const newDesc = manifest.description || manifest.teachingNotes || '';
          if (newDesc && (!existing.description || existing.description !== newDesc)) {
            existing.description = newDesc;
            changed = true;
          }
          if (changed) {
            await this.repo.save(existing);
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

        const lesson = this.repo.create({
          id: manifest.id || dir.name,
          title: manifest.title || dir.name,
          subject: manifest.subject || '',
          gradeLevel: manifest.gradeLevel || '',
          description: manifest.description || manifest.teachingNotes || '',
          emoji: '📖',
          lessonType: manifest.lessonType || 'interactive',
          teachingNotes: manifest.teachingNotes || '',
          manifestJson: raw,
        });
        await this.repo.save(lesson);
        this.logger.log(`Seeded lesson: ${lesson.id}`);
      } catch (e) {
        this.logger.error(`Failed to seed lesson ${dir.name}: ${e}`);
      }
    }
  }

  async findAll() {
    const rows = await this.repo.find({
      select: ['id', 'title', 'subject', 'gradeLevel', 'description', 'emoji', 'lessonType'],
    });
    return { lessons: rows };
  }

  async findManifest(id: string) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      throw new NotFoundException('Invalid lesson ID format');
    }
    const lesson = await this.repo.findOne({ where: { id } });
    if (!lesson) {
      throw new NotFoundException(`Lesson ${id} not found`);
    }
    try {
      const manifest = JSON.parse(lesson.manifestJson);
      return sanitizeManifest(manifest);
    } catch {
      throw new InternalServerErrorException(`Lesson ${id} has corrupted manifest data`);
    }
  }
}
