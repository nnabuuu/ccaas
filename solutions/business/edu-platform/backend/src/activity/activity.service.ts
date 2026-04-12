import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Activity } from '../entities/activity.entity';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
  ) {}

  async record(params: {
    user_id: string;
    entity_type: string;
    entity_id: string;
    entity_display_name: string;
    action: string;
    detail?: Record<string, any>;
  }): Promise<Activity> {
    const activity = this.activityRepo.create(params);
    return this.activityRepo.save(activity);
  }

  async getByDate(
    user_id: string,
    date: string,
    limit: number = 50,
  ): Promise<{ items: Activity[]; total: number }> {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const [items, total] = await this.activityRepo.findAndCount({
      where: {
        user_id,
        timestamp: Between(startOfDay, endOfDay),
      },
      order: { timestamp: 'DESC' },
      take: limit,
    });

    return { items, total };
  }

  async getWeeklySummary(user_id: string): Promise<{
    lesson_plan_edits: number;
    submissions_graded: number;
  }> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const activities = await this.activityRepo.find({
      where: {
        user_id,
        timestamp: Between(weekStart, now),
      },
    });

    const lesson_plan_edits = activities.filter(
      (a) =>
        a.entity_type === 'lesson_plan' &&
        ['created', 'updated', 'published'].includes(a.action),
    ).length;

    const submissions_graded = activities.filter(
      (a) => a.entity_type === 'homework' && a.action === 'submitted',
    ).length;

    return { lesson_plan_edits, submissions_graded };
  }

  async getWeekDots(
    user_id: string,
    week_start: string,
  ): Promise<{ days: Record<string, string[]> }> {
    const start = new Date(`${week_start}T00:00:00.000Z`);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const activities = await this.activityRepo.find({
      where: {
        user_id,
        timestamp: Between(start, end),
      },
    });

    const days: Record<string, string[]> = {};
    for (const activity of activities) {
      const dateStr = new Date(activity.timestamp).toISOString().split('T')[0];
      if (!days[dateStr]) {
        days[dateStr] = [];
      }
      if (!days[dateStr].includes(activity.entity_type)) {
        days[dateStr].push(activity.entity_type);
      }
    }

    return { days };
  }
}
