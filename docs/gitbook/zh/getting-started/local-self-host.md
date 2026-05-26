# 本地自托管（stage-1 sandbox）

> 你想在自己的 mac/linux 上跑 ccaas，让 claude 用你本机的 OAuth，但**不希望** claude 能动你的本地 fs 或 bash。这页教你装齐前置 → 一条命令启动 → 验证沙箱真在工作。

## 你最后会得到的能力

| 层 | 状态 | 配置 |
|---|---|---|
| Filesystem 隔离 | ✅ agentfs FUSE (Linux) / NFS (macOS) | `WORKSPACE_PROVIDER=agentfs` |
| Bash 隔离 | ✅ just-bash 进程内解释器（MCP） | `WORKSPACE_BASH_SANDBOX=just-bash`（agentfs 模式下自动开启） |
| 原生 Read/Write/Edit/Grep/Glob | ✅ 落到 agentfs 挂载 = 隔离 | 无需额外配置 |
| 网络 | ❌ claude 本身仍能访问任意 URL | 本期不在 stage-1 范围 |

## 前置条件

| 项 | 怎么装 |
|---|---|
| Node 20+ | `nvm install 20` |
| `claude` CLI（OAuth'd） | [安装](https://docs.anthropic.com/claude/docs/install) + `claude login` |
| `agentfs` binary | macOS 推荐我们的 fork（含 rail44 NFS fix + AppleDouble drop）：`bash packages/vfs-poc/scripts/build-agentfs-fix.sh`。Linux 直接装 upstream：`curl -fsSL https://github.com/tursodatabase/agentfs/releases/latest/download/agentfs-installer.sh \| sh` |
| **macOS** | 系统 NFS 内置，无需额外操作 |
| **Linux** | `apt install fuse3`；要么以 root 跑后端，要么加入 `fuse` 组并取消 `/etc/fuse.conf` 里 `user_allow_other` 的注释 |

## 启动

```bash
WORKSPACE_PROVIDER=agentfs \
  WORKSPACE_AGENTFS_BIN=$HOME/.cargo/bin/agentfs \
  npm run start:prod -w @kedge-agentic/backend
```

只设 `WORKSPACE_PROVIDER=agentfs` 就够了；`WORKSPACE_BASH_SANDBOX` 不显式设的话会自动取 `'just-bash'`。

如果想把某个 solution 的数据 seed 到每个 session 的 workspace 根：

```bash
SOLUTION_DIRS=demo-sandbox:$PWD/solutions/business/demo-sandbox \
  WORKSPACE_PROVIDER=agentfs \
  ...其他变量... \
  npm run start:prod -w @kedge-agentic/backend
```

（这条让 `SessionAssetMaterializer` 在每个 demo-sandbox 租户的 session 创建时拷 `entities/` + `resources/` 进去。详见 `platform/runtime-architecture.md` § 4.2。）

## 怎么确认沙箱真的开了

启动日志里应该看到这三行：

```
[BaseMaterializer]        materialized N skills (X files) + Y mcp servers → ...
[SandboxService]          Bash sandbox mode: just-bash (server: .../just-bash-mcp/server.mjs)
[AgentfsWorkspaceProvider] agentfs binary OK: agentfs <sha>
```

session 创建后，CliProcessService 的 spawn 命令日志里应该包含：

```
--mcp-config {"mcpServers":{"__ccaas_bash":{...}}}
--disallowed-tools Bash
--append-system-prompt For ANY shell command in this session, you MUST call the MCP tool ...
```

agent 跑第一个 shell 命令时，sandbox 日志开始出现：

```
$ tail $WORKSPACE_DIR/_sandbox_logs/bash-mcp.log
2026-XX-XX [<sessionId>] server connected
2026-XX-XX [<sessionId>] exec cwd=/ cmd=ls entities/customers/
2026-XX-XX [<sessionId>] exec done exit=0
```

## 关键环境变量

| 变量 | 默认 | 作用 |
|---|---|---|
| `WORKSPACE_PROVIDER=local` | 默认 | 老的 mkdir + symlink 方案；沙箱自动关闭 |
| `WORKSPACE_PROVIDER=agentfs` | — | 启用 agentfs 虚拟 FS + 自动启用 just-bash sandbox |
| `WORKSPACE_BASH_SANDBOX=none` | agentfs 下自动 `just-bash` | 调试逃生口：保留 agentfs FS sandbox，但允许 native Bash |
| `WORKSPACE_AGENTFS_BIN=/abs/path` | `agentfs`（在 PATH） | 指定 agentfs binary |
| `WORKSPACE_AGENTFS_BASE_DIR=/var/...` | `${WORKSPACE_DIR}/_agentfs_base` | base overlay 落盘位置 |
| `WORKSPACE_AGENTFS_DELTA_STORE=/var/...` | `${WORKSPACE_DIR}/_agentfs_deltas` | 每 session 的 delta DB 落盘位置 |
| `SOLUTION_DIRS=slug:abspath,slug2:abspath2` | 空 | 给 SessionAssetMaterializer 用，决定哪些 solution 的 entities+resources 被 seed 进 session |
| `SOLUTIONS_DIR=./solutions/business` | 空 | 启动时 SolutionLoaderService 自动 import 该目录下每个子目录的 `solution.json`（包括 solution、skills、mcp、`solution.config.artifactUrl`）。Phase 1.6 起。不设则不 auto-import，得手动 `POST /admin/solutions/import`。 |

## 保留命名约定

`__ccaas_*` 是 ccaas 内部 MCP server 的保留前缀（目前唯一一个是 `__ccaas_bash`）。Solution 不要用这个前缀给自己的 MCP server 命名 — 冲突时会 log warning + ccaas 内部那个 wins。

## 故障排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `WORKSPACE_PROVIDER=agentfs but binary 'agentfs' is not invokable` | binary 不在 PATH | 设置绝对路径的 `WORKSPACE_AGENTFS_BIN` |
| 创建 session 后 `mount` 列表里没东西 | FUSE/NFS 没挂上 | Linux: `modprobe fuse` + 查 `/dev/fuse` 权限；macOS: 一般无需操作 |
| 沙箱开了但 claude 还是用 native Bash | claude CLI 版本太老 | 升到 ≥ 2.1.x |
| `SandboxService cannot find just-bash MCP server at .../server.mjs` | nest-cli `assets` 配置丢了 | 确认 `packages/backend/nest-cli.json` 有 `assets` 段，重新 build |
| MCP server 起来了但每个命令都返回 `exit=2` | claude 发了 host 的绝对路径（`/etc/...`），sandbox 里不存在 | **沙箱正确行为** — 应让 claude 学会用相对路径（system prompt 已经引导） |
| Linux: `fuse: device not found` | 内核模块没加载 | `sudo modprobe fuse` |
| Linux: 非 root 访问挂载报 permission denied | `/etc/fuse.conf` 没有 `user_allow_other` | 取消那行的注释 + 重启 backend |

## 你能用的 Runtime REST API

启动后这些立刻可用（agent session 在内存中时）：

```bash
KEY=sk-你的-admin-key
TENANT=demo-sandbox
SID=demo-xxxxxxxx

# 看 agent 在 sandbox 里改了什么
curl -s "http://localhost:3001/api/v1/sessions/$SID/fs/diff" \
  -H "x-api-key: $KEY" -H "x-solution-id: $TENANT" | python3 -m json.tool

# checkpoint + rollback
curl -X POST "http://localhost:3001/api/v1/sessions/$SID/fs/snapshot" \
  -H "x-api-key: $KEY" -H "x-solution-id: $TENANT" \
  -H 'Content-Type: application/json' -d '{"label":"before-risky"}'
```

完整 spec：`reference/runtime-api.md`。

## stage-1 还没给你的

下面这些**不**在本期范围；都在 backlog 里：

- 计划任务（HeadlessExecutionService）还在用本地 fs，没接 WorkspaceProvider
- claude 本身的网络隔离
- 多租户场景下的 agentfs encryption（`--key/--cipher`）
- 已关 session 的 forensic 文件浏览 UI
- 容器化部署（stage-1 是裸 Node bare-metal）

## See also

- `platform/runtime-architecture.md` — 上一层：所有层怎么拼起来
- `reference/runtime-api.md` — 8 个 runtime endpoint 详细 spec
- `examples/demo-sandbox.md` — 一个能拷贝粘贴跑的完整 demo
- 想看深度设计推导：`packages/vfs-poc/docs/WORKSPACE_PROVIDER.md`
