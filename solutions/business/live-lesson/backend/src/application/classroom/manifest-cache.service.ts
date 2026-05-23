import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Lesson } from '../../adapters/persistence/entities/lesson.entity';

@Injectable()
export class ManifestCacheService {
  private cache = new Map<string, { manifest: any; fetchedAt: number }>();
  private readonly TTL_MS = 60_000;
  private readonly MAX_SIZE = 50;

  async getManifest(lessonId: string, lessonRepo: Repository<Lesson>): Promise<any | null> {
    const cached = this.cache.get(lessonId);
    if (cached && Date.now() - cached.fetchedAt < this.TTL_MS) return cached.manifest;

    const lesson = await lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) return null;

    try {
      const manifest = JSON.parse(lesson.manifestJson);
      if (this.cache.size >= this.MAX_SIZE) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) this.cache.delete(firstKey);
      }
      this.cache.set(lessonId, { manifest, fetchedAt: Date.now() });
      return manifest;
    } catch {
      return null;
    }
  }

  invalidate(lessonId: string): void {
    this.cache.delete(lessonId);
  }
}
