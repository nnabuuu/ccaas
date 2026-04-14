import { Module, OnModuleInit } from '@nestjs/common';
import { EntityRegistry } from '@kedge-agentic/context-layer/core';
import { RecipeModule } from '../recipe/recipe.module';
import { RecipeService } from '../recipe/recipe.service';
import { RecipeProvider } from './providers/recipe.provider';
import { ContextLayerLocalModule } from './context-layer-local.module';
import { recipeBrowseProvider } from './adapters/recipe-browse-provider-instance';

@Module({
  imports: [RecipeModule, ContextLayerLocalModule],
  providers: [RecipeProvider],
})
export class ReferenceableModule implements OnModuleInit {
  constructor(
    private registry: EntityRegistry,
    private recipeProvider: RecipeProvider,
    private recipeService: RecipeService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      type: 'recipe',
      displayName: '食谱',
      icon: '🍳',
      color: 'orange',
      abilities: { search: true, browse: true, resolve: true, track: true },
    });

    this.registry.registerProvider('recipe', this.recipeProvider);

    recipeBrowseProvider.setServices(this.recipeService);
  }
}
