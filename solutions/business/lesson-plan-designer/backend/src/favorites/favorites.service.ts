import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { DATABASE_TOKEN } from '../database/database.module';
import { ActivityEventService } from '../attention-feed/activity-event.service';
import {
  LessonPlanFavorite,
  LessonPlanFavoriteRow,
} from './favorites.types';

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database.Database,
    private readonly activityEventService: ActivityEventService,
  ) {}

  private rowToFavorite(row: LessonPlanFavoriteRow): LessonPlanFavorite {
    return {
      id: row.id,
      lessonPlanId: row.lesson_plan_id,
      userId: row.user_id,
      createTime: row.create_time,
      title: row.title,
      subject: row.subject,
      gradeLevel: row.grade_level,
      status: row.status,
    };
  }

  add(lessonPlanId: string, userId = 'anonymous'): LessonPlanFavorite {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT OR IGNORE INTO lesson_plan_favorites (id, lesson_plan_id, user_id, create_time)
      VALUES (?, ?, ?, ?)
    `).run(id, lessonPlanId, userId, now);

    this.activityEventService.publish({
      userId,
      category: 'activity',
      title: '收藏了教案',
      itemType: 'favorite',
      itemId: lessonPlanId,
      targetPath: `/lesson-plan/${lessonPlanId}`,
    });

    return { id, lessonPlanId, userId, createTime: now };
  }

  remove(lessonPlanId: string, userId = 'anonymous'): void {
    this.db.prepare(`
      DELETE FROM lesson_plan_favorites
      WHERE lesson_plan_id = ? AND user_id = ?
    `).run(lessonPlanId, userId);
  }

  list(userId = 'anonymous'): LessonPlanFavorite[] {
    const rows = this.db.prepare(`
      SELECT f.*, lp.title, lp.subject, lp.grade_level, lp.status
      FROM lesson_plan_favorites f
      LEFT JOIN lesson_plans lp ON f.lesson_plan_id = lp.id
      WHERE f.user_id = ?
      ORDER BY f.create_time DESC
    `).all(userId) as LessonPlanFavoriteRow[];

    return rows.map(row => this.rowToFavorite(row));
  }

  isFavorited(lessonPlanId: string, userId = 'anonymous'): boolean {
    const row = this.db.prepare(`
      SELECT 1 FROM lesson_plan_favorites
      WHERE lesson_plan_id = ? AND user_id = ?
    `).get(lessonPlanId, userId);

    return !!row;
  }
}
