import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UserTenantService } from './user-tenant.service';
import { User } from './entities/user.entity';
import { UserTenant } from './entities/user-tenant.entity';

// UsersController is intentionally NOT registered here.
// User management HTTP endpoints are served by AdminUsersController
// (api/v1/admin/users) which has proper tenant isolation via AdminTenantAccessGuard.

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, UserTenant])],
  providers: [UsersService, UserTenantService],
  exports: [UsersService, UserTenantService],
})
export class UsersModule {}
