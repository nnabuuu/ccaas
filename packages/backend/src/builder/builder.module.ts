/**
 * Builder Module
 *
 * Provides builder-scoped API endpoints for external developers
 * to manage their own tenants and API keys.
 */

import { Module } from '@nestjs/common';
import { BuilderSolutionsController } from './builder-solutions.controller';
import { BuilderApiKeysController } from './builder-api-keys.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  controllers: [BuilderSolutionsController, BuilderApiKeysController],
})
export class BuilderModule {}
