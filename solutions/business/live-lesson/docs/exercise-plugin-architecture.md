# Exercise Type Plugin Architecture

> 设计文档 — 从手动注册到自注册插件的全栈架构重构蓝图
>
> **⚠️ 历史路径注记 (2026-05):** 本文档是 plugin 系统 *最初* 的设计文档,
> 文中很多 `backend/src/classroom/exercise/plugins/<type>.plugin.ts` 等路径反映的是
> 文档撰写时的目录布局。一次后续的 clean-architecture 重构已经把后端整体迁移到
> `domain/` + `application/` + `adapters/` + `infra/` 四层结构 —
>   - per-type 文件全部进入 `backend/src/domain/exercise-types/<type>/`
>   - registry / use cases 在 `application/`
>   - controllers / entities / observer 在 `adapters/`
>   - NestJS 模块 wiring 在 `infra/`
>
> 路径速查请看 [CLAUDE.md](../CLAUDE.md) "Backend Architecture" 表 + [component-development-guide.md](./component-development-guide.md)。
> 本文档的 *设计契约* (auto-discovery、composed schema、registry dispatch) 没变 — 只是文件位置变了。

## 1. Problem Statement

### 1.1 当前 11 种练习类型

| Type | 中文名 |
|------|--------|
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
| B2 | Sanitizer | `backend/src/schemas/manifest.utils.ts:35-47` | `sanitizers` 手动 dict dispatch |
| B3 | Grader | `backend/src/classroom/exercise/grading.service.ts:22-34` | `this.graders` 手动 dict + constructor 注入 |
| B4 | CheckItems builder | `backend/src/classroom/exercise/build-check-items.ts:16-185` | `switch(ak.type)` 186 行 |
| B5 | ExerciseSpec type enum | `backend/src/schemas/exercise-spec.schema.ts:4` | 硬编码 `z.enum([...11 types])` |
| B6 | ObserveHandler | `backend/src/classroom/observe/observe-registry.ts` | **已是 auto-discovery** ✓ |

#### 前端扩展点

| # | 扩展点 | 文件 | 当前模式 |
|---|--------|------|----------|
| F1 | 学生练习渲染 | `PracticePhase.tsx:438-567` | 11 个 `{ex.type === 'xxx' && <XxxExercise />}` 块 |
| F2 | canSubmit | `PracticePhase.tsx:112-157` | `if/else` per type |
| F3 | handleCheckResult | `PracticePhase.tsx:270-391` | `if/else` per type（120 行） |
| F4 | formatSubmitData | `exercise/gradeItemSet.ts` | per-type format logic |
| F5 | TaskExercise type | `task-data.ts:82` | 硬编码 union literal `'quiz' | 'match' | ... | 'guided-discovery'` |
| F6 | 教师观察 ClassView | `teacher/observe/ObserveDrawer.tsx:147-154` | 7 个 `{type === 'xxx' && <XxxClassView />}` 条件渲染 |
| F7 | 教师观察 StudentView | `teacher/observe/ObserveDrawer.tsx:178-185` | 7 个 `{type === 'xxx' && <XxxStudentView />}` 条件渲染 |
| F8 | Exercise enrichment | `exercise/enrich-exercise.ts:415-427` | 手动 handler registry（`fromApi` + `fromManifest`） |

### 1.3 新增练习类型 Checklist（当前 ~14 步）

1. 定义 AnswerKey schema（`answer-key.schema.ts`）
2. 加入 `AnswerKeySchema` union
3. 写 sanitizer 函数 + 注册到 `sanitizers` dict
4. 写 grader class + 注册到 `GradingService.graders` dict
5. 写 `buildCheckItems` case
6. 扩展 `ExerciseSpecSchema.type` enum
7. 写前端 Exercise 组件
8. 在 `PracticePhase.tsx` 添加条件渲染块
9. 在 `canSub()` 添加 if 分支
10. 在 `handleCheckResult()` 添加 if 分支
11. 扩展 `TaskExercise.type` union literal
12. 写后端 ObserveHandler（`@ObserveType` — 已是 auto-discovery）
13. 写前端 `XxxClassView` + `XxxStudentView` observe 组件
14. 在 `ObserveDrawer.tsx` 添加条件渲染块
15. 在 `enrich-exercise.ts` 添加 `fromApi` + `fromManifest` handler

### 1.4 痛点总结

- **手动注册**：遗漏任何一步都会导致运行时错误，且编译器无法捕获
- **知识分散**：一种类型的逻辑散布在 10+ 文件中，新开发者需要全局搜索才能理解
- **ExerciseSpec 类型不安全**：所有类型的字段平铺在一个 `z.object` 中（150 行），全部 optional，编译器无法约束"quiz 必须有 questions"
- **DI 不统一**：部分 grader（matrix, map, image-upload）需要 `AiPromptBuilder`，但因为是手动 `new`，只能通过 constructor 手工传入
- **扩展包不可能**：任何新类型必须修改 core 代码

---

## 2. Architecture Overview

### 2.1 核心概念

整个系统围绕 `type` 字段构建 **Type Object** 模式：

```
manifest.answerKey.type  →  后端 sanitize / grade / buildCheckItems
exerciseSpec.type        →  前端 render / canSubmit / handleCheckResult
```

**目标**：将 `type` 从 "需要手动注册的 dispatch key" 升级为 "自注册插件的 discovery key"。

### 2.2 从手动注册到自注册插件

```
Before:  type → 手动 dict[type]    →  散布在 10 个文件
After:   type → registry.get(type)  →  集中在 1 个 Plugin 类/文件
```

### 2.3 参考模式：ObserveRegistry

`ObserveRegistry`（`observe-registry.ts`）已经实现了 auto-discovery 模式：

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

## 3. Backend Plugin System

### 3.1 Plugin Interface

```typescript
// backend/src/classroom/exercise/exercise-type-plugin.interface.ts

import { z } from 'zod';
import type { GradeResult } from '../../schemas';

/** Context passed to the grade() method */
export interface GradeContext {
  key: Record<string, unknown>;       // parsed answer key (plugin knows its shape)
  data: Record<string, unknown>;       // student submission data
}

/** Context passed to buildCheckItems() */
export interface CheckItemContext {
  key: Record<string, unknown>;
  data: Record<string, unknown>;
  gradeResult: GradeResult;
}

/** Context passed to sanitize() */
export interface SanitizeContext {
  answerKey: Record<string, unknown>;
  exerciseLabel?: string;
  practiceItemIds?: string[];
}

/**
 * Single interface for an exercise type plugin.
 * One class = one type's complete backend logic.
 */
export interface ExerciseTypePlugin {
  /** Unique type identifier, e.g. 'quiz', 'match', 'long-division' */
  readonly type: string;

  /** Zod schema for validating this type's answerKey (must include `type: z.literal(...)`) */
  readonly answerKeySchema: z.ZodType<any>;

  /**
   * Strip answer data from answerKey before sending to student.
   * Returns student-safe ExerciseSpec fields (excluding `type` and `label`, which are added by the registry).
   */
  sanitize(ctx: SanitizeContext): Record<string, unknown> | null;

  /**
   * Grade student submission against answer key.
   * May be async for AI-graded types.
   */
  grade(ctx: GradeContext): GradeResult | Promise<GradeResult>;

  /**
   * Build per-item check feedback from answer key + submission + grade result.
   * Returns array of { idx, correct, hint?, ... } items.
   */
  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>>;
}
```

**设计决策 — 为什么是单一接口而不是 4 个独立 registry**：

- 遗漏风险：4 个 registry 意味着新增类型可能注册了 grader 但忘了 sanitizer
- 共享上下文：sanitize/grade/buildCheckItems 经常需要理解同一个 schema 结构
- IDE 导航：一个类 = 一个类型的完整后端逻辑，`Cmd+click` 即达

### 3.2 装饰器

```typescript
// backend/src/classroom/exercise/exercise-type.decorator.ts

import { SetMetadata } from '@nestjs/common';

export const EXERCISE_TYPE_KEY = 'EXERCISE_TYPE';

/**
 * Mark a class as an exercise type plugin.
 * The registry auto-discovers all providers with this metadata.
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

### 3.3 Registry

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
          this.logger.warn(`Duplicate exercise type "${type}" — overwriting`);
        }
        this.plugins.set(type, plugin);
        this.logger.log(`Registered exercise type "${type}": ${wrapper.metatype.name}`);
      }
    }

    // Compose dynamic AnswerKey schema from all registered plugins
    this.composedSchema = this.buildComposedSchema();
    this.logger.log(`Composed AnswerKeySchema with ${this.plugins.size} types: [${this.getRegisteredTypes().join(', ')}]`);
  }

  /** Get a specific plugin by type */
  get(type: string): ExerciseTypePlugin | undefined {
    return this.plugins.get(type);
  }

  /** All registered type strings */
  getRegisteredTypes(): string[] {
    return [...this.plugins.keys()];
  }

  /** Dynamically composed z.union from all registered answerKeySchemas */
  getAnswerKeySchema(): z.ZodType<any> {
    if (!this.composedSchema) throw new Error('Registry not initialized');
    return this.composedSchema;
  }

  /** Validate an answerKey against the composed schema */
  validateAnswerKey(ak: unknown): { valid: boolean; errors: string[] } {
    const result = this.getAnswerKeySchema().safeParse(ak);
    if (result.success) return { valid: true, errors: [] };
    return { valid: false, errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) };
  }

  /** Sanitize an answerKey using the appropriate plugin */
  sanitize(ctx: SanitizeContext): Record<string, unknown> | null {
    const type = (ctx.answerKey as any)?.type;
    if (!type) return null;
    const plugin = this.plugins.get(type);
    if (!plugin) return null;
    const spec = plugin.sanitize(ctx);
    if (!spec) return null;
    return { ...spec, type, label: ctx.exerciseLabel || (ctx.answerKey as any).label || '' };
  }

  /** Grade using the appropriate plugin */
  async grade(rawKey: unknown, data: Record<string, unknown>): Promise<GradeResult | null> {
    const parsed = this.getAnswerKeySchema().safeParse(rawKey);
    if (!parsed.success) return null;
    const key = parsed.data;
    const plugin = this.plugins.get(key.type);
    if (!plugin) return null;
    return plugin.grade({ key, data });
  }

  /** Build check items using the appropriate plugin */
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

### 3.4 Plugin 示例：Quiz

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
  { message: 'quiz: correct index must be < options.length' },
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

### 3.5 DI 依赖处理

需要 AI 能力的 Plugin 正常使用 NestJS `@Injectable()` + constructor injection：

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

**对比当前模式**：`GradingService` 手动 `new MatrixGrader(aiPromptBuilder)`。Plugin 模式下 NestJS 自动注入，无需手工传参。

### 3.6 后端 ObserveHandler 保持独立

后端 `ObserveHandler`（数据聚合 + 统计）保持独立 registry，**不合并入 `ExerciseTypePlugin`**：

1. **关注点不同**：ObserveHandler 聚合全班提交数据 → 统计视图，Plugin 处理单个学生的验证 + 评分 + 反馈
2. **多对一映射**：`rich-content-quiz` 复用 `image-upload` 的 ObserveHandler。合并后这种共享用 `observeType` 别名解决（见 4.1）
3. **已经是 auto-discovery**：`@ObserveType` 装饰器 + `DiscoveryService` 已经工作良好，扩展包直接加 handler 即可
4. **节奏不同**：并非所有类型都需要 ObserveHandler（如 `fill-blank` 目前返回空数据）

**前端 observe 组件则纳入 `ExerciseUIPlugin`**（见 4.1）——教师 observe drawer 通过 plugin registry 查找 ClassView / StudentView，实现扩展包新类型自动出现在教师端。

### 3.7 ExerciseSpec 变为 Open Schema

当前 `ExerciseSpecSchema` 是一个 150 行的 flat object，所有类型的字段都平铺在一起。插件化后改为开放 schema：

```typescript
// exercise-spec.schema.ts — after plugin migration

export const ExerciseSpecSchema = z.object({
  type: z.string(),   // ← 从 z.enum([...]) 改为 z.string()
  label: z.string(),
}).passthrough();       // ← 允许插件自定义字段

export type ExerciseSpec = z.infer<typeof ExerciseSpecSchema>;
```

**权衡**：类型安全从全局 schema 下沉到每个 plugin 内部。Plugin 内部的 sanitize 返回值是强类型的，只是 registry 层面用 `Record<string, unknown>` 传输。

---

## 4. Frontend Plugin System

### 4.1 Plugin Interface

```typescript
// frontend/src/components/student/exercise/exercise-type-plugin.ts

import type { CheckResult } from '../../../hooks/useClassroom';

/** Props passed to every exercise component */
export interface ExercisePluginProps {
  // ── Core (all types get these) ──
  exercise: Record<string, any>;       // type-specific ExerciseSpec fields
  ans: Record<string, any>;
  setAns: (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  allDone: boolean;
  reviewData?: { data: Record<string, unknown>; checkItems?: Array<Record<string, unknown>> };
  /** Opaque state bag from handleCheckResult — plugin stores/reads its own state */
  checkResultState: Record<string, any>;

  // ── Platform capabilities (PracticePhase always provides; component uses if needed) ──
  onDone: () => void;
  stepIdx?: number;
  taskId?: number;
  locale?: string;

  // ── Optional capabilities (only passed when parent supports them) ──
  /** Overlay control for text annotations (used by select-evidence, map) */
  onOverlayChange?: (overlay: { paragraphIdx: number; tokens: any[] } | null) => void;
  /** Push scaffold hints to the sidebar (used by rich-content-quiz) */
  onScaffoldPush?: (hint: Record<string, any>) => void;
  /** Submit step data to the session (used by rich-content-quiz) */
  submit?: (step: number, data: Record<string, any>) => void;
  studentId?: string;
  sessionCode?: string;
}

/** Result of handleCheckResult() */
export interface CheckResultHandlerOutput {
  /** Opaque state bag — stored in PracticePhase, passed back to Component */
  checkResultState: Record<string, any>;
  /** Exercise fully completed */
  allDone: boolean;
  /** Soft completion (e.g. matrix/map: submitted, maybe not 100%) */
  softDone: boolean;
  /** Keys to clear from ans after wrong answers (for quiz/match retry) */
  clearAnsKeys?: (string | number)[];
}

/** Result of local grading (for types that don't need server check) */
export interface LocalGradeResult {
  allDone: boolean;
  softDone: boolean;
  correctQs?: Set<number>;
  wrongQs?: Set<number>;
  attempts?: Record<number, any[]>;
  clearAnsKeys?: (string | number)[];
}

/** Props for teacher observe ClassView */
export interface ObserveClassViewProps {
  data: Record<string, any>;
  onStudentSelect: (studentId: string) => void;
}

/** Props for teacher observe StudentView */
export interface ObserveStudentViewProps {
  data: Record<string, any>;
  studentId: string;
}

/**
 * Frontend exercise type plugin — one object = one type's complete UI logic.
 *
 * Covers both student-side interaction (Component, canSubmit, handleCheckResult),
 * data enrichment (enrichFromApi, enrichFromManifest),
 * and teacher-side observation (ObserveClassView, ObserveStudentView).
 */
export interface ExerciseUIPlugin {
  /** Unique type identifier, must match backend type */
  readonly type: string;

  // ── Student-side: Rendering ──

  /** React component for rendering the exercise */
  readonly Component: React.ComponentType<ExercisePluginProps>;

  /** If true, this component manages its own submit button (e.g. rich-content-quiz, select-evidence) */
  readonly selfManagedSubmit?: boolean;

  /**
   * If false, skip the server /check API — use localGrade or let the component self-manage.
   * Defaults to true.
   */
  readonly serverCheck?: boolean;

  // ── Student-side: Logic ──

  /**
   * Can the student submit? Used to enable/disable the submit button.
   * checkResultState is the opaque state bag from handleCheckResult output
   * (e.g. quiz uses it to access correctQs for skipping already-correct questions).
   */
  canSubmit(exercise: Record<string, any>, ans: Record<string, any>, checkResultState: Record<string, any>): boolean;

  /**
   * Format ans into the submit payload for the backend.
   * checkResultState provides accumulated state (e.g. quiz/match reads attemptCounts from it).
   */
  formatSubmitData(ans: Record<string, any>, checkResultState: Record<string, any>): Record<string, any>;

  /**
   * Process server check result into local state.
   * Called when /check API returns items.
   */
  handleCheckResult(
    result: CheckResult,
    exercise: Record<string, any>,
    currentState: { ans: Record<string, any>; attempts: Record<number, any[]>; correctQs: Set<number> },
  ): CheckResultHandlerOutput;

  /**
   * Optional: local grading fallback (for quiz/match/order that can grade without server).
   * Return null to fall through to server check.
   */
  localGrade?(
    exercise: Record<string, any>,
    ans: Record<string, any>,
    prev: { correctQs: Set<number>; attempts: Record<number, any[]> },
    taskId: number,
  ): LocalGradeResult | null;

  // ── Student-side: Enrichment ──

  /**
   * Convert API ExerciseSpec into TaskExercise component fields.
   * Called when exercise data arrives from the backend API.
   * Mutates the exercise object in-place to add component-specific fields.
   */
  enrichFromApi?(exercise: Record<string, any>, spec: Record<string, any>): void;

  /**
   * Convert manifest answerKey into TaskExercise fields (offline/fallback mode).
   * Used when working directly with manifest data instead of API responses.
   */
  enrichFromManifest?(exercise: Record<string, any>, answerKey: Record<string, any>): void;

  // ── Teacher-side: Observation ──

  /**
   * Teacher observe drawer — class overview.
   * Renders aggregated stats, per-item analysis, student table.
   * Optional: types without observe views (e.g. fill-blank) omit this.
   */
  readonly ObserveClassView?: React.ComponentType<ObserveClassViewProps>;

  /**
   * Teacher observe drawer — individual student detail.
   * Renders per-student breakdown when teacher clicks a student row.
   * Required if ObserveClassView is provided.
   */
  readonly ObserveStudentView?: React.ComponentType<ObserveStudentViewProps>;

  /**
   * The observe type key sent to the backend API.
   * Usually matches `type`, but allows remapping (e.g. 'quiz' → 'mc',
   * 'rich-content-quiz' → 'image-upload' for handler reuse).
   * Defaults to `type` if omitted.
   */
  readonly observeType?: string;
}
```

### 4.2 Registry

前端使用简单的 Map + side-effect import 模式（无需 React Context）：

```typescript
// frontend/src/components/student/exercise/exercise-type-registry.ts

import type { ExerciseUIPlugin } from './exercise-type-plugin';

const registry = new Map<string, ExerciseUIPlugin>();

/** Register an exercise type plugin (call at module load time) */
export function registerExerciseType(plugin: ExerciseUIPlugin): void {
  if (registry.has(plugin.type)) {
    console.warn(`[ExerciseRegistry] Duplicate type "${plugin.type}" — overwriting`);
  }
  registry.set(plugin.type, plugin);
}

/** Get a plugin by type */
export function getExerciseType(type: string): ExerciseUIPlugin | undefined {
  return registry.get(type);
}

/** Get all registered types */
export function getRegisteredTypes(): string[] {
  return [...registry.keys()];
}
```

**注册时机**：

```typescript
// frontend/src/components/student/exercise/built-in.ts
// Side-effect import — registers all built-in types

import { registerExerciseType } from './exercise-type-registry';
import { quizPlugin } from './plugins/quiz.plugin';
import { matchPlugin } from './plugins/match.plugin';
// ... 11 types

registerExerciseType(quizPlugin);
registerExerciseType(matchPlugin);
// ...
```

```typescript
// frontend/src/main.tsx (or App.tsx)
import './components/student/exercise/built-in';  // registers all built-in types
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

#### Before（当前）

```
10 个 per-type useState:
  wrongQs, correctQs, matrixAns, matrixRowResults,
  mapFeedback, mapItemResults, imageUploadFeedback,
  imageUploadRubricResults, fillBlankResults, gdStepResults

canSub():       if/else × 11 types (45 行)
handleCheckResult(): if/else × 11 types (120 行)
render():       {ex.type === 'xxx' && <Xxx />} × 11 (130 行)
```

#### After（插件化）

```typescript
// PracticePhase.tsx — simplified

const plugin = getExerciseType(ex.type);
if (!plugin) return <div>Unknown exercise type: {ex.type}</div>;

// 1 个 opaque state bag 替代 10 个 per-type useState
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

// Render — 1 行替代 130 行条件渲染
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

// Submit button
{!plugin.selfManagedSubmit && (
  <button onClick={handleSubmit} disabled={!canSub() || submitting}>
    {submitting ? t('practice.checking') : t('practice.submit')}
  </button>
)}
```

### 4.4 ObserveDrawer 重构

#### Before（当前）

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

#### After（插件化）

```typescript
// ObserveDrawer.tsx — 1 行替代 14 个条件渲染块
const plugin = getExerciseType(exerciseType);
const observeType = plugin?.observeType ?? exerciseType;

// Fetch observe data using observeType (handles remapping like quiz→mc)
const { data } = useFetch(`/api/classroom/${code}/steps/${step}/observe/${observeType}`);

// ClassView — plugin 提供，或 fallback 到 "暂无观察视图"
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

| Plugin type | `observeType` | 说明 |
|------------|---------------|------|
| `quiz` | `'mc'` | 后端 observe handler 注册为 `mc` |
| `rich-content-quiz` | `'image-upload'` | 复用 image-upload 的 observe handler |
| `match` | `'mc'` | 复用 mc handler（类似 item 结构） |
| 其他 | 默认 `= type` | 无需别名 |

这解决了之前 "多对一映射" 的问题——共享由 `observeType` 字段声明，不需要在 registry 层做 fallback。

### 4.5 TaskExercise Type 变为 Open

```typescript
// task-data.ts — after
export interface TaskExercise {
  type: string;    // ← 从 union literal 改为 string
  label: string;
  [key: string]: any;  // plugin-specific fields
}
```

---

## 5. Extension Pack Structure

```
packages/exercise-pack-math/
├── backend/
│   ├── index.ts                          # NestJS Module: LongDivisionModule
│   └── plugins/
│       ├── long-division.plugin.ts       # @Injectable() @ExerciseType('long-division')
│       ├── long-division.schema.ts       # AnswerKey + ExerciseSpec schemas
│       └── long-division.observe.ts      # @Injectable() @ObserveType('long-division')
├── frontend/
│   ├── index.ts                          # registerExerciseType() side-effect
│   ├── long-division.plugin.ts           # ExerciseUIPlugin（含 ObserveClassView/StudentView）
│   ├── LongDivisionExercise.tsx          # 学生练习组件
│   ├── LongDivisionClassView.tsx         # 教师观察 — 全班视图
│   └── LongDivisionStudentView.tsx       # 教师观察 — 单个学生视图
├── package.json
└── README.md
```

### 5.1 Backend 加载

```typescript
// backend/src/classroom/classroom.module.ts
import { LongDivisionModule } from 'exercise-pack-math/backend';

@Module({
  imports: [
    // ... existing imports
    LongDivisionModule,  // auto-discovers @ExerciseType('long-division')
  ],
})
export class ClassroomModule {}
```

扩展包的 Module 只需要 export `@Injectable()` + `@ExerciseType()` providers，registry 在 `onModuleInit()` 自动发现。

### 5.2 Frontend 加载

```typescript
// frontend/src/main.tsx
import './components/student/exercise/built-in';  // 内置 11 types
import 'exercise-pack-math/frontend';             // 扩展包注册
```

### 5.3 Zero Core Modification

| 层 | Core 修改 | 扩展包提供 |
|----|-----------|-----------|
| AnswerKey validation | 无（registry 动态 compose） | `answerKeySchema` |
| Sanitizer | 无（registry dispatch） | `sanitize()` |
| Grader | 无（registry dispatch） | `grade()` |
| CheckItems | 无（registry dispatch） | `buildCheckItems()` |
| ExerciseSpec | 无（`z.string()` + `.passthrough()`） | 自定义字段 |
| ObserveHandler（后端） | 无（已是 auto-discovery） | `@ObserveType` handler |
| ObserveDrawer（前端） | 无（`<plugin.ObserveClassView />`） | ClassView + StudentView 组件 |
| Frontend render | 无（`<plugin.Component />`） | React component |
| Frontend logic | 无（`plugin.canSubmit` etc） | Plugin methods |
| Frontend enrichment | 无（`plugin.enrichFromApi` etc） | Enrichment methods |

---

## 6. 11 种类型兼容性分析

> 基于审计 audit（2026-05），对全部 11 种现有类型按 plugin 适配难度分组。

### 6.1 后端兼容性 — 全部 OK

| Type | sync/async | 需要 DI | 适配 `ExerciseTypePlugin.grade(ctx)` |
|------|-----------|---------|--------------------------------------|
| quiz | sync | ❌ | ✅ 直接 |
| match | sync | ❌ | ✅ 直接 |
| order | sync | ❌ | ✅ 直接 |
| stance | sync | ❌ | ✅ 直接 |
| select-evidence | sync | ❌ | ✅ 直接 |
| matrix | async | AiPromptBuilder (opt) | ✅ `@Injectable()` 自动注入 |
| fill-blank | async | AiPromptBuilder (opt) | ✅ 同上 |
| map | async | AiPromptBuilder (opt) | ✅ 同上 |
| image-upload | async | AiPromptBuilder (**必需**) | ✅ 同上 |
| rich-content-quiz | async | AiPromptBuilder (**必需**) | ✅ 同上 |
| guided-discovery | async | AiPromptBuilder (opt) | ✅ 同上 |

**特殊情况**：`rich-content-quiz` 当前复用 `ImageUploadGrader`。Plugin 化后 `RichContentQuizPlugin.grade()` 直接内联相同逻辑或 import 共享函数即可。

所有 11 种 sanitizer 函数签名一致（`ak → Record`），所有 11 个 `buildCheckItems` case 签名一致（`ak, data, gradeResult → items[]`）。直接搬入 Plugin。

### 6.2 前端分组

#### Group A — 简单受控（5 种）

标准 `setAns` + `canSubmit` + `handleCheckResult` 模式，无需特殊处理。

| Type | canSubmit 逻辑 | handleCheckResult 要点 |
|------|---------------|----------------------|
| quiz | `!questions.some(unanswered && !correctQs.has)` | correctQs/wrongQs/serverHints → clearAns |
| match | 同 quiz | 同 quiz |
| stance | `ans.stance && evidence.length≥1` | softDone |
| order | `order.length === items.length` | wrongPositions → clearAns |
| fill-blank | `all blanks filled` | blankResults → state |

`checkResultState` 存放 correctQs/wrongQs/feedback 等。

#### Group B — 受控但有额外 state（3 种）

| Type | 特殊点 | Plugin 化方案 |
|------|--------|---------------|
| matrix | `onAnsChange(ri, field, val)` | Component 内部包装 `setAns` → `onAnsChange`；`rowResults` 存入 checkResultState |
| map | `onActiveChange` 回调 + feedback + itemResults | feedback/itemResults 存入 checkResultState；`onOverlayChange` 从 platform props 取 |
| image-upload | feedback + rubricResults + "continue to discuss" 按钮 | feedback/rubricResults 存入 checkResultState |

Matrix 不再需要 PracticePhase 持有 `matrixAns` 独立 state。Plugin 化后 MatrixExercise 内部用 `setAns` 管理 `{ rows: { [ri]: { what, why } } }`，`formatSubmitData` 从 `ans.rows` 读取数据。

#### Group C — 自管理提交（3 种）

| Type | 特殊点 | Plugin 化方案 |
|------|--------|---------------|
| select-evidence | 自带 `onSubmit`/`onDone`；客户端判分 | `selfManagedSubmit=true`；`serverCheck=false`；`onDone` 从 platform props |
| rich-content-quiz | 最复杂：多 part 状态机 + scaffold + `ctx.submit()` | `selfManagedSubmit=true`；`submit`/`onScaffoldPush`/`stepIdx`/`taskId` 从 platform props |
| guided-discovery | 多步骤渐进 + 混合判分 | `selfManagedSubmit=true`；组件完全管理自己的提交流程 |

### 6.3 审计发现的 5 个接口修正（已应用到 §4.1）

1. **遗漏扩展点 F8**：`enrich-exercise.ts` 是第 8 个前端扩展点 → 增加 `enrichFromApi`/`enrichFromManifest` 方法
2. **`canSubmit` 签名不够**：quiz/match 需要 `correctQs` 判断已答对题目 → 增加 `checkResultState` 参数
3. **`ExercisePluginProps` 缺平台能力**：不同组件需要 `onOverlayChange`/`onScaffoldPush`/`submit` 等回调 → 增加 platform capabilities 层
4. **Matrix `onAnsChange` 不走 `setAns`**：可内化，Component 内部包装 `setAns`，无需改接口
5. **`formatSubmitData` 需要 `checkResultState`**：quiz/match 提交时附带 `attemptCounts` → 增加 `checkResultState` 参数

---

## 7. Migration Path

### Phase 0: 基础设施（零行为变化）

**目标**：引入 interface + registry + decorator，不改变任何现有行为。

**步骤**：
1. 创建 `ExerciseTypePlugin` interface（后端）
2. 创建 `@ExerciseType()` decorator
3. 创建 `ExerciseTypeRegistry`（`onModuleInit` auto-discovery）
4. 在 `ClassroomModule` 注册 `ExerciseTypeRegistry`
5. 创建前端 `ExerciseUIPlugin` interface（含 `ObserveClassView` / `ObserveStudentView`）+ registry
6. 写测试验证 registry 初始化（0 个 plugin 时不崩溃）

**验证**：所有现有测试通过，registry 日志显示 0 个注册类型。

### Phase 1: 迁移 quiz + match + order（Group A 最简单的 3 种）

**原因**：纯受控、无 DI 依赖（grader 是纯函数），是最简单的迁移起点。

**步骤**：
1. 创建 `QuizPlugin`、`MatchPlugin`、`OrderPlugin`（`@Injectable() @ExerciseType('quiz')`）
2. 在现有代码中添加 fallback 逻辑：

```typescript
// GradingService.grade() — 迁移期
async grade(rawKey: unknown, data: Record<string, unknown>): Promise<GradeResult | null> {
  // 优先使用 registry
  const pluginResult = await this.registry.grade(rawKey, data);
  if (pluginResult) return pluginResult;
  // Fallback 到旧逻辑
  return this.legacyGrade(rawKey, data);
}
```

3. 创建前端 `quizPlugin`、`matchPlugin`、`orderPlugin`
4. 在 `PracticePhase` 中添加 plugin 分支：

```typescript
const plugin = getExerciseType(ex.type);
if (plugin) {
  return <PluginExerciseWrapper plugin={plugin} ... />;
}
// Fallback to existing conditional rendering
```

**验证**：
- E2E: `04-exercise-check.spec.ts`（quiz grading）
- 手动：完整 quiz + match + order 流程

### Phase 2: 迁移 stance + fill-blank（Group A 剩余）

纯受控，无 DI，略有不同的 state 模式（stance 有 softDone，fill-blank 有 blankResults）。

**每个类型的步骤**：同 Phase 1。

### Phase 3: 迁移 matrix + map + image-upload（Group B）

有 `checkResultState` 反馈 + AI grading。Plugin 是 `@Injectable()`，NestJS 自动注入 `AiPromptBuilder`，比当前 `new XxxGrader(aiPromptBuilder)` 更干净。

**额外工作**：
- Matrix：内化 `matrixAns` state → 使用 `setAns` 管理 `{ rows: {...} }`
- Map：`onOverlayChange` 从 platform props 获取
- image-upload：feedback/rubricResults 存入 checkResultState

### Phase 4: 迁移 select-evidence（Group C 客户端判分）

`selfManagedSubmit=true` + `serverCheck=false`。Component 管理自己的提交和判分逻辑。

### Phase 5: 迁移 rich-content-quiz + guided-discovery（Group C 最复杂）

最复杂的两种类型：
- `rich-content-quiz`：多 part 状态机 + scaffold + `ctx.submit()`
- `guided-discovery`：多步骤渐进 + 混合判分

两者都设为 `selfManagedSubmit=true`，从 platform props 获取所需回调。

### Phase 6: 删除遗留代码

当所有 11 个类型都迁移完成后：
1. 删除 `GradingService.graders` dict + 旧 import
2. 删除 `sanitizers` dict in `manifest.utils.ts`
3. 删除 `buildCheckItems()` 中的 `switch` 块
4. 删除 `ExerciseSpecSchema` 中的 hardcoded `z.enum`
5. 删除 `PracticePhase` 中的 11 个条件渲染块
6. 删除 `canSub()` 和 `handleCheckResult()` 中的 if/else
7. 删除 `ObserveDrawer` 中的 14 个条件渲染块（7 ClassView + 7 StudentView）
8. 删除 `TaskExercise` 中的 union literal type
9. 更新 `AnswerKeySchema` 为 registry 动态 compose

### Phase 7: 示例扩展包 + 文档

1. 创建 `exercise-pack-example`（包含一个简单的自定义类型）
2. 写开发者文档：如何创建扩展包
3. 写 API 参考：Plugin interface 各方法的约束
4. 更新 CLAUDE.md 中的相关描述

---

## 8. Key Design Decisions

| 决策 | 选择 | 备选方案 | 理由 |
|------|------|----------|------|
| **单一 Plugin interface** | ✅ `ExerciseTypePlugin` 含 sanitize + grade + buildCheckItems | 4 个独立 registry（SanitizerRegistry, GraderRegistry, ...） | 防遗漏；一个类 = 一个类型的完整逻辑；IDE 导航友好 |
| **后端 ObserveHandler 保持独立** | ✅ 不合并入 `ExerciseTypePlugin` | 合并为 Plugin 的 `compute()` 方法 | 关注点不同（全班聚合 vs 单学生交互）；已有 auto-discovery；多对一映射 |
| **前端 observe 纳入 `ExerciseUIPlugin`** | ✅ `ObserveClassView` + `ObserveStudentView` 字段 | 独立的 `TeacherObservePlugin` registry | 一个 plugin = 一个类型在全栈的完整定义；扩展包无需注册多个 registry |
| **`observeType` 别名** | ✅ plugin 声明 `observeType?: string` | ObserveDrawer 内置 fallback map | 显式声明优于隐式规则；扩展包可以声明复用已有 observe handler |
| **Frontend 用 side-effect import** | ✅ `import './built-in'` | React Context Provider | 更简单；注册发生在模块加载时；不需要 React 树 |
| **`checkResultState` 泛型 bag** | ✅ `Record<string, any>` | per-type useState | 类型安全下沉到 plugin 内部；PracticePhase 只负责存储/传递 |
| **迁移期 registry + fallback 共存** | ✅ plugin → legacy fallback | Big Bang 一次性迁移 | 增量迁移、安全回滚；每个 phase 都可以独立验证 |
| **ExerciseSpec 改为 open schema** | ✅ `z.string()` + `.passthrough()` | 保持封闭 enum | 扩展包不需要修改 core schema；类型安全在 plugin 内部保证 |
| **Plugin 是 @Injectable()** | ✅ NestJS IoC 管理 | 手动实例化 | 自动 DI（AiPromptBuilder 等）；生命周期由框架管理 |
| **AnswerKeySchema 动态 compose** | ✅ Registry 从 plugin schemas 构建 `z.union` | 保持静态 union | 扩展包无需修改 core schema 文件 |

---

## Appendix A: Current Code References

### A.1 AnswerKey Schema（封闭 union）

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

### A.2 Sanitizer Dict（手动注册）

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

### A.3 Grader Dict（手动注册 + 手动 DI）

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

### A.4 Grader Interface（当前）

```typescript
// backend/src/classroom/exercise/graders/grader.interface.ts
export interface Grader {
  grade(key: AnswerKey, data: Record<string, unknown>): GradeResult | Promise<GradeResult>;
}
```

### A.5 ObserveHandler Decorator（参考实现）

```typescript
// backend/src/classroom/observe/observe-handler.interface.ts
export const OBSERVE_TYPE_KEY = 'OBSERVE_TYPE';
export function ObserveType(type: string): ClassDecorator {
  return SetMetadata(OBSERVE_TYPE_KEY, type);
}
```

### A.6 ObserveDrawer 条件渲染（硬编码 dispatch）

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

### A.7 Frontend Type Union（硬编码）

```typescript
// frontend/src/components/student/task-data.ts:82-83
export interface TaskExercise {
  type: 'quiz' | 'match' | 'matrix' | 'stance' | 'order' | 'select-evidence'
       | 'map' | 'image-upload' | 'fill-blank' | 'rich-content-quiz' | 'guided-discovery'
  // ...
}
```
