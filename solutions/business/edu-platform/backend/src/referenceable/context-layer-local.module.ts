import { Module } from '@nestjs/common';
import { EntityRegistry } from '@kedge-agentic/context-layer/core';
import { EduCacheStore } from './adapters/edu-cache-store';
import { EduBrowseProvider } from './adapters/edu-browse-provider';
import { eduBrowseProvider } from './adapters/edu-browse-provider-instance';

// Import core classes — these are pure TS, no NestJS version conflict
import { RecommendEngine } from '@kedge-agentic/context-layer/core';
import { ActivityEmitter } from '@kedge-agentic/context-layer/core';
import { ContextInjector } from '@kedge-agentic/context-layer/core';
import { ContextRouter } from '@kedge-agentic/context-layer/core';
import { ShortcutManager } from '@kedge-agentic/context-layer/core';
import { RelationInferrer } from '@kedge-agentic/context-layer/core';
import { EduOrmAdapter } from './adapters/edu-orm-adapter';

/**
 * Local replacement for ContextLayerModule.forRoot() that avoids
 * dual @nestjs/core version conflicts in this monorepo setup.
 *
 * Provides the same core services + controller but using the local
 * @nestjs/common & @nestjs/core from edu-platform's node_modules.
 *
 * SYNC: Keep endpoints in sync with ContextLayerController in
 * packages/context-layer/src/nestjs/context-layer.controller.ts
 */

// Re-declare the controller locally to use local NestJS decorators
import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  EntityTypesResponse,
  SuggestResponse,
  BrowseResponse,
  SearchResponse,
  ResolveResponse,
  ShortcutsResponse,
  ShortcutsConfig,
  EntityContext,
  EditResult,
} from '@kedge-agentic/context-layer/core';
// DTOs imported from context-layer (class-validator decorators are framework-agnostic)
import { EditEntityDto, ApplyDto, RecordActivityDto } from '@kedge-agentic/context-layer/nestjs';

const cacheStore = new EduCacheStore();
const ormAdapter = new EduOrmAdapter();
const registry = new EntityRegistry();
const recommend = new RecommendEngine(cacheStore, registry);
const activityEmitter = new ActivityEmitter({ add: async () => {} }, recommend);
const injector = new ContextInjector(registry, eduBrowseProvider);
const shortcutManager = new ShortcutManager(cacheStore);
const inferrer = new RelationInferrer(registry, ormAdapter);
const contextRouter = new ContextRouter(registry);

@ApiTags('context')
@Controller('context')
class EduContextLayerController {
  @Get('entity-types')
  getEntityTypes(): EntityTypesResponse {
    return registry.getEntityTypes();
  }

  @Get('suggest')
  async suggest(
    @Query('session_id') sessionId: string = '',
    @Query('limit') limit: string = '10',
  ): Promise<SuggestResponse> {
    const recents = await recommend.getTopN(
      { userId: 'default-user', tenantId: 'default', sessionId },
      parseInt(limit, 10),
    );
    return { recents, cachedAt: new Date().toISOString() };
  }

  @Get('browse')
  async browse(
    @Query('entity_type') entityType: string,
    @Query('parent_type') parentType?: string,
    @Query('parent_id') parentId?: string,
    @Query('page') page: string = '1',
  ): Promise<BrowseResponse> {
    return injector.browse(entityType, {
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
    return injector.search(query, {
      entityType,
      limit: parseInt(limit, 10),
    });
  }

  @Get('resolve')
  async resolve(
    @Query('entity_type') entityType: string,
    @Query('entity_id') entityId: string,
  ): Promise<ResolveResponse> {
    return injector.resolve(entityType, entityId);
  }

  @Post('activity')
  async recordActivity(
    @Body() body: RecordActivityDto,
  ): Promise<{ ok: true }> {
    await activityEmitter.emit(
      { userId: 'default-user', tenantId: 'default', sessionId: body.sessionId },
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

  @Get('entity/:type/:id')
  async getEntityContext(
    @Param('type') type: string,
    @Param('id') id: string,
  ): Promise<EntityContext> {
    try {
      return await contextRouter.getEntityContext(type, id, 'default-user');
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Entity not found',
        err.message?.includes('No EntityContextProvider')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // SYNC: Document endpoints (Phase 4)

  @Get('entity/:type/:id/document')
  async getDocument(
    @Param('type') type: string,
    @Param('id') id: string,
  ): Promise<{ document: string }> {
    try {
      const document = await contextRouter.getDocument(type, id, 'default-user');
      return { document };
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Cannot serialize entity',
        err.message?.includes('No EntityContextProvider')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('entity/:type/:id/edit')
  async editEntity(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: EditEntityDto,
  ): Promise<EditResult> {
    const ops = body.operations.map(op => {
      if (op.op === 'str_replace') {
        return { op: 'str_replace' as const, old_string: op.old_string!, new_string: op.new_string! };
      }
      return { op: 'field_set' as const, field: op.field!, value: op.value };
    });

    return contextRouter.editEntity(type, id, ops, 'default-user');
  }

  // SYNC: Legacy apply (deprecated)

  /** @deprecated Use POST /context/entity/:type/:id/edit instead */
  @Post('apply')
  async apply(
    @Body() body: ApplyDto,
  ): Promise<{ success: boolean; error?: string }> {
    return contextRouter.apply(
      body.target_type,
      body.target_id,
      {
        field_path: body.field_path,
        suggested_value: body.suggested_value,
        action_description: body.action_description,
        session_id: body.session_id ?? '',
      },
      'default-user',
    );
  }

  @Get('shortcuts')
  async getShortcuts(
    @Query('session_template') sessionTemplate?: string,
  ): Promise<ShortcutsResponse> {
    return shortcutManager.getShortcuts('default-user', 'default', sessionTemplate);
  }

  @Put('shortcuts')
  async updateShortcuts(
    @Body() config: ShortcutsConfig,
  ): Promise<{ ok: true }> {
    await shortcutManager.updateShortcuts('default-user', 'default', config);
    return { ok: true };
  }
}

@Module({
  controllers: [EduContextLayerController],
  providers: [
    { provide: EntityRegistry, useValue: registry },
    { provide: RecommendEngine, useValue: recommend },
    { provide: ActivityEmitter, useValue: activityEmitter },
    { provide: ContextInjector, useValue: injector },
    { provide: ContextRouter, useValue: contextRouter },
    { provide: ShortcutManager, useValue: shortcutManager },
    { provide: RelationInferrer, useValue: inferrer },
  ],
  exports: [EntityRegistry, RecommendEngine, ActivityEmitter, ContextInjector, ContextRouter, ShortcutManager],
})
export class ContextLayerLocalModule {}
