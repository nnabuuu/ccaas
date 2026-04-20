import { Injectable, NotFoundException, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from '../entities/lesson.entity';
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

    for (const dir of dirs) {
      const manifestPath = path.join(dataDir, dir.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;

      const existing = await this.repo.findOne({ where: { id: dir.name } });
      if (existing) continue;

      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(raw);

        const lesson = this.repo.create({
          id: manifest.id || dir.name,
          title: manifest.title || dir.name,
          subject: manifest.subject || '',
          gradeLevel: manifest.gradeLevel || '',
          description: manifest.teachingNotes || '',
          emoji: '📖',
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
      select: ['id', 'title', 'subject', 'gradeLevel', 'description', 'emoji'],
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
      return JSON.parse(lesson.manifestJson);
    } catch {
      throw new InternalServerErrorException(`Lesson ${id} has corrupted manifest data`);
    }
  }
}
