# 练习类型插件 Preview 系统

> 设计文档 — 为单个 plugin bundle 提供独立试运行、可视化展示、快速搭建的预览平台。
>
> 配套文档：[`exercise-plugin-architecture.zh-CN.md`](./exercise-plugin-architecture.zh-CN.md) — 插件架构本体。

## 1. 问题陈述

### 1.1 没有 Preview 的痛点

插件架构落地后，一个新练习类型的开发链路是：

```
写 plugin → 接入 live-lesson backend → 编 manifest → 启 SQLite + NestJS + Vite +
MCP server → 创建 classroom session → 假扮学生 join → 走 listen/practice/discuss 流程
→ 提交答案 → 看到效果
```

每次迭代都要走完整集成路径。反馈环长（>2 分钟）、依赖重（4 个进程）、噪音多（无关错误干扰判断）、不可分享（开发机本地的状态无法给他人看）。

### 1.2 三类受众的不同诉求

| 受众 | 诉求 | 现状缺口 |
|------|------|---------|
| 插件**开发者** | 改代码秒级看效果、调试 grade/sanitize 输入输出、隔离 AI 调用噪音 | 需轻量沙箱（Storybook 风格） |
| 课程**编辑/教学设计师** | 可视化编辑 answerKey JSON、切换学生/教师视角、保存草稿 | 需 admin 后台 Playground |
| **终端用户/客户/招生** | 公网可访问的 demo、模拟真实课堂体验、可分享链接 | 需公网部署 + 短码分享 |

### 1.3 目标

- **开发者**：`npx exercise-preview .` 一行命令启动，热重载，Inspector 面板看完整生命周期
- **编辑者**：admin-next `/playground/:bundle` 页面，Monaco JSON 编辑器，多视角切换
- **用户**：公网 demo 站点，每个 bundle 有独立分享链接（如 `demo.kedge.com/p/long-division-abc123`）
- **统一性**：一份 Mini Backend + 一套 Stories 协议，三个 UI 壳复用

---

## 2. 整体架构（三壳一核）

```
┌──────────────────────────────────────────────────────────┐
│  3 个 UI 壳 (面向不同受众)                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ CLI Preview  │  │ Admin 嵌入   │  │ 公网 Demo    │    │
│  │ 开发者沙箱   │  │ Playground   │  │ 销售展示     │    │
│  │ 热重载       │  │ JSON 编辑    │  │ 分享链接     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         └──────────┬──────┴──────────────────┘            │
├──────────────────────────────────────────────────────────┤
│  Preview Runtime (TS 库，三壳共用)                         │
│  - defineStories() API                                    │
│  - StoryLoader (扫描 *.stories.ts)                        │
│  - PreviewSession (内存 classroom 模拟)                    │
│  - RoleSwitcher (student / teacher / inspector)           │
├──────────────────────────────────────────────────────────┤
│  Mini Classroom Backend (NestJS, 复用真实 provider)        │
│  - ExerciseTypeRegistry  ← 复用                            │
│  - GradingService        ← 复用                            │
│  - AiPromptBuilder       ← 复用（连真实 LLM）              │
│  - InMemoryClassroomState (替换 SQLite/TypeORM)           │
│  - 不加载：Observer / Discuss / PersonalTouch / Snapshot   │
└──────────────────────────────────────────────────────────┘
```

**核心论点**：一层 Runtime + 一层 Mini Backend，三个 UI 壳。Mini Backend 复用真实 Plugin 代码（保证行为一致），但剥离 SQLite / Observer / Discuss / Snapshot 等与单插件预览无关的子系统。

### 2.1 为什么选择嵌入式 mini NestJS 而不是纯前端 mock

| 方案 | 优点 | 缺点 | 是否采用 |
|------|------|------|---------|
| 纯前端内存 mock | 启动最快、无后端依赖 | 行为偏移：AI 评分类型必须 mock LLM；Zod 校验链路与真实环境分裂 | ❌ |
| 嵌入式 mini NestJS | 复用 ExerciseTypeRegistry/GradingService 真实代码；Zod 校验和真实环境一致；AI 评分调真实 LLM | 启动稍慢（约 2-3s）、需要 Node 进程 | ✅ |
| 复用真实 live-lesson backend | 零新增后端代码 | preview 形态被 classroom 语义绑死（必须有 session code / student / step），违背"单插件预览"诉求 | ❌ |

**关键收益**：开发者在 preview 中看到的评分结果，与生产环境完全一致——因为跑的是同一份 `plugin.grade()` 代码。

---

## 3. Stories 文件格式

### 3.1 设计原则

借鉴 Storybook 的 CSF (Component Story Format)：

- 一个 `*.stories.ts` 文件 = 一个插件的所有预设场景
- 默认导出绑定 plugin，命名导出每个场景
- stories 文件本身就是测试用例（可喂给 vitest）+ 文档（IDE 跳转）+ Demo 数据源（公网展示）
- 一份内容三处复用

### 3.2 API

```typescript
// packages/exercise-pack-math/frontend/long-division.stories.ts

import { defineStories } from '@kedge-agentic/exercise-preview';
import { longDivisionPlugin } from './long-division.plugin';

export default defineStories({
  plugin: longDivisionPlugin,
  meta: {
    title: '长除法 / Long Division',
    description: '初中数学多项式长除法',
    tags: ['math', 'grade-8'],
    docsUrl: 'https://docs.kedge.com/long-division',
  },
});

// 每个 export = 一个 story
export const Default: Story = {
  name: '默认空白',
  answerKey: {
    type: 'long-division',
    dividend: 'x^2 + 5x + 6',
    divisor: 'x + 2',
  },
};

export const PartiallyAnswered: Story = {
  name: '答到一半',
  answerKey: { ... },
  initialAns: { steps: [{ quotient: 'x', remainder: '...' }] },
};

export const ReviewMode: Story = {
  name: '复习视图',
  answerKey: { ... },
  reviewData: {
    data: {...},
    checkItems: [
      { idx: 1, correct: true },
      { idx: 2, correct: false, hint: '注意符号' },
    ],
  },
  initialPhase: 'review',
};

export const TeacherObserve: Story = {
  name: '教师观察 — 10 学生提交',
  answerKey: { ... },
  // 教师视图专属：mock 全班提交
  classSubmissions: [
    { studentId: 's1', name: '张三', data: {...}, score: 100 },
    { studentId: 's2', name: '李四', data: {...}, score: 60 },
    // ...
  ],
  initialRole: 'teacher',
};
```

### 3.3 Story 类型契约

```typescript
// @kedge-agentic/exercise-preview/src/core/types.ts

export interface StoryMeta {
  title: string;                // 显示名
  description?: string;
  tags?: string[];              // 用于过滤、分类
  docsUrl?: string;             // 外部文档链接
  bundleVersion?: string;       // 版本兼容声明
}

export interface DefineStoriesArgs {
  plugin: ExerciseUIPlugin;     // 前端插件实例
  meta: StoryMeta;
}

export interface Story {
  name: string;                                                // 场景名
  answerKey: Record<string, unknown>;                          // 完整 answer key（含答案）
  initialAns?: Record<string, unknown>;                        // 学生初始作答状态
  reviewData?: { data: Record<string, unknown>; checkItems?: Array<Record<string, unknown>> };
  initialPhase?: 'idle' | 'submitting' | 'review';             // 起始阶段
  initialRole?: 'student' | 'teacher';                         // 起始视角
  classSubmissions?: Array<MockSubmission>;                    // 教师视角的 mock 数据
  notes?: string;                                              // 长描述（Markdown，渲染到 Inspector 标签页）
  skipInDemo?: boolean;                                        // 公网 demo 是否隐藏（默认 false）
}

export interface MockSubmission {
  studentId: string;
  name: string;
  data: Record<string, unknown>;
  score?: number;
  submittedAt?: number;
}
```

### 3.4 自动发现

```typescript
// CLI 启动时
const stories = await loadStories({
  cwd: process.cwd(),
  patterns: ['**/*.stories.ts', '**/*.stories.tsx'],
  ignore: ['node_modules/**', 'dist/**'],
});

// 返回结构
type LoadedStories = Array<{
  filePath: string;
  plugin: ExerciseUIPlugin;
  meta: StoryMeta;
  stories: Record<string, Story>;
}>;
```

### 3.5 一份内容三处复用

| 用途 | 复用方式 |
|------|---------|
| **单元测试** | `for (const [name, story] of Object.entries(stories)) it(name, () => plugin.grade({key: story.answerKey, data: story.initialAns || {}}))` |
| **Preview 沙箱** | `StoryLoader` 扫描后渲染左侧场景树 |
| **公网 demo** | build-time 把 stories 打包进静态站点 |
| **回归基线** | 把 stories 的 grade 结果 snapshot，PR 检测行为偏移 |
| **文档示例** | `@example` JSDoc 链接到 stories 文件 |

---

## 4. Mini Backend 设计

### 4.1 NestJS Module 组成

```typescript
// @kedge-agentic/exercise-preview/src/backend/preview-backend.module.ts

@Module({
  imports: [DiscoveryModule, ConfigModule.forRoot()],
  controllers: [PreviewClassroomController],
  providers: [
    // ── 复用真实 providers ──
    AiPromptBuilder,              // 复用 live-lesson 的 AI 调用层
    ExerciseTypeRegistry,         // 复用 — auto-discover @ExerciseType()
    GradingService,               // 复用 — 调 registry.grade()

    // ── Preview 专属替换 ──
    InMemoryClassroomState,       // 替换 ClassroomService
    PreviewSessionService,        // 内存 session 管理（无 SQLite）

    // ── 动态注入插件 bundles ──
    ...loadBundleProviders(process.env.PREVIEW_BUNDLES?.split(',') ?? []),
  ],
})
export class PreviewBackendModule {}
```

### 4.2 剥离原则

凡是只在"完整课堂语义"下有意义的服务，preview 都不加载：

| 服务/子系统 | 是否加载 | 理由 |
|------------|---------|------|
| `ExerciseTypeRegistry` + `GradingService` | ✅ 加载 | 插件核心评分链路 |
| `AiPromptBuilder` | ✅ 加载 | AI 评分类型必需，直连 LLM |
| `ClassroomService` | ❌ 替换为 `InMemoryClassroomState` | 无需多人 session、step 同步 |
| `ObserverEngine` | ⚠️ 可选 | 仅当 story 含 `classSubmissions` 且 role=teacher 时按需启用 |
| `DiscussService` / `PersonalTouchService` | ❌ 不加载 | 不是单插件预览的关注点 |
| `SnapshotService` / `MetricsAggregator` | ❌ 不加载 | 单用户 preview 不需要历史回放 |
| SQLite / TypeORM | ❌ 不加载 | `InMemoryClassroomState` 替代 |
| SSE endpoint / 3s polling | ❌ 不加载 | 单用户 preview 用 React state 直接同步 |
| 鉴权 / Session code / Join 流程 | ❌ 不加载 | preview 跳过身份语义 |

### 4.3 InMemoryClassroomState

```typescript
@Injectable()
export class InMemoryClassroomState {
  private sessions = new Map<string, PreviewSessionData>();

  createSession(storyId: string, story: Story): string {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      storyId,
      answerKey: story.answerKey,
      ans: story.initialAns ?? {},
      submissions: story.classSubmissions ?? [],
      checkResults: [],
      gradeHistory: [],
    });
    return sessionId;
  }

  getAnswerKey(sessionId: string): unknown { ... }
  recordGrade(sessionId: string, input: unknown, output: GradeResult, durationMs: number): void { ... }
  getInspectorTrace(sessionId: string): InspectorTrace { ... }
}
```

### 4.4 API 端点

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/preview/stories` | 列出所有已加载 stories |
| `POST` | `/preview/sessions` | 创建 preview session `{ storyId }` → `{ sessionId, sanitizedSpec }` |
| `POST` | `/preview/sessions/:id/check` | 提交检查 `{ ans }` → `{ gradeResult, checkItems }` |
| `GET` | `/preview/sessions/:id/inspector` | 获取 Inspector trace（grade 调用历史、AI prompt 等） |
| `GET` | `/preview/sessions/:id/teacher-state` | 教师视角的聚合数据（基于 `classSubmissions`） |
| `POST` | `/preview/sessions/:id/reset` | 重置 session 到初始态 |

### 4.5 与真实 backend 的代码复用

```typescript
// @kedge-agentic/exercise-preview/src/backend/preview-controller.ts

@Controller('preview/sessions/:id')
export class PreviewClassroomController {
  constructor(
    private readonly state: InMemoryClassroomState,
    private readonly gradingService: GradingService,  // ← 真实的
    private readonly registry: ExerciseTypeRegistry,  // ← 真实的
  ) {}

  @Post('check')
  async check(@Param('id') id: string, @Body() body: { ans: unknown }) {
    const session = this.state.get(id);
    const key = session.answerKey;
    const data = body.ans;

    // 复用真实评分链路
    const t0 = performance.now();
    const gradeResult = await this.gradingService.grade(key, data);  // ← 真实代码
    const durationMs = performance.now() - t0;

    const checkItems = this.registry.buildCheckItems(key, data, gradeResult);  // ← 真实代码

    // Inspector 记录
    this.state.recordGrade(id, { key, data }, gradeResult, durationMs);

    return { gradeResult, checkItems };
  }
}
```

**关键**：`gradingService.grade()` 和 `registry.buildCheckItems()` 是从 live-lesson backend **完全相同的源代码**，preview 只是换了 controller 和 state 存储。

---

## 5. 三个 UI 壳

### 5.1 形态对比

| 维度 | CLI Preview | Admin 嵌入 | 公网 Demo |
|------|-------------|-----------|----------|
| **启动方式** | `npx exercise-preview .` | admin-next `/playground/:bundle` | 静态部署 + share link 短码 |
| **Stories 来源** | 本地文件系统 watch | 上传 bundle zip 或选已安装 bundle | build-time 打包 |
| **AI 评分** | 开发者的 API key | admin 用户的 quota | 限流的 demo API key |
| **answerKey 编辑** | 文件即编辑（IDE） | Monaco editor 内联 | 只读 |
| **Inspector 面板** | ✅ 完整 | ✅ 完整 | ❌ 隐藏 |
| **教师观察预览** | ✅ 用 `classSubmissions` mock | ✅ 同 | ✅ 同 |
| **分享链接** | ❌ | ⚠️ 内部链接（含 admin auth） | ✅ 公网短码 |
| **热重载** | ✅ Vite HMR | ❌ | ❌ |
| **离线运行** | ✅ 除 AI 评分类型外 | ❌（依赖 admin server） | ❌ |
| **多 bundle 并存** | ✅ 命令行 glob | ✅ 选择器 | ✅ 路由分发 |

### 5.2 CLI Preview

**安装与启动：**

```bash
# 全局/npx 方式
npx @kedge-agentic/exercise-preview .
# 或在 bundle 包内
npm run preview     # package.json scripts: "preview": "exercise-preview ."
```

**目录约定：**

```
packages/exercise-pack-math/
├── frontend/
│   ├── long-division.plugin.ts
│   ├── long-division.stories.ts        ← preview 自动发现
│   └── LongDivisionExercise.tsx
├── backend/
│   └── plugins/long-division.plugin.ts
└── package.json
   └── scripts: { "preview": "exercise-preview ." }
```

**进程拓扑：**

```
exercise-preview . 命令
   ├── 启动 Mini NestJS（端口 4321）
   │   └── 扫描 backend/**/*.plugin.ts → 动态导入 → 注入 module
   └── 启动 Vite dev server（端口 5283）
       └── 扫描 frontend/**/*.stories.ts → HMR watch
浏览器 http://localhost:5283
   ↓ API 请求 /preview/* 代理到 4321
```

### 5.3 Admin 嵌入（Playground）

**路由：** `admin-next/src/pages/playground/[bundleId].tsx`

**UI 草图：**

```
┌─ Playground / Long Division ──────────────────────────────────┐
│ Bundle: exercise-pack-math v1.2.0                              │
│ Story: [Default ▼]   Role: [Student ▼]   [Reset] [Share]      │
├──────────────────┬───────────────────────┬─────────────────────┤
│ AnswerKey JSON   │ Student View          │ Inspector           │
│ (Monaco editor)  │ (renders plugin)      │ (state + grade log) │
│                  │                       │                     │
│ {                │   ┌────────────────┐  │ canSubmit: true     │
│   "type": "...", │   │ <plugin.Comp>  │  │ ans: {...}          │
│   ...            │   │                │  │ Last grade: 80      │
│ }                │   └────────────────┘  │ AI prompt: [open]   │
│                  │   [Submit]            │                     │
└──────────────────┴───────────────────────┴─────────────────────┘
```

**特性：**

- 左栏 Monaco editor：实时 Zod 校验 + JSON schema autocomplete（schema 来自 `plugin.answerKeySchema`）
- 中栏：渲染 `<plugin.Component>` 或 `<plugin.ObserveClassView>`（取决于 Role）
- 右栏 Inspector：见 §6
- 保存草稿：admin 后台的 `playground_drafts` 表，按 bundle + 用户 id 索引
- 一键导出：把 answerKey JSON 复制到剪贴板 / 推送到 lesson manifest 的 draft 草稿

### 5.4 公网 Demo

**部署形态：**

```
demo.kedge.com/
├── /p/long-division-abc123        # bundle: long-division, story: Default
├── /p/quiz-pythagoras-xyz789      # 短码自动生成
└── /catalog                        # bundle marketplace
```

**构建流程：**

```bash
exercise-preview build \
  --bundles ./packages/exercise-pack-* \
  --output ./dist \
  --base-url https://demo.kedge.com
# → 静态 HTML/JS + stories 内嵌为 JSON + 短码映射表
```

**特性：**

- 静态打包：每个 story 一个路由，无需 backend（AI 评分类型走代理）
- 限流：demo API key 设 RPM 限制（避免被刷）
- 分享短码：`abc123` 自动生成，可设置过期时间
- 隐藏 Inspector / 编辑器：终端用户只看练习本身
- 引流：右下角"了解 KedgeAgentic 平台"按钮

### 5.5 三壳共享代码

```
@kedge-agentic/exercise-preview/
├── src/
│   ├── core/                       # 三壳共用
│   │   ├── define-stories.ts       # API 入口
│   │   ├── types.ts                # Story / StoryMeta / MockSubmission
│   │   ├── story-loader.ts         # 文件系统扫描
│   │   └── preview-session.ts      # 内存 session 抽象
│   ├── backend/                    # Mini NestJS（CLI + Admin 共用）
│   │   ├── preview-backend.module.ts
│   │   ├── preview-classroom.controller.ts
│   │   └── in-memory-classroom-state.ts
│   ├── ui/                         # React 组件库（三壳共用）
│   │   ├── PreviewApp.tsx          # 主布局
│   │   ├── StoryList.tsx           # 左栏场景树
│   │   ├── StudentStage.tsx        # 渲染 <plugin.Component>
│   │   ├── TeacherStage.tsx        # 渲染 <plugin.ObserveClassView>
│   │   ├── Inspector.tsx           # 右栏 inspector
│   │   ├── AnswerKeyEditor.tsx     # Monaco 编辑器（Admin 用）
│   │   └── RoleSwitcher.tsx
│   ├── cli/                        # CLI 入口
│   │   ├── index.ts                # bin entry
│   │   ├── dev-server.ts           # Vite + NestJS 并发启动
│   │   └── build.ts                # 静态打包（公网 demo）
│   └── embed/                      # Admin 嵌入接口
│       └── PlaygroundShell.tsx     # iframe 安全壳 + postMessage 协议
└── package.json
```

---

## 6. Inspector 面板设计

Inspector 是开发者最有用的部分——把"插件生命周期 + 评分内幕"完整暴露出来。

### 6.1 面板结构

```
┌─ Inspector ─────────────────────────────┐
│ ▼ AnswerKey (sanitize 前后对比)          │
│   raw:       {...full key with answers} │
│   sanitized: {...student-safe spec}     │
│   diff:      [highlighted stripped keys]│
├─────────────────────────────────────────┤
│ ▼ Current State                         │
│   ans:               {...}              │
│   checkResultState:  {...}              │
│   allDone:           false              │
│   softDone:          false              │
│   canSubmit:         true               │
├─────────────────────────────────────────┤
│ ▼ Last Grade Call                       │
│   input:    {ans, key}                  │
│   output:   {total: 80, byDimension}    │
│   duration: 1.2s (AI call)              │
│   prompt:   [click to expand]           │
│   response: [click to expand]           │
├─────────────────────────────────────────┤
│ ▼ Check Items                           │
│   #1 correct  ✓                         │
│   #2 wrong    ✗ hint: "..."             │
├─────────────────────────────────────────┤
│ ▼ Plugin Lifecycle                      │
│   enrichFromApi:      called (2.3ms)    │
│   enrichFromManifest: not called        │
│   canSubmit:          12 calls          │
│   handleCheckResult:  1 call (3.1ms)    │
│   localGrade:         not implemented   │
├─────────────────────────────────────────┤
│ ▼ Validation                            │
│   answerKeySchema: ✓ valid              │
│   sanitize output: ✓ matches ExerciseSpec│
├─────────────────────────────────────────┤
│ ▼ Notes                                 │
│   [Markdown from story.notes]           │
└─────────────────────────────────────────┘
```

### 6.2 关键观察项

| 区段 | 数据来源 | 价值 |
|------|---------|------|
| AnswerKey 对比 | `plugin.answerKeySchema.parse(key)` + `plugin.sanitize(...)` | 暴露"答案泄漏"问题——sanitize 是否真的剥离了敏感字段 |
| Current State | React state 实时快照 | 调试 canSubmit/handleCheckResult 错误时一目了然 |
| Last Grade Call | Mini Backend `recordGrade` trace | AI 评分类型可直接看 prompt + response，定位 LLM 调用错误 |
| Check Items | `plugin.buildCheckItems()` 返回值 | 验证 hint/walkthrough 路径 |
| Plugin Lifecycle | 用 Proxy 包裹 plugin 方法记录调用 | 发现"应该调用却没调用"的回调缺失 |
| Validation | Zod safeParse 结果 | 即时发现 schema 漂移（如手写 manifest 时常见错误） |

### 6.3 调用追踪实现

```typescript
// Proxy 包裹插件，记录所有方法调用
function instrumentPlugin(plugin: ExerciseUIPlugin, tracer: Tracer): ExerciseUIPlugin {
  return new Proxy(plugin, {
    get(target, prop) {
      const value = (target as any)[prop];
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const t0 = performance.now();
        try {
          const result = value.apply(target, args);
          tracer.record(String(prop), { args, result, durationMs: performance.now() - t0 });
          return result;
        } catch (err) {
          tracer.recordError(String(prop), { args, error: err });
          throw err;
        }
      };
    },
  });
}
```

---

## 7. 数据流（完整一遍）

以 CLI Preview + 学生视图为例：

```
1. 开发者执行 `npx exercise-preview .`
   ↓
2. CLI 启动：
   a. StoryLoader 扫描 ./**/*.stories.ts → 得到 Plugin + Stories
   b. BundleLoader 扫描 ./backend/**/*.plugin.ts → 动态 require → 注入 Mini Backend
   c. 启动 Vite dev server (5283) + Mini NestJS (4321)
   ↓
3. 浏览器打开 http://localhost:5283
   PreviewApp 加载 → 左栏 StoryList 显示 [Default, PartiallyAnswered, ReviewMode, TeacherObserve]
   ↓
4. 用户点击 "Default"
   → POST /preview/sessions { storyId: 'long-division/Default' }
   → Mini Backend 创建 sessionId，存 answerKey + initialAns
   → 返回 { sessionId, sanitizedSpec }
   ↓
5. StudentStage 渲染 <plugin.Component
       exercise={sanitizedSpec}
       ans={story.initialAns ?? {}}
       setAns={setAns}
       checkResultState={{}}
       onDone={onDone}
     />
   ↓
6. 学生交互：填空、选择、画图……
   ans 状态实时同步到 Inspector
   ↓
7. 点击"提交"：
   a. plugin.canSubmit(ex, ans, checkResultState) → true
   b. plugin.formatSubmitData(ans, checkResultState) → submitPayload
   c. POST /preview/sessions/:id/check { ans: submitPayload }
   ↓
8. Mini Backend:
   a. 调 gradingService.grade(answerKey, submitPayload)  ← 真实代码路径
      - registry.get(type).grade(ctx) → GradeResult
      - 若为 AI 评分：AiPromptBuilder 调真实 LLM
   b. 调 registry.buildCheckItems(key, data, gradeResult) → CheckItem[]
   c. state.recordGrade(...)  ← Inspector trace
   d. 返回 { gradeResult, checkItems }
   ↓
9. 前端 plugin.handleCheckResult(result, ex, currentState) → { checkResultState, allDone, ... }
   ↓
10. setCheckResultState(...) → 重新渲染
    Inspector 面板更新：grade 历史 + checkItems + lifecycle 调用
    ↓
11. 开发者改了 plugin 代码 → Vite HMR → 状态保留，组件重渲染
```

---

## 8. 实施路径

5 阶段渐进，每阶段可独立 ship：

| 阶段 | 目标 | 关键产出 | 验证 |
|------|------|---------|------|
| **P0** | Core 库脚手架 | `defineStories` API + Story 类型 + StoryLoader | 单测：能从 `.stories.ts` 提取 plugin + stories（含 vitest） |
| **P1** | Mini NestJS + CLI 单 bundle 跑通 | preview-backend + preview-classroom.controller + cli/dev-server | E2E：CLI 启动 → 浏览器看到 quiz → 提交 → 评分正确 |
| **P2** | PreviewApp 三栏布局 + Inspector + Role 切换 | PreviewApp / StoryList / StudentStage / TeacherStage / Inspector | 手动：教师视图 mock submissions 渲染 ObserveClassView |
| **P3** | Admin 嵌入 | admin-next `/playground/:bundle` + Monaco editor + 草稿保存 | 手动：admin 选 bundle → 编辑 answerKey → 实时预览 |
| **P4** | 公网 demo | `exercise-preview build` 静态打包 + 短码服务 + 限流 demo API key | 手动：生成分享链接 → 隐身窗口打开 → demo 跑通 |

### 8.1 P0 — Core 库脚手架

**产出：**
- `@kedge-agentic/exercise-preview` 包初始化
- `defineStories()` API + `Story` / `StoryMeta` 类型
- `StoryLoader.load(cwd)` 扫描函数
- 单元测试覆盖 stories 解析

**不在范围内**：UI、backend、CLI

### 8.2 P1 — Mini NestJS + CLI MVP

**产出：**
- `PreviewBackendModule` + `PreviewClassroomController`
- `InMemoryClassroomState`
- `cli/dev-server.ts` 启动两个进程
- 最小可用 PreviewApp（只有 student view + 提交按钮）

**关键依赖**：插件架构 P1 阶段必须先落地（至少 quiz + match + order 三种类型迁移完成）

**验证**：拿 quiz plugin 跑通完整流程

### 8.3 P2 — 完整三栏 UI

**产出：**
- StoryList（左栏）
- StudentStage / TeacherStage（中栏可切换）
- Inspector（右栏 + 调用追踪 Proxy）
- RoleSwitcher

**验证标准**：11 种现有题型都能在 Preview 跑通

### 8.4 P3 — Admin 嵌入

**产出：**
- admin-next 新增 `pages/playground/[bundleId].tsx`
- Monaco editor 集成（带 Zod schema → JSON schema 转换）
- `playground_drafts` 表 + 草稿 CRUD API
- iframe + postMessage 安全壳（隔离 admin token）

**注意**：admin 不直接复用 CLI 的 dev-server，而是用同一个 Mini Backend 库 + 自定义 controller 接入 admin 鉴权。

### 8.5 P4 — 公网 demo

**产出：**
- `exercise-preview build` 命令：静态打包 stories → HTML/JS
- 短码服务（可复用现有 URL shortener 或新建）
- 限流 demo API key 配置
- demo 站点骨架（landing + catalog + share link 路由）

**注意**：AI 评分类型在静态部署下需要后端代理——可以复用 admin 后端或新起一个 thin proxy。

---

## 9. 关键设计决策

| 决策 | 选择 | 备选 | 理由 |
|------|------|------|------|
| Backend 用 NestJS 还是纯前端 mock | ✅ NestJS | 纯前端 mock | 复用 ExerciseTypeRegistry / Zod 校验 / AiPromptBuilder 真实代码，避免行为偏移 |
| Stories 文件 vs 运行时 JSON | ✅ Stories 文件为主 | 仅运行时 JSON | 代码即文档；测试/Preview/Demo 三处复用 |
| Admin 是否可运行时编辑 | ⚠️ Admin 壳支持，CLI 壳不支持 | 全支持 | CLI 尊重文件即来源；Admin 是给非工程师用的，需要 GUI 编辑 |
| Mini Backend 是否独立进程 | ✅ 独立 NestJS 进程 | 同进程 worker thread | NestJS 启动需要完整 IoC；独立进程便于隔离 + 调试 |
| 多 bundle 同时预览 | ✅ 支持 | 一次一个 | `exercise-preview ./pack-math ./pack-reading` — 同进程注入多个 plugin，左栏分组显示 |
| Inspector 是否在公网 demo 显示 | ❌ 隐藏 | 显示 | 不暴露评分内部细节（answers / AI prompt）给终端用户 |
| Stories 是否支持异步生成 answerKey | ❌ v1 不支持 | 支持 | 同步声明足够；异步引入 build/load 时机复杂度 |
| 教师观察的 mock submissions | 直接在 story 里写 | 自动生成器 | 不引入"全班数据生成器"，作者写几条样本即可；保持 stories 简单 |
| AI 评分调真实 LLM 还是固定假数据 | ✅ 真实 LLM（默认） | 固定假数据 | 真实体验；可通过 `--mock-ai` flag 切换到 fixture 模式（CI 用） |
| Bundle 加载机制 | 动态 import + DiscoveryModule | 静态 import | 支持 monorepo + npm 包两种来源；与插件架构的 auto-discover 一致 |
| 短码服务 | 单独 service（不绑死） | 内嵌 demo 站点 | 解耦；未来可复用到其他分享场景 |
| 草稿存储 | admin-next 后台 SQL 表 | localStorage | 跨设备 + 团队协作 |
| iframe 安全隔离（Admin 嵌入） | ✅ iframe + postMessage | 直接渲染 | 防止 plugin 代码读取 admin token / 操作主框架 DOM |

---

## 10. 与插件架构的关系

### 10.1 依赖方向

```
@kedge-agentic/exercise-preview
   ↓ depends on
ExerciseTypeRegistry / GradingService / AiPromptBuilder
（live-lesson backend 已抽取的 plugin 基础设施）
   ↓ depends on
@kedge-agentic/exercise-pack-* (具体 bundle)
```

Preview 包**只依赖插件基础设施（接口 + 注册表）**，不依赖具体 bundle。具体 bundle 通过命令行参数或 admin UI 选择注入。

### 10.2 Stories 协议是插件架构的扩展点

插件架构定义了 9 种契约（answerKeySchema / sanitize / grade / buildCheckItems / Component / canSubmit / handleCheckResult / enrichFromApi / ObserveClassView），Preview 引入第 **10 种契约**：

```typescript
// 推荐但非强制：每个 plugin bundle 应当导出一个 stories 文件
// 命名约定：与 plugin 同名 + .stories.ts
export const longDivisionStories = defineStories({ plugin: longDivisionPlugin, meta: {...} });
```

未提供 stories 的 bundle 仍可工作（preview 会显示"暂无场景，请添加 .stories.ts"），但失去了开发期反馈环和公网展示能力。

### 10.3 时间线对齐

| 插件架构阶段 | Preview 配套 |
|-------------|-------------|
| Plugin 阶段 0（基础设施） | Preview P0（Core 库） |
| Plugin 阶段 1（quiz+match+order 迁移） | Preview P1（Mini Backend + CLI MVP） |
| Plugin 阶段 2-5（其他类型迁移） | Preview P2（完整三栏 UI） |
| Plugin 阶段 6（删遗留代码） | Preview P3（Admin 嵌入） |
| Plugin 阶段 7（示例扩展包 + 文档） | Preview P4（公网 demo） |

Preview P1 必须等 Plugin 阶段 1 完成（至少有 1 种类型迁移到插件模式）。建议两条线交错推进：插件迁移每完成一组（A/B/C），Preview 都补一轮验证。

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| AI 评分类型在 preview 中频繁调真实 LLM → 成本 | 中 | `--mock-ai` flag 切换到固定 fixture；公网 demo 限流 |
| Mini Backend 与真实 backend 行为偏移 | 高 | 严格复用 `GradingService` / `ExerciseTypeRegistry`，不复制代码；CI 加 snapshot 测试对比两边 grade 输出 |
| Stories 文件过时（answerKey schema 变更后未更新） | 中 | CI 跑 `vitest stories.test.ts`：每个 story 做一次 `safeParse(answerKeySchema, story.answerKey)`，失败即报错 |
| 公网 demo 被滥用（恶意流量、信息提取） | 中 | demo API key RPM 限流；隐藏 Inspector；短码可过期 |
| Admin Monaco 编辑器与 plugin Zod schema 不同步 | 低 | 通过 `zod-to-json-schema` 自动转换；plugin schema 变更触发 admin schema 缓存失效 |
| iframe 嵌入的 postMessage 协议被滥用 | 低 | origin 白名单校验 + 协议字段强类型（zod 校验） |
| Bundle 多版本共存冲突 | 中 | preview 同时只允许一个版本的同名 plugin；多版本测试场景使用多个进程 |

---

## 12. 附录

### 12.1 Bundle 包结构（含 stories）

```
packages/exercise-pack-math/
├── backend/
│   ├── index.ts
│   └── plugins/
│       ├── long-division.plugin.ts
│       ├── long-division.schema.ts
│       └── long-division.observe.ts
├── frontend/
│   ├── index.ts                          # registerExerciseType()
│   ├── long-division.plugin.ts           # ExerciseUIPlugin
│   ├── long-division.stories.ts          # ← Preview 入口
│   ├── LongDivisionExercise.tsx
│   ├── LongDivisionClassView.tsx
│   └── LongDivisionStudentView.tsx
├── tests/
│   └── stories.test.ts                   # 自动从 stories.ts 生成
├── package.json
│   └── scripts: { "preview": "exercise-preview ." }
└── README.md
```

### 12.2 命令行 API

```bash
# 启动 dev server
exercise-preview [bundle-paths...]
  --port <n>                # default 5283
  --backend-port <n>        # default 4321
  --mock-ai                 # AI 评分类型用 fixture
  --watch                   # 文件变化自动重启（默认 true）

# 静态打包公网 demo
exercise-preview build
  --bundles <glob>
  --output <dir>
  --base-url <url>
  --share-code-service <url>  # 短码服务地址

# Stories 测试
exercise-preview test
  --bundles <glob>
  --reporter vitest
```

### 12.3 与现有 Storybook 的关系

不用 Storybook 直接接入的原因：

| 维度 | Storybook | Exercise Preview |
|------|-----------|------------------|
| 关注点 | 通用 React 组件 | 练习类型插件（含 backend grade 链路） |
| Backend 集成 | 无 | 嵌入式 NestJS |
| Story 数据模型 | `args` + `render` | `answerKey` + `initialAns` + 教师 mock |
| Inspector | Args/Controls panel | Plugin 生命周期 + grade trace + Zod 校验 |
| 公网 demo | 需自行搭建 | 内建 build 命令 |

**取舍**：直接借鉴 CSF 文件格式（开发者熟悉），但运行时和 UI 自己写——因为预览的不是"组件"而是"全栈插件"。

### 12.4 与 lesson manifest 的关系

| 场景 | 数据来源 |
|------|---------|
| 生产课堂 | `data/lessons/<id>/manifest.json` 的 `readingSteps[].answerKey` |
| Preview | `*.stories.ts` 的 `answerKey` |
| Admin 草稿 | `playground_drafts` 表 |

Preview **不读 lesson manifest**——它独立于课堂语义，只关注单个 answerKey 在插件下的行为。这是有意的边界：preview = 插件试运行，manifest = 课程编排。

未来可考虑反向工具：admin 中"从 manifest 提取 step 作为 story"——把课程里某一步导出成 stories 文件，方便插件作者拿真实数据回归测试。

---

## 13. 多步骤插件预览（基于 reviewData 复用）

> 决策记录 — 决议日期：2026-05-23

### 13.1 决策摘要

复用现有 `useReviewRestore` 机制 + `ReviewData` 类型，**不在 Plugin/Story 契约新增字段**。

**理由：**

- 零新增 API，向前兼容
- 现有 11 种插件都已实现 review-restore 模式（见 [`live-lesson/CLAUDE.md`](../CLAUDE.md) "Exercise Review Restore Pattern"），"已完成步骤的状态还原"代码路径本来就存在
- Story 写起来直观：`reviewData.data` 直接描述已完成步骤的答案

### 13.2 Story 写法

通用模板：

```typescript
export const Step3Started: Story = {
  name: '从第 3 步开始',
  answerKey: { ... },
  // 前两步已完成，第三步空白
  reviewData: {
    data: {
      // 数据结构由插件 parseXxxReview 决定（见 useReviewRestore）
      steps: [
        { stepId: 'observation_1', completed: true, ans: { ... } },
        { stepId: 'formula_1',     completed: true, ans: { ... } },
        // step 2/3 留空 → 学生从这里开始
      ],
    },
    checkItems: [
      { idx: 0, correct: true },
      { idx: 1, correct: true },
    ],
  },
  initialPhase: 'idle',  // ← 不用 'review'，让学生继续作答
};
```

**关键**：`initialPhase` 不设 `'review'`，而是 `'idle'`——插件 `useReviewRestore` 会把已完成步骤的状态还原，但 UI 仍允许继续作答（即"恢复"而非"回顾"）。

### 13.3 具体例子：guided-discovery 4 步

```typescript
export const StartAtDerivation: Story = {
  name: '从第 3 步（多项式验证）开始',
  answerKey: { type: 'guided-discovery', steps: [...] },
  reviewData: {
    data: {
      stepAnswers: {
        observation_choice_1: { choices: { c1: 0, c2: 1 } },
        formula_blanks_1:     { blanks:  { b1: 'a^2', b2: 'b^2' } },
        // derivation_blank_1 / text_blanks_1 留空 → 从这里开始
      },
      completedStepIds: ['observation_choice_1', 'formula_blanks_1'],
    },
    checkItems: [],
  },
};
```

### 13.4 具体例子：rich-content-quiz parts

```typescript
export const StartAtPart3: Story = {
  name: '从第 3 题开始',
  answerKey: { type: 'rich-content-quiz', parts: [q1, q2, q3] },
  reviewData: {
    data: {
      partAnswers: {
        q1: { imageUrls: ['mock-image.png'], score: 100 },
        q2: { imageUrls: ['mock-image.png'], score: 100 },
      },
      completedPartIds: ['q1', 'q2'],
    },
    checkItems: [],
  },
};
```

### 13.5 边界与限制

| 限制项 | 影响 | 缓解 |
|--------|------|------|
| scaffold 历史不被还原 | rich-content-quiz 的脚手架触发记录（哪些 part 用过哪级提示）默认丢失 | Story 可用 `metadata` 透传额外字段，由插件 wrapper 消费（罕见场景） |
| AI 评分 prompt/response 不在 reviewData | 无法复现"上一步 AI 评分时的 prompt" | 用 §14 AI Prompt 调试器配合 |
| `enrichFromApi` 可能重复触发 | reviewData 还原后再点 submit 可能二次调用 enrich | 插件作者注意 `enrichFromApi` 幂等性 |
| 数据结构由插件决定 | Story 作者需了解插件的 `parseXxxReview` 期望的数据格式 | IDE 类型支持（通过 plugin schema 推导） |

### 13.6 Fallback：自定义 wrapper

罕见情况下 reviewData 仍不够用，插件可以在 `*.stories.ts` 里 export 自定义 wrapper：

```typescript
// long-division.stories.ts
import { defineStories } from '@kedge-agentic/exercise-preview';
import { longDivisionPlugin } from './long-division.plugin';
import { LongDivisionExerciseWithInitial } from './LongDivisionExerciseWithInitial';

// 用 wrapper 覆盖原 Component
export default defineStories({
  plugin: { ...longDivisionPlugin, Component: LongDivisionExerciseWithInitial },
  meta: { ... },
});

export const CustomState: Story = {
  answerKey: { ... },
  metadata: { customStartStep: 3 },  // wrapper 自己消费 metadata
};
```

`Story.metadata` 是开放透传字段，属于自定义 wrapper 的私有约定，不进入通用契约。

---

## 14. AI Prompt 调试器（三档全实现）

> 决策记录 — 决议日期：2026-05-23

### 14.1 三档能力概览

| 档位 | 版本 | 能力 | Plugin 契约改造 |
|------|------|------|----------------|
| **L1** | v1 (MVP) | Inspector 显示完整 system/user prompt + response（只读） | 无 |
| **L2** | v2 | 编辑 prompt 重跑 LLM 调用，走插件原解析路径 | 无 |
| **L3** | v3 | 编辑 response 重跑解析逻辑（绕过 LLM） | **需要**：plugin 把 grade 拆成 `buildGradePrompt` + `parseGradeResponse` |

### 14.2 L1 MVP：只读 prompt + response

**实现**：`AiPromptBuilder.callLlm` 加 trace 钩子。

```typescript
@Injectable()
export class AiPromptBuilder {
  private tracer: PreviewTracer | null = null;

  setTracer(tracer: PreviewTracer): void {
    this.tracer = tracer;
  }

  async callLlm(systemPrompt: string, userMessage: string, options): Promise<string> {
    const callId = randomUUID();
    this.tracer?.recordPromptStart(callId, { systemPrompt, userMessage, options });

    const t0 = performance.now();
    const response = await this.actuallyCall(systemPrompt, userMessage, options);
    const durationMs = performance.now() - t0;

    this.tracer?.recordPromptEnd(callId, { response, durationMs });
    return response;
  }
}
```

Inspector UI：

```
▼ AI Calls (3 total)
  └─ Call 1 (1.2s)
     systemPrompt: [click to expand]
     userMessage:  [click to expand]
     response:     [click to expand]
     options:      { responseFormat: 'json', temperature: 0 }
  └─ Call 2 (0.8s)
     ...
```

**复杂度**：低。AiPromptBuilder 加约 30 行；Inspector UI 加 1 个组件。

### 14.3 L2：可编辑 prompt 重跑（record-and-replay）

**核心思路**：plugin.grade 内部可能多次调 LLM，Inspector 让你改其中一次，但**其他次保持不变**——靠 record-and-replay 缓存其他调用的旧 response。

```typescript
@Injectable()
export class AiPromptBuilder {
  private replayCache = new Map<string, string>();  // callKey → mocked response

  async callLlm(systemPrompt: string, userMessage: string, options): Promise<string> {
    const callKey = hash(systemPrompt + userMessage);

    // Replay 模式：有缓存就直接返回（避免重复调真实 LLM）
    if (this.replayCache.has(callKey)) {
      return this.replayCache.get(callKey)!;
    }

    // 否则正常调
    const response = await this.actuallyCall(systemPrompt, userMessage, options);
    this.tracer?.recordCall(callKey, { systemPrompt, userMessage, response });
    return response;
  }

  /** Preview API 调用：用编辑后的 prompt 跑出新 response */
  async rerunWithEditedPrompt(
    targetCallId: string,
    newSystemPrompt: string,
    newUserMessage: string,
    gradeCtx: GradeContext,
  ): Promise<GradeResult> {
    // 1. 把其他 LLM 调用的 response 缓存到 replayCache
    for (const call of this.tracer.allCalls.filter(c => c.id !== targetCallId)) {
      this.replayCache.set(call.key, call.response);
    }
    // 2. 重跑 plugin.grade —— 大多数调用走缓存，只有 target 真的调 LLM
    try {
      return await this.gradingService.grade(gradeCtx.key, gradeCtx.data);
    } finally {
      this.replayCache.clear();
    }
  }
}
```

Inspector UI：

```
▼ AI Call 1 (1.2s)
  systemPrompt:
    [textarea, editable]
    你是一位初中数学教师助手...
  userMessage:
    [textarea, editable]
    学生答案：3x + 5 = 11...
  response:
    {"score": 80, ...}
  [Rerun with these edits]  ← 触发 rerunWithEditedPrompt
```

**复杂度**：中。AiPromptBuilder 加 record-and-replay；Preview Inspector 加 prompt 编辑器 + Rerun 按钮 + API 端点。

### 14.4 L3：可编辑 response 重跑解析

**前提**：plugin 契约升级——把 `grade()` 拆成"构造 prompt"和"解析响应"两阶段。

#### Plugin 契约扩展（可选，向后兼容）

```typescript
export interface ExerciseTypePlugin {
  // ── 原有字段 ──
  grade(ctx: GradeContext): GradeResult | Promise<GradeResult>;

  // ── L3 新增（可选）：两阶段 grade ──

  /** 阶段 1：从 answerKey + 学生数据构造 LLM 调用规格 */
  buildGradePrompt?(ctx: GradeContext): GradePromptSpec[];

  /** 阶段 2：从 LLM 响应字符串数组解析为 GradeResult */
  parseGradeResponse?(responses: string[], ctx: GradeContext): GradeResult;
}

interface GradePromptSpec {
  systemPrompt: string;
  userMessage: string;
  options?: LlmCompletionOptions;
}
```

未实现 `buildGradePrompt` / `parseGradeResponse` 的插件仍使用单阶段 `grade()`，L3 调试器对它们不可用。

#### Preview API 端点

```typescript
@Controller('preview/sessions/:id')
export class PreviewClassroomController {
  @Post('rerun-parse')
  async rerunParse(
    @Param('id') id: string,
    @Body() body: { editedResponses: string[] },
  ) {
    const session = this.state.get(id);
    const plugin = this.registry.get(session.answerKey.type);

    if (!plugin.parseGradeResponse) {
      throw new BadRequestException(`Plugin "${plugin.type}" does not support parse-only mode`);
    }

    // 直接调解析阶段，完全绕过 LLM
    const gradeResult = plugin.parseGradeResponse(body.editedResponses, {
      key: session.answerKey,
      data: session.ans,
    });

    return {
      gradeResult,
      checkItems: this.registry.buildCheckItems(session.answerKey, session.ans, gradeResult),
    };
  }
}
```

Inspector UI：

```
▼ AI Call 1 — Response Editor (v3, 仅升级后插件可用)
  response:
    [textarea, editable]
    {"score": 80, "explanation": "..."}
  [Rerun parser with edited response]  ← 触发 rerunParse
```

**复杂度**：高。需要：
1. 升级 plugin 契约（向后兼容，但要求新插件遵循）
2. 改造 6 个现有 AI 评分插件
3. Preview Inspector + API 端点

**收益**：开发者调试"解析逻辑"时无需等待 LLM 调用（每次省 1-3s + token 成本）。

### 14.5 6 个 AI 插件的 L3 改造工作量

| 插件 | 现状 | 改造工作量 |
|------|------|----------|
| `matrix` | grade() 内单次 LLM 调用 | **低** — 把 prompt 构造和响应解析拆函数 |
| `map` | 同 | **低** |
| `fill-blank` | 同 | **低** |
| `image-upload` | 单次 LLM + 图片 base64 编码 | **中** — 注意图片 payload 在 buildGradePrompt 阶段已准备好 |
| `rich-content-quiz` | 多 part 并行 LLM 调用 | **中** — buildGradePrompt 返回数组（每 part 一个 spec）；parseGradeResponse 接受数组 |
| `guided-discovery` | 多步骤 LLM + 图片 OCR 缓存（见 commit `d3ded228`） | **高** — OCR 缓存逻辑要保留；并行化 + 缓存 + 解析串起来较复杂 |

总体可行，但 guided-discovery 改造需要小心 OCR 缓存语义。

### 14.6 实施路径

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **Preview P2.5** | L1 MVP：AiPromptBuilder trace 钩子 + Inspector 只读显示 | Preview P2 完成 |
| **Preview P3.5** | L2：record-and-replay + 编辑 prompt rerun | L1 完成 + Mini Backend 稳定 |
| **Plugin 阶段 8** | L3：`buildGradePrompt` / `parseGradeResponse` 契约升级 + 6 个 AI 插件改造 | 现有 11 种插件全部迁移到 plugin 模式完成（Plugin 阶段 6） |

**关键**：L3 不是 Preview 项目独立完成的——它依赖 plugin 契约升级，所以归入插件架构的新阶段（建议命名为 "Plugin 阶段 8 — 两阶段 grade"）。

### 14.7 record-and-replay 的失效场景

L2 的 record-and-replay 依赖 prompt 哈希作为缓存键。以下情况会破坏缓存：

1. **prompt 包含时间戳 / 随机 ID** — 每次哈希都不同，replay 失效
2. **plugin 用 `temperature > 0`** — 即使 prompt 相同，response 也不稳定
3. **streaming 响应** — 暂不支持（Preview L2 仅支持非流式调用）

**缓解**：plugin 作者编写 grade 时避免在 prompt 里塞时间戳；AI 评分类型推荐 `temperature=0`。

---

## 15. 资源 Mock 设计（fixtures + upload + URL 抽象）

> 决策记录 — 决议日期：2026-05-23

### 15.1 决策摘要

| 子决策 | 选择 |
|--------|------|
| Fixtures git 策略 | 分闭值：<200KB 直接进 git；超过用 Git LFS 或占位图 |
| URL 抽象 | 引入 `uploadFile` / `resolveResourceUrl` 平台能力（注入到 `ExercisePluginProps`） |
| 落地阶段 | Preview P2（与完整三栏 UI 同期） |

### 15.2 三条资源链路对比

| 链路 | 生产环境 | Preview 环境 |
|------|---------|-------------|
| 学生上传 | `POST /api/lessons/<id>/upload` → 对象存储 → 返回 CDN URL | `POST /preview/upload` → `/tmp/preview-uploads/` → 返回 `/preview/uploads/<id>` |
| 静态资源 | `GET /api/lessons/<id>/resources/<filename>` | `GET /preview/fixtures/<bundle>/<filename>` |
| AI 视觉评分 | backend fetch CDN URL → base64 → 调视觉模型 | backend fetch `http://localhost:4321/preview/...` → base64 → 调视觉模型（同模型）|

### 15.3 Fixtures 静态资源

#### 目录约定

```
packages/exercise-pack-math/
├── fixtures/                              ← Mini Backend 自动 serve
│   ├── handwriting-correct.png            (< 200KB, 进 git)
│   ├── handwriting-wrong.png              (< 200KB, 进 git)
│   ├── scene-square-plot.webp             (1.2MB, Git LFS)
│   └── placeholder-large-image.json       (LFS 不可用时的占位元数据)
└── frontend/
    └── long-division.stories.ts
```

#### Story 引用方式

```typescript
import { fixture } from '@kedge-agentic/exercise-preview';

export const ClassroomFullSubmissions: Story = {
  name: '10 学生提交',
  initialRole: 'teacher',
  classSubmissions: [
    {
      studentId: 's1', name: '张三',
      data: { imageUrls: [fixture('handwriting-correct.png')] },
      score: 100,
    },
    {
      studentId: 's2', name: '李四',
      data: { imageUrls: [fixture('handwriting-wrong.png')] },
      score: 50,
    },
  ],
};
```

`fixture(name)` 返回 `/preview/fixtures/<bundle-name>/<name>`，由 Mini Backend 通过 bundle 元数据自动 serve。

#### 200KB 阈值规则

| 大小 | 策略 | 工具 |
|------|------|------|
| < 200KB | 直接进 git | 无（普通 commit） |
| 200KB - 5MB | Git LFS | `git lfs track "*.webp" "*.png"` |
| > 5MB | 占位图 + 元数据 | 在 fixtures 目录放 1x1 像素占位 + `.meta.json`（含真实尺寸/checksum） |

理由：bundle 的 git 体积失控会拖累 monorepo clone 速度（CCAAS monorepo 内 npm install 已经较重），200KB 阈值平衡可用性与体积。

#### Mini Backend 自动发现

```typescript
@Module({
  providers: [
    {
      provide: 'FIXTURES_DIRS',
      useFactory: () => process.env.PREVIEW_BUNDLES?.split(',')
        .map(b => ({ bundle: path.basename(b), dir: path.join(b, 'fixtures') }))
        .filter(x => fs.existsSync(x.dir)) ?? [],
    },
  ],
})
export class PreviewFixturesModule {}

@Controller('preview/fixtures')
export class PreviewFixturesController {
  constructor(@Inject('FIXTURES_DIRS') private dirs: Array<{ bundle: string; dir: string }>) {}

  @Get(':bundle/:filename')
  serve(@Param('bundle') bundle: string, @Param('filename') filename: string, @Res() res) {
    const entry = this.dirs.find(d => d.bundle === bundle);
    if (!entry) throw new NotFoundException();
    const fullPath = path.join(entry.dir, filename);
    if (!fullPath.startsWith(entry.dir)) throw new ForbiddenException();  // path traversal 防护
    res.sendFile(fullPath);
  }
}
```

### 15.4 Mock Upload Endpoint

#### 实现

```typescript
@Controller('preview')
export class PreviewUploadController {
  constructor(private readonly state: InMemoryClassroomState) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadFile(@UploadedFile() file: Express.Multer.File): { url: string } {
    if (!file) throw new BadRequestException('No file uploaded');
    const id = randomUUID();
    const ext = path.extname(file.originalname);
    const filename = `${id}${ext}`;
    const tmpDir = process.env.PREVIEW_UPLOAD_DIR ?? '/tmp/preview-uploads';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, filename), file.buffer);
    return { url: `/preview/uploads/${filename}` };
  }

  @Get('uploads/:filename')
  serveUpload(@Param('filename') filename: string, @Res() res) {
    const tmpDir = process.env.PREVIEW_UPLOAD_DIR ?? '/tmp/preview-uploads';
    const fullPath = path.join(tmpDir, filename);
    if (!fullPath.startsWith(tmpDir)) throw new ForbiddenException();
    res.sendFile(fullPath);
  }
}
```

#### 生命周期

- Preview session 结束（浏览器关闭 / `/preview/sessions/:id/reset`）→ 异步清理该 session 上传的文件
- Mini Backend 重启 → `/tmp/preview-uploads` 全部清空（startup hook）
- 文件大小限制：10MB（与生产保持一致，便于复现"超限"错误）

### 15.5 平台能力扩展（ExercisePluginProps）

#### 新增字段

```typescript
// frontend/src/components/student/exercise/exercise-type-plugin.ts

export interface ExercisePluginProps {
  // ── 原有字段 ──
  exercise, ans, setAns, allDone, reviewData, checkResultState,
  onDone, stepIdx, taskId, locale,
  onOverlayChange, onScaffoldPush, submit, studentId, sessionCode,

  // ── 新增（可选）：资源处理能力 ──

  /**
   * 上传文件，返回可访问 URL。
   * 生产：调 /api/lessons/<id>/upload。Preview：调 /preview/upload。
   * 未注入时插件应回退到老逻辑（兼容现有代码）。
   */
  uploadFile?: (file: File, options?: UploadOptions) => Promise<{ url: string }>;

  /**
   * 解析资源相对路径为绝对 URL。
   * 生产：`/api/lessons/<id>/resources/handwriting.png`
   * Preview：`/preview/fixtures/<bundle>/handwriting.png`
   */
  resolveResourceUrl?: (relativePath: string) => string;
}

export interface UploadOptions {
  /** 上传进度回调（0-1） */
  onProgress?: (pct: number) => void;
  /** 用于业务侧关联（如 part id） */
  context?: Record<string, unknown>;
}
```

#### 注入点

| 环境 | 注入位置 | 实现 |
|------|---------|------|
| 生产（PracticePhase） | `<plugin.Component uploadFile={prodUploadFile} />` | `prodUploadFile = file => POST(/api/lessons/${lessonId}/upload, file)` |
| Preview（PreviewApp） | `<plugin.Component uploadFile={previewUploadFile} />` | `previewUploadFile = file => POST(/preview/upload, file)` |

#### Plugin 使用方式

**改造前（image-upload 插件硬编码）：**

```typescript
const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/lessons/${lessonId}/upload`, { method: 'POST', body: formData });
  const { url } = await res.json();
  setAns(prev => ({ ...prev, imageUrls: [...(prev.imageUrls ?? []), url] }));
};
```

**改造后（用平台能力）：**

```typescript
const handleUpload = async (file: File) => {
  if (!props.uploadFile) throw new Error('uploadFile capability not injected');
  const { url } = await props.uploadFile(file);
  setAns(prev => ({ ...prev, imageUrls: [...(prev.imageUrls ?? []), url] }));
};
```

### 15.6 AI 评分链路（视觉模型）

#### Backend fetch 图片的 URL 拼接

视觉模型（qwen3-vl-plus）需要拿 base64 而不是 URL。`AiPromptBuilder` 内部 fetch 图片转 base64：

```typescript
async fetchImageAsBase64(url: string): Promise<string> {
  // 处理相对 URL：preview 环境拼 PREVIEW_BASE_URL，生产环境拼 API_BASE_URL
  const absoluteUrl = url.startsWith('http')
    ? url
    : `${process.env.PREVIEW_BASE_URL ?? process.env.API_BASE_URL ?? ''}${url}`;

  const response = await fetch(absoluteUrl);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}
```

Mini Backend 启动时设置 `PREVIEW_BASE_URL=http://localhost:4321`，AiPromptBuilder 能正常 fetch fixtures 和 uploads。

#### OCR 缓存兼容（guided-discovery）

guided-discovery 已有 OCR 缓存机制（commit `d3ded228`）：相同图片的 OCR 结果按 hash 缓存避免重复调用。Preview 环境下：

- Fixtures 图片：hash 稳定 → OCR 缓存命中率高（多次 preview 同一 story 时省 token）
- Mock uploads：每次 random UUID → hash 不同 → 每次 OCR

这不会破坏缓存逻辑，只是 mock uploads 的 OCR 不会复用。可接受。

### 15.7 现有 AI/上传插件改造工作量

| 插件 | 改造点 | 工作量 |
|------|--------|--------|
| `image-upload` | 把硬编码的 `/api/lessons/<id>/upload` 改为 `props.uploadFile()` | 低（1-2 处替换） |
| `rich-content-quiz` | 同上 + 注意 `props.uploadFile` 在 `selfManagedSubmit=true` 下要透传给内部 part 组件 | 中 |
| `guided-discovery` | 同上 + 资源引用（如 hint 内嵌图）用 `props.resolveResourceUrl()` | 中 |
| 其他 8 种插件 | 无图片资源 | 0 |

#### 向后兼容策略

未注入 `uploadFile` 的环境（极旧调用方）→ plugin 可回退老逻辑：

```typescript
const upload = props.uploadFile ?? legacyUpload(`/api/lessons/${lessonId}/upload`);
```

但建议**在 Plugin 阶段 2-3 迁移时一并切换**，避免长期保留双路径。

### 15.8 在 Preview P2 内的子任务

| 子任务 | 产出 | 验证 |
|--------|------|------|
| P2.a | `fixture(name)` helper + `PreviewFixturesController` | 单测：能 serve bundle/fixtures/*.png |
| P2.b | `PreviewUploadController` + tmp 文件管理 | E2E：浏览器上传图 → 返回 URL → 能 `<img>` 显示 |
| P2.c | `ExercisePluginProps.uploadFile` / `resolveResourceUrl` 字段 + PracticePhase 注入生产实现 | 类型测试：注入后类型正确 |
| P2.d | image-upload / rich-content-quiz / guided-discovery 三插件改造 | 现有 E2E（`04-exercise-check.spec.ts`）继续通过 |
| P2.e | AiPromptBuilder `PREVIEW_BASE_URL` 支持 | E2E：preview 环境调视觉模型成功 |
| P2.f | Git LFS 配置 + bundle 模板 README 说明 fixtures 阈值规则 | 文档校验 |

总工作量预估：1-2 周（与 P2 三栏 UI 同期推进）。

### 15.9 风险与缓解

| 风险 | 缓解 |
|------|------|
| `uploadFile` capability 在某些调用路径未注入 → plugin 抛错 | TypeScript 标 `?` 可选；plugin 加 runtime guard + 友好错误信息 |
| Mock upload 的 `/tmp/preview-uploads` 在生产 OS 上被清理 | 启动时 `mkdir -p` + 配置项 `PREVIEW_UPLOAD_DIR` 允许覆盖 |
| 大 fixtures 进 git 拉低 monorepo clone 速度 | 200KB 阈值 + Git LFS 监控（CI 检查 `git ls-files --others --ignored --exclude-standard | xargs -I {} wc -c {}` 超 200KB 报警） |
| Preview fetch fixtures 失败（路径错） | Path traversal 防护 + 启动时校验 fixtures 目录存在 + 404 给清晰错误信息（含期望路径） |
| 视觉模型 token 成本（fixtures 重复调用） | OCR/视觉缓存按 image hash 复用；preview 文档建议 fixtures 用稳定文件名 |

---


## 16. 多语言支持（i18n）

> 决策记录 — 决议日期：2026-05-23

### 16.1 决策摘要

| 子决策 | 选择 |
|--------|------|
| 受众 (A) | **A3**. 数据 + 全部 UI（CLI + Admin + Demo 三壳全 i18n） |
| 数据模式 (B) | **B2**. `story.locale` 多版本（命名后缀 `Default_zh` / `Default_en`） |
| 时机 (C) | **C2**. v2 启动 demo 化时正式 ship；v1 已 i18n-ready 但只配 zh-CN |
| 语言列表 (D) | **D2**. 中 + 英 |

**协调策略**：A3（全 UI i18n）+ C2（v2 才 ship）= **v1 代码必须 i18n-ready，但 locale 只配 zh-CN**。所有 UI 文案用 `t('key')`，避免 v2 retrofit 全文搜索硬编码中文。

### 16.2 数据层模式（B2）

#### 命名约定

```
long-division.stories.ts
  ├── export const Default_zh
  ├── export const Default_en
  ├── export const PartiallyAnswered_zh
  └── export const PartiallyAnswered_en
```

`<storyName>_<locale>` 后缀。Preview UI 按当前 locale 过滤显示。

#### Story 示例

```typescript
export const Default_zh: Story = {
  name: '默认（中文）',
  locale: 'zh',
  answerKey: {
    type: 'quiz',
    answers: [{
      questionText: '哪个结构产生这个结果?',
      options: ['a²+b²', 'a²-b²', '2ab', 'ab'],
      correct: 1,
    }],
  },
};

export const Default_en: Story = {
  name: 'Default (English)',
  locale: 'en',
  answerKey: {
    type: 'quiz',
    answers: [{
      questionText: 'Which structure produces this result?',
      options: ['a²+b²', 'a²-b²', '2ab', 'ab'],
      correct: 1,
    }],
  },
};
```

#### Story 类型扩展

```typescript
export interface Story {
  // ... 原字段
  locale?: 'zh' | 'en';  // v2 新增（v1 可选）
}
```

#### 与现有 manifest `xxxZh` 模式的关系

Story 用 B2 多版本；manifest 仍是 `xxxZh` 双字段。两者通过转换器互通：

- **manifest → story**：扫描 manifest，按 locale 拆分字段 → 生成单语 answerKey
- **story → manifest**：合并同名不同 locale 的 stories → 字段加 `Zh` 后缀

admin Playground 编辑器内置工具：

```typescript
mergeLocalizedStories(['Default_zh', 'Default_en']) → manifestAnswerKey
splitToLocalizedStories(manifestAnswerKey) → ['Default_zh', 'Default_en']
```

### 16.3 UI 层模式（A3 + C2 协调）

#### 技术栈

- `react-i18next`（与 admin-next 一致）
- Locale 文件：`@kedge-agentic/exercise-preview/locales/{zh-CN,en}.json`

#### v1：i18n-ready 但不 ship 英文

```typescript
// 所有 UI 组件用 t()
<button>{t('preview.submit')}</button>  // 而非 <button>提交</button>

// v1: 只配 zh-CN
i18n.init({
  resources: { 'zh-CN': zhCN },
  fallbackLng: 'zh-CN',
});

// v2: 加 en
i18n.init({
  resources: { 'zh-CN': zhCN, en },
  fallbackLng: 'zh-CN',
});
```

#### 三壳的 locale 来源

| 壳 | locale 来源 | v1 默认 |
|----|------------|---------|
| CLI | `process.env.PREVIEW_LOCALE` 或 `--locale` flag | `zh-CN` |
| Admin | 用户偏好（admin-next 已有） | `zh-CN` |
| 公网 Demo | URL 前缀 `/zh/p/...` `/en/p/...` | `zh-CN` |

### 16.4 公网 Demo URL 路由（v2）

```
demo.kedge.com/
├── /zh/p/long-division-abc123
└── /en/p/long-division-abc123
```

build 时按 locale 生成静态路由。同一短码下，不同 locale 对应不同 story 后缀：

```
short-code 'abc123' → bundle: long-division, story-base: Default
  ├── /zh/p/abc123 → 加载 Default_zh
  └── /en/p/abc123 → 加载 Default_en
```

某 locale story 缺失时 fallback 到 zh 并显示警示：`English version not available; showing Chinese`。

### 16.5 v1-v2 落地计划

#### v1：i18n-ready 工作量（分布在 P0-P4）

| Preview 阶段 | i18n 任务 |
|-------------|----------|
| P0 | i18next 集成 + zh-CN.json 骨架 |
| P1 | CLI dev-server + Inspector 文案 `t()` 化 |
| P2 | PreviewApp / StoryList / StudentStage / TeacherStage / Inspector / RoleSwitcher 文案 `t()` 化 |
| P3 | Admin Playground 文案 + Monaco editor 错误提示 `t()` 化 |
| P4 | 公网 Demo 文案 + URL 路由 i18n 准备（不暴露切换器） |

v1 全程仅 zh-CN，无英文。开发者写代码时**强制要求**用 `t()`。

#### v2：正式 ship 步骤

| 步骤 | 内容 |
|------|------|
| 1 | 翻译 zh-CN.json → en.json（约 100 个 key） |
| 2 | 公网 Demo URL 路由加 locale 前缀 |
| 3 | UI 右上角加语言切换器（仅公网 Demo；CLI/Admin 也加但默认 zh） |
| 4 | Bundle 作者文档：如何编写 `_en` 后缀 story |
| 5 | Catalog 页面按 locale 过滤 bundle |

**启动条件**：第一个海外 ToB 客户线索出现，或公司战略明确国际化方向。

### 16.6 风险与缓解

| 风险 | 缓解 |
|------|------|
| v1 期间开发者忘记用 `t()`，硬编码中文 | ESLint 规则 `no-literal-chinese-in-jsx`（自定义规则扫描中文字面量） |
| Story 多 locale 维护负担（每 bundle 双倍 stories） | bundle 可只写中文 story；preview 自动 fallback；提供 LLM 翻译工具自动生成 `_en` 草稿 |
| zh-CN.json 和 en.json key 集合不同步 | CI 检查两个 json 的 key 集合相等 |
| manifest `xxxZh` 与 story `_locale` 双模式造成混淆 | 文档明确：manifest 用 `xxxZh`（兼容已有数据），story 用 `_locale` 后缀（新设计） |
| v1 写代码慢 30%（每个字符串都要抽 key） | 接受 — retrofit 成本远高于前期 i18n-ready 成本 |

---

## 17. 协作编辑（Admin Playground）

> 决策记录 — 决议日期：2026-05-23

### 17.1 决策摘要

| 子决策 | 选择 |
|--------|------|
| v1 范围 | **A1**. 不做协作编辑功能 |
| Presence Indicator | **C2.5**. v1 不独立做；v2 若启用 B3 Yjs 则自带 awareness |
| v2+ 技术选型（提前敲定） | **Yjs CRDT** — 明确不选 B1 悲观锁 / B2 乐观锁 / B4 自研 OT |

**核心立场**：教学设计团队规模小，团队内沟通约定足够；不引入新协作技术栈维护负担。但需要基础的数据保护，避免"两人同时编辑无察觉地丢数据"。

### 17.2 v1 工作模式

#### 协作方式：团队约定

- 编辑前在团队 IM（飞书/钉钉）通知"我现在改 X draft"
- 编辑窗口短（建议 < 30 分钟），改完立即保存
- 频繁保存（autosave 5 分钟一次）减少数据丢失窗口

#### 数据保护机制（轻量，必做）

虽然不做冲突检测，但要避免"莫名其妙丢数据"：

| 机制 | 实现 |
|------|------|
| 显示最后修改时间 + 修改者 | UI 顶部：「最后修改：张三 · 5 分钟前」 |
| 客户端 autosave 到 localStorage | 防止浏览器崩溃 / 误关页面 |
| 保存前重读 server check | 点击保存时再 fetch 一次，若 `last_modified_at` 变了 → 弹警示 |
| 历史版本记录 | `playground_drafts` 表存最近 10 个版本快照，可一键回滚 |

#### 保存前 check 警示对话框

```
⚠️ 此 draft 在你打开后已被他人修改

  对方版本：李四 · 3 分钟前
  你的版本：基于 2 小时前的状态

  [覆盖（不推荐，建议先看对方改了什么）]
  [取消（保留你的本地草稿）]
  [打开对比视图]
```

避免完全沉默覆盖造成数据丢失。

### 17.3 v2 升级触发条件

满足以下**任一**启动 v2 协作编辑：

1. 教学设计团队规模超过 5 人
2. 出现 3 次以上「两人改同一 draft 数据丢失」事件
3. 多人协作场景（如审核流程、并行编辑大型 manifest）成为产品功能要求

### 17.4 v2 技术选型：Yjs CRDT（提前敲定，避免到时再选）

启动 v2 时**直接选 Yjs**，不再评估其他方案。理由：

| 备选方案 | 不选的理由 |
|---------|----------|
| B1 悲观锁 | 协作体验差；锁僵死问题；仍需要 Presence 补充 |
| B2 乐观锁 | 冲突频繁场景下用户体验差（频繁弹"请刷新"） |
| **B3 Yjs** | ✅ **业界事实标准；y-monaco 直接绑 Monaco editor；awareness 自带 Presence** |
| B4 自研 OT | 维护负担过重；社区无成熟实现 |

#### v2 实施步骤

1. 引入 `yjs` + `y-websocket` + `y-monaco`
2. Draft 文档结构改为 `Y.Doc`（answerKey JSON 用 `Y.Map` 表达）
3. WebSocket 服务端：用现成的 [y-websocket-server](https://github.com/yjs/y-websocket) 或集成进 admin-next 后端
4. UI 加 awareness 头像 + 远程光标（自动获得 Presence Indicator）
5. 持久化：`Y.Doc` 序列化存数据库，按需 snapshot

### 17.5 风险与缓解

| 风险 | 缓解 |
|------|------|
| v1 真出现"沉默覆盖" | §17.2 保存前 check + 历史版本（最近 10 个快照）兜底 |
| 浏览器关闭丢数据 | localStorage autosave + `beforeunload` 提示 |
| v2 启动时机判断错误（早做晚做都是错的） | 触发条件清单 + 实际事件统计驱动决策 |
| 选 Yjs 后续发现不合适 | 接受 — Yjs 已是业界事实标准，错的概率最低 |
| v1 期间用户感觉"功能缺失" | 文档说明：协作编辑是 v2+ 路线项，团队规模小不优先 |

---

## 18. Bundle Marketplace & 公网 Demo 形态

> 决策记录 — 决议日期：2026-05-23

### 18.1 决策摘要

| 子决策 | 选择 |
|--------|------|
| v1 Demo 形态 (A) | **A2**. 加 `/catalog` 浏览页（在 P4 末期实施） |
| 第三方上传 (B) | **B2**. 暂不允许但架构保留可扩展 |
| 迁移路径 (C) | **C2**. 提供 manifest 导出（无一键安装） |
| 商业模式 | 工程不决策；商业团队按需启动 |

**核心立场**：v1 做"轻 marketplace"——有目录、有导出，但没有用户系统、没有第三方上传、没有评分评论。架构层面为未来 marketplace 化保留扩展点。

### 18.2 v1 形态：Catalog + Demo + 导出

```
demo.kedge.com/
├── /                                # 首页：宣传 + 精选 bundle
├── /catalog                         # 浏览所有官方 bundle
├── /catalog?subject=math            # 按学科过滤
├── /catalog?type=guided-discovery   # 按练习类型过滤
├── /b/exercise-pack-math            # bundle 详情页（含所有 stories）
├── /p/<short-code>                  # 单 story 分享链接
└── /export/<bundle-id>              # 下载 manifest snippet
```

### 18.3 Catalog 实现细节（A2）

#### Build-time 索引

```bash
exercise-preview build \
  --bundles ./packages/exercise-pack-* \
  --output ./dist \
  --emit-catalog                    # ← 新增 flag
```

构建过程：

1. 扫描所有 bundle 的 `meta` 字段（`title`, `description`, `tags`, `subject`）
2. 生成 `catalog.json` 索引（含每个 bundle 的 stories 数量、缩略图、tags）
3. 静态部署到 `/catalog.json`
4. 前端 `/catalog` 路由按需 fetch + 客户端过滤

#### Catalog 页面 UI 草图

```
┌─ 即见 Agentic Catalog ─────────────────────────────────────┐
│ 筛选：[全部 ▼] [学科：数学 ▼] [类型：guided-discovery ▼]   │
├────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ exercise-    │ │ exercise-    │ │ exercise-    │         │
│ │ pack-math    │ │ pack-reading │ │ pack-physics │         │
│ │              │ │              │ │              │         │
│ │ 平方差公式    │ │ 阅读理解策略  │ │ 力学基础      │         │
│ │ 11 stories   │ │ 8 stories    │ │ 6 stories    │         │
│ │ [试用]       │ │ [试用]       │ │ [试用]       │         │
│ └──────────────┘ └──────────────┘ └──────────────┘         │
└────────────────────────────────────────────────────────────┘
```

#### 无后端能力

无搜索后端 / 无 ranking 算法 / 无个性化——纯静态 + 客户端过滤。

### 18.4 Manifest 导出（C2）

#### 用户操作流程

1. 在 demo 站点试用某个 story（如 `/p/long-division-abc123`）
2. 点右上角"导出到我的 admin"按钮
3. 弹窗显示该 story 对应的 manifest snippet（JSON 格式）
4. 用户复制 JSON
5. 粘贴到自己 admin 的 lesson manifest 编辑器

#### 导出格式

```json
{
  "_source": "kedge-demo-marketplace",
  "_bundleId": "exercise-pack-math",
  "_bundleVersion": "1.2.0",
  "_storyName": "Default_zh",
  "_exportedAt": "2026-05-23T10:00:00Z",
  "_instructions": "把 answerKey 部分粘贴到你的 lesson manifest 的 readingSteps[].answerKey 字段",

  "answerKey": {
    "type": "guided-discovery",
    "steps": [ /* ... */ ]
  }
}
```

带元数据头部便于追溯来源 + 用户能看懂如何使用。

#### 前置依赖

用户的 admin 必须**已经安装对应 bundle 包**（如 `exercise-pack-math`）。导出页面会显示提示：

```
⚠️ 使用此 manifest 前，确保你的 admin 已安装 exercise-pack-math 包：
   npm install @kedge-agentic/exercise-pack-math

   未安装的话，answerKey 会因 "Unknown exercise type" 报错。
```

#### 不做：一键安装（C3）

CCAAS admin 当前是 ToB 私有部署，无多租户能力。一键安装需要：

- OAuth 授权流程（demo 站点 → 用户 admin）
- bundle 版本管理（npm install 自动化）
- admin 后端的"接收 bundle"API

工作量大且依赖 admin 多租户化重构，v1 不做。

### 18.5 架构可扩展性（B2）

虽然 v1 不允许第三方上传，但 bundle 加载机制要为未来保留扩展点：

#### 现有机制（已就绪）

- Bundle 自注册（`@ExerciseType` 装饰器）
- 动态 import（`import('exercise-pack-xxx/backend')`）
- 注册表 auto-discovery（onModuleInit）

#### 为未来预留的接口（v1 不实现，仅在文档列出）

```typescript
// 未来 v2 marketplace 上传后的注入路径
interface BundleManifest {
  id: string;
  version: string;
  publisher: 'official' | 'community';     // ← v1 永远是 'official'
  source: 'npm' | 'github' | 'upload';     // ← v1 永远是 'npm'
  checksum?: string;                        // ← 第三方上传时必填
  signature?: string;                       // ← 官方签名验证
}
```

v1 不在 catalog.json 里加这些字段。v2 启动 marketplace 时增量添加，旧 bundle 默认 `publisher: 'official'`。

### 18.6 v2+ 触发条件

满足以下**任一**才启动 v2 marketplace：

| 触发信号 | 决策方 |
|---------|--------|
| 官方 bundle 数量 > 20，且第三方明确表达想贡献 | 工程 + 产品 |
| ToB 客户要求"我们要在 KedgeAgentic 上发布自己学校的练习类型" | 商业 |
| 公司战略明确转向 SaaS 平台（而非 ToB 私有部署） | 商业 |
| Demo 站点流量 > 10K/月且导出转化率 > 5% | 产品 + 商业 |

### 18.7 不在 v1 范围（商业团队待决策）

| 项目 | 待决策方 |
|------|---------|
| 是否对部分 bundle 收费 | 商业 + 财务 |
| 第三方收入分成模式 | 商业 + 法务 |
| 第三方上传审核流程 | 商业 + 运营 |
| 用户评分 / 评论系统 | 产品 |
| 用户账号系统（demo 站点是否要登录） | 产品 + 商业 |

工程团队**不主动推进**这些项目，等商业明确信号。

### 18.8 风险与缓解

| 风险 | 缓解 |
|------|------|
| Catalog 页面流量大但导出转化率低 | 在 Catalog 详情页显著放置"试用 + 导出"按钮；分析转化漏斗找堵点 |
| 用户复制 manifest 后报错（bundle 未安装） | 导出页面前置提示 + 弹窗确认 + 文档 link |
| 第三方未经允许把 demo 内容截图用于商业 | 在 footer 加版权声明；高价值 bundle 加水印（可选） |
| B2 架构保留实际未使用造成过度设计 | 仅在 catalog.json 留预留字段；其他扩展点 v1 不实现，仅文档存档 |
| Demo 站点被恶意爬取大量调 AI 评分 → token 成本 | 已在 §5.4 设计：限流 demo API key + 短码过期机制 |
