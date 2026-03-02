/**
 * Messages Module
 *
 * Handles message persistence, tool events, thinking blocks,
 * token usage tracking, and conversation analysis data.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { ToolEvent } from './entities/tool-event.entity';
import { ConversationContext } from './entities/conversation-context.entity';
import { ProcessLifecycleEvent } from './entities/process-lifecycle-event.entity';
import { ApiErrorEvent } from './entities/api-error-event.entity';
import { ThinkingBlock } from './entities/thinking-block.entity';
import { TokenUsageEvent } from './entities/token-usage-event.entity';
import { UserContextEvent } from './entities/user-context-event.entity';
import { SessionEvent } from './entities/session-event.entity';
import { MessagesService } from './messages.service';
import { ToolEventsService } from './tool-events.service';
import { ConversationContextService } from './conversation-context.service';
import { ProcessLifecycleService } from './process-lifecycle.service';
import { ApiErrorService } from './api-error.service';
import { ThinkingBlocksService } from './thinking-blocks.service';
import { TokenUsageService } from './token-usage.service';
import { UserContextService } from './user-context.service';
import { SessionEventsService } from './session-events.service';
import { MessagesController } from './messages.controller';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Message,
      ToolEvent,
      ConversationContext,
      ProcessLifecycleEvent,
      ApiErrorEvent,
      ThinkingBlock,
      TokenUsageEvent,
      UserContextEvent,
      SessionEvent,
    ]),
    FilesModule,
  ],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    ToolEventsService,
    ConversationContextService,
    ProcessLifecycleService,
    ApiErrorService,
    ThinkingBlocksService,
    TokenUsageService,
    UserContextService,
    SessionEventsService,
  ],
  exports: [
    MessagesService,
    ToolEventsService,
    ConversationContextService,
    ProcessLifecycleService,
    ApiErrorService,
    ThinkingBlocksService,
    TokenUsageService,
    UserContextService,
    SessionEventsService,
  ],
})
export class MessagesModule {}
