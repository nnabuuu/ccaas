/**
 * Skills Service
 *
 * Business logic for skill CRUD operations with versioning.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AlreadyExistsException } from '../protocol/http-exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import * as path from 'path';
import { Skill, SkillStatus, SkillType } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SkillFile } from './entities/skill-file.entity';
import { SkillVersionFile } from './entities/skill-version-file.entity';
import {
  CreateSkillDto,
  UpdateSkillDto,
  ListSkillsDto,
  CreateVersionDto,
} from './dto/skill.dto';
import { UpsertSkillFileDto } from './dto/skill-file.dto';
import { SkillChangeNotifier } from '../common/skill-change-notifier';
import { SessionService } from '../sessions/session.service';

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
    @InjectRepository(SkillFile)
    private readonly skillFileRepository: Repository<SkillFile>,
    @InjectRepository(SkillVersionFile)
    private readonly skillVersionFileRepository: Repository<SkillVersionFile>,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Create a new skill.
   *
   * Three writes (skill row, files, initial version snapshot) all run
   * inside a single transaction so a mid-create failure rolls everything
   * back. Without this, `SolutionLoaderService` auto-import would see a
   * dangling skill row on the next boot via `findOne(solutionId, slug)`
   * and silently skip the re-import — leaving the skill permanently
   * without a version + files.
   */
  async create(solutionId: string, dto: CreateSkillDto, userId?: string): Promise<Skill> {
    const slug = dto.slug || this.generateSlug(dto.name);

    const saved = await this.skillRepository.manager.transaction(async (manager) => {
      // Duplicate-slug guard runs inside the transaction so a concurrent
      // create can't slip past (the unique index would catch it too,
      // but the message is friendlier here).
      const existing = await manager.findOne(Skill, {
        where: { solutionId, slug },
      });
      if (existing) {
        throw new AlreadyExistsException(`Skill with slug '${slug}' already exists`);
      }

      const skill = manager.create(Skill, {
        solutionId,
        createdBy: userId || null,
        scope: dto.scope || "solution",
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

      const saved = await manager.save(Skill, skill);

      // Files (use the same manager so they share the transaction)
      if (dto.files && dto.files.length > 0) {
        const fileRows = dto.files.map((f) =>
          manager.create(SkillFile, {
            skillId: saved.id,
            relativePath: this.normalizePath(f.relativePath),
            content: f.content,
            contentHash: this.hashContent(f.content),
          }),
        );
        await manager.save(SkillFile, fileRows);
      }

      // Initial version snapshot
      const contentHash = this.hashContent(saved.content);
      const version = manager.create(SkillVersion, {
        skillId: saved.id,
        version: '1.0.0',
        content: saved.content,
        contentHash,
        config: saved.config,
        allowedTools: saved.allowedTools,
        changelog: 'Initial version',
        deploymentStatus: 'draft',
      });
      const savedVersion = await manager.save(SkillVersion, version);

      // Snapshot files into version_files (matches createVersion's behaviour)
      if (dto.files && dto.files.length > 0) {
        const versionFiles = dto.files.map((f) =>
          manager.create(SkillVersionFile, {
            versionId: savedVersion.id,
            relativePath: this.normalizePath(f.relativePath),
            content: f.content,
            contentHash: this.hashContent(f.content),
          }),
        );
        await manager.save(SkillVersionFile, versionFiles);
      }

      this.logger.log(`Created skill ${saved.name} (${saved.slug}) for tenant ${solutionId}`);
      return saved;
    });

    // Notify AFTER commit succeeds — listeners may load the skill back
    // from the DB and a notifier-inside-the-callback would fire while
    // the row is still uncommitted.
    SkillChangeNotifier.notify(solutionId, saved.id, saved.slug, 'created');
    return saved;
  }

  /**
   * Find all skills for a tenant with pagination and filtering
   */
  async findAll(solutionId: string, query: ListSkillsDto, userId?: string): Promise<PaginatedResult<Skill>> {
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

    const where: FindOptionsWhere<Skill> = { solutionId };

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
    qb.where('skill.solutionId = :solutionId', { solutionId });

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
        '(skill.scope = :solutionScope OR (skill.scope = :personalScope AND skill.createdBy = :userId))',
        { solutionScope: 'solution', personalScope: 'personal', userId },
      );
    } else {
      // Anonymous users can only see solution-scoped skills
      qb.andWhere('skill.scope = :solutionScope', { solutionScope: 'solution' });
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
  async findOne(solutionId: string, idOrSlug: string): Promise<Skill | null> {
    // Try by ID first
    let skill = await this.skillRepository.findOne({
      where: { id: idOrSlug, solutionId },
      relations: ['creator'],
    });

    if (!skill) {
      // Try by slug
      skill = await this.skillRepository.findOne({
        where: { slug: idOrSlug, solutionId },
        relations: ['creator'],
      });
    }

    return skill;
  }

  /**
   * Find a skill with versions
   */
  async findOneWithVersions(solutionId: string, idOrSlug: string): Promise<Skill | null> {
    let skill = await this.skillRepository.findOne({
      where: { id: idOrSlug, solutionId },
      relations: ['versions'],
    });

    if (!skill) {
      skill = await this.skillRepository.findOne({
        where: { slug: idOrSlug, solutionId },
        relations: ['versions'],
      });
    }

    return skill;
  }

  /**
   * Update a skill
   */
  async update(solutionId: string, idOrSlug: string, dto: UpdateSkillDto): Promise<Skill> {
    const skill = await this.findOne(solutionId, idOrSlug);
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

    // Upsert files if provided
    if (dto.files && dto.files.length > 0) {
      await this.upsertFiles(saved.id, dto.files);
    }

    // Create new version if content changed and requested
    if (dto.content !== undefined && dto.createVersion) {
      await this.createVersion(skill.id, { bumpType: 'patch' });
    }

    this.logger.log(`Updated skill ${saved.name} (${saved.slug})`);

    // Notify listeners of skill update
    SkillChangeNotifier.notify(skill.solutionId, saved.id, saved.slug, 'updated');

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
      skill.solutionId,
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
      solutionId: skill.solutionId,
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
  async archive(solutionId: string, idOrSlug: string): Promise<void> {
    const skill = await this.findOne(solutionId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    skill.status = 'archived';
    await this.skillRepository.save(skill);

    this.logger.log(`Archived skill ${skill.name} (${skill.slug})`);

    // Notify listeners of skill archive
    SkillChangeNotifier.notify(skill.solutionId, skill.id, skill.slug, 'archived');
  }

  /**
   * Publish a skill
   */
  async publish(solutionId: string, idOrSlug: string): Promise<Skill> {
    const skill = await this.findOne(solutionId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    skill.status = 'published';
    skill.publishedAt = new Date();

    const saved = await this.skillRepository.save(skill);
    this.logger.log(`Published skill ${saved.name} (${saved.slug})`);

    // Notify listeners of skill publish (this is when it becomes available to sessions)
    SkillChangeNotifier.notify(skill.solutionId, saved.id, saved.slug, 'published');

    // Week 5: Emit skill_updated event with affected sessions
    await this.emitSkillUpdatedEvent(saved);

    return saved;
  }

  /**
   * Unpublish a skill (set status back to draft)
   */
  async unpublish(solutionId: string, idOrSlug: string): Promise<Skill> {
    const skill = await this.findOne(solutionId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    skill.status = 'draft';
    skill.publishedAt = null;

    const saved = await this.skillRepository.save(skill);
    this.logger.log(`Unpublished skill ${saved.name} (${saved.slug})`);

    // Notify listeners of skill unpublish
    SkillChangeNotifier.notify(skill.solutionId, saved.id, saved.slug, 'unpublished');

    return saved;
  }

  /**
   * Create a new version of a skill
   */
  async createVersion(skillId: string, dto: CreateVersionDto): Promise<SkillVersion> {
    return this.skillRepository.manager.transaction(async (manager) => {
      const skill = await manager.findOne(Skill, { where: { id: skillId } });
      if (!skill) {
        throw new NotFoundException(`Skill not found: ${skillId}`);
      }

      // Determine version number
      let version: string;
      if (dto.version) {
        version = dto.version;
      } else {
        const existingVersions = await manager.find(SkillVersion, {
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

      const skillVersion = manager.create(SkillVersion, {
        skillId,
        version,
        content: skill.content,
        contentHash,
        config: skill.config,
        allowedTools: skill.allowedTools,
        changelog: dto.changelog,
        deploymentStatus: 'draft',
      });

      const saved = await manager.save(SkillVersion, skillVersion);

      // Snapshot current skill files into version files
      const currentFiles = await manager.find(SkillFile, {
        where: { skillId },
      });
      if (currentFiles.length > 0) {
        const versionFiles = currentFiles.map((f) =>
          manager.create(SkillVersionFile, {
            versionId: saved.id,
            relativePath: f.relativePath,
            content: f.content,
            contentHash: f.contentHash,
          }),
        );
        await manager.save(SkillVersionFile, versionFiles);
        this.logger.debug(
          `Snapshotted ${versionFiles.length} files for version ${version}`,
        );
      }

      // Update skill's current version
      skill.currentVersion = version;
      await manager.save(Skill, skill);

      this.logger.log(`Created version ${version} for skill ${skill.name}`);
      return saved;
    });
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
  async rollbackToVersion(solutionId: string, idOrSlug: string, version: string): Promise<Skill> {
    const skill = await this.findOne(solutionId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    const skillVersion = await this.versionRepository.findOne({
      where: { skillId: skill.id, version },
    });
    if (!skillVersion) {
      throw new NotFoundException(`Version not found: ${version}`);
    }

    return this.skillRepository.manager.transaction(async (manager) => {
      // Update skill with versioned content
      skill.content = skillVersion.content;
      skill.config = skillVersion.config;
      skill.allowedTools = skillVersion.allowedTools;
      skill.currentVersion = version;

      const saved = await manager.save(Skill, skill);

      // Restore files from version snapshot
      // 1. Delete all current skill files
      await manager.delete(SkillFile, { skillId: skill.id });

      // 2. Rebuild from version files
      const versionFiles = await manager.find(SkillVersionFile, {
        where: { versionId: skillVersion.id },
      });
      if (versionFiles.length > 0) {
        const restoredFiles = versionFiles.map((vf) =>
          manager.create(SkillFile, {
            skillId: skill.id,
            relativePath: vf.relativePath,
            content: vf.content,
            contentHash: vf.contentHash,
          }),
        );
        await manager.save(SkillFile, restoredFiles);
        this.logger.debug(
          `Restored ${restoredFiles.length} files from version ${version}`,
        );
      }

      this.logger.log(`Rolled back skill ${skill.name} to version ${version}`);
      return saved;
    });
  }

  /**
   * Find published skills for a tenant
   */
  async findPublished(solutionId: string): Promise<Skill[]> {
    return this.skillRepository.find({
      where: { solutionId, status: 'published' },
    });
  }

  /**
   * Toggle the enabled state of a skill
   */
  async toggle(solutionId: string, idOrSlug: string): Promise<Skill> {
    const skill = await this.findOne(solutionId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    skill.enabled = !skill.enabled;
    const saved = await this.skillRepository.save(skill);

    this.logger.log(`Toggled skill ${saved.name} (${saved.slug}) enabled=${saved.enabled}`);
    return saved;
  }

  // =========================================================================
  // Skill File Methods
  // =========================================================================

  /**
   * Get all files for a skill
   */
  async getSkillFiles(skillId: string): Promise<SkillFile[]> {
    return this.skillFileRepository.find({
      where: { skillId },
      order: { relativePath: 'ASC' },
    });
  }

  /**
   * Get a single file by ID
   */
  async getSkillFile(skillId: string, fileId: string): Promise<SkillFile | null> {
    return this.skillFileRepository.findOne({
      where: { id: fileId, skillId },
    });
  }

  /**
   * Upsert files for a skill (create or update by relativePath).
   * Batched: loads all existing files in one query, saves changed files in one call.
   */
  async upsertFiles(
    skillId: string,
    files: UpsertSkillFileDto[],
  ): Promise<SkillFile[]> {
    // Load all existing files for this skill in one query
    const existingFiles = await this.skillFileRepository.find({
      where: { skillId },
    });
    const existingByPath = new Map(
      existingFiles.map((f) => [f.relativePath, f]),
    );

    const toSave: SkillFile[] = [];
    const unchanged: SkillFile[] = [];

    for (const fileDto of files) {
      // Normalize and validate path
      const normalizedPath = this.normalizePath(fileDto.relativePath);
      const contentHash = this.hashContent(fileDto.content);

      const existing = existingByPath.get(normalizedPath);
      if (existing) {
        if (existing.contentHash !== contentHash) {
          existing.content = fileDto.content;
          existing.contentHash = contentHash;
          toSave.push(existing);
        } else {
          unchanged.push(existing);
        }
      } else {
        toSave.push(
          this.skillFileRepository.create({
            skillId,
            relativePath: normalizedPath,
            content: fileDto.content,
            contentHash,
          }),
        );
      }
    }

    const saved =
      toSave.length > 0
        ? await this.skillFileRepository.save(toSave)
        : [];

    this.logger.debug(
      `Upserted ${saved.length} files (${unchanged.length} unchanged) for skill ${skillId}`,
    );
    return [...saved, ...unchanged];
  }

  /**
   * Delete a file by relativePath
   */
  async deleteFile(skillId: string, relativePath: string): Promise<void> {
    const result = await this.skillFileRepository.delete({
      skillId,
      relativePath,
    });
    if (result.affected === 0) {
      throw new NotFoundException(
        `File not found: ${relativePath} in skill ${skillId}`,
      );
    }
    this.logger.debug(`Deleted file ${relativePath} from skill ${skillId}`);
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Normalize a relative path and reject traversal attempts.
   */
  private normalizePath(relativePath: string): string {
    const normalized = path.posix.normalize(relativePath).replace(/^\.\//, '');
    if (
      normalized.startsWith('..') ||
      path.posix.isAbsolute(normalized) ||
      normalized.includes('..')
    ) {
      throw new BadRequestException(
        `Invalid file path: ${relativePath} — must be relative and within skill directory`,
      );
    }
    return normalized;
  }

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
