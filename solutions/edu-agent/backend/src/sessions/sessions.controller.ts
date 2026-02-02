import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * GET /api/sessions/:sessionId/messages
   * Fetch messages for a session from CCAAS
   *
   * @param sessionId - The session ID
   * @param includeToolEvents - Optional query param to include tool events
   */
  @Get(':sessionId/messages')
  async getMessages(
    @Param('sessionId') sessionId: string,
    @Query('includeToolEvents') includeToolEvents?: string,
  ) {
    try {
      const includeTools = includeToolEvents === 'true';
      const messages = await this.sessionsService.getMessages(
        sessionId,
        includeTools,
      );
      return { messages };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to fetch messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
