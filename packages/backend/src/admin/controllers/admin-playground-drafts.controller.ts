/**
 * Admin Playground Drafts Controller
 *
 * CRUD endpoints for /admin/playground-drafts (§17 — exercise plugin preview).
 * Replaces the v1 localStorage persistence with a real per-user store.
 *
 * All endpoints under /api/v1/admin/playground-drafts. Drafts are scoped
 * to the authenticated admin/builder user.
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

  /** List the caller's drafts, optionally filtered by bundleId. */
  @Get()
  async list(
    @Ctx() ctx: RequestContext,
    @Query('bundleId') bundleId?: string,
  ): Promise<{ data: PlaygroundDraft[]; total: number }> {
    const where: Record<string, unknown> = { userId: (ctx.userId ?? ctx.apiKeyId ?? 'anonymous') };
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
      where: { userId: (ctx.userId ?? ctx.apiKeyId ?? 'anonymous'), bundleId, storyName },
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
    let draft = await this.repo.findOne({
      where: { userId: (ctx.userId ?? ctx.apiKeyId ?? 'anonymous'), bundleId, storyName },
    });
    if (!draft) {
      draft = this.repo.create({
        userId: (ctx.userId ?? ctx.apiKeyId ?? 'anonymous'),
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
    await this.repo.delete({ userId: (ctx.userId ?? ctx.apiKeyId ?? 'anonymous'), bundleId, storyName });
  }
}
