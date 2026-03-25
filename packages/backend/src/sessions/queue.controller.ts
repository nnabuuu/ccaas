import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthAdminOrBuilder } from '../auth/decorators';
import { MessageQueueService } from './services/message-queue.service';

@AuthAdminOrBuilder()
@ApiTags('queue')
@Controller('api/v1/queue')
export class QueueController {
  constructor(private readonly messageQueueService: MessageQueueService) {}

  @Get('stats')
  @ApiOperation({ summary: '全局队列统计 / Global queue stats' })
  async getStats() {
    return this.messageQueueService.getStats();
  }
}
