import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserTenantService } from './user-tenant.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserTenantDto } from './dto/create-user-tenant.dto';
import { UpdateUserTenantDto } from './dto/update-user-tenant.dto';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { RequireScopes } from '../auth/decorators';

@ApiTags('auth')
@Controller('users')
@UseGuards(ApiKeyGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userTenantService: UserTenantService,
  ) {}

  @Post()
  @RequireScopes('admin')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @RequireScopes('admin')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequireScopes('admin')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequireScopes('admin')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequireScopes('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // UserTenant endpoints
  @Post('tenants')
  @RequireScopes('admin')
  createUserTenant(@Body() createUserTenantDto: CreateUserTenantDto) {
    return this.userTenantService.create(createUserTenantDto);
  }

  @Get('tenants/by-tenant/:tenantId')
  @RequireScopes('admin')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.userTenantService.findByTenant(tenantId);
  }

  @Get('tenants/by-user/:userId')
  @RequireScopes('admin')
  findByUser(@Param('userId') userId: string) {
    return this.userTenantService.findByUser(userId);
  }

  @Patch('tenants/:id')
  @RequireScopes('admin')
  updateUserTenant(@Param('id') id: string, @Body() updateUserTenantDto: UpdateUserTenantDto) {
    return this.userTenantService.update(id, updateUserTenantDto);
  }

  @Delete('tenants/:id')
  @RequireScopes('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeUserTenant(@Param('id') id: string) {
    return this.userTenantService.remove(id);
  }
}
