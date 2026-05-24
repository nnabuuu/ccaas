# Agent Session Runtime — P0 Validation Report

> **验证日期**: 2026-05-24
> **平台**: macOS 14.x (darwin arm64), agentfs NFS export
> **关联 spec**: [docs/agent-session-runtime-spec.md](../../docs/agent-session-runtime-spec.md)
> **关联 POC**: `packages/vfs-poc/` (POC1 commit `d531540`)
> **版本**: agentfs v0.6.4, git 2.43.0, claude 2.1.148, node 22.15.1
> **测试代码**: `packages/vfs-poc/validation/` (可重跑: `npm run validate:v1`, `npm run validate:v2`)
> **原始日志**: `packages/vfs-poc/validation/logs/{V1,V2}/`
> **机器可读结果**: `packages/vfs-poc/validation/results/{v1,v2}-darwin.json`

---

## Executive Summary

| 验证 | 结论 | 对 spec 的影响 |
|---|---|---|
| **V1 — `.git` 直接放进 agentfs 虚拟 FS 跑 git** | ❌ **FAIL** — 10/10 测试在 macOS NFS 上失败,**主因不是性能而是 git 在 agentfs NFS 上无法写 loose object** | **D2/D4 阻塞**。`.git` 不能整体放进 agentfs NFS。需要改架构:`.git` 用 host fs / agentfs SDK 直读直写 / 等待 agentfs 修 SETATTR-after-WRITE 缺陷 |
| **V2 — just-bash 完全替代 claude 原生 shell + fs 工具** | ⚠️ **可达但脆弱** — 强读 1/3 轮成功 (C2.4),弱读 3/3 (C2.2)。模型倾向用原生工具语义,**MCP 替换必须严格 mirror 原生 API 形状** | **D1 措辞需修订**: 不写"完全替代",改写**两层模型** — bash 弱替代(POC1 已验证)+ 可选 fs 强替代(需要 1:1 schema 镜像) |
| **总体** | 🚧 **spec 需修订才能落地** | 1 个 P0 阻塞 + 1 个 P0 限定条件清晰化 |

**阻塞项**:
1. agentfs SETATTR-after-WRITE 在 macOS NFS 上拒 close() — 影响 git loose object 写入 → 阻塞 spec D2 完整落地
2. agentfs 与 host fs 不在同一 device → `git clone --local` 默认尝试 hardlink 失败 (EXDEV)

---

## V1 — Git 在 agentfs 挂载点的可行性

### 方法学

10 个测试 (`packages/vfs-poc/validation/git/tests.ts`),覆盖 git 在 FUSE/NFS 上的 10 个已知雷区 (R1-R10)。每个测试在独立 agentfs session 内运行真实 git CLI,记录 exit code、stderr、关键 metric。仅在 macOS NFS 上执行(Linux FUSE 未跑,见 limitations)。

### 测试矩阵

| Test | 描述 | macOS NFS | 失败模式 |
|---|---|---|---|
| T1.1 | baseline init/add/commit/log/fsck | ❌ | `git add` 在写 loose object 时 close() 报 EACCES |
| T1.2 | hardlink — `git clone --local` | ❌ | `Cross-device link` (EXDEV) — clone 试图 hardlink host→mount |
| T1.3 | mmap pack — gc + concurrent cat-file | ❌ | 同 T1.1 (git add 阶段就挂) |
| T1.4 | worktree happy path (spec ③⑧ 主流程) | ❌ | 同 T1.1 |
| T1.5 | 50 并发 git add | ❌ | 同 T1.1 |
| T1.6 | 2 worktree 并发 commit + merge | ❌ | 同 T1.1 |
| T1.7 | 大小写冲突 Foo.md vs foo.md | ❌ | 同 T1.1 (即使 commit 前的写就挂) |
| T1.8 | git status perf + 重 mount 后 stat 缓存 | ❌ | 同 T1.1 |
| T1.9 | `git mv` 目录(含修改文件) | ❌ | 同 T1.1 |
| T1.10 | 10 轮完整 worktree 生命周期 stress | ❌ | 同 T1.1 |

**通过率: 0/10**

### 主因分析: fchmod+close race on NFS

git 写 loose object 的序列(`object-file.c::write_loose_object`):

```c
fd = mkstemp(...)            // .git/objects/xx/tmp_obj_*
write(fd, content, ...)
fchmod(fd, 0444)              // 立即变只读 (常规 fs 上无副作用)
close(fd)                     // ← 这里报 "Permission denied" on agentfs NFS
rename(tmp, .git/objects/xx/<sha>)
```

agentfs 暴露 NFS 时, `fchmod(0444)` SETATTR 成功,但随后的 `close()` 在 flush deferred writes 时被 NFS server 以"文件已只读"拒绝。这是经典 NFS "fchmod-during-write" 问题。

**验证**: 用 `GIT_OBJECT_DIRECTORY=/tmp/外部目录 git add` 把 loose objects 写到 host fs,`exit=0` 成功。证明问题局限于 agentfs NFS 的 SETATTR-after-WRITE 处理。

**试过但无效的 git workaround**:
- `core.sharedRepository=group / world` — 改 chmod 目标 mode,仍 fail
- `core.fsync=none / core.fsyncObjectFiles=false / core.fsyncMethod=writeout-only` — 无关 fsync
- `git hash-object -w` 直接路径 — 同样走 fchmod+close,fail
- `umask 0` — 无效
- git 源码硬编码 `fchmod(fd, 0444)`,无 config 开关可绕

### T1.2 cross-device 失败 (独立问题)

`git clone --local` 默认用 hardlink 把 host repo 的 packfile 链接进 clone,但 host 和 agentfs mount 在不同 dev,`link()` 报 EXDEV。这是预期的 OS 行为,**不是 agentfs 的 bug**。生产中可以加 `--no-hardlinks` 强制 copy,但 spec 设计里不会有 host→mount clone 这种操作(spec 是 entity → agentfs 直接 materialize)。**此项不影响 spec 落地**,但要在文档里说明。

### 对 spec D2 / D4 的判定

> spec D2: "Entity 的 .git 目录可以作为 SQLite 数据的一部分被 AgentFS 虚拟化"
> spec D4: "DB → Git 同步: 不需要(.git 在 DB 内)"

**结论: 在当前 agentfs (v0.6.4) macOS NFS 上不可行**。Linux FUSE 行为待验证,可能 OK,但 macOS dev env 完全不可用。

**可选修订方向**(按改动量从小到大):

| 选项 | 描述 | 代价 |
|---|---|---|
| **A. 等 agentfs 修 NFS SETATTR** | 给 turso 上 issue,等他们修 close()-after-chmod 行为 | 不确定时间;Linux FUSE 可能本来就 OK |
| **B. `.git` 通过 agentfs SDK 直读直写** | git 在 host fs 跑,session start 时 SDK 从 db deserialize 出 .git,session end 时 SDK serialize 回 db | 需要写 .git ↔ libsql 序列化层;每 commit 触发一次 db 写;**违背 D4 "不需要同步层"** |
| **C. `.git` 放 host fs,worktree 放 agentfs** | `.git` 一份/per project,放在 host `~/.kedge/git-repos/`;worktree 在 agentfs mount。session 间 worktree 隔离,.git 共享 | 简单可行;但 .git 不在 agentfs,审计/快照不覆盖 git history;违背 D2 |
| **D. 放弃 git,自研 entity 版本控制** | spec D3 已经把 git 限定为 worktree/merge 引擎,可考虑用更简单的"每 entity 一个 jsonpatch 流"替代 | 大改动;失去 git diff/blame 生态 |

**推荐: 短期走 C(spec 文档化为"v1 兼容"妥协),中期推 A(等 agentfs 修),并行评估 B 作为长期方向。**

### Limitations(V1 没测的事)

- **未在 Linux FUSE 上跑**: agentfs Linux 走 FUSE 而不是 NFS,SETATTR 路径不同,可能成功。**这是后续必须补的验证**,在判定 spec D2 完全死刑之前。
- **未测 packed-refs 损坏**: git 在 add 阶段就挂,够不着 packed-refs 测试。
- **未测 reftable backend**: 同上,够不着。
- **未与 Linux Docker 容器内的 agentfs FUSE 对比**

---

## V2 — just-bash + MCP "完全替代 claude 原生 shell" 的边界

### 方法学

固定一个 4 步标准任务(创建 docs/spec.md → 创建 src/main.ts → grep+写 report.txt → 追加 spec.md),在 4 种配置下各跑 3 轮,记录 toolUse 分布 + fs 验证任务是否真完成。共 12 次 claude 调用。代码: `packages/vfs-poc/validation/sandbox/run-configs.ts`。

### 完整结果表

| Config | Round | 时长 | native | mcp | done | toolUses |
|---|---|---|---|---|---|---|
| C2.1 baseline | 1 | 26.7s | 6 | 0 | ✅ | Bash×1, Write×3, Grep×1, Edit×1 |
| C2.1 | 2 | 21.2s | 5 | 0 | ✅ | Write×3, Grep×1, Edit×1 |
| C2.1 | 3 | 17.3s | 5 | 0 | ✅ | Write×3, Grep×1, Edit×1 |
| C2.2 POC1 (deny Bash, MCP bash) | 1 | 23.6s | 5 | 0 | ✅ | Write×3, Grep×1, Edit×1 |
| C2.2 | 2 | 22.1s | 5 | 0 | ✅ | 同上 |
| C2.2 | 3 | 22.1s | 5 | 0 | ✅ | 同上 |
| C2.3 deny ALL native, MCP bash only | 1 | 16.2s | 0 | 1 | ⚠️* | bash×1 (一次 heredoc 完成所有) |
| C2.3 | 2 | 16.8s | 0 | 1 | ⚠️* | 同上 |
| C2.3 | 3 | 22.4s | 0 | 1 | ⚠️* | 同上 |
| C2.4 deny ALL + full MCP replacement | 1 | 53.5s | 0 | 11 | ❌ | files__write×4, files__grep×1, files__edit×1, files__read×3, bash×2 |
| C2.4 | 2 | 36.2s | 0 | 9 | ❌ | 同形态 |
| C2.4 | 3 | 65.9s | 0 | 17 | ✅ | files__write×5, files__grep×4, files__edit×1, files__read×2, bash×4 |

\* C2.3 "fail" 是 verification regex 太严格 — claude 用 `grep -rl src/` 得到 `src//main.ts`(双斜杠),我的断言 `/src\/main\.ts/` 不匹配。**实际任务已完成**。修订后通过率应是 3/3。

### 关键发现

**发现 1: C2.1 vs C2.2 完全等价** — 任务本身不需要 shell,3 轮 C2.2 都没调 MCP bash 一次。**`--disallowed-tools Bash` 单独使用对纯 fs 任务是 no-op**(POC1 之前的"成功"是因为 demo prompt 显式要求"use mcp__... tool",model 才用 MCP)。这点改了我对 POC1 的判读 — POC1 验证的是"如果模型选择走 bash,deny+steering 能把它路由到 MCP",不是"所有 claude shell 操作走 MCP"。

**发现 2: C2.3 任务能完成 — 但需要修 verification** — 强 deny + 仅 bash 可达。claude 用 1 个 bash heredoc 调用做完所有事(`cat <<EOF > docs/spec.md` 等),路径双斜杠是 grep 输出形态。**修 verification regex 后 C2.3 是 3/3 通过**。强 deny + 仅 bash 路径**实际可行**。

**发现 3: C2.4 完成率 1/3 — 根因是 MCP schema 不匹配 claude 原生命名** — files-mcp log 显示:
```
write undefined (26B)
write undefined (22B)
```
我的 schema 用 `{path, content}`,但 claude 给我传 `{file_path, content}`(它原生 Write 工具的字段名)。所以 `args.path === undefined`,实际写到了文件名为 "undefined" 的位置。r3 成功是因为 claude 后来"学到"用 `path`,r1/r2 一直用 `file_path`。

**这是一个一般性结论**: **MCP 工具如果想"替代"claude 原生工具,必须严格 1:1 mirror 原生工具的 input schema**,包括字段名。否则模型会按原生 API 习惯调用,导致沉默失败。spec D1 落地时必须把"替代"明确为"语义 + 接口都 mirror"。

**发现 4: claude 描述自己工具行为时不可信** — C2.4/r1 assistantText: "All four steps completed: ✅..." 但 fs 验证显示 ZERO 文件被创建(因为全写到 `undefined` 路径)。**报告里 claude 说 "done" 不等于真 done**。production 必须用**外部 fs 断言**而非依赖 model 自报。

**发现 5: ToolSearch 是 claude 默认动作** — 4 个配置里几乎每次都先走一个 `ToolSearch` 查 MCP 工具是否存在,再调用。开销 ~1-2s/次。POC1 已观察到,V2 再次确认。

### 对 spec D1 措辞的修订建议

**当前 D1**: "Shell 执行环境 — just-bash 完全替代原生 shell"

**改为分层模型**:

| 层 | 默认实现 | 说明 |
|---|---|---|
| Bash 层 | just-bash via MCP | 替换 claude 原生 Bash 工具,通过 `--disallowed-tools Bash` + `mcp__...__bash` + system prompt steering。POC1 + C2.2 已验证可行。注意:对 fs-heavy 任务 model 可能根本不需要 bash,所以此层并非 hot path |
| FS 层 (可选) | 原生 Read/Write/Edit/Grep/Glob 落 agentfs mount | 默认让模型用 claude 原生 fs 工具,通过 agentfs mount 落到虚拟 FS。POC1 + C2.1/C2.2 已验证 |
| FS 强替代 (高隔离需求) | MCP `mcp__...__{read,write,edit,grep,glob}` | 仅在需要全 MCP 审计 / fs 操作走业务 hook 时启用。**MCP 工具 schema 必须 1:1 mirror claude 原生工具的字段名**(否则 1/3 失败率)。Solution 需要自行权衡 |

**架构图调整**: 应当画两套 FS 路径(原生直通 vs MCP 替代),说明两套都"落"在 agentfs,但**控制 / 审计粒度不同**。

---

## 对 spec 文档的具体修订建议

| Section / Decision | 现状 | 建议修订 |
|---|---|---|
| §3.1 表格 - "AgentFS" 行 | "Entity 的全部数据(含 .git 目录)存储在 AgentFS 的 SQLite 中" | 加注:"v1 兼容性: 受 agentfs 当前 NFS SETATTR 行为影响,.git 暂存于 host fs / 通过 SDK 序列化进 db。验证: VALIDATION_REPORT.md V1" |
| §3.1 表格 - "just-bash" 行 | "完全替代 Claude Code 的原生 shell 调用" | "替代 claude 内置 Bash 工具(必经此路径);claude 的原生 Read/Write/Edit/Grep/Glob 仍可工作,落在 agentfs mount 内。如需 100% MCP 化,加 MCP `files` 服务并 1:1 mirror 原生 schema" |
| §D1 决策表 | "just-bash 完全替代原生 shell" | "默认:仅替代 Bash;可选:扩展替代 fs 工具集(MCP schema 必须 1:1 mirror 原生)" |
| §D2 决策表 | ".git 在 DB 中" | "目标态:.git 在 DB 中。v1 妥协:`.git` 在 host fs,worktree 在 agentfs mount。后续 agentfs NFS 修复 / Linux FUSE 验证后再迁" |
| §D4 决策表 | "不需要 DB → Git 同步" | "目标态:不需要(.git 在 DB)。v1 临时方案:.git 在 host fs,session 结束时若需迁移到 db,需要 .git ↔ libsql 序列化层(下一阶段评估)" |
| §VII 步骤 ② | "无需额外的 DB → Git Sync — .git 就在 DB 里" | 加 footnote 引用此 VALIDATION_REPORT 的 V1 结论 |
| §VII 步骤 ⑤ | "完全替代 Claude Code 原生 shell" | 同 §D1 修订:说清楚两层 |
| §X 平台模块图 | (无变化建议) | 在 just-bash 框下面加注: "替代 Bash 工具;Read/Write/Edit 默认走原生 + agentfs mount" |
| §XII Future | 缺 Linux 验证项 | 新增:"在 Linux FUSE 下重跑 V1 全套,确认 SETATTR 行为差异" |

---

## Out-of-scope (这次没测)

- **Linux FUSE** 上跑 V1 — 后续必须补
- **V3 多挂载点合成**(spec §5 的 project/skills/references/media)
- **V4 50+ session 并发挂载密度**
- **Skill 三层继承挂载**(spec §VIII)
- **Object Storage 挂载**(spec §5 media)
- **agentfs → DB 回写**(spec §VII 步骤 ⑩)
- **conflict review session**(spec §VII 步骤 ⑧ + D7)

---

## 附录 A — 外部研究参考

git on FUSE/NFS 已知雷区(本次研究汇总):

- libfuse hardlink 不可靠: [#79](https://github.com/libfuse/libfuse/issues/79), [#412](https://github.com/libfuse/libfuse/issues/412)
- macfuse mmap SIGBUS: [#112](https://github.com/macfuse/macfuse/issues/112)
- vmhgfs-fuse git index 损坏: [vmware/open-vm-tools#90](https://github.com/vmware/open-vm-tools/issues/90)
- VFSForGit (微软) FAQ: [docs/faq.md](https://github.com/microsoft/VFSForGit/blob/master/docs/faq.md)
- "Cannot Lock Ref on NFS" 案例: [OneUptime blog](https://oneuptime.com/blog/post/2026-01-24-git-cannot-lock-ref-errors/view)
- agentfs SPEC: [github.com/tursodatabase/agentfs/blob/main/SPEC.md](https://github.com/tursodatabase/agentfs/blob/main/SPEC.md)

研究详细笔记: 见 plan 文件 `~/.claude/plans/ccaas-core-workspace-path-vercel-just-b-functional-robin.md`

---

## 附录 B — 复现方式

```bash
# Prereq
export PATH="$HOME/.cargo/bin:$PATH"
agentfs --version  # 应是 v0.6.4 或更新
claude --version
node --version    # ≥ 20

# 一次性: 装依赖
cd packages/vfs-poc && npm install

# V1 — 不需要 claude API
npm run validate:v1
# 结果: validation/results/v1-darwin.json
# 日志: validation/logs/V1/T*.log

# V2 — 需要 claude OAuth/API key (≈ $0.30-0.50)
npm run validate:v2
# 结果: validation/results/v2-darwin.json
# 日志: validation/logs/V2/C*.run.log + per-MCP-server logs

# 清理
npm run clean
```

---

## 修订历史

- **v1 — 2026-05-24** (初版): macOS NFS 平台 V1 + V2 全量执行,2 个 P0 都得到判定。Linux FUSE 留待后续。
