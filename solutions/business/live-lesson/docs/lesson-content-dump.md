# Ideal Beauty 课堂内容总览

> **课名**: Ideal Beauty — 阅读策略训练
> **学科**: 英语 · 高一
> **课型**: reading
> **总时长**: ~47 分钟（5 个 task step + 1 个 instruction step）
> **课文**: B7U2 *Ideal Beauty*（8 段，讲跨文化审美差异）

---

## 总体结构

```
课前导读 (instruction, 2 min)
  │
  ├─ Step 1 · 图式激活 Predict      (task, 5 min)   — quiz
  ├─ Step 2 · 结构解码 Skim         (task, 8 min)   — select-evidence
  ├─ Step 3 · 矩阵构建 Scan & Build (task, 15 min)  — matrix
  ├─ Step 4 · 批判质疑 Evaluate     (task, 12 min)  — map (拖拽+写理由)
  └─ Step 5 · 复盘升华 Wrap-up      (task, 5 min)   — order (排序)
```

每个 task step 内部都有 **四个阶段** (phaseConfig)：

| Phase | 说明 |
|-------|------|
| **Listen** | 阅读策略说明 (studentView)，学生点"确认"后进入练习 |
| **Practice** | 做题 (answerKey 对应的练习) |
| **Discuss** | AI 苏格拉底式对话，围绕本步学习目标深入探讨 |
| **Takeaway** | 小结 (summary)，展示 insight |

---

## 课前导读 (instruction step)

| 维度 | 内容 |
|------|------|
| **学生看到** | 欢迎页：介绍今天读 *Ideal Beauty*，学 4 种阅读策略 (Predicting, Skimming, Scanning, Evaluating)。3 个 key points + TTS 朗读。底部按钮 "I'm ready, let's go" |
| **任务** | 无练习，点击确认即进入 Step 1 |
| **老师看到** | 仪表盘提示 "学生正在阅读课前导读"，cue card 说明"无需干预，等待学生自行完成" |

---

## Step 1 · 图式激活 (Predict)

**策略**: Predicting — 看标题和开头，激活已知，形成预期
**聚焦段落**: ¶1-2（尼日利亚增肥室 vs 现代媒体审美）
**时长**: 5 分钟

### 学生看到什么

**Listen 阶段** — 策略说明页：
- 标题 "What is Predicting?"
- 解释：用标题、图片、首段线索猜测文章内容
- 指引：(1) 读标题 Ideal Beauty (2) 略读 ¶1 找具体例子 (3) 略读 ¶2 看是否与 ¶1 一致
- 3 个 key points + TTS
- 按钮 "I've read the title — let's predict"

**Practice 阶段** — Quiz 练习（3 道选择题）：

| # | 问题 | 正确答案 |
|---|------|----------|
| Q1 | What did Happiness Edem do to become "beautiful"? | B. Gained weight in a fattening room |
| Q2 | What kind of beauty does modern media promote? | C. Slim and fair-skinned |
| Q3 | What is the writer's main question? | B. Is one idea of physical beauty really more attractive than another? |

- 每题有英/中 hint（看哪个段落找什么关键词）
- 有 walkthrough（手把手讲解，答错多次后触发）

**Discuss 阶段** — AI 对话：
- 开场问题: "Why do you think the writer chose to start with these two different examples?"
- 学习目标: 理解作者用冲突开头（增肥 vs 纤瘦），引出核心问题
- 最多 6 轮，5 分钟
- 如果学生不回答/困难，有 fallback MC 兜底

**Takeaway** — 小结:
> You found the central conflict: one culture values gaining weight, while modern media promotes being slim. Key question: *Is one idea of physical beauty really more attractive than another?*

### 老师看到什么

**仪表盘**:
- Speech line: "Look at the title — Ideal Beauty. Before reading, what comes to mind?"
- 4 个快捷操作按钮：
  - 💡 标题联想 — 广播提示学生说 3 个关键词
  - 📖 读¶1尼日利亚 — 提示学生阅读 ¶1
  - ⚡ 对比提示 — "¶1 说胖是美，¶2 说 slim and fair 才是美"
  - ⏱ 再给 2 分钟
- 3 张 cue card：激活策略方法、¶1-2 要点、过渡到 Step 2 的话术
- Step card 显示：当前人数、正确率、AI 对话轮次、卡住人数

---

## Step 2 · 结构解码 (Skim)

**策略**: Skimming — 只读首句 + 信号词，快速提炼文章骨架
**聚焦段落**: ¶1-8（全文）
**时长**: 8 分钟

### 学生看到什么

**Listen 阶段** — 策略说明页：
- 标题 "What is Skimming?"
- 解释：不要逐字读，只读首句 + 找信号词
- 信号词对照表：
  - `change over time` → History
  - `around the world / different cultures` → Culture
  - `It appears that` → Conclusion
- 3 个 key points + TTS

**Practice 阶段** — Select-Evidence 练习：
- 任务：把 4 个段落组 (¶1-2, ¶3-4, ¶5-7, ¶8) 分别匹配到功能标签
- 功能选项：`Phenomenon`, `History`, `Culture`, `Conclusion`
- 正确答案：

| 段落组 | 功能 | 关键信号 |
|--------|------|----------|
| ¶1-2 | Phenomenon | 两个对立审美 + 核心问句 |
| ¶3-4 | History | "change over time", "Egyptian", "1600s", "Elizabethan" |
| ¶5-7 | Culture | "different cultures around the world", Borneo, NZ, Myanmar, Indonesia |
| ¶8 | Conclusion | "It appears that", 总结句 |

- 每段文本被拆为 token，标记了 `evidence`（应选）、`distractor`（干扰项）、普通文本
- 学生需要高亮选中关键证据词，系统即时判定

**Discuss 阶段** — AI 对话：
- 开场: "Why does the writer put History BEFORE Culture? Could the order be reversed?"
- 目标: 理解 History(时间) + Culture(空间) = 层层递进的论证
- 最多 6 轮

**Takeaway**:
> Text structure: Phenomenon → History → Culture → Conclusion. The writer builds an argument step by step.

### 老师看到什么

- Speech line: "Read only the first sentence of each paragraph. Find the signal words."
- 4 个快捷操作：只读首句！/ 信号词提示 / 文章结构 / 再给 2 分钟
- 3 张 cue card：Skimming 方法、四段结构表、过渡话术
- 实时看到每个学生的段落功能匹配情况和高亮选词

---

## Step 3 · 矩阵构建 (Scan & Build)

**策略**: Scanning — 带着明确目的细读，提取关键细节
**聚焦段落**: ¶3-7
**时长**: 15 分钟

### 学生看到什么

**Listen 阶段** — 策略说明页：
- 标题 "What is Scanning?"
- 解释：像查字典一样，带目标扫读
- 介绍 Place × Practice × Reason 矩阵

**Practice 阶段** — Matrix 练习（6 行，首行示范）：

| Place | Practice | Reason | 段落 |
|-------|----------|--------|------|
| Ancient Egypt *(示范)* | slim dark-haired women in paintings | beauty ideal / normal practice | ¶3 |
| 1600s Europe | plump and pale-skinned | wealth | ¶4 |
| Borneo | tattoos | diary of events | ¶6 |
| NZ Maori | tattoos | position in society | ¶6 |
| Myanmar | metal neck rings | elegance | ¶7 |
| Indonesia | sharpened teeth | cultural identity | ¶7 |

- 首行 (Ancient Egypt) 预填作为 demo
- 每行有英/中 hint 和 AI 反馈
- 前 3 行有 `practiceCount: 3`，允许 3 次尝试

**Discuss 阶段** — AI 对话：
- 开场: "If someone from another planet read your matrix, would they conclude humans care about 'looking good'? Or is something deeper going on?"
- 目标: 看到审美实践不只是外表，而是身份、地位、归属
- 最多 6 轮

**Takeaway**:
> You turned paragraphs into organized evidence. Your matrix shows beauty is about culture, status, and identity.

### 老师看到什么

- Speech line: "Let's fill in the flesh — Place × Practice × Reason."
- Focus type: `matrix` — 实时矩阵展示
- 4 个快捷操作：Myanmar 位置提示 / Practice 写法示例 / Maori tattoos 提示 / 再给 2 分钟
- 3 张 cue card：
  - 用 Egypt 打样的方法
  - ⚠ 易错点（Maori 写 tattoos 不写 tā moko；Myanmar 和 Indonesia 要分两行）
  - 过渡话术（看 Reason 列）

---

## Step 4 · 批判质疑 (Evaluate)

**策略**: Evaluating — 用证据批判性思考
**聚焦段落**: ¶2, ¶8
**时长**: 12 分钟

### 学生看到什么

**Listen 阶段** — 策略说明页：
- 标题 "How to Read Critically"
- 回顾 ¶2 中 "shallow beauty ideals"，指出这是 many people 的看法，不是作者结论
- 给出议论段模板：
  ```
  I [agree/disagree] that beauty ideals are shallow.
  First, in [Place], [Practice] because [Reason].
  Second, in [Place], [Practice] because [Reason].
  Therefore, beauty is [not] shallow.
  ```

**Practice 阶段** — Map 练习（二维坐标拖拽 + 写理由）：
- 坐标轴：
  - X 轴: "Why is it done?" (Just appearance ←→ Cultural meaning)
  - Y 轴: "How lasting is it?" (Temporary ←→ Permanent)
- 7 个可拖拽的 chip：

| Chip | 参考段落 | 参考位置 (x, y) |
|------|----------|-----------------|
| Egyptian kohl | ¶3 | (0.55, -0.2) |
| 1600s plump & pale | ¶4 | (-0.4, -0.5) |
| Borneo tattoos | ¶5 | (0.7, 0.85) |
| Maori tā moko | ¶6 | (0.85, 0.9) |
| Myanmar neck rings | ¶7 | (0.55, 0.55) |
| Indonesia teeth | ¶7 | (0.6, 0.8) |
| Modern media slim | ¶2 | (-0.7, -0.7) |

- 每个 chip 拖放后需写理由（最少 8 字）

**Discuss 阶段** — AI 对话：
- 开场: "The writer calls modern media beauty standards 'shallow.' Do you think it's fair? What would make a beauty standard 'deep'?"
- 目标: 用矩阵证据论证媒体审美为何"肤浅"
- 最多 8 轮，6 分钟

**Takeaway**:
> You used evidence to support your judgment — a big step in academic reading.

### 老师看到什么

- Speech line: "Are these really shallow beauty ideals?"
- Focus type: `rubric` — 评分标准 & 写作模板
- 4 个快捷操作：回顾 Reason 列 / 引用矩阵证据 / 议论段模板 / 再给 2 分钟
- 3 张 cue card：
  - 引导批判思维（¶2 是别人的观点，不是作者结论）
  - ⚠ 评分标准（立场清晰 / ≥2 条证据 / First-Second-Therefore 结构）
  - 过渡话术（选好的学生作品展示）
- 实时看到学生在二维平面上的拖拽分布和理由

---

## Step 5 · 复盘升华 (Wrap-up)

**策略**: Synthesizing — 回顾整节课的阅读策略
**聚焦段落**: ¶8
**时长**: 5 分钟

### 学生看到什么

**Listen 阶段** — 策略说明页：
- 标题 "Review: What Did You Learn Today?"
- 表格回顾 4 步阅读法：

| Step | Strategy |
|------|----------|
| 1 | Predicting — read the title, activate prior knowledge |
| 2 | Skimming — read first sentences + signal words, find the skeleton |
| 3 | Scanning — read with a purpose, extract details into a matrix |
| 4 | Evaluating — think critically with evidence, write an argument |

- 强调：这套方法适用于任何说明文/议论文

**Practice 阶段** — Order 练习（排序题）：
- 4 个选项需按正确顺序排列：
  1. Predicting — read the title, ask questions
  2. Skimming — find the structure quickly
  3. Scanning — find specific details
  4. Evaluating — form your own judgment

**Discuss 阶段** — AI 对话：
- 开场: "Imagine your friend missed today's class. How would you explain your reading process step by step?"
- 目标: 能说出 4 步及其作用，并认识到方法可迁移
- 最多 5 轮，4 分钟

**Takeaway**:
> Reading process: Predict → Skim → Scan → Evaluate. These work for any text.
> Homework: "Beyond the Plate" using today's 4 steps.

### 老师看到什么

- Speech line: "We used 4 strategies today: Predicting, Skimming, Scanning, and Evaluating."
- 4 个快捷操作：Predict 回顾 / Skim 回顾 / 布置作业 / 再给 2 分钟
- 3 张 cue card：
  - 策略总结（4 步法完整列表）
  - ¶8 主旨（"美不是 shallow vanity，而是 cultural language"）
  - 作业说明（读 Beyond the Plate，画 structure map + 填 matrix）

---

## 三端视角对比

| 维度 | 学生端 | 老师端仪表盘 | 投屏黑板 |
|------|--------|-------------|----------|
| **核心功能** | 读策略说明 → 做题 → AI 对话 → 看小结 | 监控进度、正确率、卡点、AI 对话、一键广播提示 | 展示结构化板书（由 MCP server 控制） |
| **信息流** | 从 manifest.studentView + answerKey | 从 SSE 实时流 + stepMetrics + questions | 从 boardData (MCP state) |
| **交互** | 做题提交、AI 对话、点确认推进 | 点快捷操作广播消息、点学生查看详情 | 无交互，纯展示 |
| **每步看到** | 策略说明 + 练习题 + AI 对话 | Health cards + Step cards (人数/正确率/AI/卡点) + 问题聚类 | 当前步骤的板书内容 |

---

## 练习类型汇总

| Step | 练习类型 | 交互方式 | 评分维度 |
|------|----------|----------|----------|
| 1 图式激活 | `quiz` (3 道选择题) | 点选 | 按题目：Q1, Q2, Q3 各对错 |
| 2 结构解码 | `select-evidence` (4 组段落匹配) | 选功能标签 + 高亮证据词 | 按段落组 (¶1-2, ¶3-4, ¶5-7, ¶8) |
| 3 矩阵构建 | `matrix` (6 行三列) | 填写文本 | 按行 (1600s Europe, Borneo, NZ Maori, Myanmar, Indonesia) |
| 4 批判质疑 | `map` (7 chip 拖拽 + 写理由) | 拖拽到二维坐标 + 文本输入 | 按 chip (位置偏差 + 理由长度) |
| 5 复盘升华 | `order` (4 项排序) | 拖拽排序 | 整体顺序是否正确 |
