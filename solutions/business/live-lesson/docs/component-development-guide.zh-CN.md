# 组件开发指南

> live-lesson 中**新增一个交互/题型 (interaction type)** 的内部开发者入门文档。Day-One 新人入职时直接发这份。

读者: 在 `solutions/business/live-lesson/` 里新加一种 `<type>` (例如 `rich-content-quiz`、`guided-discovery`) 的内部工程师。

底层架构请读同目录的 [`exercise-plugin-architecture.zh-CN.md`](./exercise-plugin-architecture.zh-CN.md)。逐步骤代码骨架请读同目录的 [`exercise-plugin-extension-guide.md`](./exercise-plugin-extension-guide.md) (英文)。这份文档是 *地图*: 告诉你新加一种交互类型要碰哪些 surface、按什么顺序、哪些边界是动不了的。

---

## §1. 这里"组件"是什么

在 live-lesson 里, **组件 = 一种新的交互/题型 (exercise type)**。做一个不是一个文件就能搞定的事 —— 它跨越**五个 surface**:

1. 教师端的**手写 schema** (老师在 `manifest.json` 里写什么)。
2. **后端 plugin** (校验、脱敏、打分、可选的 §14 L3 prompts)。
3. **学生端前端, 左边任务区** (练习/做题区)。
4. **学生端前端, 右边 guide + 阅读文本区** (per-type guide modal, 个别题型还会跟右边文本交互)。
5. **observation 管道 + 教师端 observe drawer** (老师看每个学生这题做得怎么样)。

如果你只是写一个独立的 React 小组件或一个后端 service, 那是上述五件事的子集 —— 这种情况只需要执行 §5 或 §4 即可。但大部分实际工作是"我要加一种新题型, 完整地告诉我要改哪些文件"。

---

## §2. 五个 surface 速览

| # | Surface | 主要文件 | 是否必须 | 一行契约 |
| - | --- | --- | --- | --- |
| 1 | [Schema](#3-surface-1--schema-教师手写) | `backend/src/domain/exercise-types/<type>/<type>.plugin.ts` 的 `answerKeySchema` 字段 — 组合到 `backend/src/schemas/answer-key.schema.ts` | ✅ | 以 `type: z.literal('<type>')` 为判别字段的 Zod schema |
| 2 | [后端 plugin](#4-surface-2--后端-plugin) | `backend/src/domain/exercise-types/<type>/<type>.plugin.ts` | ✅ | `@Injectable() @ExerciseType('<type>')` 实现 `ExerciseTypePlugin` |
| 3 | [前端任务区](#5-surface-3--前端任务区左边一列) | `frontend/src/components/student/exercise/<Type>Exercise.tsx` + `plugins/built-in.tsx` 里的 entry | ✅ | `ExerciseUIPlugin` 提供 `Component` + `canSubmit` |
| 4 | [前端右边一列](#6-surface-4--前端右边一列guide--文本面板) | `<Type>Guide.tsx`; 极少数情况 `TextPanel.tsx` | 可选/特例 | per-type guide 是约定, 不是框架 |
| 5 | [Observe 管道 + drawer](#7-surface-5--observation--教师端-observe-drawer) | `backend/src/domain/exercise-types/<type>/<type>.observe.ts` + plugin 的 `ObserveClassView/StudentView` | 可选 | plugin 声明 `observeType` + lazy views; 后端用 `@ObserveType('<type>')` |

**不在**列表里、**也不能扩展**的: 教师端 dashboard 的 tab 栏。详见 [§8](#8-边界拿不动的几样)。

---

## §3. Surface 1 — Schema (教师手写)

### 老师写的是什么

`manifest.json` 里 `type: "task"` 的 `readingStep` 带一个 `answerKey`, `answerKey.type` 字段选择你的题型。`data/lessons/math-difference-of-squares/manifest.json` 里 `rich-content-quiz` 步骤的真实片段:

```json
{
  "answerKey": {
    "type": "rich-content-quiz",
    "subType": "calculation",
    "aiSystemPrompt": "你是一位初中数学教师助手...",
    "parts": [
      {
        "id": "q1",
        "prompt": "(1) 计算 $(y+2)(y-2)$",
        "expression": "$(y+2)(y-2)$",
        "rubric": [
          { "id": "c1", "label": "计算正确", "weight": 100,
            "criteria": "最终答案为 y²-4 即满分。" }
        ],
        "sampleSolution": "$$ y^2 - 4 $$",
        "accepts": ["y^2-4", "y²-4"],
        "maxImages": 1,
        "scaffold": { "threshold": 1, "levels": [ /* 提示等级 */ ] }
      }
    ]
  }
}
```

设计 rule of thumb: 教师可写的属性名要自然、自解释 (`prompt`、`rubric`、`sampleSolution`), 不要暴露实现 (`promptString`、`rubricArr`)。

### Schema 在哪

- Zod schema 通过两个入口暴露:
  - 作为 plugin 的 `answerKeySchema` 字段 (source of truth, 跟 plugin 同文件, 在 `backend/src/domain/exercise-types/<type>/<type>.plugin.ts`)。
  - 组合到 `backend/src/schemas/answer-key.schema.ts` 的判别 union, 让调用方能引到跨题型的 `AnswerKey` 类型 (per-type 单独成文件 `<type>.schema.ts` 在 backlog 上)。
- schema 必须以 `z.literal('<type>')` 作为 `type` 字段的判别 —— 组合 union dispatcher 依赖这一点。
- **不要**用 `.transform()` / `.preprocess()` / `.pipe()` 改变输出类型。registry 把校验后的原对象直接转发给 plugin 方法; transform 会让 plugin 看到的形状跟调用方看到的不一致。只用 `.refine()` 做校验。

### 校验 + 脱敏

- **Seed 时校验:** `lesson.service.ts` 在 seed lessons 时, 对每一步调用 `validateAnswerKey()`。失败会 **打 warning 但不阻塞 seed** —— 对教师用户来说要明确知道这一点。(见 `schemas/answer-key.schema.ts`。)
- **发给学生时脱敏:** 通过 `ExerciseTypeRegistry.sanitize()` (per-type 走 plugin 的 `sanitize()`) 和 `ExerciseTypeRegistry.sanitizeManifest()` (遍历 `readingSteps`) 分发。三个调用点: `application/lesson/lesson.service.ts` (serve manifest)、`application/exercise/exercise.service.ts` (单 step spec)、`application/ai/personalization.service.ts` (bonus)。`rich-content-quiz` 会被剥掉 `aiSystemPrompt`、每个 part 的 `accepts[]`、rubric 的 `criteria` 和 `sampleSolution`。例外是 `select-evidence` —— 它客户端打分, 答案数据要保留。

---

## §4. Surface 2 — 后端 plugin

一个文件: `backend/src/domain/exercise-types/<type>/<type>.plugin.ts`。通过 `@Injectable()` + `@ExerciseType('<type>')` 装饰器自动发现 —— `ExerciseTypeRegistry.onModuleInit()` (在 `backend/src/application/exercise/exercise-type-registry.ts`) 用 NestJS 的 `DiscoveryService` 扫描 providers, 把带装饰器的类注册进 registry。

### 契约 — `ExerciseTypePlugin`

来自 `backend/src/domain/shared/exercise-type-plugin.interface.ts:65`:

```ts
export interface ExerciseTypePlugin {
  readonly type: string;
  readonly answerKeySchema: z.ZodType<unknown>;
  grade(ctx: GradeContext): GradeResult | Promise<GradeResult>;

  sanitize?(ctx: SanitizeContext): ExerciseSpec | null;
  buildCheckItems?(ctx: CheckItemContext): Array<Record<string, unknown>>;

  // §14 L3 两阶段打分 (可选)
  buildGradePrompt?(ctx: GradeContext): GradePromptSpec[];
  parseGradeResponse?(responses: string[], ctx: GradeContext):
    GradeResult | Promise<GradeResult>;
}
```

**必填:** `type`、`answerKeySchema`、`grade`。
**期望填:** `sanitize`、`buildCheckItems`。接口里标成 optional, 但所有现有题型都实现了 —— registry 没有 fallback, plugin 没实现 `sanitize()` 会让学生拿到 `NotFoundException: Unsupported exercise type`。
**推荐填 (复杂题型):** `buildGradePrompt` + `parseGradeResponse` —— §14 L3 两阶段契约。admin playground 的 "改 LLM prompt、不烧 token 重新 parse" inspector 流就靠它驱动。

### 调度

`GradingService.grade(type, key, data)` 从 registry 拿 plugin, 用 `plugin.answerKeySchema` 校验 `key`, 调用 `plugin.grade(ctx)`。后端没有任何一处再有 per-type `switch` —— registry 迁移已经把那些都删了。

### 复用 (Composition)

可以在 plugin 内部直接复用另一个 plugin 的 grader。`rich-content-quiz` 就在 constructor 里 new 出 `ImageUploadGrader`, `grade()` 直接委托过去:

```ts
// rich-content-quiz.plugin.ts:95-148 (节选)
constructor(private readonly aiPromptBuilder: AiPromptBuilder) {
  this.legacyGrader = new ImageUploadGrader(aiPromptBuilder);
}
grade(ctx: GradeContext): Promise<GradeResult> {
  return this.legacyGrader.grade(ctx.key as any, ctx.data);
}
```

新题型如果是 "X 但 schema/sanitize 不同", 先想能不能用这个 pattern, 而不是从头写 grader。

---

## §5. Surface 3 — 前端任务区 (左边一列)

学生做题时看到的练习区。

### 在哪渲染

`frontend/src/components/student/exercise/PracticePhase.tsx:333` 是唯一的 dispatch 点:

```tsx
const plugin = getExerciseType(ex.type)
if (!plugin) return <div>...no plugin registered...</div>
const PluginComp = plugin.Component
return <PluginComp exercise={ex} ans={ans} setAns={...} ... />
```

`PracticePhase` 里没有 per-type 的 switch。如果你发现自己为了新题型在 `PracticePhase` 里加分支, 停手 —— 这正是 plugin 契约要阻止的回归。

### 契约 — `ExerciseUIPlugin`

来自 `frontend/src/components/student/exercise/plugins/types.ts:128`:

```ts
export interface ExerciseUIPlugin {
  readonly type: string                    // 跟后端 @ExerciseType 一致
  readonly Component: ComponentType<ExercisePluginProps>
  canSubmit(...): boolean
  formatSubmitData(...): Record<string, any>
  handleCheckResult(...): CheckResultHandlerOutput

  readonly selfManagedSubmit?: boolean     // plugin 自己管理 submit 按钮
  readonly serverCheck?: boolean           // false → 客户端打分, 跳过 /check
  localGrade?(...): LocalGradeResult | null
  enrichFromApi?(exercise, spec): void     // API spec → component 字段
  enrichFromManifest?(exercise, ak): void  // 原 manifest → component 字段

  readonly ObserveClassView?: ComponentType<ObserveClassViewProps>
  readonly ObserveStudentView?: ComponentType<ObserveStudentViewProps>
  readonly observeType?: string | null
}
```

参考实现: `built-in.tsx:889` 注册了 `richContentQuizPlugin`, 设 `selfManagedSubmit: true`、`observeType: 'image-upload'` (别名, 复用 image-upload 的 observe views), `enrichFromApi` + `enrichFromManifest` 把每个 part 的 schema 复制成可渲染的 exercise 字段。

### 新题型 recipe

1. 在 `<Type>Exercise.tsx` 旁边新建一个 —— 纯渲染组件, 接收 ans / setAns / allDone / reviewData 等 props。
2. 在 `built-in.tsx` 加 plugin entry。这个文件故意写得长 —— 让所有 entry 紧挨着, 你找一个相似的 type, 复制结构改一下就行。
3. 如果组件支持 review-restore (大部分都要), 走 `frontend/CLAUDE.md` 里的菜谱: `useReviewRestore` hook + 纯 `parseXxxReview` 函数 export 在组件旁, 再在 `exercise/__tests__/review-restore.test.ts` 加一行单测。

---

## §6. Surface 4 — 前端右边一列 (guide + 文本面板)

学生屏幕的右边一列有两个新题型可能要碰的东西。两个都**不**自动发现。

### Per-type guide modal (常见)

`RcqGuide.tsx`、`MapGuide.tsx`、`MatrixGuide.tsx` 等 —— 一个**由 exercise 组件自己 import 的**上下文帮助层。没有中央 registry; 你的组件自己持有 `const [guideOpen, setGuideOpen] = useState(false)` 和工具栏的 `<HelpButton>` 触发器。

Recipe: 复制 `RcqGuide.tsx`, 改文案, 在你的 `<Type>Exercise.tsx` 里 import 进来, 在工具栏接一个 `HelpButton`。50–80 行的事; 类型安全通过 guide 组件的 props 来保证。

### 右边阅读文本面板 (罕见)

`TextPanel.tsx` + `BoardInline.tsx` 渲染阅读内容。大部分题型不碰这块。例外是 `select-evidence` —— 它从脱敏后的 spec 里读 `paragraphTokens`, 把右边文本里的 span 标成可高亮。

如果你的新题型需要"学生在左边操作 → 右边阅读文本响应" (比如"高亮学生刚点的那句"), 这种连线**今天是 bespoke 的** —— 没有通用 surface。**不要**在没有架构 review 的情况下自己造一个; 先研究现有的 select-evidence 路径作为参考。

---

## §7. Surface 5 — Observation + 教师端 observe drawer

### 事件发射 (新题型一般不动)

`application/classroom/student-submission.service.ts` 在每次打分后通过 `@kedge-agentic/observer-engine` dispatch `exercise_result` 事件。`backend/src/adapters/observer-engine/handlers/` 下的 observation handler (`ExerciseHandler`、`JoinHandler` 等) 是**全局的**, 不是 per-type 的。新题型通常不在这里加新文件。

### 后端 observe handler (per-type 教师数据)

这是"老师在 observe drawer 看到的这一步的数据"的 per-type surface。文件: `backend/src/domain/exercise-types/<type>/<type>.observe.ts` (discuss-observe 不是题型, 而是讨论 phase, 住在 `backend/src/application/observation/discuss.observe.ts`)。

自动注册跟 plugin registry 同模式。`backend/src/application/observation/observe-registry.ts:24`:

```ts
onModuleInit() {
  for (const wrapper of this.discoveryService.getProviders()) {
    const type = this.reflector.get<string>(OBSERVE_TYPE_KEY, wrapper.metatype);
    if (type && wrapper.instance) {
      this.handlers.set(type, wrapper.instance as ObserveHandler);
    }
  }
}
```

参考实现: `domain/exercise-types/matrix/matrix.observe.ts`、`domain/exercise-types/quiz/quiz.observe.ts`。各自是 `@Injectable() @ObserveType('<type>')` 实现 `ObserveHandler.compute(ctx) → <Type>ObserveData`。聚合时一次性给出班级整体 + 每个学生的明细。(历史注: 重构前这两个叫 `mc.handler.ts` 和 `evidence.handler.ts`, `@ObserveType('mc')` / `@ObserveType('evidence')` 装饰器字符串保留, 只是文件 + 类名改了。)

两种 opt-out:
- **复用另一种 type 的 handler**: 在 plugin 上设 `observeType` 为字符串别名 (比如 `rich-content-quiz` 别名到 `'image-upload'` —— 见 `observe-registry.ts:52`)。
- **完全隐藏 observe 按钮**: 在 plugin 设 `observeType: null` (`fill-blank` 就是这样做的)。

### 前端 observe drawer 集成

`frontend/src/components/teacher/observe/ObserveDrawer.tsx` 通过 `observe-view-registry.tsx` 里的 `getObserveView(type)` 取视图。registry 走 plugin registry, 按 `observeType ?? plugin.type` 查找:

```ts
// observe-view-registry.tsx — findPluginByObserveType()
for (const type of getRegisteredTypes()) {
  const plugin = getExerciseType(type)
  if (plugin.observeType === null) continue
  const effective = plugin.observeType ?? plugin.type
  if (effective !== observeType) continue
  if (plugin.ObserveClassView && plugin.ObserveStudentView) return plugin
}
```

所以前端这边的契约是: 在 plugin 上声明 lazy-loaded 的 `ObserveClassView` + `ObserveStudentView`, 设对的 `observeType`, drawer 自动拿到。鼓励别名 (alias) 而不是重复实现。

---

## §8. 边界 — 拿不动的几样

动手前先对照自己, 下面这些今天都不是可插拔的:

- **教师端 dashboard tab 栏。** `TeacherShell.tsx:415–448` 把右侧 tab 结构写死 (`DiscussInsightTab`、`SummaryTab`、`ClassroomStatusTab`, 再加一个 `depth` 面板)。新题型能贡献*数据* —— `stepMetrics`、`clusterStats`、`observation.indicatorStats` 等都会汇入现有 tab —— 但加不了第五个 tab。如果你觉得需要, 那是框架级修改, 不是 plugin 修改。
- **`PracticePhase` / `StudentShell` / `enrich-exercise.ts` / `gradeItemSet` / `teacher-helpers`。** 新题型对它们 off-limits。如果发现自己为了上一种 exercise 要动这几个, 说明 plugin 契约有缺口 —— 去修契约, 不要绕过它。
- **Observation 事件类型。** 加新事件 (在 `exercise_result`、`chat_turn` 之外) 是 `@kedge-agentic/observer-engine` 的框架级改动, 不要作为新题型的一部分顺手做。

---

## §9. 调试

### 后端

| 现象 | 第一现场 |
| --- | --- |
| Endpoint 500 | `backend.log` (`tail -f`), NestJS 打完整 stack |
| 打分错误 | plugin 的 `grade()` 返回值 + manifest 的 `answerKey` 形状; 99% 是 schema 漂移 |
| Observe 数据缺失 | handler 的 `compute()` 在 `ctx.answerKey?.type !== '<expected>'` 时早返回, 检查类型守卫 |
| LLM 没被调到 | `AiPromptBuilder.callLlm` / `callVisionLlm` 每次都打 log; 日志里看不到你的 prompt 就是代码路径没走到 |
| Type 注册了但没被 dispatch | registry 只看到 Nest 真正构造过的类。如果你的 `.module.ts` 没把 plugin 放进 `providers`, 装饰器扫描就触发不了 |

`AiPromptBuilder` 把每次请求的 trace 写到 `data/llm-trace/`。LLM 行为异常时拉一份最近的, 输入、响应、模型名都在里面。

常用单次命令:

```bash
# 改完 manifest.json 后重新 seed (seed 只 insert, 不 update):
cd solutions/business/live-lesson/backend
node -e "const fs=require('fs'),p=require('path'),DB=require('better-sqlite3');\
  const raw=fs.readFileSync(p.resolve('..','data/lessons/ideal-beauty-reading/manifest.json'),'utf-8');\
  const m=JSON.parse(raw); const db=new DB(p.resolve('data/live-lesson.db'));\
  db.prepare('UPDATE lessons SET manifest_json=? WHERE id=?').run(raw,m.id); db.close();"

# 用 watch 模式跑单个 Jest 文件:
cd solutions/business/live-lesson/backend && npx jest <文件 pattern> --watch
```

### 前端

- React DevTools 里能看到 `PracticePhase` 的 `getExerciseType()` 查找结果。如果题型显示 "no plugin registered" fallback, 说明 `built-in.tsx` 里的 side-effect import 没走到 `registerExerciseType()`。
- 浏览器 Network 面板是验证前后端契约最便宜的方式。如果请求打到 `http://localhost:3001` 而不是 3007, 说明 CCAAS SDK 的 `serverUrl` 配错了 (规则见 `CLAUDE.md`)。
- 调试轮询: polling endpoint 幂等, DevTools Console 里手动刷:
  ```js
  await (await fetch('/api/classroom/<CODE>/state')).json()
  ```

### 常见踩坑

- **Jest 测试 `Cannot find module 'fs'`**: 文件顶部用 `jest.mock('fs')` + `const fs = require('fs') as jest.Mocked<typeof import('fs')>`。新版 Node 的 `existsSync` non-configurable, `jest.spyOn` 会失败。
- **localStorage `'sub:CODE:0'` 跨 vitest run 残留**: 在 `beforeEach` 里 `vi.stubGlobal('localStorage', …)`, `afterEach` restore。见 `submission-cache.test.ts`。
- **Playwright 报 `400 name must be ≤20 characters`**: 后端学生名上限 20 字符; 测试 fixture 取短一点。
- **E2E 点 FAB 卡住**: StudentGuide 弹窗大概率盖住了, 交互前先显式关闭它。

---

## §10. 预览

### 本地 dev (日常迭代)

```bash
# Terminal 1 — solution backend (port 3007)
cd solutions/business/live-lesson/backend && npm install --legacy-peer-deps && node dist/main.js

# Terminal 2 — solution frontend (port 5283)
cd solutions/business/live-lesson/frontend && npm install && npm run dev

# Terminal 3 — 主 CCAAS backend, 只有改聊天/Agent 流时才需要 (port 3001)
npm run dev:backend
```

浏览器打开 `http://localhost:5283/`, 选一节课, 拿到 join code 后第二个标签页打开 `/join`。你现在同一间教室里既是老师又是学生 —— 两侧都能回放完整流程。

### 题型 plugin preview (不开整套 app)

`packages/exercise-preview` 提供一个轻量 iframe 沙箱, 用 `.stories.mjs` 文件渲染任意 plugin。新题型 UI 迭代时用它, 不用开整个课堂:

```bash
cd packages/exercise-preview
npm run build
node dist/cli/index.js --port 43451 bundles/<你的 bundle>
# 打开 http://127.0.0.1:43451
```

admin playground 里 `Share Link` 按钮能生成短码, 贴到 Slack 就能分享 story snapshot。

### E2E 预览 (Playwright UI)

```bash
cd solutions/business/live-lesson/e2e
npm install
BACKEND_URL=http://localhost:3007 FRONTEND_URL=http://localhost:5283 npx playwright test --ui
```

`--ui` 模式打开 Playwright 时间回放调试器。需要验证新 endpoint 真的通过线上模型走通时, `14-real-llm-integration.spec.ts` 是一个很好的模板。

---

## §11. 提交前 checklist (强制)

任何代码改动之后, 按这个顺序跑完三步才能认为 task 完成 —— 跳过任一步在根 `CLAUDE.md` 里明确定义为"流程违规":

1. **跑测试**
   - 后端: `cd solutions/business/live-lesson/backend && npx jest --no-coverage`
   - 前端: `cd solutions/business/live-lesson/frontend && npm test`
   - E2E (动了用户可见行为时): `cd solutions/business/live-lesson/e2e && npx playwright test`
2. **Code review**: 对所有改动文件跑 `code-reviewer` agent。
3. **Harness**: repo 根跑 `bash scripts/harness-checks.sh`。

review 发现问题先修再继续。harness 是最后一道闸。

---

## §12. 还是卡住时

- Memory 和约定: `/Users/niex/.claude/projects/.../memory/MEMORY.md` 每次 Claude 会话都加载, 里面列了所有反复出现的坑 (serverUrl 陷阱、commit 格式、harness 规则)。
- 架构决策: repo 根 `docs/adr/` 和同目录的 [`exercise-plugin-architecture.md`](./exercise-plugin-architecture.md)。
- 某次具体 PR 的原因: `git log -p` 是唯一真相; 这个 repo 的 commit message 是按 load-bearing 标准写的, 信息量足够。

实在卡住的话, 约一个 15 分钟 pairing —— 三只眼睛胜过任何文档。
