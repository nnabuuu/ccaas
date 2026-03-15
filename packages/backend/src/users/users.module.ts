import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UserTenantService } from './user-tenant.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserTenant } from './entities/user-tenant.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, UserTenant])],
  controllers: [UsersController],
  providers: [UsersService, UserTenantService],
  exports: [UsersService, UserTenantService],
})
export class UsersModule {}
