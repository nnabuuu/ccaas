import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Recipe } from '../entities/recipe.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

@Injectable()
export class RecipeService {
  constructor(
    @InjectRepository(Recipe)
    private readonly repo: Repository<Recipe>,
  ) {}

  async create(dto: CreateRecipeDto): Promise<Recipe> {
    const recipe = this.repo.create(dto);
    return this.repo.save(recipe);
  }

  async findAll(opts?: { q?: string; limit?: number; page?: number }): Promise<{ items: Recipe[]; total: number; page: number }> {
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 20;
    const where: any = {};
    if (opts?.q) {
      where.title = Like(`%${opts.q}%`);
    }
    const [items, total] = await this.repo.findAndCount({
      where,
      take: limit,
      skip: (page - 1) * limit,
      order: { title: 'ASC' },
    });
    return { items, total, page };
  }

  async findOne(id: string): Promise<Recipe> {
    const recipe = await this.repo.findOne({ where: { id } });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);
    return recipe;
  }

  async update(id: string, dto: UpdateRecipeDto): Promise<Recipe> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
