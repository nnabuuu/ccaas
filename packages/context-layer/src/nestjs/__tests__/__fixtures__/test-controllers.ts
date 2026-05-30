/**
 * Test-only NestJS controllers with `@Referenceable` decorators. Used
 * by the integration suite to exercise the discovery-driven
 * registration path in `ContextLayerModule.onModuleInit`.
 *
 * The controllers themselves have no business logic — they just
 * advertise their metadata. The module's discovery pass should find
 * them at boot and register their entity types with `EntityRegistry`.
 */

import { Controller, Get, Post } from '@nestjs/common';
import { Referenceable, Tracked } from '../../context-layer.decorator.js';

@Referenceable({
  type: 'recipe',
  displayName: '食谱',
  icon: '🍳',
  color: 'orange',
  abilities: { search: true, browse: true, resolve: true, track: true },
})
@Controller('recipes')
export class RecipeTestController {
  @Get(':id')
  read(): { id: string; name: string } {
    return { id: 'rec-1', name: 'Test recipe' };
  }

  @Post()
  create(): { id: string; name: string } {
    return { id: 'rec-2', name: 'Newly created' };
  }
}

@Referenceable({
  type: 'recipe_section',
  displayName: '章节',
  icon: '📑',
  color: 'amber',
  abilities: { search: true, browse: true, resolve: true },
})
@Controller('recipe-sections')
export class RecipeSectionTestController {
  @Get(':id')
  read(): { id: string; name: string } {
    return { id: 'sec-1', name: 'Test section' };
  }
}

@Controller('explicit-tracking')
export class ExplicitTrackingController {
  @Tracked('viewed', { entityType: 'recipe' })
  @Get(':id')
  read(): { id: string; name: string } {
    return { id: 'rec-tracked', name: 'Viewed via @Tracked' };
  }
}
