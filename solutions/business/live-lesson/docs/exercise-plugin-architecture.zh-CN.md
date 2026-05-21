# 练习类型插件架构

> 设计文档 — 从手动注册到自注册插件的全栈架构重构蓝图

## 1. 问题陈述

### 1.1 当前 11 种练习类型

| 类型标识 | 中文名 |
|---------|--------|
| `quiz` | 选择题 |
| `match` | 配对题 |
| `matrix` | 矩阵评价 |
| `stance` | 立场论证 |
| `order` | 排序题 |
| `select-evidence` | 选证据 |
| `map` | 象限图 |
| `image-upload` | 图片上传 |
| `rich-content-quiz` | 综合题（多小题/脚手架） |
| `fill-blank` | 填空题 |
| `guided-discovery` | 引导式探究 |

### 1.2 扩展点清单

每新增一种练习类型，需手动修改以下 **6 个后端 + 8 个前端** 扩展点：

#### 后端扩展点

| # | 扩展点 | 文件 | 当前模式 |
|---|--------|------|----------|
| B1 | AnswerKey Schema | `backend/src/schemas/answer-key.schema.ts` | 封闭 `z.union`（11 个 schema 手动罗列） |
| B2 | 数据脱敏器 | `backend/src/schemas/manifest.utils.ts:35-47` | `sanitizers` 手动字典分发 |
| B3 | 评分器 | `backend/src/classroom/exercise/grading.service.ts:22-34` | `this.graders` 手动字典 + 构造函数注入 |
| B4 | 检查项构造器 | `backend/src/classroom/exercise/build-check-items.ts:16-185` | `switch(ak.type)` 186 行 |
| B5 | ExerciseSpec 类型枚举 | `backend/src/schemas/exercise-spec.schema.ts:4` | 硬编码 `z.enum([...11 types])` |
| B6 | 观察处理器 | `backend/src/classroom/observe/observe-registry.ts` | **已是自动发现** ✓ |

#### 前端扩展点

| # | 扩展点 | 文件 | 当前模式 |
|---|--------|------|----------|
| F1 | 学生练习渲染 | `PracticePhase.tsx:438-567` | 11 个 `{ex.type === 'xxx' && <XxxExercise />}` 块 |
| F2 | 可提交判断 | `PracticePhase.tsx:112-157` | 按类型 `if/else` |
| F3 | 检查结果处理 | `PracticePhase.tsx:270-391` | 按类型 `if/else`（120 行） |
| F4 | 提交数据格式化 | `exercise/gradeItemSet.ts` | 按类型格式化逻辑 |
| F5 | TaskExercise 类型 | `task-data.ts:82` | 硬编码联合字面量 `'quiz' | 'match' | ... | 'guided-discovery'` |
| F6 | 教师观察 ClassView | `teacher/observe/ObserveDrawer.tsx:147-154` | 7 个 `{type === 'xxx' && <XxxClassView />}` 条件渲染 |
| F7 | 教师观察 StudentView | `teacher/observe/ObserveDrawer.tsx:178-185` | 7 个 `{type === 'xxx' && <XxxStudentView />}` 条件渲染 |
| F8 | 练习数据充实 | `exercise/enrich-exercise.ts:415-427` | 手动 handler 注册表（`fromApi` + `fromManifest`） |

### 1.3 新增练习类型清单（当前约 14 步）

1. 定义 AnswerKey schema（`answer-key.schema.ts`）
2. 加入 `AnswerKeySchema` 联合类型
3. 编写数据脱敏函数 + 注册到 `sanitizers` 字典
4. 编写评分器类 + 注册到 `GradingService.graders` 字典
5. 编写 `buildCheckItems` 分支
6. 扩展 `ExerciseSpecSchema.type` 枚举
7. 编写前端练习组件
8. 在 `PracticePhase.tsx` 添加条件渲染块
9. 在 `canSub()` 添加 if 分支
10. 在 `handleCheckResult()` 添加 if 分支
11. 扩展 `TaskExercise.type` 联合字面量
12. 编写后端观察处理器（`@ObserveType` — 已是自动发现）
13. 编写前端 `XxxClassView` + `XxxStudentView` 观察组件
14. 在 `ObserveDrawer.tsx` 添加条件渲染块
15. 在 `enrich-exercise.ts` 添加 `fromApi` + `fromManifest` 处理器

### 1.4 痛点总结

- **手动注册**：遗漏任何一步都会导致运行时错误，且编译器无法捕获
- **知识分散**：一种类型的逻辑散布在 10+ 文件中，新开发者需要全局搜索才能理解
- **ExerciseSpec 类型不安全**：所有类型的字段平铺在一个 `z.object` 中（150 行），全部 optional，编译器无法约束"quiz 必须有 questions"
- **依赖注入不统一**：部分评分器（matrix、map、image-upload）需要 `AiPromptBuilder`，但因为是手动 `new`，只能通过构造函数手工传入
- **扩展包不可能**：任何新类型必须修改核心代码

---

## 2. 架构概览

### 2.1 核心概念

整个系统围绕 `type` 字段构建 **类型对象** 模式：

```
manifest.answerKey.type  →  后端 sanitize / grade / buildCheckItems
exerciseSpec.type        →  前端 render / canSubmit / handleCheckResult
```

**目标**：将 `type` 从"需要手动注册的分发键"升级为"自注册插件的发现键"。

### 2.2 从手动注册到自注册插件

```
之前:  type → 手动 dict[type]    →  散布在 10 个文件
之后:  type → registry.get(type)  →  集中在 1 个 Plugin 类/文件
```

### 2.3 参考模式：ObserveRegistry

`ObserveRegistry`（`observe-registry.ts`）已经实现了自动发现模式：

```typescript
// observe-handler.interface.ts
export const OBSERVE_TYPE_KEY = 'OBSERVE_TYPE';
export function ObserveType(type: string): ClassDecorator {
  return SetMetadata(OBSERVE_TYPE_KEY, type);
}

// observe-registry.ts
@Injectable()
export class ObserveRegistry implements OnModuleInit {
  private handlers = new Map<string, ObserveHandler>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    for (const wrapper of this.discoveryService.getProviders()) {
      if (!wrapper.metatype) continue;
      const type = this.reflector.get<string>(OBSERVE_TYPE_KEY, wrapper.metatype);
      if (type && wrapper.instance) {
        this.handlers.set(type, wrapper.instance as ObserveHandler);
      }
    }
  }
}
```

我们将复用这个 `DiscoveryService + Reflector + SetMetadata` 三件套来构建 `ExerciseTypeRegistry`。

---

## 3. 后端插件系统

### 3.1 插件接口

```typescript
// backend/src/classroom/exercise/exercise-type-plugin.interface.ts

import { z } from 'zod';
import type { GradeResult } from '../../schemas';

/** 传递给 grade() 方法的上下文 */
export interface GradeContext {
  key: Record<string, unknown>;       // 解析后的答案密钥（插件知道其结构）
  data: Record<string, unknown>;       // 学生提交数据
}

/** 传递给 buildCheckItems() 的上下文 */
export interface CheckItemContext {
  key: Record<string, unknown>;
  data: Record<string, unknown>;
  gradeResult: GradeResult;
}

/** 传递给 sanitize() 的上下文 */
export interface SanitizeContext {
  answerKey: Record<string, unknown>;
  exerciseLabel?: string;
  practiceItemIds?: string[];
}

/**
 * 练习类型插件的统一接口。
 * 一个类 = 一个类型的完整后端逻辑。
 */
export interface ExerciseTypePlugin {
  /** 唯一类型标识符，例如 'quiz'、'match'、'long-division' */
  readonly type: string;

  /** 用于验证该类型 answerKey 的 Zod schema（必须包含 `type: z.literal(...)`） */
  readonly answerKeySchema: z.ZodType<any>;

  /**
   * 从 answerKey 中剥离答案数据后发送给学生。
   * 返回学生安全的 ExerciseSpec 字段（不含 `type` 和 `label`，由注册表添加）。
   */
  sanitize(ctx: SanitizeContext): Record<string, unknown> | null;

  /**
   * 根据答案密钥对学生提交进行评分。
   * AI 评分类型可以是异步的。
   */
  grade(ctx: GradeContext): GradeResult | Promise<GradeResult>;

  /**
   * 根据答案密钥 + 提交数据 + 评分结果构建逐项检查反馈。
   * 返回 { idx, correct, hint?, ... } 项目数组。
   */
  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>>;
}
```

**设计决策 — 为什么是单一接口而不是 4 个独立注册表**：

- 遗漏风险：4 个注册表意味着新增类型可能注册了评分器但忘了脱敏器
- 共享上下文：sanitize/grade/buildCheckItems 经常需要理解同一个 schema 结构
- IDE 导航：一个类 = 一个类型的完整后端逻辑，`Cmd+click` 即达

### 3.2 装饰器

```typescript
// backend/src/classroom/exercise/exercise-type.decorator.ts

import { SetMetadata } from '@nestjs/common';

export const EXERCISE_TYPE_KEY = 'EXERCISE_TYPE';

/**
 * 将类标记为练习类型插件。
 * 注册表通过此元数据自动发现所有 provider。
 *
 * @example
 * @Injectable()
 * @ExerciseType('quiz')
 * export class QuizPlugin implements ExerciseTypePlugin { ... }
 */
export function ExerciseType(type: string): ClassDecorator {
  return SetMetadata(EXERCISE_TYPE_KEY, type);
}
```

### 3.3 注册表

```typescript
// backend/src/classroom/exercise/exercise-type-registry.ts

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { z } from 'zod';
import { EXERCISE_TYPE_KEY } from './exercise-type.decorator';
import type { ExerciseTypePlugin, GradeContext, CheckItemContext, SanitizeContext } from './exercise-type-plugin.interface';
import type { GradeResult } from '../../schemas';

@Injectable()
export class ExerciseTypeRegistry implements OnModuleInit {
  private readonly logger = new Logger(ExerciseTypeRegistry.name);
  private readonly plugins = new Map<string, ExerciseTypePlugin>();
  private composedSchema: z.ZodType<any> | null = null;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    for (const wrapper of this.discoveryService.getProviders()) {
      if (!wrapper.metatype) continue;
      const type = this.reflector.get<string>(EXERCISE_TYPE_KEY, wrapper.metatype);
      if (type && wrapper.instance) {
        const plugin = wrapper.instance as ExerciseTypePlugin;
        if (this.plugins.has(type)) {
          this.logger.warn(`重复的练习类型 "${type}" — 将覆盖`);
        }
        this.plugins.set(type, plugin);
        this.logger.log(`已注册练习类型 "${type}": ${wrapper.metatype.name}`);
      }
    }

    // 从所有已注册插件动态组合 AnswerKey schema
    this.composedSchema = this.buildComposedSchema();
    this.logger.log(`已组合 AnswerKeySchema，包含 ${this.plugins.size} 个类型: [${this.getRegisteredTypes().join(', ')}]`);
  }

  /** 按类型获取特定插件 */
  get(type: string): ExerciseTypePlugin | undefined {
    return this.plugins.get(type);
  }

  /** 所有已注册的类型字符串 */
  getRegisteredTypes(): string[] {
    return [...this.plugins.keys()];
  }

  /** 从所有已注册 answerKeySchema 动态组合的 z.union */
  getAnswerKeySchema(): z.ZodType<any> {
    if (!this.composedSchema) throw new Error('注册表未初始化');
    return this.composedSchema;
  }

  /** 根据组合 schema 验证 answerKey */
  validateAnswerKey(ak: unknown): { valid: boolean; errors: string[] } {
    const result = this.getAnswerKeySchema().safeParse(ak);
    if (result.success) return { valid: true, errors: [] };
    return { valid: false, errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) };
  }

  /** 使用对应插件对 answerKey 进行脱敏 */
  sanitize(ctx: SanitizeContext): Record<string, unknown> | null {
    const type = (ctx.answerKey as any)?.type;
    if (!type) return null;
    const plugin = this.plugins.get(type);
    if (!plugin) return null;
    const spec = plugin.sanitize(ctx);
    if (!spec) return null;
    return { ...spec, type, label: ctx.exerciseLabel || (ctx.answerKey as any).label || '' };
  }

  /** 使用对应插件进行评分 */
  async grade(rawKey: unknown, data: Record<string, unknown>): Promise<GradeResult | null> {
    const parsed = this.getAnswerKeySchema().safeParse(rawKey);
    if (!parsed.success) return null;
    const key = parsed.data;
    const plugin = this.plugins.get(key.type);
    if (!plugin) return null;
    return plugin.grade({ key, data });
  }

  /** 使用对应插件构建检查项 */
  buildCheckItems(ak: Record<string, unknown>, data: Record<string, unknown>, gradeResult: GradeResult): Array<Record<string, unknown>> {
    const type = ak.type as string;
    const plugin = this.plugins.get(type);
    if (!plugin) return [];
    return plugin.buildCheckItems({ key: ak, data, gradeResult });
  }

  private buildComposedSchema(): z.ZodType<any> {
    const schemas = [...this.plugins.values()].map(p => p.answerKeySchema);
    if (schemas.length === 0) return z.never();
    if (schemas.length === 1) return schemas[0];
    return z.union([schemas[0], schemas[1], ...schemas.slice(2)] as any);
  }
}
```

### 3.4 插件示例：选择题

```typescript
// backend/src/classroom/exercise/plugins/quiz.plugin.ts

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ExerciseType } from '../exercise-type.decorator';
import type { ExerciseTypePlugin, GradeContext, CheckItemContext, SanitizeContext } from '../exercise-type-plugin.interface';
import type { GradeResult } from '../../../schemas';

const QuizAnswerItemSchema = z.object({
  questionIdx: z.number(),
  questionText: z.string().min(1),
  questionTranslate: z.string().optional(),
  options: z.array(z.string()).min(2),
  correct: z.number().int().nonnegative(),
  label: z.string().optional(),
  hint: z.string().optional(),
  hintZh: z.string().optional(),
  walkthrough: z.string().optional(),
  walkthroughZh: z.string().optional(),
  paraRef: z.array(z.number().int().positive()).optional(),
});

const QuizAnswerKeySchema = z.object({
  type: z.literal('quiz'),
  answers: z.array(QuizAnswerItemSchema).nonempty(),
}).refine(
  ak => ak.answers.every(a => a.correct < a.options.length),
  { message: 'quiz: correct 索引必须小于 options.length' },
);

@Injectable()
@ExerciseType('quiz')
export class QuizPlugin implements ExerciseTypePlugin {
  readonly type = 'quiz';
  readonly answerKeySchema = QuizAnswerKeySchema;

  sanitize(ctx: SanitizeContext): Record<string, unknown> | null {
    const ak = ctx.answerKey;
    const answers = ak.answers as Array<Record<string, unknown>> | undefined;
    return {
      questions: (answers || []).map(a => ({
        idx: a.questionIdx,
        text: a.questionText,
        ...(a.questionTranslate && { translate: a.questionTranslate }),
        options: a.options,
        ...(a.paraRef && { paraRef: a.paraRef }),
      })),
    };
  }

  grade(ctx: GradeContext): GradeResult {
    const key = ctx.key as z.infer<typeof QuizAnswerKeySchema>;
    const submitted = (ctx.data.answers || []) as number[];
    const byDimension: Record<string, boolean> = {};
    let correct = 0;

    key.answers.forEach((a, i) => {
      const isCorrect = submitted[i] === a.correct;
      byDimension[`q${a.questionIdx}`] = isCorrect;
      if (isCorrect) correct++;
    });

    return {
      total: Math.round((correct / key.answers.length) * 100),
      byDimension,
    };
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const ak = ctx.key as z.infer<typeof QuizAnswerKeySchema>;
    const dimOk = (val: unknown): boolean => val === true || val === 100;

    return ak.answers.map(a => {
      const correct = dimOk(ctx.gradeResult.byDimension?.[`q${a.questionIdx}`]);
      return {
        idx: a.questionIdx,
        correct,
        ...(!correct && a.hint && { hint: a.hint }),
        ...(!correct && a.hintZh && { hintZh: a.hintZh }),
        ...(!correct && a.walkthrough && { walkthrough: a.walkthrough }),
        ...(!correct && a.walkthroughZh && { walkthroughZh: a.walkthroughZh }),
      };
    });
  }
}
```

### 3.5 依赖注入处理

需要 AI 能力的插件正常使用 NestJS `@Injectable()` + 构造函数注入：

```typescript
@Injectable()
@ExerciseType('matrix')
export class MatrixPlugin implements ExerciseTypePlugin {
  constructor(private readonly aiPromptBuilder: AiPromptBuilder) {}

  async grade(ctx: GradeContext): Promise<GradeResult> {
    // 使用 this.aiPromptBuilder 构建 prompt
  }
}
```

**对比当前模式**：`GradingService` 手动 `new MatrixGrader(aiPromptBuilder)`。插件模式下 NestJS 自动注入，无需手工传参。

### 3.6 后端观察处理器保持独立

后端 `ObserveHandler`（数据聚合 + 统计）保持独立注册表，**不合并入 `ExerciseTypePlugin`**：

1. **关注点不同**：ObserveHandler 聚合全班提交数据 → 统计视图，Plugin 处理单个学生的验证 + 评分 + 反馈
2. **多对一映射**：`rich-content-quiz` 复用 `image-upload` 的 ObserveHandler。合并后这种共享用 `observeType` 别名解决（见 4.1）
3. **已经是自动发现**：`@ObserveType` 装饰器 + `DiscoveryService` 已经工作良好，扩展包直接加处理器即可
4. **节奏不同**：并非所有类型都需要 ObserveHandler（如 `fill-blank` 目前返回空数据）

**前端观察组件则纳入 `ExerciseUIPlugin`**（见 4.1）——教师观察抽屉通过插件注册表查找 ClassView / StudentView，实现扩展包新类型自动出现在教师端。

### 3.7 ExerciseSpec 变为开放 Schema

当前 `ExerciseSpecSchema` 是一个 150 行的扁平对象，所有类型的字段都平铺在一起。插件化后改为开放 schema：

```typescript
// exercise-spec.schema.ts — 插件迁移后

export const ExerciseSpecSchema = z.object({
  type: z.string(),   // ← 从 z.enum([...]) 改为 z.string()
  label: z.string(),
}).passthrough();       // ← 允许插件自定义字段

export type ExerciseSpec = z.infer<typeof ExerciseSpecSchema>;
```

**权衡**：类型安全从全局 schema 下沉到每个插件内部。插件内部的 sanitize 返回值是强类型的，只是注册表层面用 `Record<string, unknown>` 传输。

---

## 4. 前端插件系统

### 4.1 插件接口

```typescript
// frontend/src/components/student/exercise/exercise-type-plugin.ts

import type { CheckResult } from '../../../hooks/useClassroom';

/** 传递给每个练习组件的属性 */
export interface ExercisePluginProps {
  // ── 核心属性（所有类型都会收到） ──
  exercise: Record<string, any>;       // 类型特定的 ExerciseSpec 字段
  ans: Record<string, any>;
  setAns: (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  allDone: boolean;
  reviewData?: { data: Record<string, unknown>; checkItems?: Array<Record<string, unknown>> };
  /** 来自 handleCheckResult 的不透明状态包 — 插件存取自己的状态 */
  checkResultState: Record<string, any>;

  // ── 平台能力（PracticePhase 始终提供；组件按需使用） ──
  onDone: () => void;
  stepIdx?: number;
  taskId?: number;
  locale?: string;

  // ── 可选能力（仅在父组件支持时传入） ──
  /** 文本标注的覆盖层控制（select-evidence、map 使用） */
  onOverlayChange?: (overlay: { paragraphIdx: number; tokens: any[] } | null) => void;
  /** 向侧边栏推送脚手架提示（rich-content-quiz 使用） */
  onScaffoldPush?: (hint: Record<string, any>) => void;
  /** 向会话提交步骤数据（rich-content-quiz 使用） */
  submit?: (step: number, data: Record<string, any>) => void;
  studentId?: string;
  sessionCode?: string;
}

/** handleCheckResult() 的返回结果 */
export interface CheckResultHandlerOutput {
  /** 不透明状态包 — 存储在 PracticePhase 中，回传给组件 */
  checkResultState: Record<string, any>;
  /** 练习完全完成 */
  allDone: boolean;
  /** 软完成（例如 matrix/map：已提交，可能不是 100%） */
  softDone: boolean;
  /** 答错后需要清除的 ans 键（用于 quiz/match 重试） */
  clearAnsKeys?: (string | number)[];
}

/** 本地评分结果（用于不需要服务器检查的类型） */
export interface LocalGradeResult {
  allDone: boolean;
  softDone: boolean;
  correctQs?: Set<number>;
  wrongQs?: Set<number>;
  attempts?: Record<number, any[]>;
  clearAnsKeys?: (string | number)[];
}

/** 教师观察 ClassView 的属性 */
export interface ObserveClassViewProps {
  data: Record<string, any>;
  onStudentSelect: (studentId: string) => void;
}

/** 教师观察 StudentView 的属性 */
export interface ObserveStudentViewProps {
  data: Record<string, any>;
  studentId: string;
}

/**
 * 前端练习类型插件 — 一个对象 = 一个类型的完整 UI 逻辑。
 *
 * 覆盖学生端交互（Component、canSubmit、handleCheckResult）、
 * 数据充实（enrichFromApi、enrichFromManifest）、
 * 以及教师端观察（ObserveClassView、ObserveStudentView）。
 */
export interface ExerciseUIPlugin {
  /** 唯一类型标识符，必须与后端类型匹配 */
  readonly type: string;

  // ── 学生端：渲染 ──

  /** 用于渲染练习的 React 组件 */
  readonly Component: React.ComponentType<ExercisePluginProps>;

  /** 若为 true，此组件自行管理提交按钮（例如 rich-content-quiz、select-evidence） */
  readonly selfManagedSubmit?: boolean;

  /**
   * 若为 false，跳过服务器 /check API — 使用 localGrade 或让组件自行管理。
   * 默认为 true。
   */
  readonly serverCheck?: boolean;

  // ── 学生端：逻辑 ──

  /**
   * 学生是否可以提交？用于启用/禁用提交按钮。
   * checkResultState 是来自 handleCheckResult 输出的不透明状态包
   * （例如 quiz 用它来访问 correctQs 以跳过已答对的题目）。
   */
  canSubmit(exercise: Record<string, any>, ans: Record<string, any>, checkResultState: Record<string, any>): boolean;

  /**
   * 将 ans 格式化为提交到后端的载荷。
   * checkResultState 提供累积状态（例如 quiz/match 从中读取 attemptCounts）。
   */
  formatSubmitData(ans: Record<string, any>, checkResultState: Record<string, any>): Record<string, any>;

  /**
   * 将服务器检查结果处理为本地状态。
   * 当 /check API 返回检查项时调用。
   */
  handleCheckResult(
    result: CheckResult,
    exercise: Record<string, any>,
    currentState: { ans: Record<string, any>; attempts: Record<number, any[]>; correctQs: Set<number> },
  ): CheckResultHandlerOutput;

  /**
   * 可选：本地评分回退（用于 quiz/match/order 等不需要服务器即可评分的类型）。
   * 返回 null 则回退到服务器检查。
   */
  localGrade?(
    exercise: Record<string, any>,
    ans: Record<string, any>,
    prev: { correctQs: Set<number>; attempts: Record<number, any[]> },
    taskId: number,
  ): LocalGradeResult | null;

  // ── 学生端：数据充实 ──

  /**
   * 将 API 返回的 ExerciseSpec 转换为 TaskExercise 组件字段。
   * 当练习数据从后端 API 到达时调用。
   * 就地修改 exercise 对象以添加组件特定字段。
   */
  enrichFromApi?(exercise: Record<string, any>, spec: Record<string, any>): void;

  /**
   * 将 manifest answerKey 转换为 TaskExercise 字段（离线/回退模式）。
   * 直接使用 manifest 数据而非 API 响应时使用。
   */
  enrichFromManifest?(exercise: Record<string, any>, answerKey: Record<string, any>): void;

  // ── 教师端：观察 ──

  /**
   * 教师观察抽屉 — 全班概览。
   * 渲染聚合统计、逐项分析、学生表格。
   * 可选：没有观察视图的类型（如 fill-blank）省略此字段。
   */
  readonly ObserveClassView?: React.ComponentType<ObserveClassViewProps>;

  /**
   * 教师观察抽屉 — 单个学生详情。
   * 当教师点击学生行时渲染逐学生明细。
   * 如果提供了 ObserveClassView 则此字段必需。
   */
  readonly ObserveStudentView?: React.ComponentType<ObserveStudentViewProps>;

  /**
   * 发送到后端 API 的观察类型键。
   * 通常与 `type` 匹配，但允许重映射（例如 'quiz' → 'mc'，
   * 'rich-content-quiz' → 'image-upload' 以复用处理器）。
   * 省略时默认为 `type`。
   */
  readonly observeType?: string;
}
```

### 4.2 注册表

前端使用简单的 Map + 副作用导入模式（无需 React Context）：

```typescript
// frontend/src/components/student/exercise/exercise-type-registry.ts

import type { ExerciseUIPlugin } from './exercise-type-plugin';

const registry = new Map<string, ExerciseUIPlugin>();

/** 注册一个练习类型插件（在模块加载时调用） */
export function registerExerciseType(plugin: ExerciseUIPlugin): void {
  if (registry.has(plugin.type)) {
    console.warn(`[ExerciseRegistry] 重复的类型 "${plugin.type}" — 将覆盖`);
  }
  registry.set(plugin.type, plugin);
}

/** 按类型获取插件 */
export function getExerciseType(type: string): ExerciseUIPlugin | undefined {
  return registry.get(type);
}

/** 获取所有已注册类型 */
export function getRegisteredTypes(): string[] {
  return [...registry.keys()];
}
```

**注册时机**：

```typescript
// frontend/src/components/student/exercise/built-in.ts
// 副作用导入 — 注册所有内置类型

import { registerExerciseType } from './exercise-type-registry';
import { quizPlugin } from './plugins/quiz.plugin';
import { matchPlugin } from './plugins/match.plugin';
// ... 11 种类型

registerExerciseType(quizPlugin);
registerExerciseType(matchPlugin);
// ...
```

```typescript
// frontend/src/main.tsx（或 App.tsx）
import './components/student/exercise/built-in';  // 注册所有内置类型
```

**扩展包加载**：

```typescript
// 扩展包：exercise-pack-math/frontend/index.ts
import { registerExerciseType } from '@live-lesson/exercise-type-registry';
import { longDivisionPlugin } from './long-division.plugin';
registerExerciseType(longDivisionPlugin);

// 在 main.tsx 中加载扩展包
import 'exercise-pack-math/frontend';
```

### 4.3 PracticePhase 重构

#### 之前（当前）

```
10 个按类型的 useState:
  wrongQs, correctQs, matrixAns, matrixRowResults,
  mapFeedback, mapItemResults, imageUploadFeedback,
  imageUploadRubricResults, fillBlankResults, gdStepResults

canSub():            if/else × 11 种类型（45 行）
handleCheckResult(): if/else × 11 种类型（120 行）
render():            {ex.type === 'xxx' && <Xxx />} × 11（130 行）
```

#### 之后（插件化）

```typescript
// PracticePhase.tsx — 简化版

const plugin = getExerciseType(ex.type);
if (!plugin) return <div>未知的练习类型: {ex.type}</div>;

// 1 个不透明状态包替代 10 个按类型的 useState
const [checkResultState, setCheckResultState] = useState<Record<string, any>>({});

const canSub = () => plugin.canSubmit(ex, ans, checkResultState);

const handleCheckResult = (result: CheckResult) => {
  const output = plugin.handleCheckResult(result, ex, { ans, attempts, correctQs });
  setCheckResultState(output.checkResultState);
  if (output.allDone) { setAllDone(true); onDone(); }
  if (output.softDone) setSoftDone(true);
  if (output.clearAnsKeys) {
    const cleared = { ...ans };
    output.clearAnsKeys.forEach(k => delete cleared[k]);
    setAns(cleared);
  }
};

// 渲染 — 1 行替代 130 行条件渲染
<plugin.Component
  exercise={ex}
  ans={ans}
  setAns={guardedSetAns}
  allDone={effectiveAllDone}
  reviewData={reviewPayload}
  checkResultState={checkResultState}
  onDone={onDone}
  stepIdx={stepIdx}
  taskId={taskId}
  onOverlayChange={onOverlayChange}
  onScaffoldPush={onScaffoldPush}
  submit={ctx.submit}
  studentId={ctx.studentId}
  sessionCode={ctx.sessionCode}
/>

// 提交按钮
{!plugin.selfManagedSubmit && (
  <button onClick={handleSubmit} disabled={!canSub() || submitting}>
    {submitting ? t('practice.checking') : t('practice.submit')}
  </button>
)}
```

### 4.4 ObserveDrawer 重构

#### 之前（当前）

```typescript
// ObserveDrawer.tsx — 7 个条件渲染块 × 2（ClassView + StudentView）
{type === 'mc' && <McClassView data={data} onStudentSelect={...} />}
{type === 'evidence' && <EvidenceClassView data={data} onStudentSelect={...} />}
{type === 'map' && <MapClassView data={mapData!} onStudentSelect={...} />}
{type === 'discuss' && <DiscussClassView data={data} onStudentSelect={...} />}
{type === 'matrix' && <MatrixClassView data={data} onStudentSelect={...} />}
{type === 'image-upload' && <ImageUploadClassView data={data} onStudentSelect={...} />}
{type === 'guided-discovery' && <GdClassView data={data} onStudentSelect={...} />}
// ... 同样 7 个 StudentView 块
```

#### 之后（插件化）

```typescript
// ObserveDrawer.tsx — 1 行替代 14 个条件渲染块
const plugin = getExerciseType(exerciseType);
const observeType = plugin?.observeType ?? exerciseType;

// 使用 observeType 获取观察数据（处理 quiz→mc 等重映射）
const { data } = useFetch(`/api/classroom/${code}/steps/${step}/observe/${observeType}`);

// ClassView — 由插件提供，或回退到"暂无观察视图"
{plugin?.ObserveClassView ? (
  <plugin.ObserveClassView data={data} onStudentSelect={setSelectedStudent} />
) : (
  <div className="observe-empty">此练习类型暂无观察视图</div>
)}

// StudentView
{selectedStudent && plugin?.ObserveStudentView && (
  <plugin.ObserveStudentView data={data} studentId={selectedStudent} />
)}
```

**`observeType` 别名机制**：

| 插件类型 | `observeType` | 说明 |
|---------|---------------|------|
| `quiz` | `'mc'` | 后端观察处理器注册为 `mc` |
| `rich-content-quiz` | `'image-upload'` | 复用 image-upload 的观察处理器 |
| `match` | `'mc'` | 复用 mc 处理器（类似的条目结构） |
| 其他 | 默认 `= type` | 无需别名 |

这解决了之前"多对一映射"的问题——共享由 `observeType` 字段声明，不需要在注册表层做回退。

### 4.5 TaskExercise 类型变为开放

```typescript
// task-data.ts — 之后
export interface TaskExercise {
  type: string;    // ← 从联合字面量改为 string
  label: string;
  [key: string]: any;  // 插件特定字段
}
```

---

## 5. 扩展包结构

```
packages/exercise-pack-math/
├── backend/
│   ├── index.ts                          # NestJS Module: LongDivisionModule
│   └── plugins/
│       ├── long-division.plugin.ts       # @Injectable() @ExerciseType('long-division')
│       ├── long-division.schema.ts       # AnswerKey + ExerciseSpec schemas
│       └── long-division.observe.ts      # @Injectable() @ObserveType('long-division')
├── frontend/
│   ├── index.ts                          # registerExerciseType() 副作用导入
│   ├── long-division.plugin.ts           # ExerciseUIPlugin（含 ObserveClassView/StudentView）
│   ├── LongDivisionExercise.tsx          # 学生练习组件
│   ├── LongDivisionClassView.tsx         # 教师观察 — 全班视图
│   └── LongDivisionStudentView.tsx       # 教师观察 — 单个学生视图
├── package.json
└── README.md
```

### 5.1 后端加载

```typescript
// backend/src/classroom/classroom.module.ts
import { LongDivisionModule } from 'exercise-pack-math/backend';

@Module({
  imports: [
    // ... 现有导入
    LongDivisionModule,  // 自动发现 @ExerciseType('long-division')
  ],
})
export class ClassroomModule {}
```

扩展包的 Module 只需要导出 `@Injectable()` + `@ExerciseType()` provider，注册表在 `onModuleInit()` 时自动发现。

### 5.2 前端加载

```typescript
// frontend/src/main.tsx
import './components/student/exercise/built-in';  // 内置 11 种类型
import 'exercise-pack-math/frontend';             // 扩展包注册
```

### 5.3 零核心修改

| 层 | 核心修改 | 扩展包提供 |
|----|---------|-----------|
| AnswerKey 验证 | 无（注册表动态组合） | `answerKeySchema` |
| 数据脱敏器 | 无（注册表分发） | `sanitize()` |
| 评分器 | 无（注册表分发） | `grade()` |
| 检查项 | 无（注册表分发） | `buildCheckItems()` |
| ExerciseSpec | 无（`z.string()` + `.passthrough()`） | 自定义字段 |
| 观察处理器（后端） | 无（已是自动发现） | `@ObserveType` 处理器 |
| 观察抽屉（前端） | 无（`<plugin.ObserveClassView />`） | ClassView + StudentView 组件 |
| 前端渲染 | 无（`<plugin.Component />`） | React 组件 |
| 前端逻辑 | 无（`plugin.canSubmit` 等） | 插件方法 |
| 前端数据充实 | 无（`plugin.enrichFromApi` 等） | 充实方法 |

---

## 6. 11 种类型兼容性分析

> 基于审计（2026-05），对全部 11 种现有类型按插件适配难度分组。

### 6.1 后端兼容性 — 全部通过

| 类型 | 同步/异步 | 需要依赖注入 | 适配 `ExerciseTypePlugin.grade(ctx)` |
|------|----------|-------------|--------------------------------------|
| quiz | 同步 | 否 | ✅ 直接适配 |
| match | 同步 | 否 | ✅ 直接适配 |
| order | 同步 | 否 | ✅ 直接适配 |
| stance | 同步 | 否 | ✅ 直接适配 |
| select-evidence | 同步 | 否 | ✅ 直接适配 |
| matrix | 异步 | AiPromptBuilder（可选） | ✅ `@Injectable()` 自动注入 |
| fill-blank | 异步 | AiPromptBuilder（可选） | ✅ 同上 |
| map | 异步 | AiPromptBuilder（可选） | ✅ 同上 |
| image-upload | 异步 | AiPromptBuilder（**必需**） | ✅ 同上 |
| rich-content-quiz | 异步 | AiPromptBuilder（**必需**） | ✅ 同上 |
| guided-discovery | 异步 | AiPromptBuilder（可选） | ✅ 同上 |

**特殊情况**：`rich-content-quiz` 当前复用 `ImageUploadGrader`。插件化后 `RichContentQuizPlugin.grade()` 直接内联相同逻辑或导入共享函数即可。

所有 11 种脱敏函数签名一致（`ak → Record`），所有 11 个 `buildCheckItems` 分支签名一致（`ak, data, gradeResult → items[]`）。可直接搬入插件。

### 6.2 前端分组

#### A 组 — 简单受控（5 种）

标准 `setAns` + `canSubmit` + `handleCheckResult` 模式，无需特殊处理。

| 类型 | canSubmit 逻辑 | handleCheckResult 要点 |
|------|---------------|----------------------|
| quiz | `!questions.some(未答 && !correctQs.has)` | correctQs/wrongQs/serverHints → 清除答案 |
| match | 同 quiz | 同 quiz |
| stance | `ans.stance && evidence.length≥1` | 软完成 |
| order | `order.length === items.length` | 错误位置 → 清除答案 |
| fill-blank | `所有空格已填` | blankResults → 状态 |

`checkResultState` 存放 correctQs/wrongQs/feedback 等。

#### B 组 — 受控但有额外状态（3 种）

| 类型 | 特殊点 | 插件化方案 |
|------|--------|-----------|
| matrix | `onAnsChange(ri, field, val)` | 组件内部包装 `setAns` → `onAnsChange`；`rowResults` 存入 checkResultState |
| map | `onActiveChange` 回调 + feedback + itemResults | feedback/itemResults 存入 checkResultState；`onOverlayChange` 从平台属性获取 |
| image-upload | feedback + rubricResults + "继续讨论" 按钮 | feedback/rubricResults 存入 checkResultState |

Matrix 不再需要 PracticePhase 持有 `matrixAns` 独立状态。插件化后 MatrixExercise 内部用 `setAns` 管理 `{ rows: { [ri]: { what, why } } }`，`formatSubmitData` 从 `ans.rows` 读取数据。

#### C 组 — 自管理提交（3 种）

| 类型 | 特殊点 | 插件化方案 |
|------|--------|-----------|
| select-evidence | 自带 `onSubmit`/`onDone`；客户端判分 | `selfManagedSubmit=true`；`serverCheck=false`；`onDone` 从平台属性获取 |
| rich-content-quiz | 最复杂：多部分状态机 + 脚手架 + `ctx.submit()` | `selfManagedSubmit=true`；`submit`/`onScaffoldPush`/`stepIdx`/`taskId` 从平台属性获取 |
| guided-discovery | 多步骤渐进 + 混合判分 | `selfManagedSubmit=true`；组件完全管理自己的提交流程 |

### 6.3 审计发现的 5 个接口修正（已应用到 §4.1）

1. **遗漏扩展点 F8**：`enrich-exercise.ts` 是第 8 个前端扩展点 → 增加 `enrichFromApi`/`enrichFromManifest` 方法
2. **`canSubmit` 签名不够**：quiz/match 需要 `correctQs` 判断已答对题目 → 增加 `checkResultState` 参数
3. **`ExercisePluginProps` 缺平台能力**：不同组件需要 `onOverlayChange`/`onScaffoldPush`/`submit` 等回调 → 增加平台能力层
4. **Matrix `onAnsChange` 不走 `setAns`**：可内化，组件内部包装 `setAns`，无需改接口
5. **`formatSubmitData` 需要 `checkResultState`**：quiz/match 提交时附带 `attemptCounts` → 增加 `checkResultState` 参数

---

## 7. 迁移路径

### 阶段 0：基础设施（零行为变化）

**目标**：引入接口 + 注册表 + 装饰器，不改变任何现有行为。

**步骤**：
1. 创建 `ExerciseTypePlugin` 接口（后端）
2. 创建 `@ExerciseType()` 装饰器
3. 创建 `ExerciseTypeRegistry`（`onModuleInit` 自动发现）
4. 在 `ClassroomModule` 注册 `ExerciseTypeRegistry`
5. 创建前端 `ExerciseUIPlugin` 接口（含 `ObserveClassView` / `ObserveStudentView`）+ 注册表
6. 编写测试验证注册表初始化（0 个插件时不崩溃）

**验证**：所有现有测试通过，注册表日志显示 0 个注册类型。

### 阶段 1：迁移 quiz + match + order（A 组最简单的 3 种）

**原因**：纯受控、无依赖注入（评分器是纯函数），是最简单的迁移起点。

**步骤**：
1. 创建 `QuizPlugin`、`MatchPlugin`、`OrderPlugin`（`@Injectable() @ExerciseType('quiz')`）
2. 在现有代码中添加回退逻辑：

```typescript
// GradingService.grade() — 迁移期
async grade(rawKey: unknown, data: Record<string, unknown>): Promise<GradeResult | null> {
  // 优先使用注册表
  const pluginResult = await this.registry.grade(rawKey, data);
  if (pluginResult) return pluginResult;
  // 回退到旧逻辑
  return this.legacyGrade(rawKey, data);
}
```

3. 创建前端 `quizPlugin`、`matchPlugin`、`orderPlugin`
4. 在 `PracticePhase` 中添加插件分支：

```typescript
const plugin = getExerciseType(ex.type);
if (plugin) {
  return <PluginExerciseWrapper plugin={plugin} ... />;
}
// 回退到现有条件渲染
```

**验证**：
- E2E：`04-exercise-check.spec.ts`（quiz 评分）
- 手动：完整 quiz + match + order 流程

### 阶段 2：迁移 stance + fill-blank（A 组剩余）

纯受控，无依赖注入，略有不同的状态模式（stance 有软完成，fill-blank 有 blankResults）。

**每个类型的步骤**：同阶段 1。

### 阶段 3：迁移 matrix + map + image-upload（B 组）

有 `checkResultState` 反馈 + AI 评分。插件是 `@Injectable()`，NestJS 自动注入 `AiPromptBuilder`，比当前 `new XxxGrader(aiPromptBuilder)` 更干净。

**额外工作**：
- Matrix：内化 `matrixAns` 状态 → 使用 `setAns` 管理 `{ rows: {...} }`
- Map：`onOverlayChange` 从平台属性获取
- image-upload：feedback/rubricResults 存入 checkResultState

### 阶段 4：迁移 select-evidence（C 组客户端判分）

`selfManagedSubmit=true` + `serverCheck=false`。组件管理自己的提交和判分逻辑。

### 阶段 5：迁移 rich-content-quiz + guided-discovery（C 组最复杂）

最复杂的两种类型：
- `rich-content-quiz`：多部分状态机 + 脚手架 + `ctx.submit()`
- `guided-discovery`：多步骤渐进 + 混合判分

两者都设为 `selfManagedSubmit=true`，从平台属性获取所需回调。

### 阶段 6：删除遗留代码

当所有 11 个类型都迁移完成后：
1. 删除 `GradingService.graders` 字典 + 旧导入
2. 删除 `manifest.utils.ts` 中的 `sanitizers` 字典
3. 删除 `buildCheckItems()` 中的 `switch` 块
4. 删除 `ExerciseSpecSchema` 中的硬编码 `z.enum`
5. 删除 `PracticePhase` 中的 11 个条件渲染块
6. 删除 `canSub()` 和 `handleCheckResult()` 中的 if/else
7. 删除 `ObserveDrawer` 中的 14 个条件渲染块（7 个 ClassView + 7 个 StudentView）
8. 删除 `TaskExercise` 中的联合字面量类型
9. 更新 `AnswerKeySchema` 为注册表动态组合

### 阶段 7：示例扩展包 + 文档

1. 创建 `exercise-pack-example`（包含一个简单的自定义类型）
2. 编写开发者文档：如何创建扩展包
3. 编写 API 参考：插件接口各方法的约束
4. 更新 CLAUDE.md 中的相关描述

---

## 8. 关键设计决策

| 决策 | 选择 | 备选方案 | 理由 |
|------|------|----------|------|
| **单一插件接口** | ✅ `ExerciseTypePlugin` 含 sanitize + grade + buildCheckItems | 4 个独立注册表（SanitizerRegistry、GraderRegistry 等） | 防遗漏；一个类 = 一个类型的完整逻辑；IDE 导航友好 |
| **后端观察处理器保持独立** | ✅ 不合并入 `ExerciseTypePlugin` | 合并为插件的 `compute()` 方法 | 关注点不同（全班聚合 vs 单学生交互）；已有自动发现；多对一映射 |
| **前端观察纳入 `ExerciseUIPlugin`** | ✅ `ObserveClassView` + `ObserveStudentView` 字段 | 独立的 `TeacherObservePlugin` 注册表 | 一个插件 = 一个类型在全栈的完整定义；扩展包无需注册多个注册表 |
| **`observeType` 别名** | ✅ 插件声明 `observeType?: string` | ObserveDrawer 内置回退映射 | 显式声明优于隐式规则；扩展包可以声明复用已有观察处理器 |
| **前端用副作用导入** | ✅ `import './built-in'` | React Context Provider | 更简单；注册发生在模块加载时；不需要 React 树 |
| **`checkResultState` 泛型包** | ✅ `Record<string, any>` | 按类型 useState | 类型安全下沉到插件内部；PracticePhase 只负责存储/传递 |
| **迁移期注册表 + 回退共存** | ✅ 插件 → 旧逻辑回退 | 一次性迁移 | 增量迁移、安全回滚；每个阶段都可以独立验证 |
| **ExerciseSpec 改为开放 schema** | ✅ `z.string()` + `.passthrough()` | 保持封闭枚举 | 扩展包不需要修改核心 schema；类型安全在插件内部保证 |
| **插件是 @Injectable()** | ✅ NestJS IoC 管理 | 手动实例化 | 自动依赖注入（AiPromptBuilder 等）；生命周期由框架管理 |
| **AnswerKeySchema 动态组合** | ✅ 注册表从插件 schema 构建 `z.union` | 保持静态联合 | 扩展包无需修改核心 schema 文件 |

---

## 附录 A：当前代码参考

### A.1 AnswerKey Schema（封闭联合）

```typescript
// backend/src/schemas/answer-key.schema.ts:370-382
export const AnswerKeySchema = z.union([
  QuizAnswerKeySchema,
  MatchAnswerKeySchema,
  MatrixAnswerKeySchema,
  StanceAnswerKeySchema,
  OrderAnswerKeySchema,
  SelectEvidenceAnswerKeySchema,
  MapAnswerKeySchema,
  ImageUploadAnswerKeySchema,
  RichContentQuizAnswerKeySchema,
  FillBlankAnswerKeySchema,
  GuidedDiscoveryAnswerKeySchema,
]);
```

### A.2 脱敏器字典（手动注册）

```typescript
// backend/src/schemas/manifest.utils.ts:35-47
const sanitizers: Record<string, (ak: AKInput) => ExerciseSpec> = {
  quiz: sanitizeQuiz,
  match: sanitizeMatch,
  matrix: sanitizeMatrix,
  stance: sanitizeStance,
  order: sanitizeOrder,
  'select-evidence': sanitizeSelectEvidence,
  map: sanitizeMap,
  'image-upload': sanitizeImageUpload,
  'rich-content-quiz': sanitizeRichContentQuiz,
  'fill-blank': sanitizeFillBlank,
  'guided-discovery': sanitizeGuidedDiscovery,
};
```

### A.3 评分器字典（手动注册 + 手动依赖注入）

```typescript
// backend/src/classroom/exercise/grading.service.ts:22-34
constructor(private readonly aiPromptBuilder: AiPromptBuilder) {
  this.graders = {
    quiz: new QuizGrader(),
    match: new MatchGrader(),
    matrix: new MatrixGrader(aiPromptBuilder),
    stance: new StanceGrader(),
    order: new OrderGrader(),
    'select-evidence': new SelectEvidenceGrader(),
    map: new MapGrader(aiPromptBuilder),
    'image-upload': new ImageUploadGrader(aiPromptBuilder),
    'rich-content-quiz': new ImageUploadGrader(aiPromptBuilder),
    'fill-blank': new FillBlankGrader(aiPromptBuilder),
    'guided-discovery': new GuidedDiscoveryGrader(aiPromptBuilder),
  };
}
```

### A.4 评分器接口（当前）

```typescript
// backend/src/classroom/exercise/graders/grader.interface.ts
export interface Grader {
  grade(key: AnswerKey, data: Record<string, unknown>): GradeResult | Promise<GradeResult>;
}
```

### A.5 观察处理器装饰器（参考实现）

```typescript
// backend/src/classroom/observe/observe-handler.interface.ts
export const OBSERVE_TYPE_KEY = 'OBSERVE_TYPE';
export function ObserveType(type: string): ClassDecorator {
  return SetMetadata(OBSERVE_TYPE_KEY, type);
}
```

### A.6 ObserveDrawer 条件渲染（硬编码分发）

```typescript
// frontend/src/components/teacher/observe/ObserveDrawer.tsx:147-154
{type === 'mc' && <McClassView data={data} onStudentSelect={...} />}
{type === 'evidence' && <EvidenceClassView data={data} onStudentSelect={...} />}
{type === 'map' && <MapClassView data={mapData!} onStudentSelect={...} />}
{type === 'discuss' && <DiscussClassView data={data} onStudentSelect={...} />}
{type === 'matrix' && <MatrixClassView data={data} onStudentSelect={...} />}
{type === 'image-upload' && <ImageUploadClassView data={data} onStudentSelect={...} />}
{type === 'guided-discovery' && <GdClassView data={data} onStudentSelect={...} />}
// ... 同样 7 个 StudentView 块
```

### A.7 前端类型联合（硬编码）

```typescript
// frontend/src/components/student/task-data.ts:82-83
export interface TaskExercise {
  type: 'quiz' | 'match' | 'matrix' | 'stance' | 'order' | 'select-evidence'
       | 'map' | 'image-upload' | 'fill-blank' | 'rich-content-quiz' | 'guided-discovery'
  // ...
}
```
