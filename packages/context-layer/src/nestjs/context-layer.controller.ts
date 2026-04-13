import { Controller, Get, Post, Put, Query, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsIn, IsNotEmpty, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EntityRegistry } from '../core/entity-registry.js';
import { RecommendEngine } from '../core/recommend-engine.js';
import { ContextInjector } from '../core/context-injector.js';
import { ContextRouter } from '../core/context-router.js';
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
  EntityContext,
  EditResult,
} from '../core/interfaces.js';

// ─── DTOs ───

export class EditOperationDto {
  @IsIn(['str_replace', 'field_set'])
  op!: 'str_replace' | 'field_set';

  @ValidateIf(o => o.op === 'str_replace')
  @IsString()
  old_string?: string;

  @ValidateIf(o => o.op === 'str_replace')
  @IsString()
  new_string?: string;

  @ValidateIf(o => o.op === 'field_set')
  @IsString()
  field?: string;

  @ValidateIf(o => o.op === 'field_set')
  value?: any;
}

export class EditEntityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditOperationDto)
  operations!: EditOperationDto[];

  @IsOptional()
  @IsString()
  description?: string;
}

export class RecordActivityDto {
  @IsString() @IsNotEmpty() entityType!: string;
  @IsString() @IsNotEmpty() entityId!: string;
  @IsString() @IsNotEmpty() entityDisplayName!: string;
  @IsString() @IsNotEmpty() sessionId!: string;
  @IsIn(['referenced', 'viewed', 'created', 'updated', 'deleted'])
  action!: 'referenced' | 'viewed' | 'created' | 'updated' | 'deleted';
}

export class ApplyDto {
  @IsString() @IsNotEmpty() target_type!: string;
  @IsString() @IsNotEmpty() target_id!: string;
  @IsString() @IsNotEmpty() field_path!: string;
  suggested_value: any;
  @IsString() @IsNotEmpty() action_description!: string;
  @IsOptional() @IsString() session_id?: string;
}

// ─── Controller ───

@ApiTags('context')
@Controller('context')
export class ContextLayerController {
  constructor(
    private registry: EntityRegistry,
    private recommend: RecommendEngine,
    private injector: ContextInjector,
    private router: ContextRouter,
    private shortcuts: ShortcutManager,
    private activityEmitter: ActivityEmitter,
  ) {}

  // TODO: Replace hardcoded 'default-user' with authenticated user from request context
  private readonly userId = 'default-user';

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
    @Body() body: RecordActivityDto,
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

  @Get('entity/:type/:id')
  async getEntityContext(
    @Param('type') type: string,
    @Param('id') id: string,
  ): Promise<EntityContext> {
    try {
      return await this.router.getEntityContext(type, id, 'default-user');
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Entity not found',
        err.message?.includes('No EntityContextProvider') ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ─── Document endpoints (Phase 4) ───

  @Get('entity/:type/:id/document')
  async getDocument(
    @Param('type') type: string,
    @Param('id') id: string,
  ): Promise<{ document: string }> {
    try {
      const document = await this.router.getDocument(type, id, 'default-user');
      return { document };
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Cannot serialize entity',
        err.message?.includes('No EntityContextProvider') ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR,
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

    return this.router.editEntity(type, id, ops, 'default-user');
  }

  // ─── Legacy apply (deprecated, forwards to field_set) ───

  /** @deprecated Use POST /context/entity/:type/:id/edit instead */
  @Post('apply')
  async apply(
    @Body() body: ApplyDto,
  ): Promise<{ success: boolean; error?: string }> {
    return this.router.apply(
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
