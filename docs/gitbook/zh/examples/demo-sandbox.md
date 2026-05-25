# 案例：demo-sandbox solution

> 一个**能直接跑起来**的 B2B SaaS demo，把 stage-1 sandbox 的所有新能力一次性展示：渐进式 skill、entities 自动 seed、DocumentEditProvider 双向编辑、热重载、单页前端 + diff inspector。看完本页 + 5 分钟操作，你就有了完整跑通过的体验。

## 这个 demo 展示什么

| 能力 | 在哪儿能看见 |
|---|---|
| Workspace 沙箱（agentfs） | 启动日志 `[AgentfsWorkspaceProvider] agentfs binary OK: agentfs <sha>` |
| Bash 沙箱（just-bash MCP） | `_sandbox_logs/bash-mcp.log` 看 agent 的每次 bash 调用 |
| Per-session entities seed | session create 后 `ls sessions/<id>/entities/customers/` |
| **渐进式 skill** | `skills/sandbox-explorer/{SKILL.md, tools/, examples/}` — 主 SKILL.md 只 60 行，子文件按需 cat |
| DocumentEditProvider | `PUT /api/demo-sandbox/entities/:id` 用 str_replace ops 双向改 disk |
| 热重载 | 改 `skills/sandbox-explorer/tools/ls-cheatsheet.md` → 500ms 后 ccaas DB 里 skill 已更新 |
| Diff inspector 前端 | 浏览器右栏「FS changes」面板 — agent 跑完后自动显示改了什么 |

## 主题

**B2B SaaS 运营**。模拟数据集：
- `entities/customers/{acme,globex,initech}.md` — 三个客户档案（健康 / 扩展机会 / 流失风险）
- `entities/revenue/{q1-summary.md, mrr-by-segment.json}` — 季度营收
- `entities/plans/{q2-roadmap.md, infra-budget.json}` — 战略 + 预算
- `resources/{glossary.md, data-dictionary.json, playbooks/}` — 参考材料

agent 用 sandboxed `ls`/`grep`/`cat` 浏览这些文件，回答业务问题（"哪个客户在流失"、"Q2 infra 预算"），并能通过 entity API 修改客户状态。

## 启动（4 个命令）

```bash
# 1. 前置：装 agentfs + claude OAuth（见 getting-started/local-self-host.md）

# 2. ccaas backend：sandbox 模式 + 把 demo-sandbox 注册成 SOLUTION_DIRS
WORKSPACE_PROVIDER=agentfs \
  WORKSPACE_AGENTFS_BIN=$HOME/.cargo/bin/agentfs \
  WORKSPACE_DIR=/tmp/demo-sandbox \
  DATABASE_PATH=/tmp/demo-sandbox/data.db \
  SOLUTION_DIRS=demo-sandbox:$PWD/solutions/business/demo-sandbox \
  INITIAL_ADMIN_KEY=sk-demo-1234567890abcdef \
  PORT=3009 \
  npm run start:prod -w @kedge-agentic/backend

# 3. demo-sandbox solution backend：注册 + 热重载 + entity API + 前端
cd solutions/business/demo-sandbox/backend
CCAAS_URL=http://localhost:3009 \
  CCAAS_API_KEY=sk-demo-1234567890abcdef \
  PORT=3010 \
  npm start

# 4. 浏览器
open http://localhost:3010/
```

启动后端时应该看到：
```
[SandboxService]            Bash sandbox mode: just-bash (server: ...)
[BaseMaterializer]          materialized 1 skills (6 files) + 0 mcp servers → /tmp/.../base
[SessionAssetMaterializer]  Session asset materializer active for 1 tenant(s): demo-sandbox
[Bootstrap]                 Application is running on: http://localhost:3009
```

solution backend 应该看到：
```
[DemoEntityProvider]        Loaded 3 entities from .../entities (editable fields: ...)
[SolutionRegisterService]   Solution registered: tenantId=...
[SolutionRegisterService]   Created skill sandbox-explorer (id=...)
[SolutionRegisterService]   Upserted 6 file(s) for sandbox-explorer
[SolutionRegisterService]   Hot-reload watcher active on .../skills
[DemoSandbox]               Backend running on http://localhost:3010
```

## 推荐第一个 prompt

浏览器左栏先点 `initech`（建立 before baseline），然后 prompt 框里：

```
Read entities/customers/initech.md, identify why it's at-risk in one
short paragraph, then PUT status=renewal_at_risk via the entity API at
http://localhost:3010/api/demo-sandbox/entities/initech.
```

按 Run。日志会按时间流过：

- `SESSION demo-xxxxxxxx`
- `STATUS running`
- `TOOL mcp____ccaas_bash__bash start · ls entities/customers/` ✨ **sandbox 在工作的证据**
- `TOOL mcp____ccaas_bash__bash start · grep -l "churn\|at-risk" ...`
- `TOOL mcp____ccaas_bash__bash start · cat entities/customers/initech.md`
- `TOOL mcp____ccaas_bash__bash start · curl -X PUT http://localhost:3010/api/demo-sandbox/entities/initech -d '...'`
- `MSG Initech 风险来自 ...`
- `STATUS complete`

session 结束后：
- 中间栏 "After" 自动 diff 高亮显示 initech.md 的改动
- 右栏 "FS changes" 显示 agent 在 sandbox 里碰过的所有文件（不仅是被 track 的实体）

## 验证热重载

```bash
echo "<!-- hot reload test $(date +%s) -->" \
  >> solutions/business/demo-sandbox/skills/sandbox-explorer/tools/ls-cheatsheet.md
```

solution backend log 立刻看到：

```
[SolutionRegisterService] Detected change on skills/sandbox-explorer/tools/ls-cheatsheet.md — scheduling re-register
[SolutionRegisterService] Upserted 6 file(s) for sandbox-explorer
```

下一个 session 创建时（重新拷 base）就会看到新内容。

## 代码地图

```
solutions/business/demo-sandbox/
├── solution.json                  # tenant + sessionTemplates 配置
├── README.md
├── skills/sandbox-explorer/        # 渐进式披露 skill 范例
│   ├── SKILL.md                   # 主 60 行；告诉 agent "需要时去 cat sub-files"
│   ├── tools/                     # ls/grep/workflow cheatsheets
│   └── examples/                  # 任务模式范例（find-customer / search-plan / edit-entity）
├── entities/                      # SessionAssetMaterializer 会 seed 这些到每个 session
│   ├── customers/{acme,globex,initech}.md
│   ├── revenue/{q1-summary.md, mrr-by-segment.json}
│   └── plans/{q2-roadmap.md, infra-budget.json}
├── resources/                     # 同上 seed；参考材料
│   ├── glossary.md
│   ├── data-dictionary.json
│   └── playbooks/{churn-response.md, expansion-qualification.md}
└── backend/                       # 独立 NestJS 进程 :3010
    └── src/
        ├── main.ts
        ├── solution-register.service.ts  # bootstrap 注册 + chokidar 热重载
        ├── demo/
        │   └── demo.controller.ts        # GET / 服 index.html + POST /demo/run SSE 代理 + GET /demo/fs-diff/<sid> 代理
        ├── entities/
        │   ├── demo-entity.provider.ts    # 继承 DocumentEditProvider
        │   └── entities.controller.ts     # GET/PUT /api/demo-sandbox/entities/:id
        └── (frontend 的 index.html 在 ../../frontend/)
```

## 这个 demo 是怎么把所有概念串起来的

| concept | 在 demo 里的体现 |
|---|---|
| `WorkspaceProvider` (agentfs) | agent 在 mount 上跑 ls/cat，写文件落到 SQLite delta，base 不变 |
| `SandboxService` + just-bash MCP | agent 的 bash 全部通过 `mcp____ccaas_bash__bash` |
| `BaseMaterializer` | 把 sandbox-explorer skill 的 SKILL.md + 6 个子文件投影到 agentfs base，每个 session 通过 overlay 看到 |
| `SessionAssetMaterializer` | 把 entities/ + resources/ 拷到每个 demo-sandbox session 的 workspace 根 |
| Solution backend pattern | 独立进程 bootstrap 时 POST 注册到 ccaas + 暴露领域 REST API |
| Hot reload | chokidar watch skills/，500ms 防抖后重新 POST 注册 |
| `DocumentEditProvider`（context-layer） | DemoEntityProvider 实现 5 个 abstract 方法；用 str_replace ops 改 markdown + 写回 disk |
| Runtime fs/diff REST | 前端「FS changes」面板用它，显示 agent 改了什么 |
| Runtime fs/snapshot+rollback | (可选用 curl) checkpoint 一个 prompt 之前的状态，错了 rollback |

## 收拾

```bash
# kill 进程
kill $(lsof -ti :3009 -i :3010 -sTCP:LISTEN)
# 清掉 sandbox 数据
rm -rf /tmp/demo-sandbox
# 还原 demo 跑的时候改过的文件
git checkout solutions/business/demo-sandbox/
```

## See also

- 代码：`solutions/business/demo-sandbox/`
- skill 源：`solutions/business/demo-sandbox/skills/sandbox-explorer/`
- README：`solutions/business/demo-sandbox/README.md`
- 想自己写一个类似的 solution：`guide/extending-runtime.md`
- 各层的设计：`platform/runtime-architecture.md`
