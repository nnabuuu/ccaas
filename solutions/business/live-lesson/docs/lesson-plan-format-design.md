# Design: live-lesson 教案文件格式 (含 per-user 解读层)

> 这是一份**设计文档**，不是实现计划。决定文件格式 / 语义 / 库结构 / 解读层。
> 实现 (Plan Tab 编辑器、库后端、Picker、Interpretation overlay) 留给下一轮。

## Context

`course-project-architecture.md` 已经定下了大方向: `plan/` 是 document-centric
的 markdown 文件，配 Notion-alike 编辑器，agent 通过文件读写访问。架构文档明说
*"教案 tab 和文件系统 tab 操作同一份底层数据"*。

但有几个具体问题没回答:
1. **教学要求必须从库 (curriculum standards library) 里选取**, 不是自由输入。这跟"agent 用 grep 访问 markdown"两个约束怎么共存?
2. **Agent 怎么知道 `req://` 这套语法** —— 不能假设 agent 永远先读完 spec
3. **教学要求的"解读"是 per-user 的** —— 同一个 req 不同教师可能解读不一样, 跨项目复用; 这层信息怎么 attach?

## Core decision

**三层架构**:

- **L0: Canonical layer (markdown 文件)** —— 磁盘上的真相, 一份普通 markdown, agent 直接 grep / Edit
- **L1: Library layer (平台资产)** —— `req://` 引用解析到的库 item, 跨用户共享, read-only
- **L2: Interpretation layer (per-user overlay)** —— 教师对每个 req 的解读, fetch 时 attach 到当前用户, **永远不进入 markdown 文件**

把"Notion-like"放 UI 层、"agent-greppable"放 L0 存储层、"per-user 解读"放 L2 overlay 层。三者关注点不同, 不冲突。

## 1. Inline 库引用的语法 (L1 接入 L0)

**用 markdown link 语法 + `req://` URI scheme:**

```markdown
- [在课文中推断生词含义](req://r-1.2.3 "课标 2.1.3 · 语言能力")
- [识别篇章主旨结构](req://r-2.1.1 "课标 3.2.1 · 阅读策略")
```

- 标准 markdown link 语法 —— 任何 md parser / 格式化器 / linter 都识别
- `req://` URI scheme 第一段是 namespace, 可扩展 (`goal://`, `module://`)
- link text = 教师看到的可读文本 (库 item 当前文案)
- link URL = `req://<library-item-id>` —— canonical 锚点, agent grep
- title 属性 = denormalized metadata —— agent `cat` 时直接拿到分类+课标

### Namespace 约定

| Scheme | 含义 | 状态 |
|---|---|---|
| `req://`     | 教学要求            | **本期实装** |
| `goal://`    | 核心素养目标         | reserved |
| `module://`  | 模块模板            | reserved |
| `lesson://`  | 跨课程项目引用       | reserved |

### Canonicalization

- **加载时**: parser 解析 `req://<id>` → 查 L1 库 → 用最新 text + metadata 覆盖 link text / title
- **库 item 被删**: 渲染为残链 chip (红色 warning + "原文: <stale text>")
- **保存时**: 写出最新 canonical 状态, 磁盘文件永远是自描述的快照

## 2. L1 库的数据结构

库是**静态资源**, 不是用户数据。

**File**: `solutions/business/live-lesson/data/teaching-requirements/<subject>.json`

```json
{
  "subject": "english",
  "subjectLabel": "英语",
  "version": "2026-05",
  "categories": [
    {
      "id": "lang",
      "label": "语言能力",
      "color": "teal",
      "items": [
        { "id": "r-1.2.3", "code": "课标 2.1.3", "text": "在课文中推断生词含义" }
      ]
    }
  ]
}
```

- `id` 一旦 ship 不可改; `text` 可改; `code` 可换映射
- 两级分类 (category → item), 三级以上过度设计
- `version` 字段给未来 pin-to-version 留空间
- 多 subject = 多 JSON 文件 (`english.json` / `math.json`)
- **教师不能编辑库** —— 平台资产 (跟 manifest schema 同边界原则)

## 3. Markdown ↔ Block tree 的双向映射

编辑器存储契约: **roundtrip stable** —— `serialize(parse(md)) === normalize(md)`。

| Markdown                                | Block type           | 备注 |
|----------------------------------------|----------------------|------|
| `# / ## / ###`                          | `heading`             | |
| 普通段落                                 | `paragraph`           | |
| `- item` / `1. item`                    | `list_item`           | |
| `> quote`                               | `blockquote`          | Notion callout 用 `> 💡` |
| ```` ```lang ... ``` ````               | `code_block`          | |
| `---`                                   | `divider`             | |
| `![alt](url)`                           | `image`               | |
| `[text](url)`                           | `link` (inline)       | |
| `[text](req://id "meta")`               | `reference_chip`      | **特殊渲染** |
| `<details><summary>...</summary>...</details>` | `toggle`       | |
| `**bold**` / `*italic*` / `` `code` ``  | inline marks          | |

**不支持的 Notion 特性** (无 markdown 对应): database / columns / web embed / 复杂表格。
我们做"Notion-feel 富文本编辑器", 不是"Notion 完整克隆"。

### Normalization (serialize 时)

- 标题前后各一空行
- 列表前后各一空行 / 内部统一 `-`
- 行尾无空格
- 文末一个 `\n`

### Slash command (UX 契约)

`/heading`, `/list`, `/quote`, `/divider`, `/image`, `/toggle`, **`/req` → 打开教学要求 Picker**。

## 4. Agent 集成 (L0 + L1 访问 + 学习)

### 4.1 访问

Agent 同时需要 L0 + L1 + L2 三层数据。但**不能假设 agent 有 bash** —— remote 环境、sandbox 禁用 shell、其它 agent runtime 都可能拿不到。

设计原则: **所有访问路径必须只依赖 `Read` / `Grep` / `Edit` 这类基础工具**。Bash helper 作为有 shell 环境时的可选便捷, 不能是 critical path。

#### 路径 A: Lesson plan 文件 (L0 + denormalized L1)

1. `cat plan/lesson-plan.md` → 完整文档. L1 的 canonical text + metadata 已经被 denormalized 进 link text + title 属性, agent 不查库就有 L1 上下文
2. `grep "req://" plan/lesson-plan.md` → 列出所有 req 引用
3. `Edit plan/lesson-plan.md` → 增删改 L0

#### 路径 B: Materialized 库 + 解读 (L1 完整 + L2)

Agent session 启动时, **`SessionAssetMaterializer` 把 L1 库 + 当前 user 的 L2 解读 写进 workspace 的 `_lib/` 目录**:

- `_lib/teaching-requirements.md` —— L1 完整库, 按 category 分 section, 每个 item 一段
- `_lib/my-interpretations.md` —— 当前 user 的所有 L2 解读, 一个 req 一段

Agent 用标准工具访问:

```
Read   _lib/teaching-requirements.md      # 翻全库
Grep   "推断生词" _lib/teaching-requirements.md  # 关键词找 id
Grep   "r-1.2.3" _lib/my-interpretations.md     # 看你对某条的解读
```

这条路径**不依赖任何外部工具**, 唯一前提是 ccaas 的 materializer 跑了。跟 ccaas 现有 `entities/` / `resources/` 物化是同一机制扩展。

#### 路径 C: Bash helper (optional, 只在有 shell 环境)

4. `bash scripts/find-req.sh <keyword-or-id>` → 单独 fetch L1 模板 + L2 解读, 一行 output 直接拼到 markdown 用 (§4.2 第 3 层详述)

便捷但不必需。Agent 应该首选路径 B (universal), 路径 C 只在 just-bash sandbox 开启时用。

#### 为什么需要路径 B 而不只是路径 A

- L0/L1 是 *project-shared* 数据, 已经在 lesson plan 文件里 (denormalized)
- 但 agent 想 **新加** 一个 req 时, 需要先找到 id —— 这时候只看 lesson plan 不够, 必须翻库
- L2 是 *per-user* 数据, 不进 lesson plan, 只能通过 materialized `_lib/my-interpretations.md` 拿

#### Materialization 时机

- **Session 启动时**: ccaas 调 live-lesson `GET /api/teaching-requirements` (subject 范围) + `GET /api/teaching-requirements/_interpretations` (当前 user), 写入 `_lib/*.md`
- **Mid-session 更新**: 当前 MVP 不支持. 教师编辑解读 → DB 更新, 但 agent 看到的是 session 启动时的 snapshot. 想拿最新解读需要重启 session
- **将来 (v2)**: 编辑器 PUT interpretation 时同时给 ccaas 发 `re-materialize` 信号, agent 下一轮 turn 看到新版

Stale snapshot 是可接受的 trade-off: 教师编辑解读通常是离线整理, agent 写教案是另一个时段, 两者并发不多。简化大于即时性。

### 4.2 学习 —— **三层冗余** (agent 怎么知道有 `req://` 语法)

#### 第 1 层 · 文件自描述 (always-on)

`plan/lesson-plan.md` 顶部 HTML 注释 (markdown 渲染器不显示, agent `cat` 必看到):

```markdown
<!--
教学要求引用语法: [文本](req://r-X.Y.Z "课标 X.Y · 分类")
查 id:   Grep "<关键词>" _lib/teaching-requirements.md
查解读:  Grep "r-X.Y.Z" _lib/my-interpretations.md
-->

# 课程标题
```

注释优先指向 **materialized 文件路径** (universal, 不依赖 bash)。**完全不依赖外部加载机制** —— Skill 可能没 trigger, system prompt 可能没刷新, 只有文件自描述是 self-contained 的。

有 bash 的环境也可以用 `bash scripts/find-req.sh "<关键词>"` 一步搞定 (§4.2 第 3 层), 但不是必需。

#### 第 2 层 · Skill (任务触发)

`skills/lesson-plan-editor/SKILL.md` —— 完整规范 + workflow (加 req / 加 section / 处理残链)。类似已有的 `manifest-editor` skill。

#### 第 3 层 · CLI helper (可选, 防错)

**前提**: agent 环境有 bash (`just-bash` sandbox 启用)。**不假设这是默认情况** —— remote agent 可能没有 shell。这一层是有 shell 时的便捷, 不是必需路径。

`scripts/find-req.sh "<keyword>"` —— 查库 + 输出 canonical link 模板 + (§5) **当前用户的解读**:

```bash
$ bash scripts/find-req.sh "推断生词"
[在课文中推断生词含义](req://r-1.2.3 "课标 2.1.3 · 语言能力")

# 你的解读 (来自当前 user):
# > 在阅读理解题型中, 这个能力主要体现为...
# > 例子: "his eyes betrayed his calm" → betray 在这里不是"背叛"
```

没 bash 的 agent 用 §4.1 路径 B 的 `Grep _lib/*.md` 拿到等价信息, 只是要多一步 (find id → look up interpretation)。

### 4.3 错误兜底

Agent 拼错 id / 库 item 被删 → canonicalization 标红 + Review 阶段 AI lint 跨 plan/execution 一致性检查。

## 5. Interpretation layer (per-user 解读)

### 5.1 设计原则

教学要求的 **canonical text** (L1) 跨用户共享、平台升级才能改。但每位教师对同一个 req 的 **解读** 可能不一样 —— 这层信息**永远不进入** `plan/lesson-plan.md`:

- 教案文件是 project-scoped, 多用户可能共享 → 嵌入 per-user 内容 = 数据所有权混乱
- 教案是"课该怎么上"的 declaration; 解读是"我怎么读这个标准"的 personal note
- 两者关注点不同, 不该混在同一份文件里

具体: `lesson-plan.md` 永远只含 canonical req refs, 解读作为 sidecar 通过 API / helper 暴露给 fetch 它的用户 (或 agent on-behalf-of-user)。

### 5.2 数据模型

新 TypeORM entity:

```typescript
@Entity('requirement_interpretations')
@Index(['userId', 'reqId'], { unique: true })
class RequirementInterpretation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() reqId: string;             // e.g. 'r-1.2.3'
  @Column({ type: 'text' }) notes: string;  // markdown
  @Column() createdAt: string;
  @Column() updatedAt: string;
}
```

设计要点:

- **Per-user cross-project** —— 一位教师对 `r-1.2.3` 的解读全局唯一, 跨所有他的项目复用。`(userId, reqId)` 唯一约束
- **Plain markdown `notes`** —— 不强制结构, 教师想写什么写什么 (例子 / 注意点 / 评估提示都行)
- **不依赖 reqId 引用完整性** —— L1 库 item 被删后, interpretation 行不级联删除 (变成"孤儿"); admin 工具可以扫出来

### 5.3 用户身份 (prerequisite)

Live-lesson backend 当前**没有用户身份模型** (`backlog.md` 第一项追踪)。本设计依赖以下任一条件:

- **路径 A (推荐)**: 复用 ccaas 已有的 `Session.userId` —— ccaas → live-lesson proxy 链路传 caller userId, live-lesson 信任并用作 `RequirementInterpretation.userId`。在 `CcaasUpstream` 加 `resolveUserId()` 或从 proxy header `X-Caller-User-Id` 取
- **路径 B**: 等 live-lesson 自己加用户模型 (cross-cutting concern, 涉及登录态/权限)

MVP 可以先用占位 (env-based default user) 让此特性 ship, 但 release 时明确"single-user 配置"; release 后切换到路径 A。

### 5.4 API

```
GET    /api/teaching-requirements/:id
  → {
      id, code, text, category,           // canonical layer (L1)
      myInterpretation?: {                  // overlay (L2) — has-record + authenticated 时出现
        notes: string,
        updatedAt: string,
      } | null
    }

PUT    /api/teaching-requirements/:id/interpretation
  body: { notes: string }
  → { updatedAt }
  // upsert (userId, reqId) row

DELETE /api/teaching-requirements/:id/interpretation
  → 204
```

userId **永远从 auth context 解析**, 从不接受 body / query 参数 (cross-user 注入防御)。

### 5.5 Editor 集成

- Chip 渲染 (canonical text) 不变
- Hover / 点击 chip → popover 显示 `myInterpretation.notes` (markdown 渲染)
- Popover 有 "编辑" 入口 → modal 编辑 `notes` → save 调 PUT API
- 没有 interpretation 时 popover 显示 "为这个要求记一些解读" 入口
- **不修改 `plan/lesson-plan.md`** —— interpretation 编辑是 sidecar 操作

### 5.6 Agent 集成

两条路径 (跟 §4.1 同, 重述 L2 视角):

**Primary (universal): materialized 文件**

`SessionAssetMaterializer` 在 session 启动时把当前 user 的所有 L2 解读写入 `_lib/my-interpretations.md`:

```markdown
<!--
你的解读 (per-user overlay, 来自 user X). 编辑请回到 Plan Tab popover.
查找用 Grep, 例如: Grep "r-1.2.3" _lib/my-interpretations.md
-->

# 我的解读

## r-1.2.3 — 在课文中推断生词含义

在阅读理解题型中, 这个能力主要体现为...
例子: "his eyes betrayed his calm" → betray 在这里不是"背叛"

---

## r-2.1.1 — 识别篇章主旨结构
...
```

Agent 用 `Read _lib/my-interpretations.md` 或 `Grep "<id>" _lib/my-interpretations.md` 即可, **不需要 bash**。

**Optional (bash 环境): helper script**

§4.2 第 3 层 `find-req.sh` 一行输出 canonical link + interpretation 注释块, 拼到 markdown 更方便。但只在 just-bash sandbox 开启时可用。

**两条路径都保证**:

- Agent 拿到的解读永远是当前 session userId 对应的那份
- 文件由 ccaas 用 auth context 物化 / helper 用 auth context 查询, **不会跨用户泄露**
- Agent 知道解读是"个人 note", 不是要写进 lesson plan 的内容 (skill `SKILL.md` 明确)

### 5.7 Trust boundary

- Interpretations 是用户敏感数据 (教师的教学思考)
- API enforce `userId from auth context, NEVER query/body`
- 一个 user 拿不到另一个 user 的 interpretation
- ccaas → live-lesson proxy 链路必须 propagate userId, 不能被前端伪造 (proxy 注入, 不读 client header)

## 6. 完整示例

```markdown
<!--
教学要求引用语法: [文本](req://r-X.Y.Z "课标 X.Y · 分类")
查 id + 解读: bash scripts/find-req.sh "<关键词>"
-->

# 函数与图像入门

> 高一第一单元导引课 · 45 分钟

## 教学目标

- 理解函数的对应关系定义
- 能识别一次/二次函数的图像特征

## 教学要求

- [理解函数概念的形式化定义](req://r-1.1.1 "课标 1.1 · 知识理解")
- [能在坐标系中描点画出基本函数图像](req://r-2.3.1 "课标 2.3 · 技能应用")
- [使用变量符号表达数量关系](req://r-3.1.2 "课标 3.1 · 数学语言") —— 本课重点

## 模块概要

### 模块 1: 复习引入 (5 分钟)
...
```

磁盘上的内容 = 上文。教师在编辑器里看到富 chip + 自己的解读 popover。Agent `cat` 看到原文 + 通过 `find-req.sh` 拿到解读。

## 7. 关键文件 (设计承诺)

**新文件:**
- `solutions/business/live-lesson/data/teaching-requirements/<subject>.json` —— L1 库数据
- `backend/src/teaching-requirements/teaching-requirements.controller.ts` —— L1 + L2 API
- `backend/src/teaching-requirements/teaching-requirements.service.ts` —— L1 内存加载 + L2 DB CRUD
- `backend/src/teaching-requirements/requirement-interpretation.entity.ts` —— L2 entity (TypeORM)
- `creator/src/lib/lesson-plan-md/parse.ts` —— md → block tree (识别 `req://`)
- `creator/src/lib/lesson-plan-md/serialize.ts` —— block tree → md
- `creator/src/lib/lesson-plan-md/canonicalize.ts` —— 用 L1 库刷新 link text/title
- `solutions/business/live-lesson/skills/lesson-plan-editor/SKILL.md` —— §4.2 第 2 层
- `solutions/business/live-lesson/scripts/find-req.sh` —— §4.2 第 3 层 (有 bash 时的便捷, optional)

**改动现有文件:**
- `backend/src/project/project.service.ts:create()` —— scaffold 必须含 §4.2 第 1 层 HTML 注释头
- `creator/src/pages/ProjectEditorPage.tsx` —— Plan Tab 接入编辑器组件
- `live-lesson/backend/src/adapters/http/ccaas-upstream.service.ts` —— 加 `resolveUserId()` (L2 prereq, 路径 A)

**ccaas 侧改动 (跨项目):**
- `packages/backend/src/sessions/services/session-asset-materializer.service.ts` —— 加 L1/L2 materialization 步骤:
  - Session 启动时: 调 live-lesson `GET /api/teaching-requirements?subject=<from manifest>` → 写 `_lib/teaching-requirements.md`
  - 调 live-lesson `GET /api/teaching-requirements/_interpretations` (带 userId) → 写 `_lib/my-interpretations.md`
- 这是 universal 路径的关键 —— 让 agent 在没有 bash 的情况下也能查 L1+L2

## 8. Open questions

1. **编辑器选型**: TipTap (推荐) / BlockNote / Lexical / 自建? 暂不决定
2. **库版本管理**: lesson plan 该不该 pin 到某个库 version? 当前方案是不 pin, 总是 canonicalize 到最新。如果库删除某 item 怎么办? 当前是渲染残链
3. **解读能否编辑 chip 里的 text**? 当前方案是不能 (canonicalization 覆盖); 教师要补充用 chip 外的 "—— 本课重点" 模式
4. **Subject 怎么定**? 用 `manifest.json` 已有的 `subject` 字段
5. **教学目标 / 核心素养目标也库化吗**? 本期不实装, `goal://` scheme 已预留
6. **用户身份模型路径选择**: 路径 A (复用 ccaas) vs 路径 B (live-lesson 自己加) vs MVP 占位? 推荐 A, 但需要 ccaas → live-lesson proxy 改造 (加 userId propagation)
7. **解读的 abuse / 滥用**: 教师可能把"用户名密码"之类的写进解读 notes —— 当 sensitive data 处理? Audit log? 暂时不动, 假定教师自律 (内部工具)
8. **Mid-session 解读更新**: MVP 是 stale snapshot (session 启动时物化, 之后不刷新). 教师在 popover 改解读后 agent 需要重启 session 才能看到新版。要不要加 ccaas re-materialize 信号? 短期不做, 等真实场景出现

## Not in scope

- Plan Tab 编辑器实现
- L1 库的种子数据 (实际课标 JSON 填充)
- L2 interpretation 的编辑 UI (modal)
- AI lint 跨 plan/execution 一致性检查
- Plan 内的版本对比 / diff UI
- 库的 admin 编辑后台
- 多教师在同一 interpretation 上协作 / 分享

---

## 后续 implementation 路线 (FYI)

设计落定后, 自然分 5 个 follow-up tracks:

1. **L1 Library backend**: 加 `teaching-requirements/` JSON + L1 controller/service + unit test + seed sample
2. **L2 Interpretation backend**: 加 `RequirementInterpretation` entity + L2 endpoints + auth context userId resolution + 跨 (userId, reqId) 唯一性测试
3. **Markdown parse/serialize lib**: 实现 `parse.ts` / `serialize.ts` / `canonicalize.ts` + round-trip property tests
4. **Plan Tab MVP (read-only)**: 接入解析器, 先做只读富渲染 (含 chip + interpretation popover, fetch L2)
5. **Plan Tab editable**: 引入编辑器 (TipTap), 加 slash command, 加 req picker modal + interpretation editor modal

每个 track 1-2 天工作量, track 2 依赖 ccaas → live-lesson 的 userId propagation (额外 0.5 天)。
