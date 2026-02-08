import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTenant, UserRole } from './entities/user-tenant.entity';
import { CreateUserTenantDto } from './dto/create-user-tenant.dto';
import { UpdateUserTenantDto } from './dto/update-user-tenant.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserTenantService {
  constructor(
    @InjectRepository(UserTenant)
    private userTenantRepository: Repository<UserTenant>,
  ) {}

  async create(createUserTenantDto: CreateUserTenantDto): Promise<UserTenant> {
    // Check if user-tenant relationship already exists
    const existing = await this.userTenantRepository.findOne({
      where: {
        userId: createUserTenantDto.userId,
        tenantId: createUserTenantDto.tenantId,
      },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this tenant');
    }

    // Set canCreateSkills based on role if not explicitly provided
    if (createUserTenantDto.canCreateSkills === undefined) {
      createUserTenantDto.canCreateSkills =
        createUserTenantDto.role === 'admin' || createUserTenantDto.role === 'developer';
    }

    const userTenant = this.userTenantRepository.create(createUserTenantDto);
    return this.userTenantRepository.save(userTenant);
  }

  async findByTenant(tenantId: string): Promise<UserTenant[]> {
    return this.userTenantRepository.find({
      where: { tenantId, isActive: true },
      relations: ['user'],
    });
  }

  async findByUser(userId: string): Promise<UserTenant[]> {
    return this.userTenantRepository.find({
      where: { userId, isActive: true },
      relations: ['tenant'],
    });
  }

  async findUserInTenant(userId: string, tenantId: string): Promise<UserTenant | null> {
    return this.userTenantRepository.findOne({
      where: { userId, tenantId },
      relations: ['user', 'tenant'],
    });
  }

  async update(id: string, updateUserTenantDto: UpdateUserTenantDto): Promise<UserTenant> {
    const userTenant = await this.userTenantRepository.findOne({ where: { id } });

    if (!userTenant) {
      throw new NotFoundException(`UserTenant with ID ${id} not found`);
    }

    // If role is being updated, auto-adjust canCreateSkills if not explicitly set
    if (updateUserTenantDto.role && updateUserTenantDto.canCreateSkills === undefined) {
      updateUserTenantDto.canCreateSkills =
        updateUserTenantDto.role === 'admin' || updateUserTenantDto.role === 'developer';
    }

    Object.assign(userTenant, updateUserTenantDto);
    return this.userTenantRepository.save(userTenant);
  }

  async remove(id: string): Promise<void> {
    const userTenant = await this.userTenantRepository.findOne({ where: { id } });

    if (!userTenant) {
      throw new NotFoundException(`UserTenant with ID ${id} not found`);
    }

    userTenant.isActive = false;
    await this.userTenantRepository.save(userTenant);
  }

  /**
   * Check if user has permission to perform an action
   */
  canPerformAction(userTenant: UserTenant | null, requiredRole: UserRole): boolean {
    if (!userTenant || !userTenant.isActive) {
      return false;
    }

    const roleHierarchy: Record<UserRole, number> = {
      admin: 3,
      developer: 2,
      viewer: 1,
    };

    return roleHierarchy[userTenant.role] >= roleHierarchy[requiredRole];
  }

  /**
   * Check if user can edit a specific resource owned by another user
   */
  canEditResource(
    userTenant: UserTenant | null,
    resourceOwnerId: string,
    currentUserId: string,
  ): boolean {
    if (!userTenant || !userTenant.isActive) {
      return false;
    }

    // Admin can edit anything
    if (userTenant.role === 'admin') {
      return true;
    }

    // Developer can edit own resources
    if (userTenant.role === 'developer' && resourceOwnerId === currentUserId) {
      return true;
    }

    // Viewer cannot edit
    return false;
  }
}
