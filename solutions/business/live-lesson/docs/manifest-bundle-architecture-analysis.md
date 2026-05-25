# Manifest / Bundle 架构分析

> Live Lesson 仓库 manifest / bundle 设计的全面分析，覆盖定义、五层关联、新增流程、代码量统计四个板块。

调查范围：`solutions/business/live-lesson/`，涉及 backend / frontend / docs / data 四棵子树。

---

## 1. Bundle 的定义

### 1.1 "Bundle" 在代码中不是一等概念

**仓库里没有任何 class、interface、enum、装饰器叫 "Bundle"**。它只在文档语境里被用作"插件包"的隐喻：

- `docs/exercise-plugin-preview-design.zh-CN.md` §2 称 `@kedge-agentic/exercise-pack-*` 是 "plugin bundles"
- `docs/bundle-readme.css`、`docs/templates/bundle-readme-template.html`、`docs/bundles/index.html` 用 "bundle" 作为 README 风格化的命名
- 真实代码术语：**`exercise type`** / **`plugin`** / **`@ExerciseType('quiz')`** 装饰器

如果要在产品语义里固化"bundle"概念，需要新建抽象 — 当前没有。

### 1.2 Manifest schema 用 Zod

路径：
- **`backend/src/schemas/manifest.schema.ts`**（206 行）
- **`backend/src/schemas/answer-key.schema.ts`**（416 行，含 7 个题型的 union）
- 每个题型在 `backend/src/domain/exercise-types/<type>/<type>.plugin.ts` 里也 declare 一份 schema 用于 plugin 自治

顶层 Manifest 结构（`manifest.schema.ts:184-206`）：

```ts
{
  id, locale?, title, subject, gradeLevel, lessonType, teachingNotes?,
  lessonIntro?, lessonSummary?,
  article?: ArticleSchema,
  readingSteps: ReadingStep[],        // 最关键 — 每个 step 是一个"任务"
  phaseConfig?: PhaseConfig[],        // 课堂阶段流（listen → practice → discuss → takeaway）
  aiReferenceQA?, personalTouch?, bonusArticle?, bonusSteps?,
  observations?: Record<string, ObservationDef>,
}
```

`ReadingStep` 内部（`manifest.schema.ts:118`）：

```ts
{
  idx, type: 'instruction' | 'task',
  studentView?, teacherView?,
  phaseConfig?: PhaseConfig[],        // step 级可覆盖全局
  answerKey?: AnswerKeySchema,        // 题目+答案
  discoveryKey?: AnswerKeySchema,     // 引导发现的"另一种作答路径"
  discuss?: DiscussSchema,
  exerciseLabel?, initialScaffold?,
}
```

### 1.3 当前 11 个 exercise type（不分"高级类型"）

`backend/src/domain/exercise-types/` 下 11 个平等并列的子目录：

```
quiz / match / matrix / map / order / stance / select-evidence
fill-blank / image-upload / rich-content-quiz / guided-discovery
```

**代码不区分"讲解 / 练习 / 讨论"这种更高层的"课堂任务类型"**：

- "讲解" 是 `phaseConfig` 里的一个 `id: 'listen'`，配合 `ReadingStep.type='instruction'` + 无 `answerKey`
- "讨论" 是 `phaseConfig` 里的 `id: 'discuss'` + `ReadingStep.discuss` 字段
- "引导发现" 是 `phaseConfig` 里的 `id: 'discovery'` + `ReadingStep.discoveryKey` 字段
- 这些都不是 exercise type — exercise type 只是"answerKey 的 type 字段值"

### 1.4 manifest 实例

截自 `data/lessons/math-difference-of-squares/manifest.json`：

```json
{
  "phaseConfig": [
    { "id": "listen",   "label": "讲解", "unlockAfter": null },
    { "id": "practice", "label": "练习", "unlockAfter": "listen" },
    { "id": "discuss",  "label": "讨论", "unlockAfter": "practice" },
    { "id": "takeaway", "label": "小结", "unlockAfter": "discuss" }
  ],
  "readingSteps": [
    { "idx": 0, "type": "instruction", "studentView": {...}, "teacherView": {...} },
    {
      "idx": 1, "type": "task",
      "phaseConfig": [...],                                          // step 级覆盖
      "answerKey":    { "type": "rich-content-quiz", "parts": [...] },
      "discoveryKey": { "type": "guided-discovery",  "steps": [...] }
    }
  ],
  "personalTouch": {
    "strategyLabels": [...],
    "tiers": [{ "minScore": 80, "label": "金牌", "tone": "gold" }]
  }
}
```

**结论**：所谓"bundle"在代码里 = `exercise type plugin`。一个 exercise type 是一个 plugin。

---

## 2. 五层之间的关联

以 `quiz` 题型为例，五层全部贴出真实文件路径：

| # | 层 | 文件 | 关键代码 |
|---|---|---|---|
| 1 | **Manifest Schema** | `backend/src/domain/exercise-types/quiz/quiz.plugin.ts` | `readonly answerKeySchema = z.object({ type: z.literal('quiz'), answers: z.array(...) })` |
| 2 | **后端逻辑（grader）** | `backend/src/domain/exercise-types/quiz/quiz.plugin.ts` + `quiz.grader.ts` | `@ExerciseType('quiz') class QuizPlugin implements ExerciseTypePlugin { grade(ctx) {...} }` |
| 3 | **前端呈现（学生）** | `frontend/src/components/student/exercise/QuizExercise.tsx` + `plugins/built-in.tsx:110` | `const quizPlugin: ExerciseUIPlugin = { type: 'quiz', Component: QuizExercise, canSubmit, formatSubmitData, handleCheckResult, localGrade, enrichFromApi, enrichFromManifest }` |
| 4 | **教师 observation** | `backend/src/domain/exercise-types/quiz/quiz.observe.ts` + `frontend/src/components/teacher/observe/mc/McClassView.tsx` + `McStudentView.tsx` | `@ObserveType('mc') class QuizObserveHandler` + `quizPlugin.observeType = 'mc'` + `ObserveClassView: McClassView` |
| 5 | **LLM watch** | `backend/src/adapters/observer-engine/handlers/exercise-handler.ts` + `@kedge-agentic/observer-engine` package | submit 时分派 `exercise_result` 事件，observer-engine 按 type 路由到对应 watcher |

### 2.1 关联机制：字符串 ID + 装饰器注册表

**五层全部靠 `type: 'quiz'` 字符串硬连接**，没有共享 enum / 类型生成。

**后端 — 装饰器自动发现**（`backend/src/application/exercise/exercise-type-registry.ts:39-62`）：

```ts
onModuleInit() {
  for (const wrapper of this.discoveryService.getProviders()) {
    const type = this.reflector.get<string>(EXERCISE_TYPE_KEY, wrapper.metatype);
    if (type && wrapper.instance) {
      this.plugins.set(type, wrapper.instance as ExerciseTypePlugin);
    }
  }
  this.composedSchema = this.buildComposedSchema();  // 动态拼 z.union
}
```

- NestJS `DiscoveryService` 扫描所有 provider，反射 `@ExerciseType('quiz')` 元数据
- 自动注册到 `Map<string, ExerciseTypePlugin>`
- 动态把所有 plugin 的 `answerKeySchema` 拼成一个 union schema（无需手动维护 `AnswerKey union`）

**Observe handler 类似**（`@ObserveType('mc')` 装饰器 + `ObserveRegistry` 扫描）。这里有个**别名机制**：`quiz`/`match`/`order` 都 declare `observeType: 'mc'`，所以三个 exercise type 共享同一套 observe 视图组件。

**前端 — 显式 import 注册**（`frontend/src/components/student/exercise/plugins/built-in.tsx`）：

```ts
import { registerExerciseType } from './registry'
const quizPlugin: ExerciseUIPlugin = { type: 'quiz', observeType: 'mc', ... }
registerExerciseType(quizPlugin)
// 11 个 plugin 全部在此文件里依次 register
```

前端**没有装饰器/discovery**，依赖手写 import + 调用副作用。

**教师端 observe 视图路由**（`frontend/src/components/teacher/observe/observe-view-registry.tsx:50-78`）：

```ts
function findPluginByObserveType(observeType: string): ExerciseUIPlugin | undefined {
  return getAllExerciseTypes().find(p => p.observeType === observeType)
}
```

后端 `quiz.observe.ts` 计算出 observe data → 前端按 `observeType` 反查 plugin → 拿出 `ObserveClassView` / `ObserveStudentView` 组件渲染。

### 2.2 五层关联示意

```
   manifest.answerKey.type='quiz'    ← 数据来源
            ↓
   backend ExerciseTypeRegistry.get('quiz') → QuizPlugin
            ├─ schema 校验
            ├─ sanitize() 去答案
            ├─ grade() 评分
            └─ buildCheckItems() 反馈项
            ↓
   sanitized spec → frontend
            ↓
   frontend registry.get('quiz') → quizPlugin
            ├─ Component 渲染学生 UI
            └─ handleCheckResult 处理评分反馈
            ↓
   submit → backend
            ↓
   QuizObserveHandler 聚合班级数据
   ExerciseHandler 发 observer-engine 事件
            ↓
   教师端 findPluginByObserveType('mc') → McClassView/McStudentView 渲染
```

### 2.3 核心抽象 — `ExerciseTypePlugin` interface

`backend/src/domain/shared/exercise-type-plugin.interface.ts:65`：

```ts
export interface ExerciseTypePlugin {
  readonly type: string;
  readonly answerKeySchema: z.ZodType<unknown>;
  grade(ctx): GradeResult | Promise<GradeResult>;
  sanitize?(ctx): ExerciseSpec | null;
  buildCheckItems?(ctx): Array<Record<string, unknown>>;
  buildGradePrompt?(ctx): GradePromptSpec[];     // §14 二阶段 grade，AI 题用
  parseGradeResponse?(responses, ctx): GradeResult;
}
```

---

## 3. 新增题型的流程

### 3.1 需要新建的文件

按当前 11 个题型的标准结构，新增 `role-play`（角色扮演）需要做：

**后端**（`backend/src/domain/exercise-types/role-play/`）：

```
role-play/
├── role-play.plugin.ts          # 必需 — @ExerciseType('role-play')，含 answerKeySchema + grade
├── role-play.grader.ts          # 可选 — 评分逻辑（也可写进 plugin）
├── role-play.observe.ts         # 必需 — @ObserveType('role-play')
└── __tests__/
    └── role-play.grader.spec.ts # 必需 — 单测
```

**前端**：

```
frontend/src/components/student/exercise/
├── RolePlayExercise.tsx                       # 学生交互组件
├── __tests__/RolePlayExercise.test.tsx        # 组件单测
└── plugins/built-in.tsx                       # 加一条 registerExerciseType({ type:'role-play', ... })

frontend/src/components/teacher/observe/
└── role-play/
    ├── RolePlayClassView.tsx
    └── RolePlayStudentView.tsx
```

### 3.2 需要修改的注册/配置

**后端**：

- `backend/src/infra/classroom.module.ts` providers 数组里加上 `RolePlayPlugin` 和 `RolePlayObserveHandler`（即使有 `@ExerciseType` 装饰器，也要让 NestJS DI 容器知道这俩类的存在 — 否则 DiscoveryService 扫不到）
- `backend/src/schemas/answer-key.schema.ts` — 目前还需要把 `RolePlayAnswerKey` 加进 `AnswerKeySchema` union（虽然 plugin 也 declare 一份 schema，但 union schema 仍是手维护，未来计划拆分到 `<type>/<type>.schema.ts`，见 plugin interface 注释）

**前端**：

- `plugins/built-in.tsx` 文件末尾加一个 `registerExerciseType(rolePlayPlugin)` 调用
- 没有其他全局注册点

### 3.3 没有脚手架 / 代码生成器

- 仓库里**没有** scaffold 工具、code gen、yeoman generator
- 只有**模板文档** `docs/exercise-plugin-extension-guide.md`（指导手写）+ `docs/exercise-plugin-architecture.md`
- 复用模板：直接 `cp -r quiz/ new-type/` 改名 — 是当前公认 workflow

### 3.4 schema 驱动 vs 手写比例

| 部分 | schema 驱动？ |
|---|---|
| Zod 校验 | ✓ 部分 — Plugin 自己声明 `answerKeySchema`，registry 自动拼 union；但 manifest 顶层 `AnswerKeySchema` union 还在 `answer-key.schema.ts` 里**手维护** |
| sanitize（去答案） | ✗ 全手写 — 每种题型剥离哪些字段需要 plugin 作者自己懂 |
| grade（评分） | ✗ 全手写 — 评分逻辑是题型核心，无法生成 |
| 学生 React 组件 | ✗ 全手写 |
| 教师 ObserveView | ✗ 全手写 |
| 单测 | ✗ 全手写 |
| review restore | 半生成 — 每题型导出 `parse<Type>Review()` 函数，共享 `useReviewRestore<T>()` hook |

### 3.5 工程上的隐藏负担

1. **5 个并行注册点**：后端装饰器 + module providers + answer-key union + 前端 register 调用 + 教师视图路由。漏一个 = 静默失效。
2. **`observeType` 别名**：可以让多个 exercise type 共享同一组教师视图（`quiz/match/order` 共享 `'mc'`），但这对新作者是隐藏概念。
3. **schema 拼装**：plugin 声明的 schema 会被 registry 拼成 union，但**老代码路径**（`answer-key.schema.ts` 的硬编码 union）还在 — 短期内需要两边都维护。

---

## 4. 可量化的信息

### 4.1 题型与代码量

**当前 11 种 exercise type**：

| 题型 | 后端行数（plugin+grader+observe+schema） | 复杂度 |
|---|---|---|
| guided-discovery | ~830 | 最高 |
| image-upload | ~727 | 高（AI 视觉评分） |
| matrix | ~611 | 高 |
| map | ~541 | 中高 |
| select-evidence | ~360 | 中 |
| fill-blank | ~337 | 中 |
| quiz | ~317 | 中 |
| rich-content-quiz | ~264 | 中（含二阶段 grade） |
| match | ~152 | 低 |
| order | ~131 | 低 |
| stance | ~128 | 低 |
| **后端合计** | **~4,339** | |

**前端代码量**：

- 学生练习组件：~3,351 行（11 个 `*Exercise.tsx` + helpers）
- 教师观察组件：~3,675 行（11 个 observe 目录）
- **前端合计**：~7,026 行（学生 + 教师）

**单题型总规模**：

- 中位数：~330 行后端 + ~600 行前端 = **~930 行/题**
- 最轻（stance）：~128 + ~250 = ~380 行
- 最重（guided-discovery / image-upload）：~800 + ~900 = ~1,700 行

### 4.2 共享代码

| 共享层 | 文件 | 行数 |
|---|---|---|
| 后端 plugin 接口 | `domain/shared/exercise-type-plugin.interface.ts` | 121 |
| 后端 @ExerciseType 装饰器 | `domain/shared/exercise-type.decorator.ts` | ~20 |
| 后端 grader interface | `domain/shared/grader.interface.ts` | ~30 |
| 后端 observe-handler interface | `domain/shared/observe-handler.interface.ts` | ~50 |
| 后端 ExerciseTypeRegistry | `application/exercise/exercise-type-registry.ts` | 206 |
| 后端 GradingService 分发 | `application/exercise/grading.service.ts` | ~100 |
| 后端 answer-key schemas | `schemas/answer-key.schema.ts` + `exercise-spec.schema.ts` + `manifest.utils.ts` | ~600 |
| 后端 manifest schema | `schemas/manifest.schema.ts` | 206 |
| 前端 ExerciseUIPlugin interface | `student/exercise/plugins/types.ts` | ~80 |
| 前端 registry | `student/exercise/plugins/registry.ts` | ~40 |
| 前端 useReviewRestore hook | `hooks/useReviewRestore.ts` | 31 |
| 前端 useClassroom hook | `hooks/useClassroom.ts` | ~750（session 管理，非题型） |
| 前端 observe-view-registry | `teacher/observe/observe-view-registry.tsx` | ~80 |
| **共享基础设施合计** | | **~1,500 行（不含 useClassroom）** |

### 4.3 复用 vs 一次性比例

- 真正的题型代码（一次性，每题独立）：~4,339（后端）+ ~7,026（前端）= **11,365 行**
- 共享基础设施：~1,500 行
- **共享 / 一次性 比 ≈ 13%**
- **每新增一种题型，作者要写 ~930 行 + 改 5 处注册点**

### 4.4 测试覆盖

- 1,431 个 backend test 通过（11 种 plugin 每个有 grader.spec.ts + observe.spec.ts + 至少一个 schema test）
- 前端组件大多有 `__tests__/` 单测

---

## 关键发现

1. **"Bundle" 是文档隐喻，不是代码概念** — 想固化要新建抽象
2. **五层硬连接靠字符串 ID `'quiz'`** — 没有 enum 也没有类型生成，但 NestJS 装饰器 + DiscoveryService 把后端"注册"自动化了
3. **前端依然手写 `registerExerciseType()` 调用** — 后端的自动发现没在前端镜像
4. **新增一种题型 ≈ 1,000 行手写代码 + 5 处注册点** — 没有脚手架
5. **共享代码占比仅 13%** — 每种题型基本独立实现，灵活但重复
6. **`observeType` 别名机制**让 quiz/match/order 共享一套教师视图 — 这是当前唯一的"跨题型复用"模式

---

## 关键文件索引

| 类别 | 路径 |
|---|---|
| 顶层 manifest schema | `backend/src/schemas/manifest.schema.ts` |
| answer-key union | `backend/src/schemas/answer-key.schema.ts` |
| Plugin 接口 | `backend/src/domain/shared/exercise-type-plugin.interface.ts` |
| 装饰器 | `backend/src/domain/shared/exercise-type.decorator.ts` |
| Registry（后端） | `backend/src/application/exercise/exercise-type-registry.ts` |
| Plugin 实例集 | `backend/src/domain/exercise-types/*/` |
| Module 装配 | `backend/src/infra/classroom.module.ts` |
| 前端 plugin 注册 | `frontend/src/components/student/exercise/plugins/built-in.tsx` |
| 前端 plugin 接口 | `frontend/src/components/student/exercise/plugins/types.ts` |
| 教师 observe 路由 | `frontend/src/components/teacher/observe/observe-view-registry.tsx` |
| Lesson 数据 | `data/lessons/<lesson-id>/manifest.json` |
| 扩展指南 | `docs/exercise-plugin-extension-guide.md` |
| 架构文档 | `docs/exercise-plugin-architecture.md` |
| Preview 系统 | `docs/exercise-plugin-preview-design.zh-CN.md` |
