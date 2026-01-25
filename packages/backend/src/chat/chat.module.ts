/**
 * Chat Module
 *
 * Core relay module that handles WebSocket connections and CLI process management.
 */

import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { SessionService } from './session.service';
import { EventMapperService } from './event-mapper.service';
import { SkillsModule } from '../skills/skills.module';
import { MessagesModule } from '../messages/messages.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [SkillsModule, MessagesModule, FilesModule],
  controllers: [ChatController],
  providers: [ChatGateway, SessionService, EventMapperService],
  exports: [SessionService, EventMapperService],
})
export class ChatModule {}
