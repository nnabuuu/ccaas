# Jijian Agent Session Runtime

> 技术方案与产品设计 | Working Draft
> 用于内部review，非外部交付文档

---

## 一、产品定位

Agent Session Runtime 是即见平台（Jijian）的核心基础设施层，解决一个问题：**如何为每个 spawned Agent 构建正确的、隔离的工作环境。**

"正确"的定义不是技术层面的——不是"能跑起来"，而是"Agent 进入 session 时看到的文件系统，精确反映了它当前任务所需的全部业务上下文"。这个"精确"由领域建模决定，不由技术架构决定。

---

## 二、核心设计原则

**1. 文件系统是 Agent 的原生界面**

Agent 天然通过文件系统和 shell 命令与世界交互——ls、grep、cat、str_replace。不需要额外的工具适配层、不需要教 Agent 调用特定 API。把业务上下文投射为文件，Agent 就能原生探索。

**2. Workspace 的内容由领域建模驱动**

挂载什么、怎么组织目录结构、哪些可写哪些只读——这些决策来自 Solution 层的领域建模，不是 runtime 自己决定的。Runtime 是执行者，Solution 是定义者。

**3. 读写隔离，按内容性质分治**

不是所有内容都需要同等级别的并发管理。经常变的业务实体需要 session 隔离和变更合并；不变的参考资料直接挂载即可。大文件（音视频等）走 object storage 只读挂载，不进入 git 管理。

**4. Git 是内部引擎，不是外部系统**

Git 的角色被精确限定为本地 branching/merging 引擎。不存在 remote，不存在 clone/push/pull。整个 .git 目录作为 Entity 数据的一部分存储在 DB 中，通过 AgentFS 虚拟化。Agent 不感知 git 的存在——worktree 的创建和合并是 Runtime 在 session 生命周期首尾自动完成的。

---

## 三、技术选型

### 3.1 核心依赖

| 组件 | 技术 | 职责 |
|------|------|------|
| **tursodatabase/agentfs** | SQLite-backed Agent 文件系统 | 持久化文件系统层。通过 FUSE（Linux）/ NFS（macOS）挂载为真实文件系统。内置审计（每个文件操作记录在 SQLite 中）、快照（`cp agent.db snapshot.db`）。Entity 的全部数据（含 .git 目录）存储在 AgentFS 的 SQLite 中。 |
| **vercel/just-bash** | TypeScript 虚拟 bash 环境 | 沙箱化执行层。**完全替代 Claude Code 的原生 shell 调用。** 提供标准 Unix 命令集（grep、sed、awk、jq 等），支持 `defineCommand` 注入业务命令。通过命令白名单屏蔽 git 等不应暴露给 Agent 的命令。 |
| **Git（仅本地）** | 本地 branching/merging | Session 隔离引擎。仅使用 worktree add / commit / merge / worktree remove 四个操作。无 remote 概念，不使用 clone/push/pull/fetch。由 Runtime 自动操作，Agent 不可见。 |

### 3.2 选型理由

**为什么用 AgentFS？**

AgentFS 的 SQLite 底座天然提供审计（每个文件操作可查询）、快照（数据库级别的原子复制）、可移植性（单文件即一个完整的 Agent 状态）。更关键的是：**Entity 的 .git 目录可以作为 SQLite 数据的一部分被 AgentFS 虚拟化**，消除了 DB 与 Git Repo 之间的同步问题。

**为什么用 just-bash 完全替代 Claude Code 的 shell？**

安全隔离——Agent 不能触及宿主环境，也不能直接操作 git。just-bash 通过命令白名单精确控制 Agent 可用的命令集，同时通过 `defineCommand` 注入领域操作。Agent 像用普通 shell 命令一样调用业务能力。

**为什么 Git 只做 branching/merging？**

Git 在这个架构中不是版本控制系统，而是一个并发隔离引擎。它的唯一价值是：多个 session 可以安全地并行修改同一个 Project 的 Entity，然后可靠地合并。不需要 remote 的概念，不需要分布式协作的能力。

---

## 四、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent (Claude Code)                     │
│                                                             │
│   ls / grep / cat / str_replace / 自定义业务命令            │
│   （看不到 .git，不知道 git 的存在）                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                   ┌───────▼──────────┐
                   │    just-bash     │  ← 沙箱化 bash 执行环境
                   │   (vercel)       │     完全替代原生 shell
                   │                  │     命令白名单 + defineCommand
                   │                  │     git 相关命令已屏蔽
                   └───────┬──────────┘
                           │
                   ┌───────▼──────────┐
                   │     AgentFS      │  ← 持久化文件系统 + 审计
                   │    (turso)       │     SQLite-backed
                   │                  │     .git 目录在 SQLite 内
                   └──┬────────┬──┬──┘
                      │        │  │
         ┌────────────▼──┐  ┌─▼──▼────────────┐
         │  Git Worktree  │  │  Direct Mount   │
         │ （可写，隔离）  │  │ （只读，共享）    │
         │  Runtime 自动   │  │                 │
         │  管理，Agent    │  │ Skills          │
         │  不可见         │  │ References      │
         └───────┬────────┘  │ 大文件(Obj Stor) │
                 │           └─────────────────┘
          ┌──────▼───────┐
          │   Database   │  ← Source of Truth
          │  （含 .git   │     Entity 数据 + .git 数据
          │    数据）     │     统一存储，无同步问题
          └──────────────┘
```

三层职责清晰分离：

- **just-bash**：Agent 的执行沙箱，控制 Agent 能做什么（白名单）和能扩展什么（defineCommand）
- **AgentFS**：Agent 的持久化文件系统，统一虚拟化所有数据源（含 .git），记录 Agent 做了什么
- **Git（本地）**：Runtime 的内部隔离引擎，Agent 不可见，仅在 session 首尾由 Runtime 操作

---

## 五、Workspace 结构

```
workspace/                             ← AgentFS 挂载根目录
├── project/                           ← Git worktree（可写，session 隔离）
│   ├── lessons/                       │  Agent 可读写
│   │   ├── unit1-lesson3/             │  .git 目录被 AgentFS 隐藏
│   │   │   ├── plan.json             │  Agent 不感知版本控制
│   │   │   └── attachments/
│   │   └── unit2-lesson1/
│   ├── analytics/
│   └── records/
│
├── skills/                            ← 直接挂载（只读）
│   ├── org/                           ← 组织级 Skill（强制继承）
│   ├── school/                        ← 学校级 Skill（强制继承）
│   └── personal/                      ← 个人级 Skill（自由覆盖）
│
├── references/                        ← 直接挂载（只读）
│   ├── curriculum-standards/          ← 课标
│   └── textbooks/                     ← 课文
│
└── media/                             ← Object Storage 挂载（只读）
    ├── audio/                         ← 音频教学素材
    └── video/                         ← 视频教学素材
```

**关键约束：**

- 目录结构由 Solution 定义，上面是教育场景的实例
- `project/` 下的 `.git` 目录对 Agent 隐藏（AgentFS 层过滤或 just-bash 命令过滤）
- `media/` 下的大文件从 Object Storage 只读挂载，**不可编辑**，不进入 git 管理
- Agent 看到的是一个自然的、扁平的文件系统，不需要知道背后有多少层抽象

---

## 六、Entity 模型与文件投射

### 6.1 Entity 定义

在 Solution 层，FDE 进行领域建模时定义该场景下的 Entity 类型。每个 Entity：

- 存储在数据库中（source of truth），**含 .git 目录数据**
- 可以 attach files（附件、子文档、结构化数据）
- 属于一个 Project
- 大文件附件指向 Object Storage（引用关系在 DB，文件本体在 Object Storage）

### 6.2 投射规则

Entity 如何变成文件系统中的目录和文件，由 Solution 定义的 **投射规则（Projection Rules）** 决定：

| 决策项 | 由谁决定 | 示例 |
|--------|---------|------|
| Entity 映射为目录还是单文件 | Solution 定义 | 教案 → 目录（含 plan.json + attachments/）|
| 目录层级和命名 | Solution 定义 | `lessons/{unit}-{lesson}/` |
| 哪些字段序列化为文件内容 | Solution 定义 | plan.json 包含目标、环节、时长 |
| 哪些 Entity 进入当前 session scope | Solution 定义 + 任务上下文 | "备课"任务只挂载目标课程相关 Entity |
| 大文件附件的引用方式 | Solution 定义 | media/ 下只读挂载，plan.json 内用相对路径引用 |

Runtime 执行这些规则，但不定义它们。

---

## 七、Session 生命周期

```
Session 创建请求
  │
  ▼
① Scope Resolution
  │  根据任务类型和上下文，确定哪些 Entity 在 scope 内
  │  （由 Solution 定义的 scope 规则）
  │
  ▼
② AgentFS 初始化
  │  从 DB 加载 scope 内 Entity 数据（含 .git）到 AgentFS 实例
  │  无需额外的 "DB → Git Sync"——.git 就在 DB 里
  │
  ▼
③ Git Worktree 创建（Runtime 操作，Agent 不可见）
  │  Runtime 在 AgentFS 内部执行：
  │    git worktree add session/{session-id}
  │  创建隔离的工作分支
  │
  ▼
④ Workspace 装配
  │  AgentFS 挂载：
  │  - worktree 路径 → workspace/project/（可写，.git 隐藏）
  │  - Skills 目录 → workspace/skills/（只读，经继承解析）
  │  - References → workspace/references/（只读）
  │  - 大文件 → workspace/media/（只读，Object Storage）
  │
  ▼
⑤ just-bash 沙箱启动
  │  创建 Bash 实例，完全替代 Claude Code 原生 shell
  │  - working directory 指向 workspace
  │  - 命令白名单：标准 Unix 命令 + 自定义业务命令
  │  - 屏蔽命令：git、docker、sudo 等
  │  - 注入 defineCommand 自定义业务命令
  │
  ▼
⑥ Agent Spawn
  │  启动 Claude Code，通过 just-bash 沙箱执行所有命令
  │  Agent 看到一个普通的文件系统，正常工作
  │  所有文件操作经 AgentFS 自动记录
  │
  ▼
⑦ Agent 完成 / Session 结束
  │
  ▼
⑧ Commit + Merge（Runtime 操作，Agent 不可见）
  │  Runtime 在 AgentFS 内部执行：
  │    git add -A && git commit -m "session/{session-id}"
  │    git checkout main && git merge session/{session-id}
  │  冲突时 → 新开 review session（Agent 或人介入解决）
  │
  ▼
⑨ Post-hook 校验
  │  业务完备性检查（由 Solution 定义的 post-merge hooks）
  │  例：session 时长总和 ≤ 课时时长、必填字段完整性
  │
  ▼
⑩ AgentFS → DB 回写
  │  将 AgentFS 中的变更（含更新后的 .git 数据）持久化回 DB
  │  使用乐观锁（version 字段）确保一致性
  │
  ▼
⑪ Cleanup
    AgentFS 快照永久保存（审计用）
    释放 worktree（git worktree remove）
    卸载 AgentFS 挂载
```

### 关键步骤详解

**② AgentFS 初始化——消除同步层**

传统方案需要 "DB → Git Repo" 的同步层来保持两个数据源一致。本方案中 .git 数据就在 DB 里，AgentFS 从 DB 加载时自然包含 .git，不存在同步问题。这消除了整个链路中最脆弱的一环。

**③ + ⑧ Git 操作——Runtime 内部行为**

Git 的全部操作发生在 AgentFS 虚拟化的文件系统内部，由 Runtime 自动完成。Agent 完全不感知。使用的 git 命令严格限定为四个：

```
git worktree add     ← session 开始
git add -A           ← session 结束
git commit           ← session 结束
git merge            ← session 结束
git worktree remove  ← cleanup
```

不使用：clone、push、pull、fetch、remote、rebase、stash、tag。

**⑤ just-bash 沙箱——完全替代原生 shell**

```typescript
const bash = new Bash({
  cwd: "/workspace",

  // 屏蔽危险命令
  // git 相关命令全部屏蔽——Agent 不应知道 git 的存在
  blockedCommands: ["git", "docker", "sudo", "su", "mount", "umount"],

  // 注入通用级业务命令
  customCommands: [
    // 通用能力（Runtime 提供）
    defineCommand("sql", async (args, ctx) => {
      // 通用 SQL 查询能力
    }),

    // Solution 自定义命令（由 Solution 注册）
    ...solutionConfig.customCommands,
  ],

  // 网络访问控制
  network: {
    allowedUrlPrefixes: solutionConfig.networkPolicy?.allowedUrls ?? [],
  },
});
```

`defineCommand` 分两层：Runtime 提供通用能力（如 sql 查询），Solution 注册领域命令。Agent 不区分两者，都是普通 shell 命令。

**⑧ Merge 冲突处理**

当 merge 遇到冲突时：

1. 当前 merge 中止（`git merge --abort`）
2. 冲突信息记录到 AgentFS 审计日志
3. **新开一个 review session**，将冲突文件和两个版本呈现给 Agent 或人
4. Review session 解决冲突后，正常走 commit → merge → post-hook 流程

不尝试自动解决，不回退用户的工作。

**⑪ AgentFS 快照——永久保存**

每个 session 结束时，AgentFS 的 SQLite 数据库文件做快照，**永久保存**。

这意味着：
- 任意历史 session 的完整文件系统状态可随时重建
- Agent 在 session 中的每个文件操作（read/write/delete）可查询
- 满足教育行业审计要求——无限期可追溯

---

## 八、Skill 三层继承与挂载

Skills 是只读挂载，但有一个业务逻辑需要 Runtime 处理：**三层继承解析。**

```
组织级（Org）      → 所有学校必须遵循（强制继承）
学校级（School）   → 学校层面的定制（强制继承）
个人级（Personal） → 教师个人的偏好（自由覆盖）
```

挂载时需要按继承规则合并：

- **强制继承型 Skill**（如课标解读）：org → school 逐层覆盖，个人级无权修改
- **自由覆盖型 Skill**（如教学细节设计）：personal 存在则用 personal，否则 fallback 到 school → org

最终 Agent 在 `workspace/skills/` 下看到的是**合并后的结果**，不需要知道继承链。

---

## 九、Solution 层契约

Solution 向 Runtime 注册以下配置：

```typescript
interface SolutionRuntimeConfig {
  // === Entity 投射 ===
  projections: EntityProjection[];

  // === Scope 解析 ===
  scopeResolver: (taskContext: TaskContext) => EntityId[];

  // === 只读挂载 ===
  staticMounts: {
    skills: SkillMountConfig;             // 含三层继承解析配置
    references: string[];                 // 静态资源路径
    media?: ObjectStorageMountConfig;      // 大文件只读挂载
  };

  // === just-bash 扩展 ===
  customCommands?: CommandDefinition[];    // defineCommand 注入的业务命令
  networkPolicy?: {
    allowedUrls: string[];                // Agent 可访问的外部资源
  };

  // === 变更管理 ===
  mergeStrategy?: CustomMergeDriver;      // JSON 等结构化数据的自定义合并
  postMergeHooks: PostHookHandler[];      // 业务完备性校验

  // === 冲突处理 ===
  conflictReviewMode: "agent" | "human";  // 冲突时新开的 review session 由谁处理
}
```

Runtime 按此配置执行，不做业务判断。Solution 是领域逻辑的所有者。

---

## 十、与即见平台其他模块的关系

```
┌──────────────────────────────────────────────────────────────┐
│                      Jijian Platform                         │
│                                                              │
│  ┌────────────┐  ┌───────────────────────────────────────┐   │
│  │  Sessions   │  │     Agent Session Runtime             │   │
│  │  Module     │──│                                       │   │
│  │            │  │  ┌─────────┐ ┌────────┐ ┌───────────┐│   │
│  └────────────┘  │  │just-bash│ │AgentFS │ │ Git (local)││   │
│                  │  │(sandbox)│ │(fs+    │ │ (branch/  ││   │
│  ┌────────────┐  │  │ 替代原生 │ │ audit+ │ │  merge    ││   │
│  │  Solutions  │──│  │  shell  │ │ .git   │ │  only)    ││   │
│  │  Module     │  │  │        │ │ 虚拟化) │ │ Agent不   ││   │
│  └────────────┘  │  └─────────┘ └────────┘ │ 可见      ││   │
│                  │                          └───────────┘│   │
│  ┌────────────┐  │  Scope / Mount / Merge / Post-hook    │   │
│  │  Skills    │  └───────────────────────────────────────┘   │
│  │  Module    │                                              │
│  └────────────┘  ┌────────────┐  ┌────────────────┐          │
│                  │  MCP       │  │ Object Storage │          │
│                  │  Module    │  │ (大文件只读)    │          │
│                  └────────────┘  └────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

- **Sessions Module**：发起 session 创建请求，Runtime 负责环境准备
- **Solutions Module**：提供 SolutionRuntimeConfig（Entity 定义、投射规则、scope 规则、自定义命令、merge 策略、post-hook）
- **Skills Module**：提供 Skill 内容和继承配置，Runtime 负责解析和挂载
- **MCP Module**：提供 Agent 可调用的工具，与 Runtime 平行（不经过文件系统）
- **Object Storage**：大文件（音视频）的存储后端，Runtime 只读挂载到 workspace/media/

---

## 十一、设计决策记录

| # | 决策 | 选择 | 放弃 | 理由 |
|---|------|------|------|------|
| D1 | Shell 执行环境 | just-bash 完全替代原生 shell | Claude Code 原生 shell 调用 | 安全隔离 + 命令白名单控制 + defineCommand 业务扩展 |
| D2 | .git 存储位置 | 作为 Entity 数据存在 DB 中，由 AgentFS 虚拟化 | 独立的宿主文件系统 Git Repo | 消除 DB ↔ Git 同步层，单一数据源 |
| D3 | Git 功能范围 | 仅 worktree add/commit/merge/remove | 完整 Git（clone/push/pull/remote） | Git 是内部隔离引擎，不是版本控制系统 |
| D4 | DB → Git 同步 | 不需要（.git 在 DB 内） | Session 创建时实时同步 | 架构简化——同步层是之前最脆弱的环节 |
| D5 | 大文件管理 | Object Storage 只读挂载，不进 git | Git LFS | 大文件不允许编辑，无需版本管理开销 |
| D6 | Workspace 缓存 | 不缓存（future feature） | 复用 worktree | 先保持简单，后续根据性能数据决定 |
| D7 | Merge 冲突处理 | 新开 review session（Agent 或人） | 自动解决 / 拒绝 | 不丢失用户工作，保持人在回路 |
| D8 | defineCommand 粒度 | 通用级（如 sql），Solution 按需扩展 | 功能级（每个业务操作一个命令） | Runtime 提供基础能力，Solution 自由定制 |
| D9 | 审计数据生命周期 | AgentFS 快照永久保存 | 定期归档/清理 | 教育行业审计要求，无限期可追溯 |

---

## 十二、待细化（Future）

1. **Workspace 缓存策略**（D6 的后续）：同一教师连续操作同一 Project 时，复用 AgentFS 实例和 worktree 的可行性和一致性保证。

2. **Post-hook 校验失败策略**：回滚 merge 还是保留但标记 warning？是否支持 blocking vs non-blocking 两种级别？待 Solution 实际运行后根据反馈决定。

3. **多节点部署**：当前假设单节点。如果需要多节点，AgentFS 的 SQLite 文件需要在共享存储上，或使用 Turso 的 libSQL 分布式能力。
