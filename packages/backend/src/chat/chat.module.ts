/**
 * Chat Module
 *
 * Core relay module that handles WebSocket connections and CLI process management.
 */

import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { SessionsController } from './sessions.controller';
import { SessionModule } from './session.module';
import { SkillsModule } from '../skills/skills.module';
import { TenantsModule } from '../tenants/tenants.module';
import { MessagesModule } from '../messages/messages.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [SessionModule, SkillsModule, TenantsModule, MessagesModule, FilesModule],
  controllers: [ChatController, SessionsController],
  providers: [ChatGateway],
  exports: [ChatGateway, SessionModule],
})
export class ChatModule {}
