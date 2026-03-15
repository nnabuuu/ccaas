/**
 * Builder Module
 *
 * Provides builder-scoped API endpoints for external developers
 * to manage their own tenants and API keys.
 */

import { Module } from '@nestjs/common';
import { BuilderTenantsController } from './builder-tenants.controller';
import { BuilderApiKeysController } from './builder-api-keys.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  controllers: [BuilderTenantsController, BuilderApiKeysController],
})
export class BuilderModule {}
