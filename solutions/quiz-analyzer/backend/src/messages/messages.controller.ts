import { Controller, Get, Post, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { ConversationContextService } from './conversation-context.service';
import { TurnsService } from './turns.service';
import { CreateMessageBodyDto } from './dto/create-message.dto';
import { CreateConversationContextBodyDto } from './dto/create-context.dto';

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

@Controller('api/v1/sessions/:sessionId')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly contextService: ConversationContextService,
    private readonly turnsService: TurnsService,
  ) {}

  @Get('messages')
  async getMessages(
    @Param('sessionId') sessionId: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    this.validateSessionId(sessionId);

    const limit = limitStr
      ? Math.min(Math.max(parseInt(limitStr, 10) || DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT)
      : undefined;
    const offset = offsetStr ? Math.max(parseInt(offsetStr, 10) || 0, 0) : undefined;

    return this.messagesService.getMessagesBySession(sessionId, { limit, offset });
  }

  @Post('messages')
  async createMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: CreateMessageBodyDto,
  ) {
    this.validateSessionId(sessionId);

    return this.messagesService.createMessage({
      ...body,
      sessionId,
    });
  }

  private validateSessionId(sessionId: string): void {
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      throw new BadRequestException('Invalid session ID format');
    }
  }

  @Get('context')
  async getContext(@Param('sessionId') sessionId: string) {
    this.validateSessionId(sessionId);
    return this.contextService.getContextBySession(sessionId);
  }

  @Post('context')
  async createContext(
    @Param('sessionId') sessionId: string,
    @Body() body: CreateConversationContextBodyDto,
  ) {
    this.validateSessionId(sessionId);
    return this.contextService.createContext({
      ...body,
      sessionId,
    });
  }

  @Get('turns')
  async getTurns(@Param('sessionId') sessionId: string) {
    this.validateSessionId(sessionId);
    return this.turnsService.getTurnsBySession(sessionId);
  }
}
