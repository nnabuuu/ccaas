/**
 * Storage Module
 *
 * Provides content-addressed storage for large outputs and system prompts.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LargeContent } from './entities/large-content.entity';
import { SystemPromptVersion } from './entities/system-prompt-version.entity';
import { ContentStoreService } from './content-store.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LargeContent, SystemPromptVersion])],
  controllers: [StorageController],
  providers: [ContentStoreService],
  exports: [ContentStoreService],
})
export class StorageModule {}
