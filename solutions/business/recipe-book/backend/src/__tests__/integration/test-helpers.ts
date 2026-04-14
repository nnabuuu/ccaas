import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Recipe } from '../../entities/recipe.entity';
import { RecipeModule } from '../../recipe/recipe.module';
import { ReferenceableModule } from '../../referenceable/referenceable.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Recipe],
      synchronize: true,
    }),
    RecipeModule,
    ReferenceableModule,
  ],
})
class TestAppModule {}

export const SEED_RECIPES = [
  {
    title: '鱼香肉丝',
    cuisine: '川菜',
    difficulty: 'medium',
    prep_time: 20,
    cook_time: 15,
    servings: 2,
    status: 'draft',
    blocks: [
      { type: 'section', content: { heading: '食材准备' } },
      { type: 'text', content: { text: '鱼香肉丝是川菜经典名菜，以其酸甜咸辣的独特风味著称。' } },
      { type: 'ingredient', content: { items: [{ name: '猪里脊', amount: '200g', note: '切丝' }, { name: '木耳', amount: '50g', note: '泡发' }, { name: '胡萝卜', amount: '1根', note: '切丝' }], category: '主料' } },
      { type: 'ingredient', content: { items: [{ name: '郫县豆瓣酱', amount: '1勺', note: '' }, { name: '醋', amount: '2勺', note: '' }, { name: '糖', amount: '1勺', note: '' }], category: '调料' } },
      { type: 'list', content: { ordered: true, items: ['猪肉切丝，加淀粉腌制10分钟', '调制鱼香汁：醋、糖、酱油、淀粉水混合', '热锅冷油，爆香豆瓣酱', '下肉丝翻炒至变色', '加入木耳和胡萝卜丝', '倒入鱼香汁，翻炒均匀'] } },
      { type: 'timeline', content: { columns: ['步骤', '时间', '火候'], rows: [['腌肉', '10分钟', '—'], ['炒制', '8分钟', '大火'], ['收汁', '2分钟', '中火']] } },
      { type: 'table', content: { columns: ['营养素', '含量'], rows: [['蛋白质', '18g'], ['碳水', '12g'], ['脂肪', '15g']] } },
      { type: 'callout', content: { text: '豆瓣酱要小火炒出红油，这是鱼香味的关键', color: 'warning' } },
      { type: 'callout', content: { text: '可以加泡椒增加风味层次', color: 'info' } },
    ],
  },
  {
    title: '番茄炒蛋',
    cuisine: '家常',
    difficulty: 'easy',
    prep_time: 5,
    cook_time: 10,
    servings: 2,
    status: 'draft',
    blocks: [
      { type: 'section', content: { heading: '简单家常菜' } },
      { type: 'text', content: { text: '番茄炒蛋是中国最普及的家常菜，几乎人人都会做。' } },
      { type: 'ingredient', content: { items: [{ name: '番茄', amount: '2个', note: '切块' }, { name: '鸡蛋', amount: '3个', note: '常温' }, { name: '葱花', amount: '适量', note: '' }], category: '主料' } },
      { type: 'list', content: { ordered: true, items: ['鸡蛋打散，加少许盐', '番茄切块备用', '热锅多油，倒入蛋液炒至凝固盛出', '锅中留底油，炒番茄至出汁', '加入炒好的鸡蛋，翻炒均匀'] } },
      { type: 'callout', content: { text: '番茄要炒出汁才好吃，可以加少许糖提鲜', color: 'tip' } },
    ],
  },
  {
    title: '提拉米苏',
    cuisine: '西餐',
    difficulty: 'hard',
    prep_time: 30,
    cook_time: 0,
    servings: 4,
    status: 'published',
    blocks: [
      { type: 'section', content: { heading: '经典意式甜品' } },
      { type: 'text', content: { text: '提拉米苏（Tiramisù）是意大利经典甜品，意为"带我走"。层层叠加的咖啡与马斯卡彭奶酪令人沉醉。' } },
      { type: 'ingredient', content: { items: [{ name: '马斯卡彭奶酪', amount: '250g', note: '室温' }, { name: '手指饼干', amount: '200g', note: '' }, { name: '浓缩咖啡', amount: '200ml', note: '冷却' }], category: '主料' } },
      { type: 'ingredient', content: { items: [{ name: '蛋黄', amount: '3个', note: '新鲜' }, { name: '细砂糖', amount: '75g', note: '' }, { name: '可可粉', amount: '适量', note: '装饰用' }], category: '辅料' } },
      { type: 'list', content: { ordered: true, items: ['蛋黄加糖打发至颜色变浅', '加入马斯卡彭奶酪搅拌均匀', '手指饼干快速蘸咖啡铺底', '铺一层奶酪糊', '重复一层饼干和奶酪', '冷藏至少4小时', '食用前筛可可粉'] } },
      { type: 'table', content: { columns: ['营养素', '含量/份'], rows: [['热量', '380kcal'], ['蛋白质', '8g'], ['碳水', '35g'], ['脂肪', '22g']] } },
      { type: 'callout', content: { text: '手指饼干蘸咖啡要快，泡太久会散', color: 'warning' } },
    ],
  },
];

export interface TestContext {
  app: INestApplication;
  baseUrl: string;
  recipes: { yuxiang: Recipe; tomato: Recipe; tiramisu: Recipe };
}

export async function createTestApp(): Promise<TestContext> {
  const module = await Test.createTestingModule({
    imports: [TestAppModule],
  }).compile();

  const app = module.createNestApplication();
  await app.init();
  await app.listen(0);
  const address = app.getHttpServer().address();
  const baseUrl = `http://localhost:${address.port}`;

  const recipes = await seedRecipes(app);
  return { app, baseUrl, recipes };
}

export async function seedRecipes(app: INestApplication) {
  const repo = app.get<Repository<Recipe>>(getRepositoryToken(Recipe));
  await repo.clear();

  const results: Recipe[] = [];
  for (const seed of SEED_RECIPES) {
    results.push(await repo.save(repo.create(seed)));
  }

  return {
    yuxiang: results[0],
    tomato: results[1],
    tiramisu: results[2],
  };
}
