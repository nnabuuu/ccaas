/**
 * Auth Module
 *
 * Provides authentication and authorization services.
 */

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { TenantsModule } from '../tenants/tenants.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey]),
    TenantsModule,
  ],
  providers: [
    ApiKeyService,
    ApiKeyGuard,
    ScopesGuard,
  ],
  exports: [
    ApiKeyService,
    ApiKeyGuard,
    ScopesGuard,
  ],
})
export class AuthModule {}
