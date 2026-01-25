/**
 * Skills Service
 *
 * Business logic for skill CRUD operations with versioning.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import * as crypto from 'crypto';
import { Skill, SkillStatus, SkillType } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import {
  CreateSkillDto,
  UpdateSkillDto,
  ListSkillsDto,
  CreateVersionDto,
} from './dto/skill.dto';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  constructor(
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(SkillVersion)
    private readonly versionRepository: Repository<SkillVersion>,
  ) {}

  /**
   * Create a new skill
   */
  async create(tenantId: string, dto: CreateSkillDto): Promise<Skill> {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check for duplicate slug
    const existing = await this.skillRepository.findOne({
      where: { tenantId, slug },
    });
    if (existing) {
      throw new ConflictException(`Skill with slug '${slug}' already exists`);
    }

    const skill = this.skillRepository.create({
      tenantId,
      name: dto.name,
      slug,
      description: dto.description,
      content: dto.content,
      type: dto.type || 'skill',
      config: dto.config || {},
      allowedTools: dto.allowedTools || [],
      triggers: dto.triggers || [],
      status: 'draft',
      currentVersion: '1.0.0',
    });

    const saved = await this.skillRepository.save(skill);

    // Create initial version
    await this.createVersion(saved.id, { changelog: 'Initial version' });

    this.logger.log(`Created skill ${saved.name} (${saved.slug}) for tenant ${tenantId}`);
    return saved;
  }

  /**
   * Find all skills for a tenant with pagination and filtering
   */
  async findAll(tenantId: string, query: ListSkillsDto): Promise<PaginatedResult<Skill>> {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: FindOptionsWhere<Skill> = { tenantId };

    if (status) {
      where.status = status;
    } else {
      // Exclude archived by default
      where.status = Like('draft') as any; // Will be overridden by query builder
    }

    if (type) {
      where.type = type;
    }

    const qb = this.skillRepository.createQueryBuilder('skill');
    qb.where('skill.tenantId = :tenantId', { tenantId });

    if (status) {
      qb.andWhere('skill.status = :status', { status });
    } else {
      qb.andWhere('skill.status != :archivedStatus', { archivedStatus: 'archived' });
    }

    if (type) {
      qb.andWhere('skill.type = :type', { type });
    }

    if (search) {
      qb.andWhere(
        '(skill.name LIKE :search OR skill.slug LIKE :search OR skill.description LIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy(`skill.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a skill by ID or slug
   */
  async findOne(tenantId: string, idOrSlug: string): Promise<Skill | null> {
    // Try by ID first
    let skill = await this.skillRepository.findOne({
      where: { id: idOrSlug, tenantId },
    });

    if (!skill) {
      // Try by slug
      skill = await this.skillRepository.findOne({
        where: { slug: idOrSlug, tenantId },
      });
    }

    return skill;
  }

  /**
   * Find a skill with versions
   */
  async findOneWithVersions(tenantId: string, idOrSlug: string): Promise<Skill | null> {
    let skill = await this.skillRepository.findOne({
      where: { id: idOrSlug, tenantId },
      relations: ['versions'],
    });

    if (!skill) {
      skill = await this.skillRepository.findOne({
        where: { slug: idOrSlug, tenantId },
        relations: ['versions'],
      });
    }

    return skill;
  }

  /**
   * Update a skill
   */
  async update(tenantId: string, idOrSlug: string, dto: UpdateSkillDto): Promise<Skill> {
    const skill = await this.findOne(tenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    // Update fields
    if (dto.name !== undefined) skill.name = dto.name;
    if (dto.description !== undefined) skill.description = dto.description;
    if (dto.content !== undefined) skill.content = dto.content;
    if (dto.config !== undefined) skill.config = { ...skill.config, ...dto.config };
    if (dto.allowedTools !== undefined) skill.allowedTools = dto.allowedTools;
    if (dto.triggers !== undefined) skill.triggers = dto.triggers;

    const saved = await this.skillRepository.save(skill);

    // Create new version if content changed and requested
    if (dto.content !== undefined && dto.createVersion) {
      await this.createVersion(skill.id, { bumpType: 'patch' });
    }

    this.logger.log(`Updated skill ${saved.name} (${saved.slug})`);
    return saved;
  }

  /**
   * Soft delete (archive) a skill
   */
  async archive(tenantId: string, idOrSlug: string): Promise<void> {
    const skill = await this.findOne(tenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    skill.status = 'archived';
    await this.skillRepository.save(skill);

    this.logger.log(`Archived skill ${skill.name} (${skill.slug})`);
  }

  /**
   * Publish a skill
   */
  async publish(tenantId: string, idOrSlug: string): Promise<Skill> {
    const skill = await this.findOne(tenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    skill.status = 'published';
    skill.publishedAt = new Date();

    const saved = await this.skillRepository.save(skill);
    this.logger.log(`Published skill ${saved.name} (${saved.slug})`);
    return saved;
  }

  /**
   * Create a new version of a skill
   */
  async createVersion(skillId: string, dto: CreateVersionDto): Promise<SkillVersion> {
    const skill = await this.skillRepository.findOne({ where: { id: skillId } });
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${skillId}`);
    }

    // Determine version number
    let version: string;
    if (dto.version) {
      version = dto.version;
    } else {
      const existingVersions = await this.versionRepository.find({
        where: { skillId },
        order: { createdAt: 'DESC' },
      });

      if (existingVersions.length === 0) {
        version = '1.0.0';
      } else {
        const latestVersion = existingVersions[0].version;
        version = this.calculateNextVersion(latestVersion, dto.bumpType || 'patch');
      }
    }

    const contentHash = this.hashContent(skill.content);

    const skillVersion = this.versionRepository.create({
      skillId,
      version,
      content: skill.content,
      contentHash,
      config: skill.config,
      allowedTools: skill.allowedTools,
      changelog: dto.changelog,
      deploymentStatus: 'draft',
    });

    const saved = await this.versionRepository.save(skillVersion);

    // Update skill's current version
    skill.currentVersion = version;
    await this.skillRepository.save(skill);

    this.logger.log(`Created version ${version} for skill ${skill.name}`);
    return saved;
  }

  /**
   * List versions of a skill
   */
  async listVersions(skillId: string): Promise<SkillVersion[]> {
    return this.versionRepository.find({
      where: { skillId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(tenantId: string, idOrSlug: string, version: string): Promise<Skill> {
    const skill = await this.findOne(tenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    const skillVersion = await this.versionRepository.findOne({
      where: { skillId: skill.id, version },
    });
    if (!skillVersion) {
      throw new NotFoundException(`Version not found: ${version}`);
    }

    // Update skill with versioned content
    skill.content = skillVersion.content;
    skill.config = skillVersion.config;
    skill.allowedTools = skillVersion.allowedTools;
    skill.currentVersion = version;

    const saved = await this.skillRepository.save(skill);
    this.logger.log(`Rolled back skill ${skill.name} to version ${version}`);
    return saved;
  }

  /**
   * Find published skills for a tenant
   */
  async findPublished(tenantId: string): Promise<Skill[]> {
    return this.skillRepository.find({
      where: { tenantId, status: 'published' },
    });
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private calculateNextVersion(
    currentVersion: string,
    bumpType: 'major' | 'minor' | 'patch',
  ): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    switch (bumpType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }
}
