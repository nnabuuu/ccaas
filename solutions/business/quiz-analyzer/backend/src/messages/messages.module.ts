import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message, ConversationContext, Turn } from '../database/entities';
import { MessagesService } from './messages.service';
import { ConversationContextService } from './conversation-context.service';
import { TurnsService } from './turns.service';
import { MessagesController } from './messages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Message, ConversationContext, Turn])],
  controllers: [MessagesController],
  providers: [MessagesService, ConversationContextService, TurnsService],
  exports: [MessagesService, ConversationContextService, TurnsService],
})
export class MessagesModule {}
