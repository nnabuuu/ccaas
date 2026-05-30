/**
 * Discovery + auto-registration service for `ContextLayerModule`.
 *
 * Moved out of the module class because NestJS does not run constructor
 * DI on the dynamic-module class itself — only on `@Injectable()` providers.
 * The previous pattern (constructor DI on `ContextLayerModule` + the
 * `OnModuleInit` hook there) left `discoveryService` as `undefined` at
 * boot time and silently failed integration tests when added.
 *
 * Production never noticed because the only in-tree consumer
 * (recipe-book) uses its own `ContextLayerLocalModule` and registers
 * entities manually instead of relying on `ContextLayerModule.forRoot()`.
 */

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { EntityRegistry } from '../core/entity-registry.js';
import { RelationInferrer } from '../core/relation-inferrer.js';
import { REFERENCEABLE_KEY } from './context-layer.constants.js';
import type { ReferenceableOptions } from '../core/interfaces.js';

@Injectable()
export class ContextLayerInitService implements OnModuleInit {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly registry: EntityRegistry,
    private readonly inferrer: RelationInferrer,
  ) {}

  async onModuleInit(): Promise<void> {
    // Scan all controllers for @Referenceable metadata
    const controllers = this.discoveryService.getControllers();

    for (const wrapper of controllers) {
      if (!wrapper.metatype) continue;
      const options = this.reflector.get<ReferenceableOptions>(
        REFERENCEABLE_KEY,
        wrapper.metatype,
      );
      if (!options) continue;

      const controllerPath = Reflect.getMetadata('path', wrapper.metatype) ?? '';
      this.registry.register(options, controllerPath);
    }

    // Infer relations from ORM metadata
    await this.inferrer.scanAndRegister();
  }
}
