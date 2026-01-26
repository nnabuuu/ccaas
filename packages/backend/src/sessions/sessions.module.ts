/**
 * Sessions Module
 *
 * RESTful API module for session management.
 * Provides endpoints for creating completions, cancelling operations,
 * and managing session lifecycle.
 */

import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { ChatModule } from '../chat/chat.module';
import { SkillsModule } from '../skills/skills.module';
import { TenantsModule } from '../tenants/tenants.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [ChatModule, SkillsModule, TenantsModule, MessagesModule],
  controllers: [SessionsController],
})
export class SessionsModule {}
