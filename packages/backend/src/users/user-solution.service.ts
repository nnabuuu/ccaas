import { Injectable, NotFoundException } from '@nestjs/common';
import { AlreadyExistsException } from '../protocol/http-exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { UserSolution, UserRole } from './entities/user-solution.entity';
import { CreateUserTenantDto } from './dto/create-user-solution.dto';
import { UpdateUserTenantDto } from './dto/update-user-solution.dto';

export interface UserTenantFilter {
  search?: string;
  role?: UserRole;
  status?: string;
}

@Injectable()
export class UserSolutionService {
  constructor(
    @InjectRepository(UserSolution)
    private userTenantRepository: Repository<UserSolution>,
  ) {}

  async create(createUserTenantDto: CreateUserTenantDto): Promise<UserSolution> {
    // Check if user-tenant relationship already exists
    const existing = await this.userTenantRepository.findOne({
      where: {
        userId: createUserTenantDto.userId,
        solutionId: createUserTenantDto.solutionId,
      },
    });

    if (existing) {
      throw new AlreadyExistsException('User is already a member of this tenant');
    }

    // Set canCreateSkills based on role if not explicitly provided
    if (createUserTenantDto.canCreateSkills === undefined) {
      createUserTenantDto.canCreateSkills =
        createUserTenantDto.role === 'admin' || createUserTenantDto.role === 'developer';
    }

    const userTenant = this.userTenantRepository.create(createUserTenantDto);
    return this.userTenantRepository.save(userTenant);
  }

  private applyFilters(
    qb: SelectQueryBuilder<UserSolution>,
    filter?: UserTenantFilter,
  ): void {
    if (filter?.search) {
      qb.andWhere('(user.name LIKE :search OR user.email LIKE :search)', {
        search: `%${filter.search}%`,
      });
    }
    if (filter?.role) {
      qb.andWhere('ut.role = :role', { role: filter.role });
    }
    if (filter?.status) {
      qb.andWhere('user.status = :status', { status: filter.status });
    }
  }

  async findByTenant(
    solutionId: string,
    options?: { skip?: number; take?: number; filter?: UserTenantFilter },
  ): Promise<UserSolution[]> {
    const qb = this.userTenantRepository
      .createQueryBuilder('ut')
      .leftJoinAndSelect('ut.user', 'user')
      .where('ut.solutionId = :solutionId', { solutionId })
      .andWhere('ut.isActive = :isActive', { isActive: true });

    this.applyFilters(qb, options?.filter);

    qb.orderBy('ut.joinedAt', 'DESC');
    if (options?.skip !== undefined) qb.skip(options.skip);
    if (options?.take !== undefined) qb.take(options.take);

    return qb.getMany();
  }

  async countByTenant(
    solutionId: string,
    filter?: UserTenantFilter,
  ): Promise<number> {
    const qb = this.userTenantRepository
      .createQueryBuilder('ut')
      .leftJoin('ut.user', 'user')
      .where('ut.solutionId = :solutionId', { solutionId })
      .andWhere('ut.isActive = :isActive', { isActive: true });

    this.applyFilters(qb, filter);

    return qb.getCount();
  }

  async findByUser(userId: string): Promise<UserSolution[]> {
    return this.userTenantRepository.find({
      where: { userId, isActive: true },
      relations: ['tenant'],
    });
  }

  async findUserInTenant(userId: string, solutionId: string): Promise<UserSolution | null> {
    return this.userTenantRepository.findOne({
      where: { userId, solutionId },
      relations: ['user', 'tenant'],
    });
  }

  async update(id: string, updateUserTenantDto: UpdateUserTenantDto): Promise<UserSolution> {
    const userTenant = await this.userTenantRepository.findOne({ where: { id } });

    if (!userTenant) {
      throw new NotFoundException(`UserSolution with ID ${id} not found`);
    }

    // If role is being updated, auto-adjust canCreateSkills if not explicitly set
    if (updateUserTenantDto.role && updateUserTenantDto.canCreateSkills === undefined) {
      updateUserTenantDto.canCreateSkills =
        updateUserTenantDto.role === 'admin' || updateUserTenantDto.role === 'developer';
    }

    if (updateUserTenantDto.role !== undefined) userTenant.role = updateUserTenantDto.role;
    if (updateUserTenantDto.canCreateSkills !== undefined) userTenant.canCreateSkills = updateUserTenantDto.canCreateSkills;
    if (updateUserTenantDto.isActive !== undefined) userTenant.isActive = updateUserTenantDto.isActive;
    return this.userTenantRepository.save(userTenant);
  }

  async remove(id: string): Promise<void> {
    const userTenant = await this.userTenantRepository.findOne({ where: { id } });

    if (!userTenant) {
      throw new NotFoundException(`UserSolution with ID ${id} not found`);
    }

    userTenant.isActive = false;
    await this.userTenantRepository.save(userTenant);
  }

  /**
   * Check if user has permission to perform an action
   */
  canPerformAction(userTenant: UserSolution | null, requiredRole: UserRole): boolean {
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
    userTenant: UserSolution | null,
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
