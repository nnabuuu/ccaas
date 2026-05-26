import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UserSolutionService } from './user-solution.service';
import { User } from './entities/user.entity';
import { UserSolution } from './entities/user-solution.entity';

// UsersController is intentionally NOT registered here.
// User management HTTP endpoints are served by AdminUsersController
// (api/v1/admin/users) which has proper tenant isolation via AdminSolutionAccessGuard.

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, UserSolution])],
  providers: [UsersService, UserSolutionService],
  exports: [UsersService, UserSolutionService],
})
export class UsersModule {}
