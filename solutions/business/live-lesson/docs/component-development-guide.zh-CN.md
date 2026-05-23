# 组件开发指南

> KedgeAgentic monorepo 中**新增、调试、预览组件**的内部开发者入门文档。Day-One 新人入职时直接发这份。

读者: 在 `solutions/business/live-lesson/` (及周边 packages) 里写新题型、observe handler、scaffold widget、学生端/教师端 UI 片段的内部工程师。

底层架构请先读同目录的 [`exercise-plugin-architecture.zh-CN.md`](./exercise-plugin-architecture.zh-CN.md)。这份文档是 *怎么做*, 那份是 *为什么*。

---

## 1. 这里说的"组件"是什么

代码库里有三种东西都被叫做"组件"。动手前先确认你做的是哪种:

| 类型 | 位置 | 真实例子 | 增加一个意味着 |
| --- | --- | --- | --- |
| **Exercise type plugin** | `backend/src/classroom/exercise/plugins/*.plugin.ts` + `frontend/.../plugins/built-in.tsx` | `quiz`、`matrix`、`guided-discovery` | 一个后端文件 + 一个前端 entry + (可选) 一个 stories 文件 |
| **React UI 片段** | `frontend/src/components/<area>/*.tsx` | `HelpButton`、`Timeline`、`Band` | 纯 React + Tailwind/CSS, 不走 registry |
| **后端 service / handler** | `backend/src/classroom/observe/handlers/*.handler.ts`、`observation/handlers/*.ts` 等 | `MatrixObserveHandler`、`JoinHandler` | `@Injectable()` 类, 挂到对应模块上 |

代码库强制的最重要的一条设计规则:**新题型禁止修改 `PracticePhase`、`StudentShell`、`enrich-exercise.ts`、`gradeItemSet`、`teacher-helpers`**。如果发现自己为了新题型动了上面任一文件, 你已经偏离了插件契约 —— 这时候要做的是修正契约, 而不是继续往里塞代码。

## 2. 设计 checklist (动手写代码前)

1. **确定 scope**: 对照上表选清楚是三种里的哪一种。不确定就先草拟最小可见产出, 反向推。
2. **取名**: 小写 kebab-case 标识符; 前后端字符串完全一致。例如 `match`、`select-evidence`、`rich-content-quiz`。按*题型*命名, 不按实现命名 (`'matching-pairs'` ✅, `'two-column-drag'` ❌)。
3. **先写 answerKey schema**: 题型用 Zod schema, handler 用 TS interface。Schema 本身就是给老师写 manifest 的最强文档。
4. **标注信任边界**: spec 里有没有"学生不能看到"的答案数据? 有的话 plugin 的 `sanitize()` 负责剥离。(select-evidence 是故意的例外, 它是客户端打分。)
5. **判断是否需要 LLM 打分**: 像 `quiz`、`order` 这种确定性题型不需要。更复杂的走 §14 L3 (`buildGradePrompt` + `parseGradeResponse`) 路径。默认"不要 LLM", 只在确实需要文字等价判断或视觉评分时才 opt-in。
6. **列出 observe 表面**: 教师 `ObserveDrawer` 里要不要看这种题型? 要的话, 前端 UI plugin 同时实现 `ObserveClassView` + `ObserveStudentView`。

写不出上面六条 (10 行内) 就说明设计还没准备好。

## 3. 实现走查

### 3.1 Exercise type plugin (主战场)

后端 + 前端两半的逐步骤指南在同目录的 [`exercise-plugin-extension-guide.md`](./exercise-plugin-extension-guide.md)。重点:

- 后端 plugin 文件 (1 个): 实现 `ExerciseTypePlugin`, 用 `@ExerciseType('<type>')` 装饰让 registry 自动发现。要实现的方法: `answerKeySchema`、`sanitize`、`grade`、`buildCheckItems`, 可选实现 `buildGradePrompt` + `parseGradeResponse` (§14 L3 契约)。
- 前端 UI plugin entry (1 个): export 一个 `ExerciseUIPlugin`, 包含 `Component`、`canSubmit`, 可选 `localGrade`、`enrichFromApi`/`enrichFromManifest`、`formatSubmitData`、`handleCheckResult`, 以及两个 observe lazy component。
- 可选的 `.stories.mjs` 文件放在 plugin 同目录, 用于在 `exercise-preview` 沙箱里预览。

一个完整 plugin 两个文件加起来大约 200–400 行。超过 600 行的话, 这个题型很可能是两个题型套了同一个壳。

### 3.2 后端 handler / service

标准 NestJS。要遵守的约定:

- 每个文件一个 `@Injectable()`; 每个文件一种职责。
- 通过注入 `AiPromptBuilder` 调 LLM —— 永远不要直接 `fetch` 到模型端点。
- 新 controller 必须加 `@ApiTags(...)`。Swagger 漂移是 code review 里最常见的 nit。
- 仓储用 TypeORM; 测试里用 `getRepositoryToken(Entity)`, 永远不要手工实例化 Repository。

打分器放在 `classroom/exercise/graders/`; observe handler (教师 drawer 的数据) 放在 `classroom/observe/handlers/`; observation handler (LLM 驱动的 dashboard) 放在 `classroom/observation/handlers/`。这三类长得很像, 区别在触发它们的事件不同。

### 3.3 React UI 片段

学生树在 `frontend/src/components/student/`, 教师在 `components/teacher/`。两边遵循同一种模式:

- 状态逻辑和副作用 → `hooks/` 里的 custom hook (这样没 DOM 也能单测)。
- 纯解析/格式化 helper → 跟组件同目录的独立 `*.ts` (这样不依赖 React 也能单测)。
- 组件文件 import 上面两个, 自己保持声明式。

改组件时同时检查父组件有没有重复渲染 —— 这是个反复出现的 bug。如果组件要支持 review-restore 流程, 走 `frontend/CLAUDE.md` 里的菜谱 (`useReviewRestore` hook + 一个纯的 `parseXxxReview` export + 在 `exercise/__tests__/review-restore.test.ts` 加单测)。

### 3.4 测试不是可选项

约定:
- **后端**: Jest。spec 跟源代码并列 (`foo.service.ts` ↔ `foo.service.spec.ts`)。新文件 statement coverage ≥80%; 整个项目目前在 ~91%。
- **前端**: Vitest。测试放在 `__tests__/` 文件夹。没有 DOM 测试的 UI 组件可以接受; 纯 helper 和 hook 必须有测试。
- **E2E**: Playwright。新增的可观测行为要在 `e2e/specs/` 加一个 spec。`e2e/helpers/api-client.ts` 跟前端 API 表面对齐 —— 新加 endpoint 时一并扩展。
- 非平凡修改前后都要跑完整测试套件。根目录 `CLAUDE.md` 的 post-implementation checklist 是唯一权威。

## 4. 调试

### 4.1 后端

| 现象 | 第一现场 |
| --- | --- |
| Endpoint 500 | `backend.log` (`tail -f`), NestJS 会打完整堆栈 |
| 打分错误 | 看 grader 的 `grade()` 返回值 + manifest 里 `answerKey` 形状; 99% 是 schema 漂移 |
| Observe 数据缺失 | handler 的 `compute()` 在 `ctx.answerKey?.type !== '<expected>'` 时早返回; 检查类型守卫 |
| LLM 没被调到 | `AiPromptBuilder.callLlm` / `callVisionLlm` 每次都打 log; 日志里没看到你的 prompt 就说明代码路径没走到调用点 |

`AiPromptBuilder` 会把每次请求的 trace 写到 `data/llm-trace/`。LLM 相关功能行为异常时, 把最近的文件拉出来 —— 输入、响应、模型名都在里面。

常用单次命令:
```bash
# 改完 manifest.json 后重新 seed (seed 逻辑只 insert, 不 update):
cd solutions/business/live-lesson/backend
node -e "const fs=require('fs'),p=require('path'),DB=require('better-sqlite3');\
  const raw=fs.readFileSync(p.resolve('..','data/lessons/ideal-beauty-reading/manifest.json'),'utf-8');\
  const m=JSON.parse(raw); const db=new DB(p.resolve('data/live-lesson.db'));\
  db.prepare('UPDATE lessons SET manifest_json=? WHERE id=?').run(raw,m.id); db.close();"

# 用 watch 模式跑单个 Jest 文件:
cd solutions/business/live-lesson/backend && npx jest <文件 pattern> --watch
```

### 4.2 前端

- Vite HMR 改代码时一般保持状态。状态恢复出现异常时, 强制完整刷新 (`Cmd+Shift+R`)。
- React DevTools 里可以看到 `ExerciseHost` 上 `useExerciseUIPlugin(type)` 的结果; 如果题型显示为 fallback 的 "未实现" 占位符, 说明 plugin 没注册。
- 浏览器 Network 面板是验证前后端契约最便宜的方式。如果请求打到 `http://localhost:3001` 而不是 3007, 说明 CCAAS SDK 的 `serverUrl` 配错了 (规则见 `CLAUDE.md`)。
- SSE / 轮询调试: polling endpoint (`GET /:code/state`) 幂等, 在 DevTools Console 手动刷一下:
  ```js
  await (await fetch('/api/classroom/<CODE>/state')).json()
  ```

### 4.3 常见踩坑

- **Jest 测试里 `Cannot find module 'fs'`**: 你用了 `import` 来 mock `fs`。改成文件顶部 `jest.mock('fs')` + `const fs = require('fs') as jest.Mocked<typeof import('fs')>`。新版 Node 把 `existsSync` 设为 non-configurable, 所以 `jest.spyOn` 会失败。
- **localStorage `'sub:CODE:0'` 跨测试残留**: 在 `beforeEach` 里 `vi.stubGlobal('localStorage', …)`, `afterEach` 里 restore (参考 `submission-cache.test.ts`)。
- **Playwright 报 `400 name must be ≤20 characters`**: 后端学生名长度限制 20 字符; 测试 fixture 取短一点。
- **E2E 点 FAB 卡住**: StudentGuide 弹窗大概率盖住了。交互前先显式关闭它。

## 5. 预览

### 5.1 本地 dev (日常迭代)

```bash
# Terminal 1 — solution backend (port 3007)
cd solutions/business/live-lesson/backend && npm install --legacy-peer-deps && node dist/main.js

# Terminal 2 — solution frontend (port 5283)
cd solutions/business/live-lesson/frontend && npm install && npm run dev

# Terminal 3 — 主 CCAAS backend, 只有改聊天/Agent 流时才需要 (port 3001)
npm run dev:backend
```

浏览器打开 `http://localhost:5283/`, 选一节课, 拿到的 join code 在第二个标签页打开 `http://localhost:5283/join`。你现在同一间教室里既是老师又是学生 —— 两侧都能回放完整流程。

### 5.2 Exercise plugin preview (不开整个 app)

`packages/exercise-preview` 这个包提供一个轻量 iframe 沙箱, 根据 `.stories.mjs` 文件渲染任意 plugin。迭代新题型 UI 时用它, 不用启整套课堂:

```bash
cd packages/exercise-preview
npm run build
node dist/cli/index.js --port 43451 bundles/<你的 bundle>
# 打开 http://127.0.0.1:43451
```

admin playground 里有个 `Share Link` 按钮可以生成短码, 贴到 Slack 就能分享某个 story 的 snapshot。

### 5.3 E2E 预览 (Playwright UI)

```bash
cd solutions/business/live-lesson/e2e
npm install
BACKEND_URL=http://localhost:3007 FRONTEND_URL=http://localhost:5283 npx playwright test --ui
```

`--ui` 模式会启 Playwright 的时间回放调试器 —— 选一个 spec, 看浏览器自动操作, 逐帧看 DOM snapshot。需要验证新 endpoint 真的通过线上模型走通时, real-LLM 集成 spec (`14-real-llm-integration.spec.ts`) 是一个很好的模板。

## 6. 提交前 checklist (强制)

任何代码改动之后, 都要按这个顺序跑完三步才能认为 task 完成。根目录 `CLAUDE.md` 明确把跳过任一步定义成"流程违规":

1. **跑测试**
   - 后端: `cd packages/backend && npx jest --no-coverage` (或 `solutions/business/live-lesson/backend`)
   - 前端: `cd solutions/business/live-lesson/frontend && npm test`
   - E2E (动了任何用户可见的东西时): `cd solutions/business/live-lesson/e2e && npx playwright test`
2. **Code review**: 对所有改动文件跑 `code-reviewer` agent。
3. **Harness**: 在 repo 根跑 `bash scripts/harness-checks.sh`。

review 发现问题先修再继续。harness 是 commit 出门前的最后一道闸。

## 7. 还是卡住时

- Memory 和约定: `/Users/niex/.claude/projects/.../memory/MEMORY.md` 每次 Claude 会话都会加载, 里面列了所有反复出现的坑 (serverUrl 陷阱、commit 格式、harness 规则)。
- 架构决策: repo 根目录的 `docs/adr/` 和同目录的 [`exercise-plugin-architecture.md`](./exercise-plugin-architecture.md)。
- 某次具体 PR 的原因: `git log -p` 是唯一真相; 这个 repo 的 commit message 是按 load-bearing 标准写的, 信息量足够。

实在卡住的话, 最优解是约一个 15 分钟 pairing —— 三只眼睛打败任何文档。
