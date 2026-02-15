import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { MessagesService, CreateMessageDto } from './messages.service';
import { ConversationContextService, CreateConversationContextDto } from './conversation-context.service';
import { TurnsService } from './turns.service';

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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.messagesService.getMessagesBySession(sessionId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('messages')
  async createMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: Omit<CreateMessageDto, 'sessionId'>,
  ) {
    return this.messagesService.createMessage({
      ...body,
      sessionId,
    });
  }

  @Get('context')
  async getContext(@Param('sessionId') sessionId: string) {
    return this.contextService.getContextBySession(sessionId);
  }

  @Post('context')
  async createContext(
    @Param('sessionId') sessionId: string,
    @Body() body: Omit<CreateConversationContextDto, 'sessionId'>,
  ) {
    return this.contextService.createContext({
      ...body,
      sessionId,
    });
  }

  @Get('turns')
  async getTurns(@Param('sessionId') sessionId: string) {
    return this.turnsService.getTurnsBySession(sessionId);
  }
}
