# ADR-0007: 消息层级与资源归属定义

**状态**: Proposed
**日期**: 2026-02-15
**决策者**: @nnabuuu

---

## 背景 (Context)

CCAAS 核心后端目前有 28 个持久化实体，但这些实体之间的层级关系缺乏清晰定义：

- `Session` 是最高层概念，但语义模糊（有时指 WebSocket 连接，有时指对话）
- `Message` 通过 `messageIndex` 排列，但用户消息和 AI 回复之间没有显式的 **Round**（回合）概念
- `AgentFile` 同时有 `sessionId` 和 `messageId`，关联关系不明确
- `JobEntity` 有 `sessionId` + `messageId` + `bgSessionId`，归属混乱
- `OutputUpdate` 只是实时 WebSocket 事件，没有持久化
- 后台任务（`ScheduledTask`、`JobEntity`）在层级中没有定位

**核心问题**：缺乏一致的 **Conversation > Round > Message** 语义模型，导致：
1. API 设计没有统一的聚合边界
2. Token 计费没有自然的 Round 级别聚合
3. 文件和后台任务的归属关系不清晰
4. 前端无法按 Round 聚合展示资源（文件、工具调用、输出更新）

---

## 决策 (Decision)

### 1. 建立三层消息层级

```
Conversation (= Session)
│
├── Round 0  [user prompt → assistant response]
│   ├── Messages (user + assistant)
│   ├── ToolEvents[]
│   ├── ThinkingBlocks[]
│   ├── TokenUsageEvents[]
│   ├── AgentFiles[] (created/modified in this round)
│   ├── OutputUpdates[] (persisted)
│   └── Jobs[] (background tasks spawned)
│
├── Round 1
│   └── ...
│
├── Round N
│   └── ...
│
└── Conversation-level metadata
    ├── ConversationContext (1:1)
    ├── ProcessLifecycleEvents[]
    └── ApiErrorEvents[]
```

### 2. Conversation（对话）

**定义**: 一次连续的人机交互会话，由多个 Round 组成。

**映射**: `Conversation` = 现有的 `Session` 实体（`admin/entities/session.entity.ts`）。不创建新表，而是通过文档和 API 命名赋予 Session 明确的 "Conversation" 语义。

**属性**:
- `id` — 唯一标识
- `tenantId` — 租户隔离
- `status` — idle | processing | error | closed | cancelling
- `messageCount` — 预聚合的消息总数
- `totalTokens` — 预聚合的 token 总量
- `estimatedCost` — 预聚合的估算费用

**Conversation 级别的关联资源**:

| 资源 | 关系 | 说明 |
|------|------|------|
| `ConversationContext` | 1:1 | 对话启动时的配置快照（系统提示词、MCP 工具、模型） |
| `ProcessLifecycleEvent` | 1:N | 进程生命周期事件（spawn/exit/crash），属于整个 Conversation |
| `ApiErrorEvent` | 1:N | API 错误事件，可能发生在任何 Round，但追踪在 Conversation 级别 |
| `UserContextEvent` | 1:N | 前端页面状态变更，Conversation 存续期间的上下文 |
| `MessageQueue` | 1:N | 待处理的消息队列 |

### 3. Round（回合）

**定义**: 一次 user prompt → assistant response 的完整交互。是 **计费、聚合、重放** 的核心单位。

**实现方式**: 在 `Message` 实体上新增 `roundIndex` 字段（0-based integer）。同一个 Round 中的 user 消息和 assistant 消息共享相同的 `roundIndex`。

```typescript
// Message entity 新增字段
@Column({ type: 'integer', default: 0 })
roundIndex!: number;  // 0-based, same for user+assistant pair
```

**Round 不是独立实体，而是一个计算概念**，通过 `roundIndex` 从 Message 和关联资源中聚合。

**Round 的边界情况**:

| 场景 | roundIndex 行为 | 说明 |
|------|-----------------|------|
| 正常交互 | user(ri=0) → assistant(ri=0) → user(ri=1) → assistant(ri=1) | 标准 Round |
| 用户取消 (stop) | user(ri=2) → assistant(ri=2, partial) → user(ri=3) → assistant(ri=3) | 取消的 Round 保留 roundIndex，assistant message 可能内容不完整（`stopReason = 'cancelled'`），下一条消息开启新 Round |
| CLI 进程重启 | Round N 结束后 CLI 被 kill → 下一条消息 spawn 新 CLI with `--resume` → Round N+1 | Round 不跨进程边界，每个 Round 在同一个 CLI 进程内完成 |
| 重连续传 | assistant(ri=2, isContinuation=true) | 重连后的续传消息保持同一 roundIndex |

**Round 聚合视图** (API 响应中计算生成):

```typescript
interface Round {
  roundIndex: number;
  userMessage: Message;        // role = 'user'
  assistantMessage: Message;   // role = 'assistant'
  toolEvents: ToolEvent[];     // 该 Round 内的工具调用
  thinkingBlocks: ThinkingBlock[];
  tokenUsage: {                // 该 Round 的 token 聚合
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    reasoningTokens: number;
    estimatedCostUsd: number;
  };
  files: AgentFile[];          // 该 Round 创建/修改的文件
  outputUpdates: OutputUpdate[];  // 该 Round 产生的输出更新
  jobs: JobEntity[];           // 该 Round 触发的后台任务
  startedAt: Date;             // user message 的 createdAt
  completedAt: Date;           // assistant message 的 createdAt
  durationMs: number;          // completedAt - startedAt
}
```

### 4. Message（消息）

**定义**: Conversation 中的一条具体消息（user 或 assistant）。

**现有字段不变**，新增 `roundIndex`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `sessionId` | string | → Conversation |
| `role` | 'user' \| 'assistant' | 发送者 |
| `content` | text | 消息内容 |
| `messageIndex` | integer | 在 Conversation 中的全局顺序 |
| **`roundIndex`** | **integer** | **所属 Round 的索引（新增）** |
| `parentMessageId` | UUID? | 会话分支支持 |
| `branchId` | string? | 分支标识 |
| `isContinuation` | boolean | 重连续传 |
| `metadata` | JSON | model, tokens, stopReason |

### 5. 资源归属详细映射

#### 5.1 AgentFile — 新增 `roundIndex`

文件是 **Conversation 级别**的持久资源（在整个对话中存在），但需要追踪 **在哪个 Round 被创建/修改**。

```typescript
// AgentFile entity 新增字段
@Column({ type: 'integer', nullable: true })
roundIndex!: number | null;  // null = Conversation 级别（如用户上传的初始文件）
```

**语义**:
- `roundIndex = null` — 文件是 Conversation 级别的（用户在对话开始时上传）
- `roundIndex = 3` — 文件在 Round 3 中被 agent 创建/修改
- 如果同一个文件在多个 Round 中被修改，`roundIndex` 记录 **最近一次修改**的 Round，历史通过 `FileVersion` 追溯

**查询模式**:
```sql
-- 获取 Round 3 创建/修改的所有文件
SELECT * FROM agent_files WHERE sessionId = ? AND roundIndex = 3;

-- 获取 Conversation 中所有文件
SELECT * FROM agent_files WHERE sessionId = ?;
```

#### 5.2 OutputUpdate — 新增持久化实体

当前 `output_update` 只是 WebSocket 事件，需要持久化：

```typescript
@Entity('output_updates')
@Index('IDX_output_updates_session_round', ['sessionId', 'roundIndex'])
export class OutputUpdate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  sessionId!: string;

  @Column({ type: 'varchar', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'integer' })
  roundIndex!: number;  // 所属 Round

  @Column({ type: 'varchar', nullable: true })
  messageId!: string | null;  // 关联的 assistant message

  @Column({ type: 'varchar', nullable: true })
  field!: string | null;  // 输出字段名

  @Column({ type: 'simple-json', nullable: true })
  value!: unknown;  // 输出值

  @Column({ type: 'varchar', default: 'set' })
  operation!: 'set' | 'append' | 'merge';

  @Column({ type: 'boolean', default: false })
  progressive!: boolean;

  @Column({ type: 'boolean', default: false })
  complete!: boolean;

  @Column({ type: 'integer', default: 0 })
  sequenceNumber!: number;  // 同一 Round 内的顺序

  @CreateDateColumn()
  createdAt!: Date;
}
```

#### 5.3 JobEntity（后台任务）— 新增 `roundIndex`

后台任务由某个 Round 内的交互触发。

```typescript
// JobEntity 新增字段
@Column({ type: 'integer', nullable: true })
roundIndex!: number | null;  // 触发此任务的 Round（null = 非 Round 触发）
```

**归属语义**:
- `sessionId` — 任务所属的 Conversation
- `messageId` — 触发任务的具体消息（通常是 assistant message）
- `roundIndex` — 触发任务的 Round
- `bgSessionId` — 后台任务自己创建的新 Conversation（如果有）

**后台任务的两种模式**:

```
模式 A: 对话内后台任务
Conversation → Round 3 → assistant message → spawn Job
                                                └── bgSessionId = 新 Conversation（后台执行）

模式 B: 定时任务
ScheduledTask → ScheduledTaskExecution → sessionId = 新 Conversation（无头执行）
```

#### 5.4 ScheduledTask（定时任务）

定时任务是 **Conversation 之外**的独立概念。每次执行时，它创建一个 **无头 Conversation**（headless）：

```
ScheduledTask (tenant 级别)
├── ScheduledTaskExecution (每次执行)
│   └── sessionId → Conversation (headless, 无 user message)
│                   └── Round 0 (只有 assistant message)
│                       ├── ToolEvents[]
│                       ├── AgentFiles[]
│                       └── OutputUpdates[]
```

**无头 Conversation 的特殊处理**:
- `Round 0` 中只有 assistant message（没有 user message，或使用 ScheduledTask.message 作为隐式 user message）
- `ConversationContext` 记录任务的 MCP 配置和 skill 配置
- 和普通 Conversation 共享相同的查询 API

#### 5.5 ToolEvent、ThinkingBlock、TokenUsageEvent — 新增 `roundIndex`

这些事件实体目前通过 `messageId` 间接关联到 Round。为了查询效率和一致性，统一新增 `roundIndex`：

```typescript
// 所有事件实体新增
@Column({ type: 'integer', nullable: true })
roundIndex!: number | null;
```

这样可以直接按 Round 聚合查询，无需 JOIN Message：

```sql
-- 获取 Round 3 的所有工具调用
SELECT * FROM tool_events WHERE sessionId = ? AND roundIndex = 3;

-- 获取 Round 3 的 token 用量
SELECT SUM(inputTokens), SUM(outputTokens) FROM token_usage_events
WHERE sessionId = ? AND roundIndex = 3;
```

### 6. 完整资源层级总结

```
Tenant
├── Conversation (= Session)
│   ├── ConversationContext (1:1, 配置快照)
│   ├── ProcessLifecycleEvents[] (进程事件)
│   ├── ApiErrorEvents[] (API 错误)
│   ├── UserContextEvents[] (页面上下文)
│   ├── MessageQueue[] (待处理队列)
│   │
│   ├── Round 0
│   │   ├── Message (user, roundIndex=0)
│   │   ├── Message (assistant, roundIndex=0)
│   │   ├── ToolEvents[] (roundIndex=0)
│   │   ├── ThinkingBlocks[] (roundIndex=0)
│   │   ├── TokenUsageEvents[] (roundIndex=0)
│   │   ├── AgentFiles[] (roundIndex=0, 该 Round 创建/修改)
│   │   ├── OutputUpdates[] (roundIndex=0, 持久化)
│   │   └── Jobs[] (roundIndex=0, 该 Round 触发)
│   │
│   ├── Round 1 ... N
│   │   └── (同上)
│   │
│   └── AgentFiles (roundIndex=null, Conversation 级别)
│
├── ScheduledTask (定时任务定义)
│   └── ScheduledTaskExecution
│       └── → Conversation (headless)
│
├── Skills[]
├── McpServers[]
└── ApiKeys[]

内容存储（全局共享）:
├── LargeContent (content-addressed, SHA-256)
└── SystemPromptVersion (prompt deduplication)
```

### 7. 变更清单

| 实体 | 变更 | 说明 |
|------|------|------|
| `Message` | 新增 `roundIndex: integer` | Round 索引，0-based |
| `AgentFile` | 新增 `roundIndex: integer?` | 创建/修改时的 Round（null = Conversation 级别） |
| `ToolEvent` | 新增 `roundIndex: integer?` | 所属 Round |
| `ThinkingBlock` | 新增 `roundIndex: integer?` | 所属 Round |
| `TokenUsageEvent` | 新增 `roundIndex: integer?` | 所属 Round |
| `JobEntity` | 新增 `roundIndex: integer?` | 触发时的 Round |
| `OutputUpdate` | **新建实体** | 持久化 output_update 事件 |

**不变更的实体**:
- `ConversationContext` — 已经 1:1 绑定 Session
- `ProcessLifecycleEvent` — Conversation 级别，无需 Round
- `ApiErrorEvent` — Conversation 级别（可选加 roundIndex）
- `UserContextEvent` — Conversation 级别
- `MessageQueue` — 队列机制，无需 Round
- `ScheduledTask / ScheduledTaskExecution` — 独立于 Conversation

---

## 考虑的方案 (Alternatives Considered)

### 方案 A: Round 作为独立实体

**描述**: 创建 `Round` 表，包含 `id`, `sessionId`, `roundIndex`, `startedAt`, `completedAt`，所有子资源通过 `roundId` FK 关联。

**优点**:
- ✅ 明确的外键约束
- ✅ Round 级别的元数据可以直接存储

**缺点**:
- ❌ 新增一张表，增加 JOIN 复杂度
- ❌ 需要在创建 user message 时就创建 Round 行
- ❌ 现有数据迁移更复杂（需要填充 Round 表）

**为什么不选择**: 过度建模。Round 本质上就是 `roundIndex` 这一个维度，不需要独立的主键和生命周期管理。

### 方案 B: 通过 `roundIndex` 字段实现虚拟 Round ⭐ **选择的方案**

**描述**: 在所有相关实体上新增 `roundIndex` 整数字段，Round 是通过查询聚合出的虚拟概念。

**优点**:
- ✅ 最小化 schema 变更（只加字段，不加表）
- ✅ 查询简单：`WHERE sessionId = ? AND roundIndex = ?`
- ✅ 现有数据迁移简单：`roundIndex = FLOOR(messageIndex / 2)`
- ✅ 无 JOIN 开销

**缺点**:
- ❌ roundIndex 没有外键约束，理论上可能不一致
- ❌ Round 级别的元数据需要从子资源聚合计算

**为什么选择**: 实用主义。roundIndex 足够简单，且覆盖所有查询场景。聚合计算的开销可以通过缓存或预聚合字段缓解。

### 方案 C: 只用 messageId 间接关联

**描述**: 不新增 roundIndex，所有资源通过 messageId 关联，需要时 JOIN Message 表获取 Round 信息。

**优点**:
- ✅ 零 schema 变更

**缺点**:
- ❌ 按 Round 查询需要 JOIN Message，查询复杂
- ❌ 无法直接按 Round 聚合 token 用量和文件
- ❌ OutputUpdate 没有 messageId，无法关联

**为什么不选择**: 查询效率和开发体验差。核心 use case（按 Round 聚合）会变得非常不方便。

---

## 结果 (Consequences)

### 正面影响
- ✅ 所有 28 个实体有了清晰的层级归属
- ✅ 前端可以按 Round 聚合展示：文件、工具调用、token、输出更新、后台任务
- ✅ Token 计费有了自然的 Round 级别单位
- ✅ OutputUpdate 持久化后，历史回放成为可能
- ✅ 后台任务有了明确的触发来源（哪个 Round）

### 负面影响
- ❌ 需要为 7 个实体新增 `roundIndex` 字段
- ❌ 需要新增 `OutputUpdate` 实体
- ❌ 写入路径增加（创建 Message 时需要计算并填充 roundIndex）
- ❌ 存量数据迁移需要回填 roundIndex

### 需要注意的事项
- ⚠️ `roundIndex` 的一致性依赖应用层逻辑，不是数据库约束
- ⚠️ OutputUpdate 持久化可能产生大量数据（progressive updates），需要考虑存储策略
- ⚠️ 无头 Conversation（定时任务）的 Round 0 只有 assistant message，前端需要特殊处理
- ⚠️ 文件被多 Round 修改时，`AgentFile.roundIndex` 只记录最近一次，历史依赖 `FileVersion`

---

## 实施指南

**Phase 1: Schema 变更**
1. Message 实体新增 `roundIndex` 字段（default 0）
2. ToolEvent、ThinkingBlock、TokenUsageEvent 新增 `roundIndex`
3. AgentFile 新增 `roundIndex`（nullable）
4. JobEntity 新增 `roundIndex`（nullable）
5. 新增 OutputUpdate 实体
6. 为所有 `roundIndex` 字段添加复合索引 `[sessionId, roundIndex]`

**Phase 2: 应用逻辑**
1. 消息创建时自动计算 roundIndex
2. ToolEvent/ThinkingBlock/TokenUsageEvent 创建时继承当前 Round 的 roundIndex
3. AgentFile 创建/修改时设置 roundIndex
4. OutputUpdate 写入时持久化并设置 roundIndex
5. JobEntity 创建时设置 roundIndex

**Phase 3: API**
1. 新增 Round 聚合查询 API：`GET /conversations/:id/rounds`
2. 新增 Round 详情 API：`GET /conversations/:id/rounds/:index`
3. 现有 Message API 增加 roundIndex 字段返回

**Phase 4: 数据迁移**
1. 存量 Message 回填 roundIndex：`roundIndex = FLOOR(messageIndex / 2)`
2. 存量 ToolEvent/ThinkingBlock/TokenUsageEvent 通过 messageId JOIN 回填
3. 存量 AgentFile 通过 messageId JOIN 回填

**检查清单**:
- [ ] 所有实体的 roundIndex 字段已添加
- [ ] OutputUpdate 实体已创建
- [ ] 复合索引 [sessionId, roundIndex] 已添加
- [ ] 消息创建逻辑自动填充 roundIndex
- [ ] 关联资源创建时继承 roundIndex
- [ ] 存量数据迁移脚本已编写
- [ ] Round 聚合 API 已实现
- [ ] 前端按 Round 展示已适配

---

## 参考资料

- ADR-0004: Single Entry Point for Messages
- 现有实体关系图（本 ADR 背景部分）

---

## 更新记录

- **2026-02-15**: 初始版本 — 定义三层消息层级 + 资源归属 + OutputUpdate 持久化
