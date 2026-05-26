# Creator v7 架构设计 — 把 agent-runtime 接到课程作者面

> **Status**: 设计稿（Phase B output）+ **大部分已落地**，见 §11 "实施进度快照"
> **Audience**: 接手实施的工程师；技术 review；销售/产品基本理解架构
> **Companion**: [`solutions/business/live-lesson-creator/docs/poc-result.md`](../../live-lesson-creator/docs/poc-result.md) 是这个设计的可行性证据

---

## 1. Context

`solutions/business/live-lesson/design/surfaces/creator-v7.html` 是一份设计原型。它在现有 v6 课程作者界面上加了三件大事：

1. **左侧 AI 聊天 panel** —— 多会话、上下文感知、辅助老师改 manifest
2. **动态 tab 系统** —— 文件/审计按需开 tab
3. **文件 popover** + 简化 top bar

其中最有产品张力的是 **左侧 AI panel**。它的产品意图：让老师在写课程的过程中**和 AI 协作**完成繁琐的 manifest 编辑工作（加题、写 rubric、配 scaffold）。

与此同时（无意中），我们已经搭好了支撑这件事所需要的所有后端基建：

| 组件 | 路径 | 状态 |
|---|---|---|
| **agent-runtime** 核心包 | `packages/agent-runtime/` v0.2.0 | ✅ Phase 1.6 shipped |
| **agent-runtime backend 集成** | `packages/backend/src/sessions/agent-runtime/` | ✅ shipped |
| **`tenant.config.artifactUrl` 自动 wire** | `solutions/business/<slug>/solution.json` + `SOLUTIONS_DIR` env | ✅ shipped |
| **REST artifact 三件套** | live-lesson `/api/projects/:id/artifacts` GET/PUT/DELETE | ✅ shipped |
| **`/creator/` real UI** | `solutions/business/live-lesson/creator/` Vite app | ✅ 在用 `/api/projects` |
| **change stream SSE** | `/projects/:id/changes` | ✅ subscriber 已通；事件来源仅 agent |

**结论**: 两边都现成了，差一层粘合 + 一个把它讲清楚的设计文档。这份文档把架构落定，下一步是按 §10 路线图实施。

---

## 2. 架构图

### 2.1 静态视图

```
                ┌─ creator-v7 UI (browser) ───────────────────┐
                │                                              │
                │  Left AI panel:                              │
                │   • input → POST /sessions/:sid/messages    │
                │   • EventSource :3001/sessions/:sid/events  │
                │   • EventSource :3001/projects/:pid/changes │
                │                                              │
                │  Tabs (Plan / Exec / Skills / Review / *):   │
                │   • polling GET :3007/api/projects/:pid      │
                │   • on SSE change event → re-fetch          │
                │                                              │
                │  File popover:                               │
                │   • GET :3007/api/projects/:pid/artifacts    │
                └──────────────┬───────────────┬───────────────┘
                               │               │
                               │ session ops   │ project file ops (read)
                               │               │
                               ▼               ▼
┌── @kedge-agentic/backend (:3001) ─┐    ┌── live-lesson backend (:3007) ─┐
│                                    │    │                                 │
│  POST /sessions/:sid/messages      │    │  ProjectController              │
│   ▶ AgentEngine (Claude CLI):      │    │   POST   /api/projects          │
│     • workspace mounted via         │    │   GET    /api/projects/:id      │
│       Local|AgentFS WorkspaceProv   │    │   GET    /api/projects/:id/files│
│     • project/ ← from REST artifact │◄───┤   PUT    /api/projects/:id/files│
│       source (lazy load on bind)    │    │   POST   /api/projects/:id/publish│
│     • skills/ ← from solution.json  │    │                                 │
│     • just-bash sandbox             │    │  ──── agent-runtime contract ─── │
│                                    │    │   GET    /api/projects/:id/artifacts│
│  Turn boundary:                    │    │   PUT    /api/projects/:id/artifacts│
│   ▶ SessionAssetSyncer:            │◄───┤   DELETE /api/projects/:id/artifacts│
│     • pull current state from      │    │                                 │
│       artifact source              │    │  CourseProject / ProjectFile     │
│     • diff vs agent's writes       │    │  (TypeORM, SQLite)               │
│     • SyncEngine: agent-wins        │    │                                 │
│     • saveArtifact() / delete       │────▶                                 │
│     • emit change → SSE             │    │                                 │
│                                    │    │                                 │
│  GET /projects/:pid/changes (SSE)  │    │                                 │
│  POST /projects/:pid/invalidate     │    │                                 │
│                                    │    │                                 │
└─────────────────────────────────────┘    └─────────────────────────────────┘
              ▲                                       ▲
              │ tenant.config.artifactUrl ←───────────┘
              │ (set via solution.json import)
              │
              └─ solutions/business/live-lesson-creator/
                   solution.json     ← tenant + artifactUrl + sessionTemplate
                   skills/manifest-editor/SKILL.md  ← agent behavior
```

### 2.2 一轮 agent turn 的时序

```
teacher在UI输入   ccaas backend                        live-lesson backend
"加一道关于p3的quiz" │                                    │
       │            │                                    │
       ▼            │                                    │
POST /sessions/:sid/messages                             │
{ message:..., tenantId: "live-lesson-creator" }         │
       ────────────▶                                     │
                    │                                    │
                    ├ getOrCreate session (auto)         │
                    │   → tenant=live-lesson-creator     │
                    │   → SessionAssetSyncer.onBound?    │
                    │     (only fires if projectId bound)│
                    │                                    │
                    ├ workspace mount (Local provider):  │
                    │   .agent-workspace/sessions/<sid>/ │
                    │   ├── project/    (empty at first) │
                    │   ├── skills/manifest-editor/...   │
                    │   └── (no entities/resources for   │
                    │        live-lesson-creator)         │
                    │                                    │
                    ├ spawn Claude CLI:                  │
                    │   cwd=workspace                    │
                    │   tools=just-bash + Read/Write     │
                    │   prompt+="@manifest-editor"        │
                    │                                    │
                    ├ event: turn.started                │
                    │   ─SSE────────────────────────────▶│ (to UI subscriber)
                    │                                    │
                    │  CLI: ls project/                  │
                    │   → empty! (no artifact load yet)  │
                    │                                    │
                    │  CLI: cat skills/manifest-editor/  │
                    │       SKILL.md                     │
                    │   → reads behavioral spec          │
                    │   → realizes needs artifact load   │
                    │                                    │
                    │  CLI: emits tool_use Read project/ │
                    │   execution/manifest.json          │
                    │                                    │
                    │  *** here's the catch ***          │
                    │  Without bindToProject() called    │
                    │  first, project/ never gets the    │
                    │  artifact source mounted, agent    │
                    │  sees empty dir, can't edit        │
                    │                                    │
                    │  ┌─ if bound:                      │
                    │  │   SessionAssetSyncer.sync()     │
                    │  │   ▶ GET /api/projects/:pid/    │
                    │  │     artifacts ─────────────────▶│
                    │  │   ◀────────── [{path,content,..}]│
                    │  │   ▶ writes to workspace         │
                    │  │   project/execution/manifest    │
                    │  │   .json                         │
                    │  └────                              │
                    │                                    │
                    │  CLI: Write project/execution/    │
                    │       manifest.json (modified)    │
                    │                                    │
                    │  CLI: emits tool_use Write        │
                    │                                    │
                    │  CLI: turn complete                │
                    │                                    │
                    ├ SessionAssetSyncer.afterTurn():    │
                    │   • diff workspace vs DB snapshot  │
                    │   • SyncEngine.merge:              │
                    │     agent wrote → agent wins      │
                    │   • for each touched path:         │
                    │     PUT /api/projects/:pid/        │
                    │     artifacts?path=... ───────────▶│
                    │                          ◄────── 204│
                    │   • emit ChangeEvent → subscribers │
                    │                                    │
                    │ event: turn.completed              │
                    │   ─SSE────────────────────────────▶│
                    │                                    │
                    │ change event: {path,kind:'put'}    │
                    │   ─SSE (separate stream)─────────▶│ UI re-fetches file
                                                         │
                                                         │ live-lesson DB has
                                                         │ new manifest.
                                                         │ Next /publish call
                                                         │ would re-validate
                                                         │ + ship to students.
```

> **Critical**: the bound-or-not branch. Without `SessionService.bindToProject(sessionId, tenantId, projectId)` being called before the first turn, the agent has no project files to read or write. This is one of the three gaps in [poc-result.md §1-3](../../live-lesson-creator/docs/poc-result.md).

---

## 3. 三个关键粘合点详解

### 3.1 `solution.json` + `SOLUTIONS_DIR`

启动 ccaas 时 `SOLUTIONS_DIR=$path` 环境变量指向一个根目录，里面每个子目录如果有 `solution.json`，`SolutionLoaderService.onModuleInit` 就会调 `import()` 把它装进 DB。

**对 creator-v7 而言**：我们在 `solutions/business/live-lesson-creator/solution.json` 里声明：

```json
{
  "schemaVersion": "3.0",
  "tenant": { "slug": "live-lesson-creator", "name": "...", "description": "..." },
  "mode": "simple",
  "discovery": { "enabled": true },
  "skills": ["skills/*"],
  "sessionTemplates": {
    "edit-lesson": {
      "description": "Conversational lesson authoring",
      "enabledSkills": ["manifest-editor"],
      "skillPromptMode": "inline"
    }
  },
  "artifactUrl": "http://localhost:3007/api"
}
```

这一行 `artifactUrl` 是和 live-lesson backend 的全部约定。`ProjectArtifactSourceRegistry` (ccaas 内部) 按 session 的 `tenant.slug` 反查 `tenant.config.artifactUrl`，构造一个 `RestProjectArtifactSource(url)`，agent-runtime 就这样定向到正确的后端。

**变更点**：今天 `SolutionLoaderService` 不会 walk `skills/*` 并把 SKILL.md 注册成 Skill 实体（详见 [poc-result.md §1](../../live-lesson-creator/docs/poc-result.md)）。需要补一个 follow-up patch；这是 v7 上线的硬阻塞。

### 3.2 `RestProjectArtifactSource` 合约

`packages/backend/src/sessions/agent-runtime/rest-project-artifact-source.ts` 调 live-lesson 的：

```
GET    {artifactUrl}/projects/:projectId/artifacts        → [{ path, content, type, attributes? }]
PUT    {artifactUrl}/projects/:projectId/artifacts?path=  → { content, type, attributes? }
DELETE {artifactUrl}/projects/:projectId/artifacts?path=  → 204 (idempotent)
```

live-lesson side 已经实现在 `solutions/business/live-lesson/backend/src/project/project.controller.ts:85-115`。**已经验证 GET + PUT 双向跑通**（poc-result.md §"What we DID verify"）。

### 3.3 SyncEngine 在 turn boundary 做的事

每次 agent turn 完成 (`session.turn.complete` 事件)：

1. `SessionAssetSyncer.afterTurn(sessionId)` 触发
2. 通过 binding 反查 `projectId`
3. 调 `artifactSource.loadArtifacts(projectId)` 拉当前 DB 状态
4. 通过 `WorkspaceProvider.diff()` 读出 agent 这轮在 workspace 里写了什么
5. `SyncEngine.merge(dbState, agentDelta)`:
   - 同一 path 双写 → **agent 赢**（设计选择；详见 `agent-session-runtime-spec.md`）
   - 只在 DB 里 → 留着
   - 只在 agent 里 → 写回 DB
6. 对每个变化 path 调 `artifactSource.saveArtifact() / deleteArtifact()`
7. 发 `ChangeEvent` 给所有 `/projects/:pid/changes` SSE 订阅者

**这就是为什么 SSE 是 "agent → backend" 单向的**：SyncEngine 只在 agent 写之后才发事件。直接 PUT live-lesson `/api/projects/:id/files` 的人类编辑不会触发这个 SSE。详见 §6 的"双源更新"讨论。

---

## 4. UI tab → 后端能力映射

| v7 UI 区域 | 干什么 | 后端怎么支撑 | 状态 |
|---|---|---|---|
| **左侧 AI panel** | 多会话聊天 | `POST /sessions/:sid/messages` SSE 流 + `manifest-editor` skill | 架构 OK；待 skill 自动注册补丁 |
| **Plan tab** | 教学计划 / 目标编辑 | `PUT /api/projects/:id/artifacts?path=plan/lesson-plan.md` (走 agent) 或 `PUT /files?path=` (人编辑) | ✅ |
| **Exec tab** | Steps / blocks 编辑 | `PUT /artifacts?path=execution/manifest.json` | ✅ |
| **Skills tab** | AI 技能开关 | 复用 `@Auth('skills:write')` skills CRUD | ✅ |
| **Review tab** | 审计课程设计 | **新建** `POST /api/projects/:id/audit` 跑 ManifestSchema + 业务规则 | ❌ 待实现 |
| **File popover** | 文件浏览 | `GET /api/projects/:id/artifacts` 列表 + 单条 GET | ✅ |
| **动态 tab 实时刷新** | UI 跟随 agent 写 | EventSource `/projects/:pid/changes` | ✅ subscribe OK；详见 §6 |
| **多 conversation 隔离** | 每个聊天独立上下文 | 每个 conversation = 一个 sessionId；都绑同一个 projectId | 需要 §5 的"多 session 同 project"考虑 |

---

## 5. `manifest-editor` skill 设计

详见 `solutions/business/live-lesson-creator/skills/manifest-editor/SKILL.md`。要点：

### 5.1 知道什么

- `project/plan/lesson-plan.md` 是 markdown narrative（教学目标 / 受众 / 教学法）
- `project/execution/manifest.json` 是 Zod 校验的结构化 lesson 定义
- 11 种 exercise type 的 `answerKey` shape (`tools/answerkey-<type>.md`)
- observe 规则 + scaffold 模式 (`tools/observe-rules.md`, `tools/scaffold.md`)
- 提供 `scripts/lint-manifest.sh` 用 jq 做 pre-write smoke 检查

### 5.2 能做什么

- 加 / 改 / 删 readingStep
- 从一段课文生成 quiz / select-evidence 题
- 配 scaffold ladder（按 partDef.scaffold.levels）
- 校验 manifest（id 没变 / idx 唯一 / answerKey 完整）

### 5.3 不该做什么

- 直接调 live-lesson HTTP API（sync 帮做）
- 改 `manifest.id`（pinned at create-time）
- 创建 / 删 / 发布 project（人在 UI 做）
- 触 `project/` 外的文件

### 5.4 渐进式 disclosure

SKILL.md 故意精简，大部分领域知识在 `tools/<topic>.md` 子文件里。Agent 按需 `cat`，避免一上来就把所有 schema 灌进上下文。

---

## 6. 双源更新 / change stream 设计

**核心矛盾**: agent 通过 SyncEngine 改 → SSE 触发；老师在 UI 直接编辑 → SSE 不触发（live-lesson 不发事件）。

### 6.1 三个候选方案

**A. UI 同时订阅两边 + 自己 reconcile** （最低代价，先做这个）
- EventSource `:3001/projects/:pid/changes` 监听 agent 写
- 老师自己点 "保存"（PUT `:3007/api/projects/:pid/files`）时本地立即 update，不依赖 SSE
- 其他客户端（同一老师另一个 tab、同事）看不到 → 接受这种"单写者"局限

**B. live-lesson 也发 SSE** （正解，但工作量大）
- live-lesson 加 `GET /api/projects/:id/changes` 发自己的事件
- ccaas 端 SyncEngine 接收 + 反向 invalidate workspace
- 真双向、多客户端一致 — 但需要 live-lesson 端实现事件系统 + 解决谁是 source-of-truth

**C. SyncEngine 主动 poll live-lesson**
- 每 30s loadArtifacts + 比对 cached snapshot
- 简单但延迟高且费 LLM 上下文

**推荐**：v1 走 A（最快交付），v2 视真实多客户端需求决定要不要 B。

### 6.2 SSE 事件 schema

`/projects/:pid/changes` 已经定义。SSE 流出两种"信封"事件 + 三种数据事件。

**信封事件**（由 controller 包出 — `packages/backend/src/sessions/agent-runtime/project-changes.controller.ts:75,83`）:
- `{ projectId, kind: 'subscribed', at }` — 流建立成功
- `{ projectId, kind: 'heartbeat', at }` — keep-alive 防代理超时

**数据事件**（`ChangeEvent` per `packages/agent-runtime/src/sync/types.ts:23`）:
```ts
{
  projectId: string,
  path: string,                                  // 同 artifact 的 path
  source: 'agent' | 'gui' | 'system',
  kind: 'created' | 'updated' | 'deleted',
  at: string,                                    // ISO8601
  actor?: string                                 // 谁触发（user id / session id）
}
```

UI 侧的 reducer:
- `subscribed` → 初始化（建立连接确认）
- `heartbeat` → 忽略 / 重置超时计数
- `created` | `updated` → fetch `/api/projects/:pid/files?path=<path>` 拿 content + diff 进 local state
- `deleted` → 从 local state 移除

---

## 7. 三个未决 / 风险

### 7.1 多 session 同 project 的冲突（中风险）

v7 UI 允许同一老师开 N 个 conversation。每个 conversation = 一个 session。如果两个 session 绑同一个 projectId，concurrent 写会怎样？

- `SessionAssetSyncer` 有 per-projectId mutex（poc 验证文档里 §"sessions"）—— 同 project 的写串行
- 但用户预期可能是"独立 conversation 不应该共享 manifest 改动" → 产品决策：是否让一个 conversation 改了，其他 conversation 立刻看到？
- v1 推荐：默认看到（共享 project），允许用户开"独立 sandbox conversation"作为 escape hatch

### 7.2 LLM 延迟与成本（已知）

每次 agent turn ≈ 3-10s（Claude CLI spawn + LLM call + sync write-back）。一次 "加 3 题 quiz" 可能 10-30s。

- v7 UI 必须显示流式状态（thinking, tool calls）—— 静默 10s 让用户以为卡死了
- 成本控制：默认开 `bundles: shared-context` 让 conversation 之间共享 prompt 缓存
- 鼓励老师用 "compose 一个 prompt 跑批量改" 而不是来回点击

### 7.3 公网部署的 auth gap（部分已修；剩多租户隔离）

**已修（commits `56173292` / `b594a191` / `37d50e82`）**：浏览器不再持有任何 ccaas key。所有 ccaas 调用走 live-lesson 后端代理（`CcaasProxyController` + `CcaasChatProxyController`），后端用 env `CCAAS_API_KEY` 作为唯一 token，server-to-server。`scrubToken` 在 log + error 消息层防 key 泄漏到任何 user-visible 字符串。

**仍要做（生产部署前）**：

1. **solution 自己的端用户 auth** — live-lesson 后端今天的 `ProjectController` / `CcaasProxyController` 都是 `@Public()`（无 guard）。把 cookie session / JWT / OIDC 等 solution-level 端用户认证加上后，proxy controllers 应该也加 guard。
2. **多老师隔离** — 一个老师不能看另一个的 project。`CourseProject` 实体需要 `ownerId` / `tenantId` 列 + 所有 endpoint 加 user-scope 过滤。

ccaas 那边的 admin/skill auth 已经不是 creator-v7 的关注点：因为浏览器不直接调 ccaas，ccaas 那边只看到 live-lesson 后端的一个 tenant key，端用户身份在 live-lesson 后端的 guard 层。

详见 [[ccaas-proxy-pattern memory note]] 和 `packages/backend/docs/AUTHENTICATION_AND_AUTHORIZATION.md`。

---

## 8. 从 `/creator` 到 v7 的迁移策略

### 阶段 1：v7 作为独立 React app，complementing `/creator`

- v7 部署在 `/creator-v7` 路径
- 共享 `/api/projects` 后端，**完全不动**现有 `/creator` 代码
- 老师可以在两边切换；v7 是 alpha
- 风险：UI 分裂、两套代码维护

时间：~2 周（v7 UI 真做 + 接上 §4 mapping）。

### 阶段 2：v7 替换 `/creator`

- 把 v7 的 "AI panel" + "动态 tab" + "文件 popover" feature 完全吸收
- 老 `/creator` 改为兼容 redirect 或归档
- 老师不再有选项分裂

时间：~1 周（迁移既有用户 + 数据兼容性兜底）。

### 阶段 3：扩散到其它 surface

类似机制能用到：
- teacher dashboard observation surface（AI helper 帮老师解读数据）
- student review surface（AI 帮学生分析自己的错题）
- 出题平台（无 lesson 结构的题库管理）

不在本设计的 scope，但路径同构。

---

## 9. 必须先解决的工程债（v1 上线前清单）

按风险排序（已修复 / 待修复标注在前）：

1. **[FIXED]** `SessionService ↔ SessionMetadataService` 循环依赖 —— forwardRef 双向修复。
2. **[FIXED]** `SolutionLoaderService` 自动注册 skills —— 现在 walk solution.json 的 `skills` glob，从文件系统 import SKILL.md + 兄弟文件到 `skills` / `skill_files` 表。详见 `poc-result.md`。
3. **[FIXED]** `POST /api/v1/sessions/:id/bind-project { projectId, tenantId }` 公开 HTTP 端点。绑定后 bootstrap sync 触发，change SSE 立即吐两条 `updated` 事件（per scaffolded file）。
4. **[FIXED]** `SessionMetadata` entity 没在 root `TypeOrmModule.forRoot()` 里 —— 加到 entities 列表。这是发现 G2 时 surface 出来的。
5. **[CRITICAL — deploy blocker]** Auth 模式 —— 给老师 API key 的流程 + UI 怎么获取 + 多租户隔离。今天 PoC 走 `AUTH_ALLOW_ANONYMOUS=true` 绕过。
6. **[HIGH]** live-lesson 是否也发 SSE —— 直接决定多客户端一致性的取舍。
7. **[HIGH]** Review tab 的 `POST /api/projects/:id/audit` —— manifest 业务规则审计端点（schema 校验之外）。
8. **[MEDIUM]** `manifest-editor` skill 完整化 —— PoC 写了 quiz + observe + lint；剩下 10 个 answerKey schema 文档 + scaffold + discuss 配置 等。

---

## 10. 路线图

| 里程碑 | 内容 | 工时 | 阻塞依赖 |
|---|---|---|---|
| M0 | PoC 三个 SSE 流端到端跑通 | 0.5 天 | §9.1, §9.2, §9.4 |
| M1 | v7 UI alpha 上 `/creator-v7` 路径 | ~2 周 | M0 + UI 实施 |
| M2 | manifest-editor skill 完整化 + Review 审计 | 1 周 | M1 |
| M3 | Auth + 多租户隔离 | 1 周 | independent |
| M4 | v7 替换 `/creator` | 1 周 | M2 + M3 |
| M5 | live-lesson SSE（如果需要） | 1 周 | M4 用户反馈 |

总计 v1 ready：~6 周（不含 M5）。

---

## 11. Reviewer 自答的三个最尖锐问题

### Q1: 我们已经有 `/creator` 了，为啥要做 v7？

A: v7 加的不是 "更好的表单"，是 **"和 AI 协作"** 的工作流模式。老师手填 manifest 是繁琐的；改 3 题 quiz 的 rubric 在 v6 里要点 30 次，在 v7 里写一句话。这是产品级别的杠杆，不是 UI polish。

### Q2: 为啥不直接让 v7 UI 调 LLM API，省去 agent-runtime 这一层？

A: 三个理由：
1. **工具调用 / sandboxing** —— agent 要能 cat / grep / sed manifest，纯 LLM API 不能。agent-runtime 已经把 just-bash 沙箱、workspace 隔离、git worktree、AgentFS 都做了。
2. **多轮上下文 / resume** —— agent-runtime 管 session，conversation 跨 turn 保持状态。前端只调 LLM API 要自己重建上下文。
3. **未来扩展** —— agent 还能调 MCP server（比如读 lesson 历史数据辅助决策）。今天不用，但留路径。

### Q3: SyncEngine 的 "agent wins" 策略会不会冲掉老师手改？

A: 会，但只在**真的双写同一个 path** 时。详见 §6 矛盾分析。v1 推荐方案：UI 把 "我正在编辑" 状态暴露出来；老师手改时不要同时让 agent 工作（产品级互斥），技术上不靠后端强制。

---

## 11.5 实施进度快照（2026-05-26 起持续更新）

设计稿落地了大半。下面按本文章节交叉索引哪些 commit 完成了哪部分，方便后来者跳过已 ship 的工作直奔未做的部分。

| 章节 | 已 ship | 关键 commit | 测试 |
|---|---|---|---|
| §3 粘合点：`tenant.config.artifactUrl` 自动 wire | ✅ | (pre-existing) | `solution-loader.service.spec.ts` |
| §3 粘合点：REST artifact 三件套 | ✅ | (pre-existing) | `project.service.spec.ts` |
| §3 粘合点：SyncEngine turn boundary | ✅ G4 修了竞态 | `00cf76b9` G4 + `ad97344b` 后续 + `3b547a9a` coalesce | `session-asset-syncer.spec.ts` (25) + `message-worker.spec.ts` G4 7 cases |
| §4 左侧 AI panel：聊天 + 多会话 + bind | ✅ | `d022f18a` AiPanel 写真 + 后续多次迭代 | `e2e/specs/16-creator-v7-agent-runtime.spec.ts` |
| §5 `manifest-editor` skill：完整 progressive disclosure | ✅ | `1d4080f7` 初版 + `e274f691` scaffold 含示例 step | `solution-loader.service.skill-walk.spec.ts` |
| §5 校验闭环（Agent 自调 + chat UI 卡片）| ✅ | `00cf76b9` 包含 G4 + validation card 全套 | `project.service.spec.ts` validate cases + `ChatBubble` ValidationCard 分支 |
| §6 change stream + invalidate | ✅ | (pre-existing + proxy migration) | `ccaas-proxy.controller.spec.ts` |
| §7.3 ccaas key 泄漏到浏览器 | ✅ **已修** | `37d50e82` 把 creator 迁到 proxy + `4b642b32` post-review | `ccaas-chat-proxy.controller.spec.ts` (12) + `ccaas-upstream.service.spec.ts` (16) |
| §7.3 多老师隔离 + solution 端用户 auth | ❌ 未做 | — | — |
| §10 Stage 2: v7 替换现有 `/creator` | ❌ 未做（UI 完整迁移）| — | — |

### 新增的、本文设计稿没预见的两个组件

1. **`CcaasChatProxyController`** —— 把 chat / session / bind 三个 ccaas 路由全部代理到 `same-origin /api/sessions/...`。浏览器不持任何 ccaas key。配合 `CcaasUpstream` shared service (env 解析 + `resolveTenantId` 单飞缓存 + `scrubToken` 双形态)，是当前实现的核心。位置：`solutions/business/live-lesson/backend/src/adapters/http/`。

2. **G4 修复（bind-before-spawn）** —— `MessageWorker` 在 `SendMessageDto.projectId` 出现时同步 `await bindToProject + syncer.sync` BEFORE 引擎 spawn，确保 agent 第一轮就能看到 workspace 里的 `artifacts/`。文档当时没意识到这条 race；实现时被发现 + 修复。位置：`packages/backend/src/sessions/services/message-worker.service.ts:170+`。

### 一并修的小坑

- scaffold 现在包含 1 个 publish-valid 的 quiz 示例 step（`project.service.ts:35`），agent 有现成模式可改 + project 创建后直接可发布。`e274f691`。
- SKILL.md 路径从 `project/...` 改回 `artifacts/...` 跟实际 workspace 落盘对齐。
- `useTenantId` hook 整个删除（浏览器不再需要 tenantId）。
- `PasteKeyBanner` UI 删除（不再需要老师粘 key）。

---

## 12. Out of scope（明确不做）

- 公网域名 / SSL / CDN 部署
- 性能优化（LLM 缓存、SSE 重连退避策略等 — 等真有用户再说）
- 离线 / 同步冲突恢复（v1 强依赖网络）
- 移动端 UI
- 多语言（zh-CN 唯一）
- 用 AI 自动生成 课文 article（这是另一个产品方向，需要单独 RAG 设计）

---

## 13. 参考

- [`solutions/business/live-lesson-creator/docs/poc-result.md`](../../live-lesson-creator/docs/poc-result.md) — PoC 实测
- [`solutions/business/live-lesson-creator/solution.json`](../../live-lesson-creator/solution.json) — 接通配置
- [`solutions/business/live-lesson-creator/skills/manifest-editor/SKILL.md`](../../live-lesson-creator/skills/manifest-editor/SKILL.md) — agent 行为说明
- `solutions/business/live-lesson/design/surfaces/creator-v7.html` — UI 设计源
- `solutions/business/live-lesson/design/surfaces/creator-v7-app.jsx` — UI 状态机
- `packages/agent-runtime/` — sync 引擎源
- `packages/backend/src/sessions/agent-runtime/` — backend 集成层
- `packages/backend/docs/SKILL_REGISTRATION.md` — skill 注册全图（v3 schema 部分 TODO）
- `solutions/business/live-lesson/backend/src/project/project.controller.ts:85-115` — artifact 三件套实现
- `solutions/business/demo-sandbox/` — solution 模式的参考实现
