import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';

@ApiTags('activity')
@Controller('context/activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async getByDate(
    @Query('user_id') user_id: string = 'teacher_001',
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    const dateStr = date || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();
    const lim = limit ? parseInt(limit, 10) : 50;
    return this.activityService.getByDate(user_id, dateStr, lim);
  }

  @Get('weekly-summary')
  async getWeeklySummary(@Query('user_id') user_id: string = 'teacher_001') {
    return this.activityService.getWeeklySummary(user_id);
  }

  @Get('week-dots')
  async getWeekDots(
    @Query('user_id') user_id: string = 'teacher_001',
    @Query('week_start') week_start?: string,
  ) {
    const ws =
      week_start || (() => {
        const now = new Date();
        const d = new Date(now);
        d.setDate(now.getDate() - 6);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
    return this.activityService.getWeekDots(user_id, ws);
  }
}
