/**
 * Admin Playground Drafts Controller
 *
 * CRUD endpoints for /admin/playground-drafts (§17 — exercise plugin preview).
 * Replaces the v1 localStorage persistence with a real per-user store.
 *
 * ## Tenant / scope model
 *
 * - Drafts are owned by a single principal. `ownerId(ctx)` resolves to
 *   `ctx.userId` first, then `ctx.apiKeyId` — never falls back to a shared
 *   bucket. Anonymous callers (no userId and no apiKeyId on the request
 *   context) are rejected with 401 Unauthorized. Without this, every
 *   anonymous caller would share a single 'anonymous' row and overwrite
 *   each other's drafts (cross-tenant data exposure on a shared deployment).
 *
 * - Drafts are *not* tenant-scoped today. A user who belongs to multiple
 *   tenants sees the same draft set everywhere they sign in. If we later
 *   need per-tenant drafts, add a `tenantId` column + composite unique
 *   constraint and key on `(userId, tenantId, bundleId, storyName)`.
 *
 * - The controller is guarded by AdminTenantAccessGuard so a caller can
 *   only invoke these endpoints from a tenant they belong to, but the
 *   draft rows themselves are not partitioned by tenant.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { AdminTenantAccessGuard } from '../guards/admin-tenant-access.guard';
import { RequestContext } from '../../auth/types';
import { PlaygroundDraft } from '../entities/playground-draft.entity';

interface UpsertBody {
  payload: Record<string, unknown>;
  notes?: string;
}

@ApiTags('admin')
@Controller('api/v1/admin/playground-drafts')
@AuthAdminOrBuilder()
@UseGuards(AdminTenantAccessGuard)
export class AdminPlaygroundDraftsController {
  constructor(
    @InjectRepository(PlaygroundDraft)
    private readonly repo: Repository<PlaygroundDraft>,
  ) {}

  /**
   * Resolve the draft owner. Throws 401 if the request has neither a userId
   * nor an apiKeyId — anonymous callers must NOT share storage with one
   * another (see class JSDoc).
   */
  private ownerId(ctx: RequestContext): string {
    const id = ctx.userId ?? ctx.apiKeyId;
    if (!id) {
      throw new UnauthorizedException(
        'Playground drafts require an authenticated principal (userId or apiKeyId).',
      );
    }
    return id;
  }

  /** List the caller's drafts, optionally filtered by bundleId. */
  @Get()
  async list(
    @Ctx() ctx: RequestContext,
    @Query('bundleId') bundleId?: string,
  ): Promise<{ data: PlaygroundDraft[]; total: number }> {
    const where: Record<string, unknown> = { userId: this.ownerId(ctx) };
    if (bundleId) where.bundleId = bundleId;
    const data = await this.repo.find({
      where,
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    return { data, total: data.length };
  }

  /** Fetch a single draft by composite key. */
  @Get(':bundleId/:storyName')
  async get(
    @Ctx() ctx: RequestContext,
    @Param('bundleId') bundleId: string,
    @Param('storyName') storyName: string,
  ): Promise<PlaygroundDraft> {
    const draft = await this.repo.findOne({
      where: { userId: this.ownerId(ctx), bundleId, storyName },
    });
    if (!draft) throw new NotFoundException('Draft not found');
    return draft;
  }

  /** Upsert (create or update) a draft for the caller. */
  @Put(':bundleId/:storyName')
  async upsert(
    @Ctx() ctx: RequestContext,
    @Param('bundleId') bundleId: string,
    @Param('storyName') storyName: string,
    @Body() body: UpsertBody,
  ): Promise<PlaygroundDraft> {
    const userId = this.ownerId(ctx);
    let draft = await this.repo.findOne({
      where: { userId, bundleId, storyName },
    });
    if (!draft) {
      draft = this.repo.create({
        userId,
        bundleId,
        storyName,
        payload: body.payload,
        notes: body.notes ?? null,
      });
    } else {
      draft.payload = body.payload;
      if (body.notes !== undefined) draft.notes = body.notes;
    }
    return this.repo.save(draft);
  }

  /** Delete a draft. Idempotent — 204 even if it didn't exist. */
  @Delete(':bundleId/:storyName')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Ctx() ctx: RequestContext,
    @Param('bundleId') bundleId: string,
    @Param('storyName') storyName: string,
  ): Promise<void> {
    await this.repo.delete({ userId: this.ownerId(ctx), bundleId, storyName });
  }
}
