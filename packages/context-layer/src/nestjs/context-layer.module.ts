import { Module, DynamicModule } from '@nestjs/common';
import { DiscoveryModule, Reflector } from '@nestjs/core';
import { EntityRegistry } from '../core/entity-registry.js';
import { RelationInferrer } from '../core/relation-inferrer.js';
import { ActivityEmitter } from '../core/activity-emitter.js';
import { RecommendEngine } from '../core/recommend-engine.js';
import { ContextInjector } from '../core/context-injector.js';
import { ShortcutManager } from '../core/shortcut-manager.js';
import { ContextRouter } from '../core/context-router.js';
import { ContextLayerController } from './context-layer.controller.js';
import { ContextLayerInterceptor } from './context-layer.interceptor.js';
import { ContextLayerInitService } from './context-layer.init.service.js';
import { CONTEXT_LAYER_OPTIONS } from './context-layer.constants.js';
import type { CacheStore, OrmAdapter, EntityBrowseProvider, ActivityQueue } from '../core/interfaces.js';

export interface ContextLayerModuleOptions {
  cacheStore: CacheStore;
  ormAdapter: OrmAdapter;
  browseProvider: EntityBrowseProvider;
  activityQueue?: ActivityQueue;
}

@Module({})
export class ContextLayerModule {
  static forRoot(options: ContextLayerModuleOptions): DynamicModule {
    const registry = new EntityRegistry();
    const recommend = new RecommendEngine(options.cacheStore, registry);
    const queue: ActivityQueue = options.activityQueue ?? { add: async () => {} };
    const activityEmitter = new ActivityEmitter(queue, recommend);
    const injector = new ContextInjector(registry, options.browseProvider);
    const shortcutManager = new ShortcutManager(options.cacheStore);
    const inferrer = new RelationInferrer(registry, options.ormAdapter);
    const contextRouter = new ContextRouter(registry);

    return {
      module: ContextLayerModule,
      imports: [DiscoveryModule],
      providers: [
        { provide: EntityRegistry, useValue: registry },
        { provide: RecommendEngine, useValue: recommend },
        { provide: ActivityEmitter, useValue: activityEmitter },
        { provide: ContextInjector, useValue: injector },
        { provide: ContextRouter, useValue: contextRouter },
        { provide: ShortcutManager, useValue: shortcutManager },
        { provide: RelationInferrer, useValue: inferrer },
        { provide: CONTEXT_LAYER_OPTIONS, useValue: options },
        ContextLayerInterceptor,
        ContextLayerInitService,
        Reflector,
      ],
      controllers: [ContextLayerController],
      exports: [EntityRegistry, RecommendEngine, ActivityEmitter, ContextInjector, ContextRouter, ShortcutManager],
    };
  }
}
