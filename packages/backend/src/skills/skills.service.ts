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
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { Skill, SkillStatus, SkillType } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import {
  CreateSkillDto,
  UpdateSkillDto,
  ListSkillsDto,
  CreateVersionDto,
} from './dto/skill.dto';
import { SkillChangeNotifier } from '../common/skill-change-notifier';
import { SessionService } from '../chat/session.service';

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
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Create a new skill
   */
  async create(tenantId: string, dto: CreateSkillDto, userId?: string): Promise<Skill> {
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
      createdBy: userId || null,
      scope: dto.scope || 'tenant',
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

    // Notify listeners of skill creation
    SkillChangeNotifier.notify(tenantId, saved.id, saved.slug, 'created');

    return saved;
  }

  /**
   * Find all skills for a tenant with pagination and filtering
   */
  async findAll(tenantId: string, query: ListSkillsDto, userId?: string): Promise<PaginatedResult<Skill>> {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      createdBy,
      scope,
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

    // Filter by scope and personal skills
    if (scope) {
      qb.andWhere('skill.scope = :scope', { scope });
    }

    // Personal skills filtering: only show user's own personal skills
    if (userId) {
      qb.andWhere(
        '(skill.scope = :tenantScope OR (skill.scope = :personalScope AND skill.createdBy = :userId))',
        { tenantScope: 'tenant', personalScope: 'personal', userId },
      );
    } else {
      // Anonymous users can only see tenant-scoped skills
      qb.andWhere('skill.scope = :tenantScope', { tenantScope: 'tenant' });
    }

    // Filter by creator if specified
    if (createdBy) {
      qb.andWhere('skill.createdBy = :createdBy', { createdBy });
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
      relations: ['creator'],
    });

    if (!skill) {
      // Try by slug
      skill = await this.skillRepository.findOne({
        where: { slug: idOrSlug, tenantId },
        relations: ['creator'],
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

    // Preserve createdBy (prevent changing ownership)
    const originalCreatedBy = skill.createdBy;

    // Update fields
    if (dto.name !== undefined) skill.name = dto.name;
    if (dto.description !== undefined) skill.description = dto.description;
    if (dto.content !== undefined) skill.content = dto.content;
    if (dto.config !== undefined) skill.config = { ...skill.config, ...dto.config };
    if (dto.allowedTools !== undefined) skill.allowedTools = dto.allowedTools;
    if (dto.triggers !== undefined) skill.triggers = dto.triggers;
    if (dto.scope !== undefined) skill.scope = dto.scope;

    // Ensure createdBy is not changed
    skill.createdBy = originalCreatedBy;

    const saved = await this.skillRepository.save(skill);

    // Create new version if content changed and requested
    if (dto.content !== undefined && dto.createVersion) {
      await this.createVersion(skill.id, { bumpType: 'patch' });
    }

    this.logger.log(`Updated skill ${saved.name} (${saved.slug})`);

    // Notify listeners of skill update
    SkillChangeNotifier.notify(skill.tenantId, saved.id, saved.slug, 'updated');

    // Week 5: Emit skill_updated event with affected sessions
    await this.emitSkillUpdatedEvent(saved);

    return saved;
  }

  /**
   * Emit skill_updated event with affected sessions
   * Week 5: WebSocket event enhancement
   */
  private async emitSkillUpdatedEvent(skill: Skill): Promise<void> {
    // Get affected sessions
    const affectedSessions = this.sessionService.getAffectedSessions(
      skill.tenantId,
      skill.id,
    );

    // Map to session details for event
    const sessionDetails = affectedSessions.map((session) => ({
      sessionId: session.sessionId,
      userId: session.userId,
      lastActive: session.lastActivity,
      canRestart: true,
    }));

    // Calculate impact level based on number of affected sessions
    const impact = this.calculateImpact(sessionDetails.length);

    // Emit event
    this.eventEmitter.emit('skill.updated', {
      skill: {
        id: skill.id,
        name: skill.name,
        version: skill.currentVersion,
        updatedAt: skill.updatedAt.toISOString(),
      },
      affectedSessions: sessionDetails,
      impact,
      tenantId: skill.tenantId,
    });
  }

  /**
   * Calculate impact level based on number of affected sessions
   * Week 5: low (0-2), medium (3-5), high (6+)
   */
  private calculateImpact(sessionCount: number): 'low' | 'medium' | 'high' {
    if (sessionCount <= 2) {
      return 'low';
    } else if (sessionCount <= 5) {
      return 'medium';
    } else {
      return 'high';
    }
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

    // Notify listeners of skill archive
    SkillChangeNotifier.notify(skill.tenantId, skill.id, skill.slug, 'archived');
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

    // Notify listeners of skill publish (this is when it becomes available to sessions)
    SkillChangeNotifier.notify(skill.tenantId, saved.id, saved.slug, 'published');

    // Week 5: Emit skill_updated event with affected sessions
    await this.emitSkillUpdatedEvent(saved);

    return saved;
  }

  /**
   * Unpublish a skill (set status back to draft)
   */
  async unpublish(tenantId: string, idOrSlug: string): Promise<Skill> {
    const skill = await this.findOne(tenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    skill.status = 'draft';
    skill.publishedAt = null;

    const saved = await this.skillRepository.save(skill);
    this.logger.log(`Unpublished skill ${saved.name} (${saved.slug})`);

    // Notify listeners of skill unpublish
    SkillChangeNotifier.notify(skill.tenantId, saved.id, saved.slug, 'unpublished');

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

  /**
   * Toggle the enabled state of a skill
   */
  async toggle(tenantId: string, idOrSlug: string): Promise<Skill> {
    const skill = await this.findOne(tenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    skill.enabled = !skill.enabled;
    const saved = await this.skillRepository.save(skill);

    this.logger.log(`Toggled skill ${saved.name} (${saved.slug}) enabled=${saved.enabled}`);
    return saved;
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
