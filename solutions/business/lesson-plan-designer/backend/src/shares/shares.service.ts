import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { DATABASE_TOKEN } from '../database/database.module';
import { ActivityEventService } from '../attention-feed/activity-event.service';
import {
  LessonPlanShare,
  LessonPlanShareRow,
  CreateShareDto,
} from './shares.types';

@Injectable()
export class SharesService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database.Database,
    private readonly activityEventService: ActivityEventService,
  ) {}

  private rowToShare(row: LessonPlanShareRow): LessonPlanShare {
    return {
      id: row.id,
      lessonPlanId: row.lesson_plan_id,
      sharedBy: row.shared_by,
      sharedTo: row.shared_to,
      permission: row.permission,
      createTime: row.create_time,
      title: row.title,
      subject: row.subject,
      gradeLevel: row.grade_level,
      status: row.status,
    };
  }

  share(dto: CreateShareDto, userId = 'anonymous'): LessonPlanShare {
    const id = uuidv4();
    const now = new Date().toISOString();
    const permission = dto.permission || 'view';

    this.db.prepare(`
      INSERT OR IGNORE INTO lesson_plan_shares (id, lesson_plan_id, shared_by, shared_to, permission, create_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, dto.lessonPlanId, userId, dto.sharedTo, permission, now);

    const share: LessonPlanShare = {
      id,
      lessonPlanId: dto.lessonPlanId,
      sharedBy: userId,
      sharedTo: dto.sharedTo,
      permission,
      createTime: now,
    };

    // Notify the recipient
    this.activityEventService.publish({
      userId: dto.sharedTo,
      category: 'pending',
      title: '收到了一份共享教案',
      description: `来自 ${userId}`,
      itemType: 'share',
      itemId: id,
      targetPath: '/lesson-plan',
    });

    return share;
  }

  revoke(id: string): void {
    this.db.prepare('DELETE FROM lesson_plan_shares WHERE id = ?').run(id);
  }

  listByMe(userId = 'anonymous'): LessonPlanShare[] {
    const rows = this.db.prepare(`
      SELECT s.*, lp.title, lp.subject, lp.grade_level, lp.status
      FROM lesson_plan_shares s
      LEFT JOIN lesson_plans lp ON s.lesson_plan_id = lp.id
      WHERE s.shared_by = ?
      ORDER BY s.create_time DESC
    `).all(userId) as LessonPlanShareRow[];

    return rows.map(row => this.rowToShare(row));
  }

  listToMe(userId = 'anonymous'): LessonPlanShare[] {
    const rows = this.db.prepare(`
      SELECT s.*, lp.title, lp.subject, lp.grade_level, lp.status
      FROM lesson_plan_shares s
      LEFT JOIN lesson_plans lp ON s.lesson_plan_id = lp.id
      WHERE s.shared_to = ?
      ORDER BY s.create_time DESC
    `).all(userId) as LessonPlanShareRow[];

    return rows.map(row => this.rowToShare(row));
  }
}
