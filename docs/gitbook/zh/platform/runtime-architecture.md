# Runtime 架构

> 10 分钟读懂 ccaas 的运行时分层。覆盖从「浏览器/curl 发请求」到「agent 在沙箱里跑完一轮」之间所有的层。读完之后你应该能：在日志里认出每一层在干什么；知道扩展点在哪儿；选定一个新场景该改哪个文件。

## 一句话总览

ccaas backend 接收会话请求 → 通过 `WorkspaceProvider` 抽象给每个 session 准备一个工作目录（local 真目录 或 agentfs 虚拟挂载）→ 注入 sandbox MCP 让 claude 的 bash 跑在隔离的解释器里 → spawn `claude` CLI 进程作为 agent → 提供 runtime REST API 让运营方看/改 sandbox 的状态。

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser / curl / admin-next                                            │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ HTTPS
            ┌──────────┴──────────────────────────────────────┐
            │ Solution Backend (可选, 例: demo-sandbox :3010) │
            │  · 启动时 POST /admin/solutions/import 注册 skill  │
            │  · 代理 SSE / 暴露领域 REST                        │
            └──────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────────────────┐
│  ccaas Backend (:3001) — NestJS, TypeORM                                │
│                                                                         │
│  Session lifecycle           Skill registry         Runtime REST API    │
│  ────────────────            ──────────────         ─────────────────   │
│  SessionService              SkillsService          SessionFsService    │
│   ↓ create                    ↓                      · fs/diff          │
│  WorkspaceProvider           BaseMaterializer        · fs/timeline      │
│   ├─ Local: mkdir                ↓ skills → 磁盘     · fs/snapshot      │
│   └─ Agentfs:                AgentfsProvider          · fs/rollback     │
│       agentfs init           SessionAssetMaterializer SessionMetadataS  │
│        + mount (FUSE/NFS)     · entities/ + resources/  · meta KV CRUD  │
│                                                                         │
│  SandboxService              CliProcessService                          │
│   · 注入 __ccaas_bash         ↓ spawn                                   │
│     MCP server                                                          │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                       ┌──────────┴──────────────────┐
                       │ claude CLI 子进程             │
                       │  · cwd = workspace mount     │
                       │  · MCP: solution + sandbox    │
                       │  · 原生 Bash 已禁用，强制走     │
                       │    mcp____ccaas_bash__bash    │
                       └──────────────────────────────┘
```

记住三个组合点：
1. **Workspace** = 文件视角（agent 能读到什么文件）
2. **Sandbox** = 工具视角（agent 的 bash 经过谁）
3. **Asset materialization** = 内容来源视角（哪些文件被预先放到 workspace 里）

下面按 session 从生到死的顺序讲一遍每一层。

---

## 1. Session 的生命周期

### 1.1 创建（`POST /api/v1/sessions/:id/messages`）

调用方（前端 / solution backend 代理 / curl）发送第一条消息时触发 session 创建。代码入口：

- `packages/backend/src/sessions/sessions.controller.ts:281-415` — 接收请求，做 solution resolve + skill resolve
- `packages/backend/src/sessions/session.service.ts:_createNewSession` — 真正的创建逻辑

关键步骤（按代码执行顺序）：

```
1. SessionService.getOrCreateSession()
   ├─ pendingCreates Map dedup (并发同 id 安全)
   └─ _createNewSession()
       ├─ WorkspaceProvider.create({ sessionId, solutionId })
       │    → 返回 WorkspaceHandle { path: '...', snapshot, rollback, diff, timeline }
       │    → path 是 agent 的 cwd
       ├─ SessionAssetMaterializer.materialize(handle.path, solutionId)
       │    → 把 solution 的 entities/ + resources/ 拷进 workspace 根
       ├─ 持久化 ManagedSession 到内存 Map + DB
       └─ 之后才 spawn claude（在 CliProcessService.ensureCLIProcess()）
```

### 1.2 Spawn claude（`CliProcessService.ensureCLIProcess`）

文件：`packages/backend/src/sessions/services/cli-process.service.ts`

`spawn(this.claudeCliPath, args, { cwd: session.workspaceDir, env: { ... } })`。
关键的 `args` 由 `applyMcpAndSandbox()`（同一文件，~line 62）拼出来，主要是：
- `--output-format stream-json --input-format stream-json --verbose --permission-mode bypassPermissions --permission-prompt-tool stdio`
- `--mcp-config <json>` — 包含 solution-provided MCP servers + ccaas-injected `__ccaas_bash`
- `--disallowed-tools Bash` —— **关键**：禁用 claude 的原生 Bash，迫使它走 sandbox MCP
- `--append-system-prompt <text>` — solution 的 prompt + sandbox 引导文本（用硬分隔符隔开）

### 1.3 Agent 跑（claude 进程内）

claude 看到的世界：
- `cwd` 是 `session.workspaceDir`（对 agentfs 来说是 FUSE/NFS 挂载点）
- 文件操作（`Read`/`Write`/`Edit`/`Grep`/`Glob`）走 host fs 系统调用 → 落到挂载点 → 被 agentfs daemon 路由到 SQLite delta
- bash 命令走 `mcp____ccaas_bash__bash` MCP 工具 → just-bash 解释器 → `ReadWriteFs` → 又落到挂载点

→ 两条工具路径都隔离在同一个 agentfs delta DB 里。

### 1.4 关闭（`SessionService.shutdown` / TTL 到期）

`workspaceProvider.close(sessionId)` 会：
- Local provider：no-op（目录留着）
- Agentfs provider：`umount` + 停掉 daemon 子进程，但 **delta DB 文件保留**（per-session `_agentfs_deltas/<id>.db`）

→ 关闭后还能用 runtime REST API 看 `fs/diff` 吗？**不能**，session 从内存 Map 删了之后这些 API 返回 404（forensic re-mount 在 backlog 里）。

如果 Solution 用了 Ontology + Workflow 层，session 关闭时还需要单独通知平台 WorkflowEngine 释放每 session 的 IndicatorRegistry 目录 + 引擎队列。详见 [Ontology & Workflow — Session 生命周期](../ontology/session-lifecycle.md)。

---

## 2. WorkspaceProvider — 文件层抽象

文件：`packages/backend/src/sessions/workspace/`

| 实现 | 适用 | 给 agent 的文件视角 |
|---|---|---|
| `LocalWorkspaceProvider` | 开发 / 不想装 agentfs | 真实 host 目录 `${WORKSPACE_DIR}/sessions/<id>/` |
| `AgentfsWorkspaceProvider` | stage-1 自托管 / 想要沙箱 | agentfs 挂载点（macOS NFS / Linux FUSE），后端是 SQLite delta |

选哪个由 `WORKSPACE_PROVIDER=local | agentfs` 环境变量决定，`WorkspaceProviderFactory` 在模块初始化时选定。

`WorkspaceHandle` 接口（`workspace/types.ts`）：
```ts
{
  sessionId: string;
  path: string;                              // 必有，agent 的 cwd
  snapshot?(label): Promise<string>;         // agentfs only
  rollback?(label): Promise<void>;           // agentfs only
  diff?(): Promise<FsDiffEntry[]>;           // agentfs only — 见 runtime-api
  timeline?(opts?): Promise<FsTimelineEntry[]>; // agentfs only
}
```

**为什么是抽象**：1) 让 backend 主路径（CliProcessService、SessionService）不关心存储实现；2) 让 agentfs 的 init/mount/snapshot 复杂逻辑只活在 AgentfsProvider 里；3) 单测可以用 LocalProvider 不依赖 agentfs binary。

设计推导见 `packages/vfs-poc/docs/WORKSPACE_PROVIDER.md`（含并发安全性、agentfs init --force race、停机时挂载清理的 sanity check）。

### 2.1 两种 provider 落盘结构对比

```
LOCAL provider                              AGENTFS provider
═══════════════                             ════════════════

${WORKSPACE_DIR}/                           ${WORKSPACE_DIR}/
└── sessions/                               ├── _agentfs_base/                 ← startup-materialized
    └── <id>/      ◄── agent cwd            │   └── tenants/{X}/
        ├── .claude/                        │       ├── skills/{Y}/...
        └── (agent 写在这里)                 │       └── mcp-servers/...
                                            │
   ↑                                        ├── _agentfs_deltas/
   真实 host 目录                            │   └── <id>.db (+ WAL)            ← 每会话
   (无隔离)                                  │
                                            └── sessions/
                                                └── <id>/  ◄── agent cwd
                                                    ├── .claude/
                                                    ├── tenants/.../skills/    (来自 base, overlay)
                                                    ├── entities/              (来自 SessionAssetMaterializer)
                                                    ├── resources/             (同上)
                                                    └── (agent 写入 → delta)
                                                       ↑
                                                       FUSE/NFS 挂载点
                                                       (虚拟；每会话独立视角)
```

### 2.2 Base overlay + 每会话 delta 是怎么叠加的

agentfs provider 的关键模型：每个 session 看到的文件系统是 **共享只读 base** 和 **会话私有可写 delta** 的并集。

```
                ┌─────────────────────────────────────────┐
                │  agent's CWD view (mount point)          │
                │  e.g. ${WORKSPACE_DIR}/sessions/abc/     │
                │  agent 做 ls/cat/write — 看不到 base     │
                │  vs delta 的区别                          │
                └─────────────────────┬───────────────────┘
                                      │
                  ┌───────────────────┴───────────────────┐
                  │   读 = 先查 delta，没有再查 base       │
                  │   写 = 永远落到 delta                  │
                  └─────┬─────────────────────────┬───────┘
                        │                          │
                        ▼                          ▼
            ┌──────────────────────┐  ┌─────────────────────────┐
            │ 每会话 DELTA          │  │ 共享 BASE                │
            │ SQLite + WAL          │  │ (只读 union)             │
            │ _agentfs_deltas/      │  │ _agentfs_base/           │
            │   <id>.db             │  │   tenants/{X}/           │
            │                       │  │     skills/{Y}/SKILL.md  │
            │ ← agent 全部写入      │  │     mcp-servers/{Z}/...  │
            │ ← 会话私有            │  │                          │
            │ ← destroy() 时删       │  │ ← 后端启动时 BaseMaterializer 一次性 │
            │                       │  │   投影；之后不变          │
            └──────────────────────┘  └─────────────────────────┘
```

**为什么这样组织**：
- 多个 session 共享同一份 skill 内容（base），省磁盘 + 加快 mount
- 每个 session 的写入互不污染（delta 隔离）
- close session 时 delta 留着（可查、可重启），destroy session 时才删
- snapshot/rollback 只操作 delta，base 永不变

---

## 3. Sandbox 层 — bash 怎么被隔离

文件：`packages/backend/src/sessions/sandbox/`

两个组件：

### 3.1 `SandboxService`（`sandbox.service.ts`）

读 `workspace.bashSandbox` 配置（自动默认：provider=agentfs → `just-bash`，否则 `none`）。提供：
- `bashMcpSpec(workspaceDir, sessionId?)` → 返回 MCP server spec（保留名 `__ccaas_bash`），告诉 CliProcessService 怎么 spawn just-bash MCP 子进程
- `disallowedTools()` → 沙箱开时返回 `['Bash']`，用来追加到 claude 的 `--disallowed-tools`
- `systemPromptSteer()` → 一段引导文字，告诉 model 必须用 `mcp____ccaas_bash__bash` 而不是原生 Bash

### 3.2 `just-bash-mcp/server.mjs`

独立的 stdio MCP 进程。每个 session spawn 一个。环境变量 `CCAAS_SANDBOX_ROOT` 指向 session workspace dir。内部用 [just-bash](https://github.com/vercel-labs/just-bash) 的 `ReadWriteFs({ root })` 做隔离的 bash 解释。

**关键**：因为 `WorkspaceProvider=agentfs` 时 `CCAAS_SANDBOX_ROOT` 就是 agentfs 挂载点，**bash 和 claude 的原生 Read/Write/Edit 落到的是同一个 SQLite delta**，没有数据不一致问题。

为什么不用 Turso 的 `agentfs-sdk/just-bash` 直连 SQLite（绕过 mount）？见 [[sandbox-mount-vs-sdk]] 决策记录：mount 必须存在（因为 claude 原生工具走 host fs），既然存在就让 bash 也走 mount，单一心智模型。

### 3.3 Agent 内部的工具路由

下图说明「为什么 native Read/Write/Edit 和 mcp__ccaas_bash__bash 最后落到同一份数据」：

```
              ┌─────────────────────────────────────────────────┐
              │  claude CLI 进程                                  │
              │                                                   │
              │  Read │ Write │ Edit │ Grep │ Glob   ← native    │
              │  Bash  (--disallowed-tools 禁用)                  │
              │  mcp____ccaas_bash__bash             ← 注入的 MCP │
              └────┬──────────────────────────────┬──────────────┘
                   │                              │
                   │ host fs syscall              │ MCP stdio
                   │ (open, read, write, ...)     │
                   ▼                              ▼
           ┌──────────────┐               ┌──────────────────────┐
           │  kernel       │               │ just-bash MCP 子进程  │
           └──────┬───────┘               │  (server.mjs)         │
                  │                       │                        │
                  │                       │  ReadWriteFs({         │
                  │                       │    root: <mount path>  │
                  │                       │  })                    │
                  │                       │       │                │
                  │                       └───────┼────────────────┘
                  │                               │
                  │       同一个 mount path        │
                  └───────────────┬───────────────┘
                                  ▼
              ┌─────────────────────────────────────────┐
              │ agentfs mount point                      │
              │ (Linux FUSE / macOS NFS)                 │
              └────────────────┬────────────────────────┘
                               │
                               ▼
                       ┌────────────────────┐
                       │ agentfs daemon      │
                       │  ↓                  │
                       │ SQLite delta DB     │
                       │  + base overlay ref │
                       └────────────────────┘

→ 两条路径都终止于同一个 SQLite delta。结果：agent 用 bash 写的文件，
  下一秒用 Read 读得到；反过来也成立。没有「bash 看到一份 / 文件 tool 看到另一份」的不一致。
```

如果禁掉 sandbox（`WORKSPACE_BASH_SANDBOX=none`），右边那条路径消失，Bash 工具重新走 host bash，会逃出 mount。这就是为什么默认行为是 provider=agentfs 时强制 sandbox=just-bash。

---

## 4. Asset materialization — 内容怎么进 workspace

两个不同的 materializer，做两件不同的事：

### 4.1 `BaseMaterializer`（@kedge-agentic/agent-runtime/workspace）

跑在 **后端启动时**，一次。把 DB 里的 skills + MCP servers 投影到 `${baseDir}/tenants/<solutionId>/{skills,mcp-servers}/`。这个 baseDir 是 agentfs 的 `--base` 参数，每个 session mount 的时候 overlay 上去。

`@kedge-agentic/agent-runtime` 包的 `workspace/` 子模块（Phase A 抽取出来的纯净版本，零框架依赖）。`ContentSource` 接口是端口（backend 提供 TypeORM 适配器）。详见 `reference/agent-runtime.md`。

代码：`packages/agent-runtime/src/workspace/base-materializer.ts`（纯）+ `packages/backend/src/sessions/workspace/typeorm-skill-content-source.ts`（适配器）。

### 4.2 `SessionAssetMaterializer`（backend）

跑在 **每个 session 创建时**。把当前租户对应 solution 目录里的 `entities/` 和 `resources/` 拷到 `handle.path` 根。换句话说，agent 一开始就在 `ls entities/` 看到 demo 数据。

源路径来自 `SOLUTION_DIRS=<slug>:<absPath>,<slug2>:<absPath2>` 环境变量。

文件：`packages/backend/src/sessions/services/session-asset-materializer.service.ts`。带 SHA-1 idempotency + 符号链接拒绝 + 大小上限（500 文件 / 1MB 单文件 / 10MB 总）。

**两个 materializer 的区别**：

| | BaseMaterializer | SessionAssetMaterializer |
|---|---|---|
| 何时跑 | 后端启动时 | 每个 session create 时 |
| 写到哪 | `${WORKSPACE_DIR}/_agentfs_base/...`（overlay base） | `<session-root>/...`（session 自己的 delta） |
| 来源 | DB（Skills / McpServer 实体） | Disk（solution 目录） |
| 适用 | 所有 session 共享的 skill 内容 | 当前 session 自己的数据副本 |
| 包 | `@kedge-agentic/agent-runtime`（`workspace/` 子模块） | backend 私有 |

### 4.3 两个 materializer 在时间轴上的位置

```
 BACKEND 启动                            APP READY ─────────────► PER-SESSION CREATE  ─────────────► CLOSE/TTL
     │                                        │                          │
     │                                        │                          │
     ▼                                        │                          ▼
┌─────────────────────────┐                   │           ┌─────────────────────────────────┐
│ BaseMaterializer        │                   │           │ SessionAssetMaterializer        │
│ .materialize()           │                   │           │ .materialize(handle.path,       │
│                          │                   │           │              solutionId)          │
│ DB (Skills, McpServer) ─▶│                   │           │                                  │
│ ${baseDir}/              │                   │           │ disk solutionDirs[slug]/   ─▶   │
│   tenants/{X}/           │                   │           │ <sessionDir>/                    │
│     skills/{Y}/SKILL.md  │                   │           │   entities/                      │
│     mcp-servers/...      │                   │           │   resources/                     │
└─────────────────────────┘                   │           └─────────────────────────────────┘
   ↑                                          │              ↑
   一次性                                      │              每个 session create 都跑
   sha1 idempotent                            │              sha1 idempotent
   失败 → fail-fast (后端起不来)               │              失败 → log + 继续 spawn agent
                                              │
                                              │
                                       ─ ─ ─ ─┴─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                                       agent 起来时看到的文件视角：
                                         · base 内容（来自 BaseMaterializer，overlay）
                                         · 自己 session 的 entities/+resources/
                                           （来自 SessionAssetMaterializer，写到 delta）
                                         · 自己后续 write/edit 的文件（也落到 delta）
```

注意：BaseMaterializer 的失败是致命的（启动期就报）；SessionAssetMaterializer 的失败是软失败（agent 起来后照样能跑，只是看不到 seed 的 entities）。这是有意识的设计 —— solution 目录配错不应该让所有 session 都崩。

---

## 5. Runtime REST API — 运营可见性

文件：`packages/backend/src/sessions/{session-fs.controller.ts, session-metadata.controller.ts}`

8 个 endpoint，都在 `/api/v1/sessions/:id/` 下：

```
GET    /fs/diff           列出 agent 在 sandbox 里改了哪些文件
GET    /fs/timeline       agentfs 内置的 tool-call 审计
POST   /fs/snapshot       checkpoint 当前 delta 状态
POST   /fs/rollback       回滚到先前 snapshot
GET    /meta              list 本 session 的 KV
GET    /meta/:key         单 key 读
PUT    /meta/:key         上限 64KB/value, 256KB/session
DELETE /meta/:key
```

FS 4 个端点需要 `WORKSPACE_PROVIDER=agentfs`（local 返回 400 + 明确 message）。Meta 4 个端点和 provider 无关（用 backend 自己的 SQLite，不用 agentfs KvStore）。

详细 spec + curl 例子见 `reference/runtime-api.md`。

---

## 6. Solution 怎么进系统

`solutions/business/<slug>/` 是一个独立 NestJS 进程（独立端口），启动时：

1. **Bootstrap**：读自己的 `solution.json`，POST `/api/v1/admin/solutions/import` 注册 solution + sessionTemplates 到 ccaas DB
2. **Skill 注册**：每个 `skills/<slug>/SKILL.md`（+ 子文件 `tools/`、`examples/`）POST 到 `/api/v1/skills` + PUT files + publish
3. **Hot reload**（可选）：chokidar 监听 `skills/` 目录，文件变动 → 防抖 500ms → 重跑 skill 注册步骤
4. **领域 API**（可选）：暴露自己的 REST endpoint（如 demo-sandbox 的 DocumentEditProvider）
5. **环境变量**：用户 boot ccaas backend 时 `SOLUTION_DIRS=<slug>:<absPath>` 让 SessionAssetMaterializer 知道去哪儿拷 `entities/` + `resources/`

实操样板 + 截图：`examples/demo-sandbox.md`。扩展点目录：`guide/extending-runtime.md`。

---

## 7. ToolCallerProxy — 工具调用的 platform 边界

Solution 的 stdio MCP server 默认走<em>直连</em>路径：Claude Code 在 `--mcp-config` 里指向 solution binary, 中间没有任何 ccaas-core 拦截。 这条路径功能上能跑, 但<em>没有 audit, agent args 没 sanitize, 没有 ambient identity</em> —— 一旦工具按用户身份返回数据, agent 写 `args.userId="admin"` 就是注入面。

**ToolCallerProxy** 是 ccaas-core 自有的<em>platform 拦截层</em>, 解决这三件事。 它<em>不替换</em> stdio MCP server, 而是<em>包在前面</em>：

```
Claude Code  ──stdio MCP──▶  ccaas-owned proxy bundle  ──HTTP loopback──▶  ccaas-core
                                                                              │ ToolCallerProxy pipeline
                                                                              │ 1. strip reserved arg fields
                                                                              │ 2. validate args (Zod, schema 来自 tools/list 探测)
                                                                              │ 3. inject ExecutionContext (actingUserId 等)
                                                                              │ 4. audit (tool_events / [audit-fallback] log)
                                                                              │ 5. dispatch via StdioMcpToolkit
                                                                              ▼
                                                                          solution 原本的 stdio MCP server
                                                                          (一字未改, 子进程, JSON-RPC)
```

### 7.1 何时启用

Solution 把对应 MCP server 翻 `proxyEnabled: true`（[solution.json reference](../reference/solution-json.md#toolcallerproxy-路由proxyenabled)）。 平台启动时：

1. **`SolutionLoaderService.registerStdioToolkit`** 临时启动 stdio MCP server 一次, 发送 `initialize` + `tools/list`, 把每个工具的 `name` / `description` / `inputSchema` 复制到 `SolutionToolkitRegistry`, 然后杀掉子进程。
2. Registry 里有该 solution 的 toolkit → `McpEngineAdapter.shouldProxy(session)` 返回 true。
3. 每次 `CliProcessService.applyMcpAndSandbox` spawn Claude Code 时, 把<em>所有非 `bundle:*`</em> 的 solution MCP entry 替换成<em>一个</em> proxy bundle entry（`tool-caller-proxy`）。 Bundle 类 MCP server (`bundle:file-attachments` / `bundle:shared-context` 等 ccaas-owned 的) 保持直连。

### 7.2 Ambient identity 链路

| 阶段 | 字段 | 来源 |
|---|---|---|
| Session 创建 | `ManagedSession.actingUserId` | `X-Ccaas-On-Behalf-Of` request header（solution backend 在每次 ccaas 调用时附带） |
| 每次 tool call | `ExecutionContext.actingUserId` | `McpEngineAdapter.registerSession` 在 session 第一次走 proxy 时 snapshot 一份 |
| Tool handler | `inv.context.actingUserId` | ToolCallerProxy 在 Step 3 注入,**不在 args 里**,agent 写不进 |
| Audit | `[audit-fallback] ... actingUserId=teacher-42 ...` | Step 4 写到 logger（DB sink 是 DEF-05） |

详细 contract 写在 [设计文档 §4.3](../../../design-tool-caller-proxy.md)。 决定档案：[META arc D-04 / D-05 / D-07](../../../decision-archive-tool-design-arc-2026-05-28.html)。

### 7.3 关键源文件

| 概念 | 文件 |
|---|---|
| 6 步 pipeline | `src/tool-caller/tool-caller-proxy.service.ts` |
| Reserved field 列表 + `satisfies` 锁契约 | `src/tool-caller/reserved-fields.ts` + `.spec.ts` |
| Engine adapter（per-session token + ledger） | `src/tool-caller/adapters/mcp-engine-adapter.service.ts` |
| Internal HTTP API（loopback + token-gated） | `src/tool-caller/internal-tool-caller.controller.ts` |
| stdio wrapping toolkit | `src/tool-caller/toolkits/stdio-mcp-toolkit.ts` |
| Schema probe（import 时 tools/list） | `src/solutions/solution-loader.service.ts:probeStdioToolList` |
| Proxy bundle（ccaas-owned stdio MCP） | `packages/mcp/tool-caller-proxy-server/src/index.ts` |

### 7.4 启动日志里看什么

```
[SolutionLoaderService] Materialized MCP bundle: .../tenants/<sid>/mcp-servers/my-tools → /path/to/solution
[SolutionToolkitRegistry] Registered toolkit "my-tools" for solution <sid>: 3 tool(s)
[SolutionLoaderService] Registered StdioMcpToolkit "my-tools" for solution <sid> (3 tool(s) — proxy enabled)

# session 来了, agent 调了一个工具
[CliProcessService] Session abc routed through ToolCallerProxy (replaced 1 solution MCP entry/entries: my-tools; bundle entries preserved)
[ToolCallerProxyService] [audit-fallback] tool=my-tools.emit_card solutionId=<sid> sessionId=abc actingUserId=teacher-42 outcome=ok stripped=none durationMs=104
```

> ⚠️ 如果 audit log 显示 `actingUserId=none`, solution backend 没把 `X-Ccaas-On-Behalf-Of` 转发上来。 用 curl 加 header 直接打 solution backend 排查（详见 [solution-dev · 验证 ambient identity 是否打通](../guide/solution-dev.md#验证-ambient-identity-是否打通)）。

---

## 看日志的时候你应该认出什么

ccaas backend 启动 + 一个 session 跑下来，日志里大致是这个顺序：

```
[SessionAssetMaterializer] Session asset materializer active for 1 solution(s): demo-sandbox
[SandboxService]   Bash sandbox mode: just-bash (server: ...)
[AgentfsWorkspaceProvider] agentfs binary OK: agentfs <sha>
[BaseMaterializer] materialized 1 skills (6 files) + 0 mcp servers → /tmp/.../_agentfs_base (4ms)
[Bootstrap]        Application is running on: http://localhost:3009

# session 来了
[AgentfsWorkspaceProvider] session demo-abc mounted at /tmp/.../sessions/demo-abc
[SessionAssetMaterializer] Materialized session assets for demo-sandbox → /tmp/.../sessions/demo-abc (copied=11, ...)
[CliProcessService] Session demo-abc bash sandbox active (just-bash) → __ccaas_bash
[CliProcessService] Spawning new AgentEngine for session demo-abc

# agent 跑一个 bash 命令
$ tail /tmp/.../_sandbox_logs/bash-mcp.log
2026-XX-XX [demo-abc] exec cwd=/ cmd=ls entities/customers/
2026-XX-XX [demo-abc] exec done exit=0

# session 关
[AgentfsWorkspaceProvider] umount /tmp/.../sessions/demo-abc
```

每一行你都能 trace 到上面对应的层。

---

## See also

- **想跑起来**：`getting-started/local-self-host.md`
- **REST API spec**：`reference/runtime-api.md`
- **写自己的 ContentSource / 用 snapshot / metadata KV**：`guide/extending-runtime.md`
- **看个完整 case study**：`examples/demo-sandbox.md`
- **设计推导 + sanity check + 风险登记**：`packages/vfs-poc/docs/WORKSPACE_PROVIDER.md`（archive，但内容是原始设计依据）
- **agentfs binary 本身的能力**：[tursodatabase/agentfs](https://github.com/tursodatabase/agentfs) + 我们的 fork [nnabuuu/agentfs](https://github.com/nnabuuu/agentfs)
- **just-bash**：[vercel-labs/just-bash](https://github.com/vercel-labs/just-bash)
