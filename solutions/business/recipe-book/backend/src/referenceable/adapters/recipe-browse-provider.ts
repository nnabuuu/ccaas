import type {
  EntityBrowseProvider,
  BrowseResponse,
  SearchResponse,
  ResolveResponse,
} from '@kedge-agentic/context-layer/core';
import type { RecipeService } from '../../recipe/recipe.service';
import { CUISINE_MAP, DIFFICULTY_MAP } from '../constants';

export class RecipeBrowseProvider implements EntityBrowseProvider {
  private recipeService?: RecipeService;

  setServices(recipeService: RecipeService): void {
    this.recipeService = recipeService;
  }

  async browse(
    entityType: string,
    opts: { parentType?: string; parentId?: string; page?: number },
  ): Promise<BrowseResponse> {
    const page = opts.page ?? 1;

    if (entityType === 'recipe' && this.recipeService) {
      const result = await this.recipeService.findAll({ page, limit: 20 });
      return {
        items: result.items.map((item: any) => ({
          entityType: 'recipe',
          entityId: item.id,
          id: item.id,
          displayName: item.title,
          subtitle: `${item.cuisine || ''} ${DIFFICULTY_MAP[item.difficulty] ?? item.difficulty ?? ''}`.trim(),
          hasChildren: false,
          summary: `${item.cuisine || ''} ${DIFFICULTY_MAP[item.difficulty] ?? item.difficulty ?? ''} 食谱`.trim(),
        })),
        total: result.total,
        page: result.page,
      };
    }

    return { items: [], total: 0, page: 1 };
  }

  async search(
    query: string,
    opts?: { entityType?: string; limit?: number },
  ): Promise<SearchResponse> {
    const limit = opts?.limit ?? 20;
    const results: any[] = [];

    if ((!opts?.entityType || opts.entityType === 'recipe') && this.recipeService) {
      const recipeResult = await this.recipeService.findAll({ q: query, limit });
      for (const item of recipeResult.items) {
        results.push({
          entityType: 'recipe',
          entityId: item.id,
          displayName: item.title,
          subtitle: `${item.cuisine || ''} ${DIFFICULTY_MAP[item.difficulty] ?? item.difficulty ?? ''}`.trim(),
          icon: '🍳',
          summary: `${item.cuisine || ''} ${DIFFICULTY_MAP[item.difficulty] ?? item.difficulty ?? ''} 食谱`.trim(),
        });
      }
    }

    return { results: results.slice(0, limit) };
  }

  async resolve(
    entityType: string,
    entityId: string,
  ): Promise<ResolveResponse> {
    if (entityType === 'recipe' && this.recipeService) {
      const recipe = await this.recipeService.findOne(entityId);
      return {
        entityType: 'recipe',
        entityId: recipe.id,
        displayName: recipe.title,
        data: recipe as any,
        dataHash: '',
        resolvedAt: new Date().toISOString(),
        breadcrumb: null,
      };
    }

    throw new Error(`Cannot resolve entity: ${entityType}/${entityId}`);
  }
}
