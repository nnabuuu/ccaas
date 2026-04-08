import { Controller, Get, Post, Put, Query, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EntityRegistry } from '../core/entity-registry.js';
import { RecommendEngine } from '../core/recommend-engine.js';
import { ContextInjector } from '../core/context-injector.js';
import { ShortcutManager } from '../core/shortcut-manager.js';
import { ActivityEmitter } from '../core/activity-emitter.js';
import type {
  EntityTypesResponse,
  SuggestResponse,
  BrowseResponse,
  SearchResponse,
  ResolveResponse,
  ShortcutsResponse,
  ShortcutsConfig,
} from '../core/interfaces.js';

@ApiTags('context')
@Controller('context')
export class ContextLayerController {
  constructor(
    private registry: EntityRegistry,
    private recommend: RecommendEngine,
    private injector: ContextInjector,
    private shortcuts: ShortcutManager,
    private activityEmitter: ActivityEmitter,
  ) {}

  @Get('entity-types')
  getEntityTypes(): EntityTypesResponse {
    return this.registry.getEntityTypes();
  }

  @Get('suggest')
  async suggest(
    @Query('session_id') sessionId: string = '',
    @Query('limit') limit: string = '10',
  ): Promise<SuggestResponse> {
    const recents = await this.recommend.getTopN(
      {
        userId: 'default-user',
        tenantId: 'default',
        sessionId,
      },
      parseInt(limit, 10),
    );

    return {
      recents,
      cachedAt: new Date().toISOString(),
    };
  }

  @Get('browse')
  async browse(
    @Query('entity_type') entityType: string,
    @Query('parent_type') parentType?: string,
    @Query('parent_id') parentId?: string,
    @Query('page') page: string = '1',
  ): Promise<BrowseResponse> {
    return this.injector.browse(entityType, {
      parentType,
      parentId,
      page: parseInt(page, 10),
    });
  }

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('entity_type') entityType?: string,
    @Query('limit') limit: string = '20',
  ): Promise<SearchResponse> {
    return this.injector.search(query, {
      entityType,
      limit: parseInt(limit, 10),
    });
  }

  @Get('resolve')
  async resolve(
    @Query('entity_type') entityType: string,
    @Query('entity_id') entityId: string,
  ): Promise<ResolveResponse> {
    return this.injector.resolve(entityType, entityId);
  }

  @Post('activity')
  async recordActivity(
    @Body() body: {
      entityType: string;
      entityId: string;
      entityDisplayName: string;
      sessionId: string;
      action: 'referenced' | 'viewed' | 'created' | 'updated' | 'deleted';
    },
  ): Promise<{ ok: true }> {
    await this.activityEmitter.emit(
      {
        userId: 'default-user',
        tenantId: 'default',
        sessionId: body.sessionId,
      },
      {
        entityType: body.entityType,
        entityId: body.entityId,
        entityDisplayName: body.entityDisplayName,
        action: body.action,
        source: 'manual',
      },
    );
    return { ok: true };
  }

  @Get('shortcuts')
  async getShortcuts(
    @Query('session_template') sessionTemplate?: string,
  ): Promise<ShortcutsResponse> {
    return this.shortcuts.getShortcuts('default-user', 'default', sessionTemplate);
  }

  @Put('shortcuts')
  async updateShortcuts(
    @Body() config: ShortcutsConfig,
  ): Promise<{ ok: true }> {
    await this.shortcuts.updateShortcuts('default-user', 'default', config);
    return { ok: true };
  }
}
