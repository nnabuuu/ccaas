/**
 * Turns Module
 *
 * Standalone module for Turn entity and TurnsService.
 * Extracted from AdminModule to avoid circular dependency with SessionsModule.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Turn } from './entities/turn.entity';
import { TokenUsageEvent } from '../messages/entities/token-usage-event.entity';
import { TurnsService } from './services/turns.service';

@Module({
  imports: [TypeOrmModule.forFeature([Turn, TokenUsageEvent])],
  providers: [TurnsService],
  exports: [TurnsService, TypeOrmModule],
})
export class TurnsModule {}
