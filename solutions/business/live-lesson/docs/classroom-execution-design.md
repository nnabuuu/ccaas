# 课堂执行设计方法论（Skill 草案）

> **定位**：AI 辅助 manifest 审查与设计 skill。在创建/修改课堂步骤时激活，确保每个学生（含 fallback 路径）都有足够的认知支撑。

---

## 全局规则

1. **用户优先权**：用户随时可以跳过任何阶段、修改方向、或直接给出具体指令。AI 不固守流程。
2. **不编造教学内容**：AI 不得自行虚构学科知识点或例题。所有教学内容必须来源于 manifest 中已有的 answerKey/sampleSolution/insight。
3. **最小干预**：如果现有步骤衔接已经合理，不要为了"完整性"强行添加 studentView。只在检测到认知断层时才建议介入。
4. **上下文保持**：长对话中，每完成一个阶段，更新审查日志（记录已检查的步骤、发现的问题、采取的行动）。

---

## 触发条件（何时激活此 skill）

以下信号触发此 skill：

| 信号 | 示例 |
|------|------|
| 用户要求创建/修改 manifest 步骤 | "给 step 3 加一个 studentView" |
| 用户要求审查步骤衔接 | "检查一下这几步之间的认知连贯性" |
| 新增 task 类型步骤且前步有 fallbackMC | 自动触发衔接检查 |
| 用户提到"学生跟不上""跳跃太大""填空太难" | 识别为认知断层信号 |

---

## 工作流阶段

### Phase 0：情景识别

**目的**：判断当前任务类型，选择执行路径。

检测维度：
- (A) **新步骤设计** — 从零创建一个 readingStep
- (B) **步骤修补** — 为已有步骤添加 studentView / 调整衔接
- (C) **全局审查** — 检查整个 manifest 的步骤衔接
- (D) **其他** — 用户有特殊需求，直接响应

> 用户确认后进入对应阶段。如果用户直接给了明确指令，跳过此阶段。

---

### Phase 1：上下文加载

**目的**：读取必要信息，建立工作记忆。

按需加载（Token 效率优先）：
- **必读**：目标步骤的完整 JSON（answerKey + discuss + teacherView）
- **必读**：前一步骤的 discuss.insight + discuss.fallbackMC + discuss.goal
- **按需**：前一步骤的 answerKey（如果需要确认术语来源）
- **按需**：后一步骤的 answerKey（如果需要确认过渡是否充分）

> 不要一次性加载整个 manifest。只加载审查所需的步骤。

---

### Phase 2：最差路径分析

**目的**：追踪 fallback 学生的认知状态。

执行步骤：
1. 列出前一步骤的所有"出口"（GOAL_REACHED / fallbackMC / 超时）
2. 对每个非理想出口，列出学生带走的知识（insight 文本、MC 正确答案的 explanation）
3. 对比当前步骤的输入要求（fill-blank 的答案词、quiz 的前置知识、image-upload 的题目理解）
4. 标记差距：哪些术语/概念在 fallback 路径中只被"一次性被动曝光"？

**输出格式**：
```
📊 最差路径分析
├─ 前步出口：[fallbackMC] → 学生知道："..." (被动)
├─ 本步输入要求：填空需要 [和、差、平方差] 三个术语
└─ ⚠️ 差距：[和、差] 从未被显式教学，只在 insight 中一闪而过
```

> 用户决策点：(A) 确认需要桥接 (B) 认为不需要，跳过 (C) 补充其他信息

---

### Phase 3：桥接方案设计

**目的**：设计 studentView 内容（如果 Phase 2 确认了认知断层）。

设计原则：

#### 3.1 结构：具体 → 抽象 → 命名

```
回顾具体算例（锚定已有经验）
    ↓
观察/归纳结构（引导主动加工）
    ↓
符号化/命名（正式给出公式/术语）
    ↓
文字描述（用自然语言复述）
```

#### 3.2 术语高亮规则

- 后续练习中要求填写/回忆的每个词，必须在 body 中以 `<strong>` 标记
- 高亮词不超过 5 个（认知负荷控制）
- 使用不同颜色/字号区分层级（公式用大字居中，术语用加粗）

#### 3.3 keyPoints 设计规则

- 条目数 = 后续练习的关键答案数（一一对应）
- 每条 keyPoint 比答案"多说一点"（提供语境），但不直接给出练习的完整答案
- 如果有 KaTeX 公式，用 `$...$` 包裹

#### 3.4 confirmLabel 设计规则

- 必须用行动动词（"我来……"）
- 必须预告下一步的动作类型
- 对照表：fill-blank → "我来填一填" | quiz → "我来选一选" | image-upload → "我来算一算" | discuss → "我来想一想"

**输出**：完整的 `studentView` JSON 块，供用户审阅。

> 用户决策点：(A) 采纳 (B) 修改后采纳 (C) 放弃

---

### Phase 4：一致性验证

**目的**：确认修改后的步骤在上下文中仍然自洽。

检查清单：

| # | 检查项 | 方法 |
|---|--------|------|
| 1 | studentView.keyPoints 覆盖 answerKey 中的所有关键答案 | 逐条比对 |
| 2 | studentView.body 中引用的算例与前步的 sampleSolution 一致 | 原文比对 |
| 3 | confirmLabel 与 exerciseLabel 的动作类型匹配 | 语义检查 |
| 4 | teacherView.cueCards 的过渡描述与实际步骤顺序一致 | 序号检查 |
| 5 | 对理想路径学生不会感到冗余 | 角度差异检查（发现 vs 归纳） |

**输出**：通过/不通过 + 具体问题列表。

---

### Phase 5：写入与验证

**目的**：将修改写入 manifest 并验证 JSON 合法性。

执行步骤：
1. 编辑 manifest.json，插入 studentView
2. `node -e 'JSON.parse(require("fs").readFileSync("manifest.json","utf-8"))'` — 验证 JSON 语法
3. 更新 DB（如果 manifest 修改不会自动同步）
4. 提示用户重启 backend 并手动验证

> **注意**：JSON 中使用中文引号（\u201c \u201d）而非 ASCII 双引号，避免破坏 JSON 结构。

---

## 禁止事项（护栏）

| # | 禁止 | 原因 |
|---|------|------|
| 1 | 不得编造学科内容 | AI 可能产生数学错误；所有内容必须来源于 manifest 已有数据 |
| 2 | 不得删除已有的 discuss/answerKey | 可能破坏其他依赖 |
| 3 | 不得在 studentView 中直接给出练习的完整答案 | 破坏练习的教学价值 |
| 4 | 不得假设学生都走了理想路径 | 核心原则违反 |
| 5 | 不得为每个步骤都加 studentView | 过度干预降低学生自主性 |

---

## 设计模式库

### 模式 A：显式教学桥接（Explicit Teaching Bridge）

**适用**：前步有 fallbackMC + 当前步要求精确回忆

**结构**：
```json
{
  "studentView": {
    "title": "新知归纳：[概念名]",
    "body": "<p>回顾具体算例</p><p>观察结构</p><p>符号化公式</p><p>文字描述</p>",
    "keyPoints": ["对应练习空1", "对应练习空2", "..."],
    "confirmLabel": "我来[动作]一[动作]"
  }
}
```

### 模式 B：情景导入（Scene Introduction）

**适用**：课程第一步，建立学习动机

**结构**：
```json
{
  "studentView": {
    "title": "故事/情景标题",
    "body": "<p>情景描述</p><img .../><p>设问</p>",
    "keyPoints": ["核心问题", "学习目标暗示"],
    "confirmLabel": "我来[探索动词]一[探索动词]"
  }
}
```

### 模式 C：方法总结桥接（Method Summary Bridge）

**适用**：前步是计算练习，后步要求反思方法论

**结构**：
```json
{
  "studentView": {
    "title": "解题方法回顾",
    "body": "<p>步骤1做了什么</p><p>步骤2做了什么</p><p>总结：正确的思维路径是...</p>",
    "keyPoints": ["步骤1名称", "步骤2名称", "完整路径"],
    "confirmLabel": "我来想一想"
  }
}
```

---

## 实例记录

### Case 1：平方差公式课 step 2（fill-blank）

**诊断**：Step 1 discuss fallback 学生只被动看了 insight，未主动加工"和""差""平方差"术语。Step 2 要求精确回忆这三个词。

**方案**：模式 A — 显式教学桥接。回顾三道具体算式 → "观察左边/右边" → 加粗关键术语 → 正式命名公式。

**结果**：keyPoints 4 条逐一对应 fill-blank 的 5 个空（s1: 和、差、平方差 + s2: a²-b²、平方差）。confirmLabel = "我来填一填"。

---

## 附录：Phase 流转与 studentView 的关系

```
Listen (studentView) → Practice (exerciseLabel + answerKey) → Discuss → Takeaway → PersonalTouch
```

- `studentView` 存在时，listen 阶段渲染教学内容；不存在时，listen 阶段跳过
- 并非每个步骤都需要 studentView —— 只在检测到认知断层时添加
- 典型分布：intro 有（导入），中间按需（桥接），最后无（学生已有积累）
