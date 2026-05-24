# Agent Session Runtime — P0 Validation Report

> **验证日期**: v1 2026-05-24, v2/v3 2026-05-25, **v4 (本次修订) 2026-05-25 (Linux Docker)**
> **平台**:
> - macOS 14.x (darwin arm64), agentfs NFS export
> - **NEW v4**: Linux 6.14 (orbstack VM arm64), agentfs FUSE mount, Ubuntu 24.04 Docker
> **关联 spec**: [docs/agent-session-runtime-spec.md](../../docs/agent-session-runtime-spec.md)
> **关联 POC**: `packages/vfs-poc/` (POC1 commit `d531540`)
> **版本** (v4 修订时): agentfs **9180ed4** ([nnabuuu/agentfs feat/nfs-drop-appledouble](https://github.com/nnabuuu/agentfs/tree/feat/nfs-drop-appledouble)) + upstream **v0.6.4** (Linux baseline), git 2.43.0+, claude 2.1.148, node 20/22
> **测试代码**: `packages/vfs-poc/validation/` (可重跑: `npm run validate:v1`, `npm run validate:v2`)
> **Linux 复现**: `bash packages/vfs-poc/scripts/run-linux-v1.sh`
> **原始日志**: `packages/vfs-poc/validation/logs/{V1,V2}/` + `/tmp/vfs-poc-linux-results/`
> **机器可读结果**: `packages/vfs-poc/validation/results/v1-darwin.json` + `/tmp/vfs-poc-linux-results/v1-linux-*.json`

---

## Executive Summary

> **本报告有四轮验证**:
> - **v1 (2026-05-24)** 用 agentfs upstream v0.6.4 跑 macOS NFS,V1 全 fail。
> - **v2 (2026-05-25)** 找到 [tursodatabase/agentfs#333](https://github.com/tursodatabase/agentfs/issues/333) 同问题 + @rail44 的 fix 分支,自己 build 装上重跑。V1 从 0/10 → 10/10,但仍依赖**应用层 workaround** (`.gitignore '._*'` + `cleanAppleDoubles()`)。
> - **v3 (2026-05-25)** 在我们 fork 上加 `feat/nfs-drop-appledouble`(server 端"silent drop" AppleDouble,250 行 Rust),应用层 workaround **全部移除**(`VFS_POC_BARE=1`),V1 仍然 10/10。spec D2 在 macOS 上现在是 **clean pass**。
> - **v4 (2026-05-25, 本次)** Linux Docker (Ubuntu 24.04 + FUSE) 上跑全套矩阵:patched fork、upstream v0.6.4 bare、upstream v0.6.4 + workaround **三个配置全部 9/10 pass + 1 skip**(T1.7 macOS-only)。**结论:Linux production 部署不需要 fork** — 上游 agentfs 直接工作。fork 仅用于 macOS dev 环境。

### V1 跨平台终极矩阵

| 平台 | agentfs | bare mode | 结果 | 备注 |
|---|---|---|---|---|
| macOS NFS | v0.6.4 upstream | 1 | ❌ 0/10 | fchmod+close EACCES (issue #333) |
| macOS NFS | 9180ed4 fork | 0 (with workaround) | ✅ 10/10 | v2 |
| **macOS NFS** | **9180ed4 fork** | **1 (bare)** | ✅ **10/10** | **v3 canonical** |
| Linux FUSE | 9180ed4 fork | 1 (bare) | ✅ **9/10 + 1 skip** | v4 — fork build works on Linux |
| **Linux FUSE** | **v0.6.4 upstream** | **1 (bare)** | ✅ **9/10 + 1 skip** | **v4 critical — production candidate, no fork needed** |
| Linux FUSE | v0.6.4 upstream | 0 (with workaround) | ✅ 9/10 + 1 skip | v4 — workarounds are harmless on Linux |

`+ 1 skip` = T1.7 (Foo.md/foo.md case collision) is macOS-only — skip is intended behavior.

### 总体 verdict

| 验证 | 状态 | 对 spec 的影响 |
|---|---|---|
| **V1 — `.git` 在 agentfs** | 🟢🟢🟢 macOS + Linux 都 clean pass | **D2/D4 完全成立**。production 用上游 binary,macOS dev 用我们 fork |
| **V2 — just-bash 替代 shell + fs** | ⚠️ 强读 1/3,弱读 3/3 (仅 macOS 测过) | **D1 措辞需修订**: 两层模型 — bash 弱替代 + 可选 fs 强替代(需要 1:1 schema 镜像) |
| **总体** | 🟢🟢 **架构落地清晰** | macOS dev env 自带 fork,Linux production 用上游 — supply chain 干净 |

**当前 blocker 状态**:
1. ~~agentfs SETATTR-after-WRITE~~ — **已解**: rail44 fix 在我们 fork (`fix/nfs-write-owner-bypass-mode-check`),由 `feat/nfs-drop-appledouble` 继承
2. ~~`git clone --local` EXDEV~~ — 标准 POSIX 行为;加 `--no-hardlinks` 即解(spec 实际场景里不会有 host→mount clone 这种操作)
3. ~~macOS AppleDouble~~ — **已解**: 我们 fork 上的 `feat/nfs-drop-appledouble` 分支在 NFS server 端"silent drop"所有 `._foo` 和 .DS_Store。LOOKUP 返 NOENT;CREATE 返 synthetic fh;READ 返 EOF;WRITE 静默吞掉;READDIR 过滤。macOS 应用层完全无感(没人需要 `com.apple.provenance` roundtrip)。Linux FUSE 本来就没这个问题

---

## V1 — Git 在 agentfs 挂载点的可行性

### 方法学

10 个测试 (`packages/vfs-poc/validation/git/tests.ts`),覆盖 git 在 FUSE/NFS 上的 10 个已知雷区 (R1-R10)。每个测试在独立 agentfs session 内运行真实 git CLI,记录 exit code、stderr、关键 metric。仅在 macOS NFS 上执行(Linux FUSE 未跑,见 limitations)。

### 测试矩阵

| Test | 描述 | v1 macOS NFS (upstream) | v2 macOS NFS (rail44+macOS-WA) | 备注 |
|---|---|---|---|---|
| T1.1 | baseline init/add/commit/log/fsck | ❌ EACCES | ✅ 1.1s | rail44 fix 直接解决 |
| T1.2 | hardlink — `git clone --local` | ❌ EXDEV | ✅ 1.4s | 加 `--no-hardlinks` |
| T1.3 | mmap pack — gc + concurrent cat-file | ❌ EACCES | ✅ 11.1s | mmap 操作 100% 工作;fsck 前清 `._*` |
| T1.4 | worktree happy path (spec ③⑧ 主流程) | ❌ EACCES | ✅ 1.3s | `.gitignore '._*'` 阻止 sidecar 进 commit |
| T1.5 | 50 并发 git add | ❌ EACCES | ✅ 2.0s | |
| T1.6 | 2 worktree 并发 commit + merge | ❌ EACCES | ✅ 1.4s | 同 T1.4 |
| T1.7 | 大小写冲突 Foo.md vs foo.md | ❌ EACCES | ✅ 1.0s | NFS 实测 case-sensitive(`Foo.md` 和 `foo.md` 共存) |
| T1.8 | git status perf + 重 mount 后 stat 缓存 | ❌ EACCES | ✅ 15.5s | cold=228ms warm=47ms postRemount=275ms (stat cache 跨 remount 大致复原) |
| T1.9 | `git mv` 目录(含修改文件) | ❌ EACCES | ✅ 1.3s | |
| T1.10 | 10 轮完整 worktree 生命周期 stress | ❌ EACCES | ✅ 4.4s | 10/10 round 全 pass |

**通过率: v1 0/10 → v2 10/10**

### v1 主因分析: NFS server 端 mode-check + open-with-0444 模式

> **更正**: v1 报告写的是"fchmod after WRITE"。这是基于错误日志反推,实际不准确。issue [#333](https://github.com/tursodatabase/agentfs/issues/333) 报告里给出了精确的 reproducer:

```c
fd = open("file", O_RDWR | O_CREAT | O_EXCL, 0444);  // 文件出生就是 0444
write(fd, data, len);                                  // 本地 cache (OK)
close(fd);                                             // ← 这里报 "Permission denied"
```

git 写 loose object 时 (`finalize_object_file` 路径) **直接用 0444 mode 创建**,而不是先 0644 再 fchmod。普通本地 fs 上无副作用 — 一旦 fd 拿到,就独立于 mode bits。但 NFS v3 是 stateless 的: server 在每个 `WRITE` RPC 都重查当前 mode bits,看到 0444 直接返回 `NFS3ERR_ACCES`。client 把错误延迟报到 `close()`(因为 close 是 flush deferred WRITE 的时机)。

agentfs 的 NFS server (`nfsproc3_write()` in `cli/src/nfsserve/nfs_handlers.rs`) 调 `permissions::can_write()` 严格按 mode bits 检查。这是 NFS server 实现的一个经典缺陷,**所有同类项目都做过 owner-bypass-mode-check 之类的修复**:
- nfs-ganesha [#262/#349](https://github.com/nfs-ganesha/nfs-ganesha/issues/262) — atomic create+open 保留 fd
- mergerfs [#626/#343](https://github.com/trapexit/mergerfs/issues/626) — `nfsopenhack`(chmod-open-fchmod 三步)
- Red Hat Bug 1751210 — errata 修复

**rail44 fix 的实质**: 在 `nfsproc3_write()` 让 file owner + root 跳过 mode-bit 写检查。语义依据: POSIX 下 owner 反正可以 `chmod` 改回去,对 owner 强制 mode 检查在语义上不可执行。Non-owner / non-root 仍按 mode 检查。带一个 `test-write-readonly-new` syscall test 重现 git 的 `open(O_CREAT, 0444) → write → close` 模式。

**验证**: 用 `GIT_OBJECT_DIRECTORY=/tmp/外部目录 git add` 把 loose objects 写到 host fs,`exit=0` 成功。证明问题局限于 agentfs NFS 的 mode-check 实现。试过的 git config workaround 全无效(`core.sharedRepository`、`core.fsync`、`git hash-object`、`umask 0`)— git 源码里 mode bits 是硬编码的。

### v2 二级 blocker: macOS AppleDouble

rail44 fix 解开 git 写入后,T1.3/T1.4/T1.6/T1.10 仍 fail,但**失败模式完全不同**:

```
fatal: 坏的 sha1 文件：.git/objects/eb/._tmp_obj_PpxAAd
unable to create file ._a.txt: No such file or directory
NFS3ERR_NOTEMPTY (agentfs server log)
```

实测原因(`packages/vfs-poc/validation/...` 探针脚本): 在 agentfs NFS mount 上 `touch hello.txt`,**立刻**出现一个 `._hello.txt` sidecar (4096 字节)。`xattr -l` 显示新文件已有 `com.apple.provenance` 属性 — macOS 13+ kernel 自动给所有新创建文件加这个 xattr。agentfs NFS server 不支持 xattr,client 端 kernel **fallback 成 AppleDouble**: 把 xattr 数据写进 `._foo` 旁路文件。

下游影响:
- git 的 `git add -A` 把 `._foo` 也加进 index → commit → merge 时尝试 checkout `._foo` 会因为各种原因失败
- git gc 创建的临时 packfile 用 plain `open()`(不是 git 的 loose-object 模式),触发 AppleDouble;后续 `git fsck` 把 `.git/objects/xx/._tmp_obj_*` 误读为 sha1 文件

**应用层 workaround**(就是 v2 用的):
1. `.gitignore '._*\n.DS_Store\n'` 写在每个 repo 根 — 阻止 sidecar 进 git 历史
2. `cleanAppleDoubles()` 递归扫 `.git/` 删 `._*` — 在跑 `git fsck` 之前
3. `--no-hardlinks` for `git clone --local` 跨设备 hardlink

这三个 workaround 是 **macOS-only** 的。Linux FUSE 不存在 AppleDouble(没有 macOS kernel,没有 fallback),理应不需要任何这类清理。

**根治路径**(turso 端):
- agentfs NFS server 实现 xattr 支持(NFSv3 SETXATTR/GETXATTR procedures);或
- agentfs NFS server 主动过滤 `._*` 文件 — 在 READDIR 响应里不返回 sidecars,在 CREATE/WRITE 时拒绝 `._` 前缀;或
- 推 macOS 端 `noappledouble` mount option(client 端方案,但 NFSv3 上目前似乎没现成开关)

### T1.2 cross-device 失败 (独立问题)

`git clone --local` 默认用 hardlink 把 host repo 的 packfile 链接进 clone,但 host 和 agentfs mount 在不同 dev,`link()` 报 EXDEV。这是预期的 OS 行为,**不是 agentfs 的 bug**。加 `--no-hardlinks` 即解。spec 设计里不会有 host→mount clone(spec 是 entity → agentfs 直接 materialize)。

### 对 spec D2 / D4 的判定 (v2 更新)

> spec D2: "Entity 的 .git 目录可以作为 SQLite 数据的一部分被 AgentFS 虚拟化"
> spec D4: "DB → Git 同步: 不需要(.git 在 DB 内)"

**v2 结论: macOS NFS 上 conditional pass**。条件:
1. 用 rail44 fix 分支(或等价的上游 fix)
2. macOS dev env 里加 `.gitignore '._*'` + 周期清 `._` sidecar
3. Linux FUSE 大概率原生 pass(无 AppleDouble,fix 是否仍需要待验证 — FUSE 路径权限模型不同)

**推荐路径**:
1. **短期 (1-2 天)**: 我们 fork agentfs,把 rail44 的 commit cherry-pick 到我们维护的 build。`packages/vfs-poc/scripts/build-agentfs.sh` 自动化 build + install
2. **中期 (1-2 周)**: 给 upstream tursodatabase/agentfs 开 PR 把 rail44 commit 推过去(他自己没开 PR,issue 也没 maintainer 回应)。同时给 #333 留 comment 带我们的独立 reproduction + V1 数据,推进优先级
3. **中期 (并行)**: 在 Linux Docker 里跑 V1,确认 FUSE 路径是否仍需 rail44 fix。如果 Linux 原生 pass,production 在 Linux 部署就不依赖 fork
4. **长期**: 推 turso 实现 NFS xattr 支持(根治 macOS AppleDouble),或文档化 macOS dev 必带 `cleanAppleDoubles` 助手

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
| §3.1 表格 - "AgentFS" 行 | "Entity 的全部数据(含 .git 目录)存储在 AgentFS 的 SQLite 中" | 加注:"已验证可行(VALIDATION_REPORT v2 V1 10/10 pass on macOS NFS),依赖 agentfs PR #TBD(rail44 NFS owner-bypass-mode-check fix)合入,或我们维护 fork build" |
| §3.1 表格 - "just-bash" 行 | "完全替代 Claude Code 的原生 shell 调用" | "替代 claude 内置 Bash 工具(必经此路径);claude 的原生 Read/Write/Edit/Grep/Glob 仍可工作,落在 agentfs mount 内。如需 100% MCP 化,加 MCP `files` 服务并 1:1 mirror 原生 schema" |
| §D1 决策表 | "just-bash 完全替代原生 shell" | "默认:仅替代 Bash;可选:扩展替代 fs 工具集(MCP schema 必须 1:1 mirror 原生)" |
| §D2 决策表 | ".git 在 DB 中" | "已验证可行 (VALIDATION_REPORT v2),依赖 agentfs upstream issue [#333](https://github.com/tursodatabase/agentfs/issues/333) 的 fix 落地" |
| §D4 决策表 | "不需要 DB → Git 同步" | "已验证 (VALIDATION_REPORT v2 V1 10/10 pass)。dev env (macOS) 需带 `.gitignore '._*'` + `cleanAppleDoubles` 助手处理 AppleDouble 副作用,production (Linux FUSE) 无此问题" |
| §VII 步骤 ② | "无需额外的 DB → Git Sync — .git 就在 DB 里" | 加 footnote 引用此 VALIDATION_REPORT v2 V1 结论 + 注 macOS dev workaround |
| §VII 步骤 ⑤ | "完全替代 Claude Code 原生 shell" | 同 §D1 修订:说清楚两层 |
| §X 平台模块图 | (无变化建议) | 在 just-bash 框下面加注: "替代 Bash 工具;Read/Write/Edit 默认走原生 + agentfs mount" |
| §XII Future | 缺 Linux 验证项 | 新增:"在 Linux FUSE 下重跑 V1 全套,确认 rail44 fix 是否仍需要 + 验证无 AppleDouble" |

---

## Linux Docker (v4) 详细数据

平台细节: Ubuntu 24.04 in Docker (OrbStack VM, Linux 6.14 kernel, arm64), agentfs FUSE 路径, `--privileged --device /dev/fuse`。

### 性能对比 (macOS NFS vs Linux FUSE,patched-bare,9180ed4)

| Test | macOS NFS | Linux FUSE | speedup |
|---|---|---|---|
| T1.1 baseline | 1005ms | 588ms | 1.7× |
| T1.2 clone | 1200ms | 662ms | 1.8× |
| T1.3 mmap pack + gc | 10949ms | 2193ms | **5.0×** |
| T1.4 worktree | 1310ms | 647ms | 2.0× |
| T1.5 50 concurrent add | 1883ms | 751ms | 2.5× |
| T1.6 2 worktree merge | 1370ms | 620ms | 2.2× |
| T1.7 case collision | 921ms | skip | — |
| T1.8 status (cold/warm/postRemount) | 260/46/188ms | **35/21/132ms** | 7×/2×/1.4× |
| T1.9 dir rename | 1007ms | 573ms | 1.8× |
| T1.10 stress (10 round) | 4407ms | 1015ms | **4.3×** |
| **total wall** | **~37s** | **~9s** | **~4×** |

FUSE/Linux 显著优于 NFS/macOS — 特别是涉及多文件 op 和 mmap 的场景。

### 三 config 一致性证明

`upstream-bare` 和 `upstream-workaround` 在 Linux 上**完全一致 pass**,说明:
- AppleDouble drop 在 Linux 上是 dead code(Linux kernel 不写 `._foo` sidecar,READDIR 过滤永远不命中)
- `.gitignore '._*'` 在 Linux 上是 dead config(没有 sidecar 进 git 索引)
- 应用层 workaround 是 macOS 专属

`patched-bare` 和 `upstream-bare` 在 Linux 上**完全一致 pass**,说明:
- rail44 NFS fix 在 Linux 上是 dead code(FUSE 路径不经过 nfsproc3_write)
- AppleDouble drop 在 Linux 上是 dead code(同上)
- **fork 对 Linux 而言是零差异**

### 复现

```bash
bash packages/vfs-poc/scripts/run-linux-v1.sh
# 或单跑一个 config:
bash packages/vfs-poc/scripts/run-linux-v1.sh patched-bare
# 结果在 /tmp/vfs-poc-linux-results/v1-linux-<config>.{json,log}
```

第一次跑会 build Ubuntu image(~30s)+ build agentfs(~3-5min,cargo target 缓存到 host `~/.cache/vfs-poc-linux/cargo-target/`)。后续重跑 build 步骤被 cargo 增量缓存,~5s。

## Out-of-scope (这次没测)

- ~~Linux FUSE V1~~ — **v4 完成**
- **V2 (claude API) 在 Linux 上** — claude CLI 没装进 image,需要 API key 配置,留下一轮
- **非 `--privileged` 容器模式** — 留产线 security posture 评估时再细抠
- **V3 多挂载点合成**(spec §5 的 project/skills/references/media)
- **V4 50+ session 并发挂载密度**
- **Skill 三层继承挂载**(spec §VIII)
- **Object Storage 挂载**(spec §5 media)
- **agentfs → DB 回写**(spec §VII 步骤 ⑩)
- **conflict review session**(spec §VII 步骤 ⑧ + D7)
- **macOS 性能基准**(我们看的是延迟差,但生产用 Linux 所以不重要)

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

- **v1 — 2026-05-24** (初版): macOS NFS 平台 V1 + V2 全量执行,2 个 P0 都得到判定。V1 0/10 因 fchmod+close 问题全 fail,初步定性 spec D2 BLOCKED。
- **v2 — 2026-05-25** (重大修订):
  - 在 turso/agentfs issue tracker 找到 [#333](https://github.com/tursodatabase/agentfs/issues/333) — `@rail44` 2026-04-16 报告同一问题,附 fix 分支 + test
  - 自己 build rail44 fix 分支(commit `2e9c85f`),备份 upstream binary 后替换 `~/.cargo/bin/agentfs`
  - 重跑 V1: rail44 fix 解了主问题后,3 个测试新失败暴露 macOS AppleDouble 二级 blocker
  - 加 `.gitignore '._*'` + `cleanAppleDoubles()` helper + `--no-hardlinks` workaround
  - **V1 最终 10/10 pass on macOS NFS** (agentfs `2e9c85f` + 应用层 macOS workaround)
  - spec D2 verdict 从 BLOCKED 升级为 conditional pass
  - 更正 v1 报告里"fchmod after WRITE"的不精确描述 — 实际是 git `open(O_CREAT, 0444)` 后 NFS server mode-check 拒 WRITE RPC,close() 时延迟报错
- **v3 — 2026-05-25** (server 端根治 AppleDouble):
  - 在 `nnabuuu/agentfs:feat/nfs-drop-appledouble` 上加 250 行 Rust 模块 `appledouble.rs` + 11 处 NFS handler 拦截。架构: synthetic fh (fileid=u64::MAX) + per-handler short-circuits + READDIR 过滤
  - 11 个 patched handler: LOOKUP / CREATE / GETATTR / SETATTR / READ / WRITE / ACCESS / REMOVE / RENAME / READDIR / READDIRPLUS
  - env var gate: `AGENTFS_DROP_APPLEDOUBLE=0` 可禁用(默认 on)
  - 加 `VFS_POC_BARE=1` 测试模式,把应用层 `.gitignore '._*'` + `cleanAppleDoubles()` 全关
  - **V1 在 bare mode 下仍 10/10 pass** → 证明 server 端拦截已替代所有应用层 workaround
  - spec D2 verdict 从 conditional pass 升级为 **clean pass** (零 git 配置妥协)
  - 不依赖 turso 上游合任何东西 — 完全在我们 fork 控制内
  - 加 code review hardening (commit 9180ed4): RENAME 数据保护 + READDIR 死循环 guard + CREATE NOTDIR + 6 单测
- **v4 — 2026-05-25** (Linux Docker production validation):
  - 加 `packages/vfs-poc/docker/{Dockerfile,entrypoint.sh}` + `scripts/run-linux-v1.sh` 三 config 矩阵 runner
  - Ubuntu 24.04 in OrbStack Docker(Linux 6.14 kernel arm64),`--privileged --device /dev/fuse`,agentfs FUSE 路径
  - 三 config 全部 **9/10 pass + 1 skip** (T1.7 macOS-only):
    - patched fork 9180ed4 + bare
    - upstream v0.6.4 + bare
    - upstream v0.6.4 + workaround
  - **关键结论: Linux production 不需要 fork**。rail44 NFS fix 和 AppleDouble drop 都只补 NFS 服务器代码,Linux 走 FUSE,完全不经过 patched 代码
  - Linux FUSE 性能比 macOS NFS 快 ~4× (T1.3 mmap 5×, T1.8 status 7×, T1.10 stress 4.3×)
  - supply chain 大幅简化: 只 macOS dev 需要 build/install fork binary,production binary 直接 curl 装上游 release
