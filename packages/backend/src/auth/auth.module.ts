/**
 * Auth Module
 *
 * Provides authentication and authorization services.
 */

import { Module, Global, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { DevLoginService } from './dev-login.service';
import { DevLoginController } from './dev-login.controller';
import { MeController } from './me.controller';

const enableDevLogin = process.env.NODE_ENV !== 'production'
  && process.env.NODE_ENV !== 'staging';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, User]),
    TenantsModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [
    MeController,
    ...(enableDevLogin ? [DevLoginController] : []),
  ],
  providers: [
    ApiKeyService,
    ApiKeyGuard,
    ScopesGuard,
    ...(enableDevLogin ? [DevLoginService] : []),
  ],
  exports: [
    ApiKeyService,
    ApiKeyGuard,
    ScopesGuard,
  ],
})
export class AuthModule {}
