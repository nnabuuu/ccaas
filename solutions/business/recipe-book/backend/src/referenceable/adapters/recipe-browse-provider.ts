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
          hasChildren: true,
          summary: `${item.cuisine || ''} ${DIFFICULTY_MAP[item.difficulty] ?? item.difficulty ?? ''} 食谱`.trim(),
        })),
        total: result.total,
        page: result.page,
      };
    }

    if (entityType === 'recipe_section' && opts.parentType === 'recipe' && opts.parentId && this.recipeService) {
      const recipe = await this.recipeService.findOne(opts.parentId);
      const blocks = recipe.blocks || [];
      const sections = blocks
        .map((block: any, index: number) => ({ block, index }))
        .filter(({ block }: any) => block.type === 'section');

      return {
        items: sections.map(({ block, index }: any) => ({
          entityType: 'recipe_section',
          entityId: `${opts.parentId}:section:${index}`,
          id: `${opts.parentId}:section:${index}`,
          displayName: block.content?.heading || block.data?.heading || `章节 ${index + 1}`,
          subtitle: `${recipe.title} / 章节`,
          hasChildren: false,
          summary: block.content?.heading || block.data?.heading || `${recipe.title} 的章节`,
        })),
        total: sections.length,
        page: 1,
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

    if ((!opts?.entityType || opts.entityType === 'recipe_section') && this.recipeService) {
      const allRecipes = await this.recipeService.findAll({ limit: 100 });
      for (const recipe of allRecipes.items) {
        const blocks = (recipe as any).blocks || [];
        blocks.forEach((block: any, index: number) => {
          if (block.type === 'section') {
            const heading = block.content?.heading || block.data?.heading || '';
            if (heading.includes(query)) {
              results.push({
                entityType: 'recipe_section',
                entityId: `${recipe.id}:section:${index}`,
                displayName: heading,
                subtitle: `${(recipe as any).title} / 章节`,
                icon: '📑',
                summary: `${(recipe as any).title} 的 ${heading}`,
              });
            }
          }
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

    if (entityType === 'recipe_section' && this.recipeService) {
      const [recipeId, , indexStr] = entityId.split(':');
      const index = parseInt(indexStr, 10);
      const recipe = await this.recipeService.findOne(recipeId);
      const blocks = recipe.blocks || [];
      const sectionBlocks = blocks
        .map((block: any, idx: number) => ({ block, idx }))
        .filter(({ block }: any) => block.type === 'section');
      const target = sectionBlocks[index];
      if (!target) throw new Error(`Section not found: ${entityId}`);

      return {
        entityType: 'recipe_section',
        entityId,
        displayName: target.block.content?.heading || target.block.data?.heading || `章节 ${index + 1}`,
        data: target.block as any,
        dataHash: '',
        resolvedAt: new Date().toISOString(),
        breadcrumb: [
          { type: 'recipe', id: recipeId, displayName: recipe.title, icon: '🍳' },
        ],
      };
    }

    throw new Error(`Cannot resolve entity: ${entityType}/${entityId}`);
  }
}
