# @kedge-agentic/vfs-poc

POC: 用 **agentfs overlay** 替代 ccaas 现在的"每 session 一个真实 host 目录",并把 **just-bash** 作为 agent 的 Bash MCP 工具,验证 `claude` CLI 可以 spawn 在虚拟 FS 上工作。

详细背景见 `/Users/niex/.claude/plans/ccaas-core-workspace-path-vercel-just-b-functional-robin.md`。

## 三个验证目标

| Goal | Demo | 通过判据 |
|---|---|---|
| G1: claude 跑在虚拟 FS | `npm run demo:single` | claude 写文件 → 落入 mount,base 不变 |
| G2: 快照/回滚 | `npm run demo:snapshot` | 写 3 个文件 → 快照 → 改/删 → rollback → 状态恢复 |
| G3: 多 session 并发隔离 | `npm run demo:concurrent` | 5 个 session 并发,各自看到自己的文件,base 共享无重复 |

`npm test` 是 G3 的自动化断言。

## 一次性环境准备 (macOS)

```bash
# 1. 装 agentfs CLI (装到 ~/.cargo/bin)
curl -fsSL https://github.com/tursodatabase/agentfs/releases/latest/download/agentfs-installer.sh | sh
export PATH="$HOME/.cargo/bin:$PATH"
agentfs --version  # 应该输出 v0.6.4 或更新

# 2. (V1 需要) build + 装 rail44 的 NFS fix 分支 — 让 git 能在 agentfs 上跑
#    详情见 VALIDATION_REPORT.md
bash packages/vfs-poc/scripts/build-agentfs-fix.sh

# 3. 装 npm 依赖
cd packages/vfs-poc && npm install

# 4. claude CLI 必须在 PATH 上 (ccaas 已经依赖)
claude --version
```

## 跑 POC

```bash
# 从 ccaas 主 db 物化出 base 目录到 /tmp/vfs-poc/base/
npm run materialize-base

# 三个 demo
npm run demo:single
npm run demo:snapshot
npm run demo:concurrent

# 自动化断言
npm test

# 清理 (卸载所有挂载、删 delta、删 base)
npm run clean
```

## 架构

```
ccaas main db
  ↓ BaseMaterializer (一次性物化)
/tmp/vfs-poc/base/                  ← agentfs --base (host 目录,只读)
  ↓ N 个 agentfs init --base
session-A delta.db   session-B delta.db   ...
  ↓ agentfs mount (NFS on macOS, FUSE on Linux)
/tmp/vfs-poc/mnt/A   /tmp/vfs-poc/mnt/B   ...
  ↓ spawn claude --cwd=mount
claude (host process)
  ↓ Bash tool → MCP → just-bash sandbox
```

## 显式 out-of-scope

- 不动 `packages/backend`(POC 跑通后另开 PR 起 WorkspaceProvider 抽象)
- 不做 base 热更新
- 不做 session 跨节点迁移
- 不做 quota/资源限制
- 不替代 WriteFileTrackerHook
