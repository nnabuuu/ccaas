import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('pending')
  getPending(
    @Query('user_id') user_id?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getPending(
      user_id,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('ai-briefing')
  getAiBriefing(@Query('user_id') user_id?: string) {
    return this.dashboardService.getAiBriefing(user_id);
  }
}
