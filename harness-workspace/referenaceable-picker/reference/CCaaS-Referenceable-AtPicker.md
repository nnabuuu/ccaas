# CCaaS Core: Referenceable Entity 与 @ Picker 规范

> 适用于：CCaaS 平台核心层
> 不依赖任何具体 solution（教育、航空等）的业务概念
> Solution 层通过注册机制接入

---

## 1. 设计目标

让 Agent 能够以统一的方式访问任何业务实体的上下文信息，而不需要为每种实体硬编码访问逻辑。

三个核心诉求：

1. **用户侧**：在对话中通过 @ 引用任何实体，Agent 自动获取上下文
2. **Agent 侧**：用一个标准 API 获取任意实体的完整信息，自行决定查看深度
3. **Solution 侧**：只需注册实体类型和 context provider，不需要改 CCaaS core

---

## 2. 核心概念

### 2.1 Referenceable Entity

任何可以被 @ 引用的东西都是 Referenceable Entity。它不是一个具体的数据表，而是一个**接口约定**——只要某个业务对象实现了这个接口，就能被 @ picker 发现、被 Agent 访问。

### 2.2 两层数据结构

**轻量引用（AtReference）**——总是在 context window 中，成本低。

```typescript
interface AtReference {
  type: string;           // 实体类型标识符，如 'lesson_plan', 'skill_run'
  id: string;             // 实体 ID
  display_name: string;   // @ pill 显示文本，人类可读
  summary: string;        // ≤100 字摘要，由 solution 层定义
                          // Agent 看到 summary 就能判断要不要深入查看
}
```

**完整上下文（EntityContext）**——Agent 按需获取，通过 API 调用。

```typescript
interface EntityContext {
  ref: AtReference;

  // 结构化字段，每个 type 的 schema 不同
  // Agent 用这些字段理解实体的完整信息
  structured: Record<string, any>;

  // 关联实体列表（仅 AtReference 级别）
  // Agent 可以决定是否递归获取某个关联实体的 EntityContext
  relations: AtReference[];

  // 附件/文件列表
  // Agent 可以决定是否通过 filesystem MCP 读取某个文件
  attachments: EntityAttachment[];
}

interface EntityAttachment {
  name: string;           // 文件名
  path: string;           // filesystem 路径
  mime_type: string;
  size_bytes: number;
}
```

### 2.3 设计原则：Agent 自主决定深度

```
消息中的 AtReference（summary ≤100 字）
  ↓ Agent 判断：summary 够回答吗？
  ├── 够 → 直接用 summary 回答，不调 API
  └── 不够 → 调用 GET /context/entity/{type}/{id}
              ↓ 拿到 structured + relations + attachments
              ↓ Agent 判断：需要看关联实体吗？
              ├── 不需要 → 用 structured 回答
              └── 需要 → 递归获取某个 relation 的 EntityContext
```

这控制了 context window 的消耗——简单问题不浪费 token 在完整上下文上。

---

## 3. Entity Registry（实体注册表）

CCaaS core 维护一个 Entity Registry，记录所有已注册的 Referenceable 类型。

### 3.1 注册数据结构

```typescript
interface EntityTypeRegistration {
  type: string;                         // 唯一标识符，如 'lesson_plan'
  display_label: string;                // 人类可读名称，如 '教案'
  icon: string;                         // 图标标识（用于 @ picker UI）
  color: string;                        // 颜色标识（用于 @ pill 色彩分类）

  // context provider 的 endpoint
  // CCaaS core 收到 GET /context/entity/{type}/{id} 时
  // 转发到这个 endpoint 获取 EntityContext
  context_endpoint: string;             // 如 'http://edu-service/context/lesson_plan'

  // search provider 的 endpoint（@ picker 搜索用）
  search_endpoint: string;              // 如 'http://edu-service/search/lesson_plan'

  // 可选：这个 type 是否支持 apply_to_entity
  supports_apply: boolean;
  apply_endpoint?: string;              // 如 'http://edu-service/apply/lesson_plan'
}
```

### 3.2 API

```
# 注册/更新 entity type（solution 层启动时调用）
POST   /registry/entity-types
       body: EntityTypeRegistration

# 查询所有已注册的 type
GET    /registry/entity-types
       → EntityTypeRegistration[]

# 删除注册
DELETE /registry/entity-types/{type}
```

### 3.3 Solution 层注册示例

教育 solution 启动时注册：

```typescript
const registrations = [
  {
    type: 'lesson_plan',
    display_label: '教案',
    icon: 'file-text',
    color: 'purple',
    context_endpoint: 'http://edu-service/context/lesson_plan',
    search_endpoint: 'http://edu-service/search/lesson_plan',
    supports_apply: true,
    apply_endpoint: 'http://edu-service/apply/lesson_plan',
  },
  {
    type: 'skill_run',
    display_label: 'Skill 产出',
    icon: 'cpu',
    color: 'purple',
    context_endpoint: 'http://edu-service/context/skill_run',
    search_endpoint: 'http://edu-service/search/skill_run',
    supports_apply: false,
  },
  {
    type: 'requirement',
    display_label: '课标',
    icon: 'check-square',
    color: 'teal',
    context_endpoint: 'http://edu-service/context/requirement',
    search_endpoint: 'http://edu-service/search/requirement',
    supports_apply: false,
  },
  // ... 更多 type
];

registrations.forEach(r => fetch('/registry/entity-types', {
  method: 'POST', body: JSON.stringify(r)
}));
```

---

## 4. @ Picker

### 4.1 用户交互流程

```
用户在输入框打 "@"
  → 弹出 picker 面板
  → 显示两部分：
      [最近引用] 基于 Activity Tracker 的最近实体（跨 type）
      [按类型搜索] 用户继续输入关键词 → 搜索匹配的实体
  → 用户选择一个实体
  → 输入框中插入 @ pill（显示 display_name，携带 AtReference）
  → 用户继续输入消息文本
  → 发送
```

### 4.2 Picker 搜索 API

CCaaS core 提供统一的搜索入口，内部扇出到各 type 的 search_endpoint：

```
GET /context/search?q={keyword}&types={type1,type2}&limit=10
  → 对每个 type 调用注册的 search_endpoint
  → 合并结果，按相关性排序
  → 返回 AtReference[]
```

每个 solution 层的 search_endpoint 需要实现：

```
GET {search_endpoint}?q={keyword}&user_id={uid}&limit=5
  → AtReference[]
```

### 4.3 最近引用

基于 Activity Tracker 的数据，按最近使用时间排序：

```
GET /context/recent?user_id={uid}&limit=10
  → AtReference[]  (从 activity 记录中提取，跨 type)
```

### 4.4 @ pill 在消息中的表达

消息体中 @ 引用以结构化方式嵌入，不是纯文本：

```typescript
interface MessageContent {
  // 消息的文本内容，@ 引用位置用占位符标记
  text: string;           // "请帮我分析 {ref:0} 的错因"

  // 引用的实体列表
  references: AtReference[];  // [{ type: 'skill_run', id: 'sr_123', ... }]
}
```

Agent 收到消息时，`references` 数组中的每个 AtReference 的 `summary` 已经可用。Agent 根据 summary 判断是否需要调用 EntityContext API 获取更多信息。

---

## 5. EntityContext API

CCaaS core 的统一入口，转发到 solution 层的 context_endpoint：

```
GET /context/entity/{type}/{id}
  → CCaaS core 查 registry 找到 context_endpoint
  → 转发到 {context_endpoint}/{id}
  → solution 层返回 EntityContext
  → CCaaS core 透传给调用方
```

### 5.1 Solution 层实现 context_endpoint

每个 solution 层为自己的 type 实现 context provider：

```typescript
// 示例：教育 solution 的 lesson_plan context provider
// GET /context/lesson_plan/{id}

function getLessonPlanContext(id: string): EntityContext {
  const lp = db.getLessonPlan(id);
  return {
    ref: {
      type: 'lesson_plan',
      id: lp.id,
      display_name: `教案:${lp.title}`,
      summary: `${lp.class_name} ${lp.subject} ${lp.lesson_type} ${lp.duration}分钟` +
               (lp.requirement_snapshot
                 ? ` 学业要求${lp.requirement_snapshot.code}`
                 : ' 未关联学业要求'),
    },
    structured: {
      title: lp.title,
      class_id: lp.class_id,
      subject: lp.subject,
      lesson_type: lp.lesson_type,
      duration_minutes: lp.duration,
      requirement_snapshot: lp.requirement_snapshot,
      blocks: lp.blocks,          // 完整内容块
      status: lp.status,
      source: lp.source,
    },
    relations: [
      // 关联的学业要求
      lp.requirement_id ? {
        type: 'requirement',
        id: lp.requirement_id,
        display_name: `课标:${lp.requirement_snapshot.code}`,
        summary: lp.requirement_snapshot.text,
      } : null,
      // 关联的练习
      ...lp.exercise_ids.map(eid => ({
        type: 'exercise',
        id: eid,
        display_name: `练习:${db.getExercise(eid).title}`,
        summary: `${db.getExercise(eid).question_count}道题`,
      })),
      // 关联的 skill_run 产出
      ...db.getSkillRunsForEntity('lesson_plan', lp.id).map(sr => ({
        type: 'skill_run',
        id: sr.id,
        display_name: `${sr.skill_name}:${lp.title}`,
        summary: sr.output_summary,
      })),
    ].filter(Boolean),
    attachments: db.getAttachments(lp.attachment_folder),
  };
}
```

### 5.2 Agent 使用模式

Agent 在 session 中拥有一个 MCP tool：`get_entity_context`

```typescript
// Agent 的 tool 定义
{
  name: 'get_entity_context',
  description: '获取一个实体的完整上下文信息。传入 type 和 id。',
  input_schema: {
    type: { type: 'string' },
    id: { type: 'string' },
  }
}
```

Agent 的决策流程：

```
1. 收到消息，看到 references[0].summary = "SSS 错误率 42%，夹角混淆 43%"
2. 判断：用户问"为什么夹角混淆这么高"，summary 里只有结论没有分析过程
3. 调用 get_entity_context({ type: 'skill_run', id: 'sr_123' })
4. 拿到 structured.reasoning_chain → 看到详细的错因分析
5. 看到 relations 里有 { type: 'homework', id: 'hw_456' }
6. 判断：需要看具体题目才能给建议
7. 调用 get_entity_context({ type: 'homework', id: 'hw_456' })
8. 拿到具体题目信息 → 给出针对性建议
```

---

## 6. Apply Action（回写机制）

当 Agent 在对话中产出了"可以落地到某个实体的具体修改建议"时，渲染一个 apply button 让用户确认。

### 6.1 数据结构

```typescript
interface ApplyAction {
  id: string;                           // action 唯一 ID
  target: AtReference;                  // 要修改的目标实体
  field_path: string;                   // 要修改的字段路径，如 'blocks[3].content'
  suggested_value: any;                 // 建议的新值
  description: string;                  // 人类可读描述
  status: 'pending' | 'applied' | 'outdated';
  applied_at?: string;
}
```

### 6.2 Agent 渲染 apply action

Agent 在消息中返回 apply action 作为一个特殊的 content block：

```typescript
// Agent 的响应消息
{
  content: [
    { type: 'text', text: '建议将 SSS 讲解从 10 分钟改为 8 分钟...' },
    {
      type: 'apply_action',
      apply_action: {
        id: 'aa_001',
        target: { type: 'lesson_plan', id: 'lp_123', display_name: '...', summary: '...' },
        field_path: 'blocks[3].content',
        suggested_value: { /* 新的 timeline block content */ },
        description: '时间线: SSS 10min→8min, 新增 SSA 反例 2min',
        status: 'pending',
      }
    }
  ]
}
```

### 6.3 用户确认流程

```
UI 渲染 [应用到教案] 按钮
  ↓ 用户点击
  ↓ 前端调用 POST /context/apply
      body: { action_id, target_type, target_id, field_path, suggested_value }
  ↓ CCaaS core 查 registry 找到 apply_endpoint
  ↓ 转发到 solution 层的 apply_endpoint
  ↓ solution 层执行实际写入（如更新教案的 blocks）
  ↓ 返回成功 → 按钮变为 ✓ 已应用
  ↓ Activity 事件记录变更
```

### 6.4 状态流转

```
pending → 用户点击 → applied
                        ↓
          对话中又产出了新方案 → outdated → 用户再点击 → applied
```

`outdated` 的判定：同一个 target + field_path 出现了更新的 apply_action。

### 6.5 Solution 层实现 apply_endpoint

```typescript
// POST {apply_endpoint}
// body: { id, field_path, suggested_value }

function applyToLessonPlan(body) {
  const lp = db.getLessonPlan(body.id);

  // 按 field_path 写入 suggested_value
  setNestedValue(lp, body.field_path, body.suggested_value);

  db.saveLessonPlan(lp);

  // 发出 Activity 事件
  activityTracker.emit({
    entity_type: 'lesson_plan',
    entity_id: lp.id,
    action: 'ai_applied',
    detail: body.description,
  });

  return { success: true };
}
```

### 6.6 安全约束

- Apply action **必须经过用户确认**，Agent 不能自动写入
- CCaaS core 在转发前检查：target type 是否 `supports_apply: true`
- 每次 apply 记录审计日志（who, when, what, from which session）
- Solution 层可以在 apply_endpoint 中实现业务校验（如"教案已归档不可修改"）

---

## 7. CCaaS Core 需要做的事

### 7.1 新增模块

| 模块 | 职责 |
|------|------|
| Entity Registry | 存储 type 注册信息，提供 CRUD API |
| Context Router | 接收 `/context/entity/{type}/{id}` 请求，路由到 solution 的 context_endpoint |
| Search Aggregator | 接收 `/context/search` 请求，扇出到各 type 的 search_endpoint，合并排序 |
| Apply Router | 接收 `/context/apply` 请求，路由到 solution 的 apply_endpoint |

### 7.2 消息格式扩展

消息的 `content` 数组支持新的 block type：

| type | 说明 |
|------|------|
| `text` | 已有，纯文本 |
| `tool_use` | 已有，工具调用 |
| `apply_action` | **新增**，渲染 apply button |

消息的 `metadata` 扩展：

```typescript
interface MessageMetadata {
  references?: AtReference[];   // 消息中包含的 @ 引用列表
}
```

### 7.3 Agent 工具扩展

为所有 session 自动注入一个 MCP tool：

```typescript
{
  name: 'get_entity_context',
  description: '获取一个被 @ 引用的实体的完整上下文。' +
               '先检查消息中的 reference summary 是否够用，' +
               '不够时再调用此工具获取完整信息。',
  input_schema: {
    properties: {
      type: { type: 'string', description: '实体类型' },
      id: { type: 'string', description: '实体 ID' },
    },
    required: ['type', 'id'],
  }
}
```

### 7.4 对 Activity Tracker 的依赖

@ picker 的"最近引用"功能依赖 Activity Tracker：

- 每当用户在消息中使用 @ 引用，记录一条 `referenced` activity
- @ picker 的最近列表从 activity 中按时间倒序提取
- 这复用了已有的 Activity Tracker 基础设施，不需要新建数据表

---

## 8. 前端 @ Picker 组件规范

### 8.1 触发

输入框中键入 `@` 字符时弹出 picker 面板。

### 8.2 面板结构

```
┌──────────────────────────┐
│ 搜索: [输入关键词...]      │
├──────────────────────────┤
│ 最近引用                  │
│  [教案] SSS/SAS 新授课    │
│  [课标] 7.3.2 全等判定    │
│  [Skill] 学情异常检测     │
├──────────────────────────┤
│ 全部类型                  │
│  教案 (12)  课标 (45)     │
│  练习 (6)   Skill (3)    │
└──────────────────────────┘
```

- 顶部搜索框：实时搜索，调用 `/context/search`
- 最近引用：调用 `/context/recent`，显示最近 5 个跨 type
- 全部类型：显示所有已注册的 type，点击展开该 type 下的实体列表

### 8.3 @ Pill 组件

```
┌─────────────────────┐
│ [icon] display_name │ ← 紫色底 + 紫色字
│                  [×]│ ← 可删除
└─────────────────────┘
```

- 颜色：使用 Entity Registry 中注册的 color
- 图标：使用 Entity Registry 中注册的 icon
- 数据：携带完整的 AtReference
- 输入框中可以有多个 @ pill

### 8.4 发送时组装

```typescript
function buildMessage(inputContent: InputContent): MessageContent {
  const references: AtReference[] = [];
  let text = '';
  let refIndex = 0;

  for (const segment of inputContent.segments) {
    if (segment.type === 'text') {
      text += segment.value;
    } else if (segment.type === 'at_pill') {
      text += `{ref:${refIndex}}`;
      references.push(segment.atReference);
      refIndex++;
    }
  }

  return { text, references };
}
```

---

## 9. 服务 Solution 层：Harness 集成

CCaaS core 提供原语，但真正编排 Agent 行为的是 solution 层的 **harness**（由 sessionTemplate 定义）。这一节定义 core 如何向 harness 暴露 Referenceable 能力，让 harness 可以更好地规划流程。

### 9.1 Session 启动时的上下文注入

当一个 session 创建时，CCaaS core 向 harness 的 system prompt 注入以下信息：

```typescript
interface SessionContextInjection {
  // 当前环境中可用的实体类型（从 Entity Registry 获取）
  available_entity_types: {
    type: string;
    display_label: string;
    supports_apply: boolean;
    description: string;          // solution 注册时提供的描述
  }[];

  // 如果 session 绑定了一个主实体（EntityLevelSession 场景）
  // solution 层在创建 session 时传入
  primary_entity?: AtReference;

  // 主实体的完整上下文（自动预取，省掉 harness 的第一次 tool call）
  primary_entity_context?: EntityContext;
}
```

实际注入到 system prompt 的效果：

```
你是一个备课助手。当前工作在以下教案上：

[主实体]
教案: 12.2 三角形全等的判定 — SSS/SAS
八(2)班 数学 新授课 45分钟 学业要求7.3.2

[关联实体]
- 课标:7.3.2 全等判定 → 能运用 SSS、SAS 判定三角形全等
- 练习:SSS/SAS 专项 → 5 道题 含 SSA 辨析 已发布
- Skill产出:学情异常检测 → SSS 错误率 42%，夹角混淆占 43%
- Skill产出:课标对齐检查 → v2.1 新增 SSA 反例建议，练习缺 SSA 辨析题

[可用操作]
- get_entity_context(type, id): 获取任何实体的完整信息
- 可以对以下类型执行 apply_to_entity: 教案, 练习
- 用户消息中的 @引用 会携带 type+id+summary

[可用实体类型]
- lesson_plan (教案): 支持 apply
- requirement (课标): 只读
- exercise (练习): 支持 apply
- skill_run (Skill 产出): 只读
- student_profile (学生画像): 只读
```

**关键点：primary_entity_context 是预取的**——harness 启动时就已经看到了主实体的 structured 数据和 relations 列表（AtReference 级别）。它不需要先调 `get_entity_context` 才能知道这个教案有什么关联。

### 9.2 Entity Graph 发现

Relations 构成了一个实体图谱。Harness 的 system prompt 中已经有了一级 relations（AtReference 级别），但它可以按需展开任何 relation：

```
primary_entity (lesson_plan)
  ├── requirement (7.3.2)        ← AtReference 已在 prompt 中
  │     └── [可展开] interpretation, version_history, related_requirements
  ├── exercise (SSS/SAS 专项)    ← AtReference 已在 prompt 中
  │     └── [可展开] questions[], difficulty_stats, submission_stats
  ├── skill_run (学情异常检测)   ← AtReference 已在 prompt 中
  │     └── [可展开] reasoning_chain, input_params, raw_data_refs
  └── skill_run (课标对齐检查)   ← AtReference 已在 prompt 中
        └── [可展开] diff_result, recommendation_details
```

Harness 看到的是一级的 summary，然后根据用户问题决定往哪个方向深入。这比"把所有关联实体的完整内容一次性塞进 context window"效率高得多。

### 9.3 Harness 的流程规划模式

Harness 可以利用 Entity Graph 做多步骤规划。几种常见模式：

**模式 A：深度探查**

用户问"为什么夹角混淆占比这么高"→ harness 规划：

```
1. 已有 skill_run summary："夹角混淆 43%"（不够）
2. → get_entity_context('skill_run', 'sr_123')
   拿到 reasoning_chain + raw_data_refs
3. reasoning_chain 提到"作业 hw_456 的第 3 题错误率最高"
4. → get_entity_context('exercise', 'ex_789')
   拿到第 3 题的具体题目和学生答卷分析
5. 综合回答 + 建议修改教案
```

**模式 B：交叉验证**

用户问"帮我检查教案是否对齐课标"→ harness 规划：

```
1. 已有 primary_entity_context.structured.blocks（教案内容）
2. 已有 relation: requirement summary（课标条目文本）
3. → get_entity_context('requirement', 'req_732')
   拿到 interpretation（区级解读完整版）+ version_history
4. 逐 block 对比教案内容 vs 课标要求
5. 输出对齐报告 + apply_action 建议修改
```

**模式 C：联动修改**

用户说"帮我把第 3 题改成 SSA 辨析题"→ harness 规划：

```
1. 已有 primary_entity_context.structured.blocks（含练习表格）
2. → get_entity_context('requirement', 'req_732')
   确认 SSA 反例是课标 v2.1 的要求
3. 生成新题目
4. → apply_action 到 lesson_plan 的 blocks[练习表格]
5. 如果练习同时关联了独立的 exercise 实体
   → 额外生成一个 apply_action 到 exercise
```

### 9.4 Skill Run 产出如何成为 Referenceable

Skill run 的产出要能被 @ 引用和被 harness 访问，需要 solution 层做两件事：

**1. 注册 skill_run 为 Referenceable type**（启动时，见 §3）

**2. Skill 执行完成后，将产出结构化存储**

```typescript
// Skill 执行器完成后，将结果写入 solution 的存储
interface SkillRunRecord {
  id: string;
  skill_name: string;
  skill_version: string;

  // 绑定到哪个实体（用于 relation 发现）
  bound_entity_type: string;          // 'lesson_plan'
  bound_entity_id: string;            // 'lp_123'

  // Skill 的输入参数（Agent 可以看到"这个分析基于什么"）
  input_params: Record<string, any>;

  // Skill 的输出（结构化，不是纯文本）
  output: {
    summary: string;                  // ≤100 字，作为 AtReference.summary
    conclusion: string;               // 结论性文本
    data_points: any[];               // 数据支撑
    reasoning_chain: string[];        // 推理步骤
    suggestions: string[];            // 建议列表
  };

  // 时效性
  input_data_hash: string;            // 输入数据的 hash，用于判断是否过期
  run_at: string;
  freshness: 'fresh' | 'stale';
}
```

当 harness 通过 `get_entity_context('skill_run', 'sr_123')` 获取时，solution 层的 context_endpoint 将 SkillRunRecord 映射为 EntityContext：

```typescript
function getSkillRunContext(id: string): EntityContext {
  const sr = db.getSkillRun(id);
  return {
    ref: {
      type: 'skill_run',
      id: sr.id,
      display_name: `${sr.skill_name}:${sr.bound_entity_id}`,
      summary: sr.output.summary,
    },
    structured: {
      skill_name: sr.skill_name,
      run_at: sr.run_at,
      freshness: sr.freshness,
      input_params: sr.input_params,
      conclusion: sr.output.conclusion,
      data_points: sr.output.data_points,
      reasoning_chain: sr.output.reasoning_chain,
      suggestions: sr.output.suggestions,
    },
    relations: [
      // 关联回绑定的实体
      { type: sr.bound_entity_type, id: sr.bound_entity_id, ... },
      // 关联到 input_params 中引用的其他实体
      ...extractRefsFromParams(sr.input_params),
    ],
    attachments: [],
  };
}
```

这样 harness 看到一个 skill_run 的 summary 后，可以按需查看 `reasoning_chain`（为什么得出这个结论）、`data_points`（基于什么数据）、`suggestions`（有什么建议）。

### 9.5 Harness 的 Tool 清单

Session 创建时，CCaaS core 自动为 harness 注入以下 tools：

```typescript
// 1. 实体上下文获取（Phase 1）
{
  name: 'get_entity_context',
  description: '获取一个实体的完整上下文。先检查 summary 是否够用，不够时再调用。',
  input_schema: {
    properties: {
      type: { type: 'string', description: '实体类型' },
      id: { type: 'string', description: '实体 ID' },
    },
    required: ['type', 'id'],
  }
}

// 2. 实体搜索（Phase 2，@ picker 的 Agent 侧等价物）
{
  name: 'search_entities',
  description: '搜索实体。当用户提到一个你不知道 ID 的实体时使用。',
  input_schema: {
    properties: {
      query: { type: 'string' },
      types: { type: 'array', items: { type: 'string' }, description: '可选，限制搜索的类型' },
    },
    required: ['query'],
  }
}

// 3. 回写建议（Phase 3）
// 不是一个 tool call，而是 Agent 在 response 中输出 apply_action block
// CCaaS core 的消息渲染器识别 apply_action block 并渲染按钮
```

### 9.6 SessionTemplate 中的 Referenceable 配置

SessionTemplate（harness 的定义文件）可以声明这个 harness 关心哪些实体类型：

```typescript
interface SessionTemplateReferenceable {
  // 这个 session 的主实体类型（如果是 EntityLevelSession）
  primary_entity_type?: string;

  // 这个 harness 关心的实体类型列表
  // 只有这些 type 会出现在 system prompt 的 [可用实体类型] 中
  // 也只有这些 type 的 relation 会在 primary_entity_context 中展开
  relevant_entity_types: string[];

  // 是否自动预取 primary_entity_context
  auto_prefetch_context: boolean;

  // 自动预取的深度
  // 0 = 只有 primary entity 的 AtReference
  // 1 = primary entity 的 EntityContext + 一级 relations 的 AtReference（默认）
  // 2 = 一级 relations 的 EntityContext 也预取（慎用，token 消耗大）
  prefetch_depth: 0 | 1 | 2;
}
```

示例：备课助手的 sessionTemplate 配置：

```typescript
{
  template_id: 'lesson_plan_assistant',
  name: '备课助手',
  referenceable: {
    primary_entity_type: 'lesson_plan',
    relevant_entity_types: [
      'lesson_plan', 'requirement', 'exercise',
      'skill_run', 'student_profile', 'template'
    ],
    auto_prefetch_context: true,
    prefetch_depth: 1,
  },
  skills: ['学情异常检测', '课标对齐检查', '练习生成', ...],
}
```

### 9.7 完整的 Harness 启动序列

```
1. Solution 层创建 session
   POST /sessions { template_id: 'lesson_plan_assistant', primary_entity: { type: 'lesson_plan', id: 'lp_123' } }

2. CCaaS core 读取 sessionTemplate 配置
   → relevant_entity_types = [lesson_plan, requirement, exercise, ...]
   → auto_prefetch_context = true, prefetch_depth = 1

3. Core 预取 primary entity context
   → 调用 GET /context/entity/lesson_plan/lp_123
   → 拿到 EntityContext（structured + relations + attachments）

4. Core 组装 system prompt injection
   → available_entity_types（从 registry 中筛选 relevant_entity_types）
   → primary_entity（AtReference）
   → primary_entity_context（structured + relations 的 AtReference 列表）
   → 注入 tools（get_entity_context, search_entities）

5. Core 将 system prompt injection 注入 harness 的 system prompt
   → harness 启动时就已经知道：
      - 我在服务哪个教案
      - 这个教案关联了哪些实体（summary 级别）
      - 我可以用什么工具获取更多信息
      - 我可以对哪些实体执行 apply

6. Harness 准备就绪，等待用户消息
```

---

## 10. 与 EntityLevelSession 的关系

EntityLevelSession 是 **solution 层的概念**——某个业务实体绑定了一个长期存在的 session。CCaaS core 不知道也不需要知道这个绑定关系。

但 @ picker + Referenceable 为 EntityLevelSession 提供了基础能力：

- 用户在 EntityLevelSession 中 @ 引用其他实体 → 标准的 AtReference 流程
- Skill 产出的"追问"按钮 → 实质上是在 EntityLevelSession 的输入框中预注入一个 @ pill
- Apply action → 写回到绑定的实体 → 标准的 apply 流程

CCaaS core 只需要提供这三个原语（@ 引用解析、context 获取、apply 回写），solution 层在上面组合出 EntityLevelSession 的完整体验。

---

## 11. Solution 实现指南（Claude Code Handoff）

> 本节面向 solution 层开发者（或辅助实现的 Claude Code）。
> 描述为接入 Referenceable 体系，solution 需要交付的模块、文件、接口。

### 11.1 Solution 需要交付的模块总览

```
solution/
├── referenceable/
│   ├── registry.ts           # 启动时注册所有 entity types
│   ├── types.ts              # 本 solution 的 AtReference / EntityContext 类型
│   ├── providers/
│   │   ├── lesson-plan.ts    # lesson_plan 的 context + search + apply provider
│   │   ├── requirement.ts    # requirement 的 context + search provider
│   │   ├── exercise.ts       # exercise 的 context + search + apply provider
│   │   ├── skill-run.ts      # skill_run 的 context + search provider
│   │   └── template.ts       # template 的 context + search provider
│   └── routes.ts             # Express/Fastify 路由，暴露 context/search/apply endpoints
├── session/
│   ├── entity-session.ts     # EntityLevelSession 绑定逻辑
│   └── templates/
│       └── lesson-plan-assistant.yaml  # sessionTemplate 定义
└── skills/
    └── ...                   # 各 Skill 的输出需要遵循 SkillRunRecord 格式
```

### 11.2 每个 Provider 必须实现的接口

每个 entity type 的 provider 需要实现最多三个 handler：

```typescript
// ── 必须实现 ──

/**
 * Context Provider: 返回实体的完整上下文
 * CCaaS core 路由: GET /context/entity/{type}/{id}
 * → 转发到 solution: GET {context_endpoint}/{id}
 */
type ContextHandler = (id: string, userId: string) => Promise<EntityContext>;

/**
 * Search Provider: 根据关键词搜索该 type 下的实体
 * CCaaS core 路由: GET /context/search?q=&types=
 * → 转发到 solution: GET {search_endpoint}?q=&user_id=&limit=
 */
type SearchHandler = (query: string, userId: string, limit: number) => Promise<AtReference[]>;

// ── 可选实现（仅 supports_apply: true 的 type）──

/**
 * Apply Provider: 将 AI 建议的修改写入实体
 * CCaaS core 路由: POST /context/apply
 * → 转发到 solution: POST {apply_endpoint}
 */
interface ApplyRequest {
  entity_id: string;
  field_path: string;          // 如 'blocks[3].content'
  suggested_value: any;
  action_description: string;  // 人类可读描述
  session_id: string;          // 来源 session（审计用）
}
type ApplyHandler = (req: ApplyRequest, userId: string) => Promise<{ success: boolean; error?: string }>;
```

### 11.3 Provider 实现示例：lesson_plan

```typescript
// solution/referenceable/providers/lesson-plan.ts

import { AtReference, EntityContext } from '../types';
import { db } from '../../db';

export const lessonPlanProvider = {

  async context(id: string, userId: string): Promise<EntityContext> {
    const lp = await db.lessonPlan.findById(id);
    if (!lp) throw new NotFoundError('lesson_plan', id);

    const skillRuns = await db.skillRun.findByEntity('lesson_plan', id);
    const exercises = await db.exercise.findByIds(lp.exercise_ids);

    return {
      ref: {
        type: 'lesson_plan',
        id: lp.id,
        display_name: `教案:${lp.title}`,
        summary: buildSummary(lp),      // ≤100 字
      },
      structured: {
        title: lp.title,
        class_id: lp.class_id,
        class_name: lp.class_name,
        subject: lp.subject,
        lesson_type: lp.lesson_type,
        duration_minutes: lp.duration_minutes,
        status: lp.status,
        requirement_snapshot: lp.requirement_snapshot,
        blocks: lp.blocks,               // 完整内容块
        source: lp.source,
        source_template_id: lp.source_template_id,
      },
      relations: [
        lp.requirement_id ? {
          type: 'requirement',
          id: lp.requirement_id,
          display_name: `课标:${lp.requirement_snapshot.code}`,
          summary: lp.requirement_snapshot.text.slice(0, 100),
        } : null,
        ...exercises.map(ex => ({
          type: 'exercise',
          id: ex.id,
          display_name: `练习:${ex.title}`,
          summary: `${ex.questions.length}道题 ${ex.status}`,
        })),
        ...skillRuns.map(sr => ({
          type: 'skill_run',
          id: sr.id,
          display_name: `${sr.skill_name}`,
          summary: sr.output.summary,
        })),
      ].filter(Boolean),
      attachments: await db.attachment.listByFolder(lp.attachment_folder),
    };
  },

  async search(query: string, userId: string, limit: number): Promise<AtReference[]> {
    const results = await db.lessonPlan.search({
      query,
      teacher_id: userId,
      limit,
    });
    return results.map(lp => ({
      type: 'lesson_plan',
      id: lp.id,
      display_name: `教案:${lp.title}`,
      summary: buildSummary(lp),
    }));
  },

  async apply(req: ApplyRequest, userId: string) {
    const lp = await db.lessonPlan.findById(req.entity_id);
    if (!lp) throw new NotFoundError('lesson_plan', req.entity_id);
    if (lp.status === 'archived') {
      return { success: false, error: '已归档的教案不可修改' };
    }

    // 按 field_path 写入
    setNestedValue(lp, req.field_path, req.suggested_value);
    await db.lessonPlan.save(lp);

    // Activity 事件
    await activity.emit({
      entity_type: 'lesson_plan',
      entity_id: lp.id,
      action: 'ai_applied',
      detail: req.action_description,
      session_id: req.session_id,
      user_id: userId,
    });

    return { success: true };
  },
};

function buildSummary(lp: LessonPlan): string {
  const parts = [lp.class_name, lp.subject, lp.lesson_type, `${lp.duration_minutes}分钟`];
  if (lp.requirement_snapshot) {
    parts.push(`学业要求${lp.requirement_snapshot.code}`);
  }
  return parts.join(' ');  // "八(2)班 数学 新授课 45分钟 学业要求7.3.2"
}
```

### 11.4 Provider 实现示例：skill_run

```typescript
// solution/referenceable/providers/skill-run.ts

export const skillRunProvider = {

  async context(id: string): Promise<EntityContext> {
    const sr = await db.skillRun.findById(id);
    return {
      ref: {
        type: 'skill_run',
        id: sr.id,
        display_name: `${sr.skill_name}`,
        summary: sr.output.summary,
      },
      structured: {
        skill_name: sr.skill_name,
        skill_version: sr.skill_version,
        run_at: sr.run_at,
        freshness: sr.freshness,
        input_params: sr.input_params,
        // ── Agent 关心的结构化输出 ──
        conclusion: sr.output.conclusion,
        data_points: sr.output.data_points,
        reasoning_chain: sr.output.reasoning_chain,
        suggestions: sr.output.suggestions,
      },
      relations: [
        // 绑定的实体
        {
          type: sr.bound_entity_type,
          id: sr.bound_entity_id,
          display_name: `...`,
          summary: `...`,
        },
      ],
      attachments: [],
    };
  },

  async search(query: string, userId: string, limit: number): Promise<AtReference[]> {
    const results = await db.skillRun.search({ query, user_id: userId, limit });
    return results.map(sr => ({
      type: 'skill_run',
      id: sr.id,
      display_name: `${sr.skill_name}`,
      summary: sr.output.summary,
    }));
  },

  // skill_run 不支持 apply（只读）
};
```

### 11.5 路由注册

```typescript
// solution/referenceable/routes.ts

import { Router } from 'express';
import { lessonPlanProvider } from './providers/lesson-plan';
import { requirementProvider } from './providers/requirement';
import { exerciseProvider } from './providers/exercise';
import { skillRunProvider } from './providers/skill-run';
import { templateProvider } from './providers/template';

const providers: Record<string, any> = {
  lesson_plan: lessonPlanProvider,
  requirement: requirementProvider,
  exercise: exerciseProvider,
  skill_run: skillRunProvider,
  template: templateProvider,
};

const router = Router();

// Context endpoint: GET /context/:type/:id
router.get('/context/:type/:id', async (req, res) => {
  const provider = providers[req.params.type];
  if (!provider?.context) return res.status(404).json({ error: 'Unknown type' });
  const ctx = await provider.context(req.params.id, req.user.id);
  res.json(ctx);
});

// Search endpoint: GET /search/:type?q=&limit=
router.get('/search/:type', async (req, res) => {
  const provider = providers[req.params.type];
  if (!provider?.search) return res.status(404).json({ error: 'Unknown type' });
  const results = await provider.search(
    req.query.q as string,
    req.user.id,
    parseInt(req.query.limit as string) || 5,
  );
  res.json(results);
});

// Apply endpoint: POST /apply/:type
router.post('/apply/:type', async (req, res) => {
  const provider = providers[req.params.type];
  if (!provider?.apply) return res.status(400).json({ error: 'Type does not support apply' });
  const result = await provider.apply(req.body, req.user.id);
  res.json(result);
});

export { router as referenceableRouter };
```

### 11.6 启动时注册到 CCaaS Core

```typescript
// solution/referenceable/registry.ts

const CCAAS_CORE_URL = process.env.CCAAS_CORE_URL;
const SOLUTION_BASE_URL = process.env.SOLUTION_BASE_URL;  // 如 http://edu-service

interface Registration {
  type: string;
  display_label: string;
  icon: string;
  color: string;
  description: string;
  context_endpoint: string;
  search_endpoint: string;
  supports_apply: boolean;
  apply_endpoint?: string;
}

const registrations: Registration[] = [
  {
    type: 'lesson_plan',
    display_label: '教案',
    icon: 'file-text',
    color: 'purple',
    description: '教师的教案文档，包含教学目标、教学过程、练习等内容块',
    context_endpoint: `${SOLUTION_BASE_URL}/context/lesson_plan`,
    search_endpoint: `${SOLUTION_BASE_URL}/search/lesson_plan`,
    supports_apply: true,
    apply_endpoint: `${SOLUTION_BASE_URL}/apply/lesson_plan`,
  },
  {
    type: 'requirement',
    display_label: '课标',
    icon: 'check-square',
    color: 'teal',
    description: '课程标准中的学业要求条目，含区级解读',
    context_endpoint: `${SOLUTION_BASE_URL}/context/requirement`,
    search_endpoint: `${SOLUTION_BASE_URL}/search/requirement`,
    supports_apply: false,
  },
  {
    type: 'exercise',
    display_label: '练习',
    icon: 'edit-3',
    color: 'blue',
    description: '教师设计的练习，包含题目列表',
    context_endpoint: `${SOLUTION_BASE_URL}/context/exercise`,
    search_endpoint: `${SOLUTION_BASE_URL}/search/exercise`,
    supports_apply: true,
    apply_endpoint: `${SOLUTION_BASE_URL}/apply/exercise`,
  },
  {
    type: 'skill_run',
    display_label: 'Skill 产出',
    icon: 'cpu',
    color: 'purple',
    description: 'Skill 自动分析的产出结果，含推理链和建议',
    context_endpoint: `${SOLUTION_BASE_URL}/context/skill_run`,
    search_endpoint: `${SOLUTION_BASE_URL}/search/skill_run`,
    supports_apply: false,
  },
  {
    type: 'template',
    display_label: '模板',
    icon: 'layout',
    color: 'gray',
    description: '教案结构模板，含三级作用域',
    context_endpoint: `${SOLUTION_BASE_URL}/context/template`,
    search_endpoint: `${SOLUTION_BASE_URL}/search/template`,
    supports_apply: false,
  },
];

export async function registerEntityTypes() {
  for (const reg of registrations) {
    await fetch(`${CCAAS_CORE_URL}/registry/entity-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reg),
    });
  }
  console.log(`Registered ${registrations.length} entity types with CCaaS core`);
}
```

### 11.7 EntityLevelSession 绑定

```typescript
// solution/session/entity-session.ts

/**
 * 教案创建时自动绑定 EntityLevelSession
 * 在教案 service 的 create 方法末尾调用
 */
export async function bindEntitySession(
  entityType: string,
  entityId: string,
  templateId: string,     // 如 'lesson_plan_assistant'
) {
  // 1. 调用 CCaaS core 创建 session
  const session = await fetch(`${CCAAS_CORE_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: templateId,
      primary_entity: {
        type: entityType,
        id: entityId,
        // display_name 和 summary 由 core 通过 context_endpoint 获取
      },
    }),
  }).then(r => r.json());

  // 2. 存储绑定关系（solution 层自己维护）
  await db.entitySession.create({
    entity_type: entityType,
    entity_id: entityId,
    session_id: session.id,
    template_id: templateId,
  });

  return session;
}

/**
 * 获取实体绑定的 session（教案详情页加载时调用）
 */
export async function getEntitySession(entityType: string, entityId: string) {
  return db.entitySession.findOne({ entity_type: entityType, entity_id: entityId });
}
```

### 11.8 Skill 产出写入规范

所有 Skill 的执行器完成后，必须将产出写入符合 `SkillRunRecord` 格式的记录：

```typescript
// solution/skills/base.ts

interface SkillRunRecord {
  id: string;                          // 自动生成
  skill_name: string;
  skill_version: string;
  bound_entity_type: string;
  bound_entity_id: string;
  input_params: Record<string, any>;   // Skill 读取了什么输入
  output: {
    summary: string;                   // ≤100 字，将作为 AtReference.summary
    conclusion: string;                // 完整结论
    data_points: any[];                // 数据支撑
    reasoning_chain: string[];         // 推理步骤列表
    suggestions: string[];             // 建议列表
  };
  input_data_hash: string;             // 输入数据 hash，用于 freshness 判定
  run_at: string;
  freshness: 'fresh' | 'stale';
}

/**
 * Skill 执行器调用此方法保存产出
 * 保存后，该 skill_run 自动成为 Referenceable entity
 */
export async function saveSkillRun(record: Omit<SkillRunRecord, 'id' | 'run_at' | 'freshness'>) {
  return db.skillRun.create({
    ...record,
    id: generateId('sr'),
    run_at: new Date().toISOString(),
    freshness: 'fresh',
  });
}
```

### 11.9 实现检查清单

Claude Code 实现时逐项验证：

```
□ types.ts 定义了 AtReference, EntityContext, ApplyRequest 类型
□ 每个 entity type 有对应的 provider 文件
  □ lesson_plan: context ✓ search ✓ apply ✓
  □ requirement: context ✓ search ✓ apply ✗
  □ exercise: context ✓ search ✓ apply ✓
  □ skill_run: context ✓ search ✓ apply ✗
  □ template: context ✓ search ✓ apply ✗
□ 每个 provider.context() 返回的 summary ≤100 字
□ 每个 provider.context() 返回的 relations 是 AtReference[]（不是完整 EntityContext）
□ routes.ts 暴露 /context/:type/:id, /search/:type, /apply/:type
□ registry.ts 在 solution 启动时注册所有 type 到 CCaaS core
□ entity-session.ts 在教案创建时调用 bindEntitySession
□ 所有 Skill 执行器完成后调用 saveSkillRun，输出包含 summary + reasoning_chain
□ Skill 的 input_data_hash 在底层数据变化时触发 freshness → stale
□ apply handler 在写入前检查业务约束（如归档状态不可修改）
□ apply handler 在写入后发出 Activity 事件
```

---

## 12. 实施顺序

```
Phase 1: 基础能力
  ├── Entity Registry CRUD API
  ├── Context Router（GET /context/entity/{type}/{id}）
  ├── 消息格式扩展（references 字段）
  └── Agent 工具 get_entity_context

Phase 2: @ Picker
  ├── Search Aggregator（GET /context/search）
  ├── 最近引用（GET /context/recent，依赖 Activity Tracker）
  ├── 前端 @ picker 组件
  └── @ pill 在输入框和消息气泡中的渲染

Phase 3: Apply Action
  ├── Apply Router（POST /context/apply）
  ├── 消息中 apply_action block 渲染
  ├── 按钮状态管理（pending / applied / outdated）
  └── 审计日志
```

Phase 1 完成后 Agent 就能通过 tool 访问实体上下文了（只是没有 @ picker UI）。Phase 2 加上用户侧的 @ 交互。Phase 3 加上回写能力。每个 phase 独立可交付。
