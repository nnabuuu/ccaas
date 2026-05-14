# Ideal Beauty — 阅读策略训练课 设计文档

> **课程编号** `ideal-beauty-reading`
> **学科** 英语（高中一年级）
> **课型** 阅读策略训练（Reading Strategy Training）
> **课文来源** B7U2 *Ideal Beauty*
> **目标时长** ≈45 分钟

---

## 1. 设计理念

### 1.1 核心问题

> *Is one idea of physical beauty really more attractive than another?*

课文围绕全球审美多样性展开，从尼日利亚增肥室到缅甸长颈族，用跨时间、跨文化的事实论证"美不是肤浅的——它是文化语言"。本课利用这一内容载体，训练四种可迁移的阅读策略。

### 1.2 教学哲学

| 原则 | 实现方式 |
|------|----------|
| **苏格拉底式引导** | AI 从不直接给出答案，通过提问引导学生自己发现 |
| **生成效应** | 学生自己发现的答案 → 2-3 倍记忆留存率 |
| **支架递撤** | 每步先教策略、给提示，逐步减少辅助 |
| **证据先行** | 所有观点必须有文本证据支撑，培养批判思维 |
| **即时反馈** | 练习提交后秒级评分 + AI 个性化对话 |

### 1.3 三端联动架构

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  教师控制台   │    │   学生端     │    │   投屏黑板   │
│  推进节奏     │◄──►│  完成任务    │    │  结构化板书  │
│  实时监控     │    │  AI 对话     │    │  可视化矩阵  │
│  干预提示     │    │  个性反馈    │    │  策略回顾    │
└─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │
       └──────── SSE 实时广播 ─────────────────┘
```

---

## 2. 课文结构分析

### 2.1 文章全文

课文 *Ideal Beauty* 共 8 个自然段（约 450 词），每段标注了角色属性：

| 段落 | 角色 | 内容摘要 | 信号词 |
|------|------|----------|--------|
| ¶1 | detail | 尼日利亚少女 Happiness Edem 在"增肥室"增重至 120kg | — |
| ¶2 | **key** | 现代媒体推崇纤瘦白皙 → 核心问题 | `shallow beauty ideals` |
| ¶3 | **key** | 审美随时间变化：古埃及纤瘦 vs 35000年前的维纳斯 | `change over time`, `different periods` |
| ¶4 | detail | 1600s 鲁本斯画丰腴女性；伊丽莎白时代白皮肤=财富 | — |
| ¶5 | **key** | 全球不同文化的审美差异 | `different cultures around the world` |
| ¶6 | detail | 婆罗洲纹身=日记；毛利纹身=社会地位 | — |
| ¶7 | detail | 缅甸颈环=优雅；印尼磨牙=文化身份 | — |
| ¶8 | **key** | 总结：人类改变外貌的深层原因 | `It appears that` |

### 2.2 文章骨架（三段结构）

```
¶3-4  History     — 跨时间维度（古埃及 → 1600s 欧洲）
¶5-7  Culture     — 跨空间维度（婆罗洲 → 毛利 → 缅甸 → 印尼）
¶8    Conclusion  — "人类改变外貌是为了文化身份，不只是好看"
```

这一结构是 Step 2（Skimming）的核心教学内容。

---

## 3. 课程步骤设计

### 3.0 总览与通用机制

#### 步骤概览

```
Step i0  课前导读      (instruction)  ≈2 min    Orientation
Step 1   图式激活      (task)         ≈5 min    Predicting
Step 2   结构解码      (task)         ≈8 min    Skimming
Step 3   矩阵构建      (task)         ≈15 min   Scanning
Step 4   批判质疑      (task)         ≈12 min   Evaluating
Step 5   复盘升华      (task)         ≈5 min    Synthesizing
                                      ────────
                                      ≈47 min total
```

#### 阶段解锁链

每个 task 步骤内，学生依次经历四个阶段，前一个完成后自动解锁下一个：

```
Listen → Practice → Discuss → Takeaway
```

教师通过 `POST /step` 推进全班步骤，但学生在步骤内的阶段进度是独立的。

#### 通用 Discuss 阶段体验

以下描述适用于所有步骤的苏格拉底讨论阶段，后文各步骤不再重复：

**🧑‍🎓 学生端看到什么**

```
┌──────────────────────────────────────────┐
│  💬 Let's think deeper...                │  ← AI 开场问题（英文）
│                                          │
│  脚手架提示（灰色小字）：                   │  ← 3 个半成品句子，点击可插入输入框
│  · "The writer starts with..."           │
│  · "This creates a feeling of..."        │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ 输入框（支持中英文混合输入）        │    │  ← 回车或点击发送
│  └──────────────────────────────────┘    │
│                                          │
│  ⏱ 剩余 5:00 / 第 1/6 轮                │  ← 状态栏：倒计时 + 轮次
└──────────────────────────────────────────┘
```

- AI 每轮回复 2-3 句英文，只问一个聚焦问题
- 学生可以用中文回答（AI 用英文回复但表示理解了中文内容）
- 讨论过程中，学生可随时点击脚手架提示填入输入框
- AI 检测到学生完全理解 → 回复包含 `[GOAL_REACHED]` + 祝贺 → 自动进入 Takeaway
- 如果 6 轮对话用完 或 5 分钟超时 → **保底选择题**自动弹出（单选，答对答错均进入 Takeaway）

**🍎 教师端看到什么**

- stepMetrics 中 `aiRounds`（本步骤 AI 对话总轮次）、`aiPeople`（使用 AI 的学生数）
- 观察面板中按指标聚合的学生数和最新事件摘要（详见各步骤的观察表）
- `discuss_complete` 系统事件含：`completionType`（goal_reached / fallback_rounds / fallback_time）、`roundsUsed`、`timeUsedSeconds`、`mcCorrect`

**🔬 观察系统如何工作**

每轮 student↔AI 对话自动调用 Observer LLM，对照全局 12 项指标（K1-K6, M1-M6）分析：

```
输入: 全部指标定义 + 该学生已有事件 + 最新一轮对话
输出: { action: skip|update|append, anchors: [K1,M2], gist: "一句话", quote: "原话" }
```

> **注意**：当前 manifest 各步骤未设置 `observe` 字段，所有观察完全依赖全局指标 + Observer LLM 自动判断。后文各步骤中标注的"期望触发指标"是**设计期望**，而非系统强制约束。

**🤖 AI 通用行为规则**

- 绝不直接说出答案
- 每轮只问一个聚焦问题，2-3 句话
- 学生部分正确 → 肯定 + 追问更深层
- 学生卡住 → 缩小范围或给小线索
- 使用简单英语（中国高中生水平）
- 检测到学生完全理解 → `[GOAL_REACHED]` + 简短祝贺

#### 通用 Takeaway 阶段体验

**🧑‍🎓 学生端看到什么**

```
┌──────────────────────────────────────────┐
│  🎯 核心洞察                              │
│  ───────────────────────────────          │
│  "文章用冲突开头..."                       │  ← 当前步骤的核心洞察文本
│                                          │
│  ✅ 你已完成本步骤                         │
│                                          │
│  [继续对话 💬]   [等待老师进入下一步 ⏳]    │  ← 可选延续对话或等待
└──────────────────────────────────────────┘
```

- "继续对话"进入 Continue Chat 模式（AI 可以自由讨论，直接给答案和解释）
- 教师推进步骤后，学生自动进入下一步的 Listen 阶段

---

### 3.1 Step i0 — 课前导读（Orientation）

**类型**：instruction（无练习，无 Discuss/Takeaway）

**🧑‍🎓 学生端**

- 屏幕展示策略总览卡：4 种阅读策略图标 + 简短描述
- TTS 朗读策略说明（可暂停/回放）
- 底部提示："不需要逐字阅读——策略帮助你用更少的阅读获取更多信息"
- 不用担心生词——关注信号词和结构
- 准备好后点击 "I'm ready, let's go" → 自动进入 Step 1

**🍎 教师端**

- 学生自主学习中，无需干预
- 仪表盘显示已准备/未准备人数

---

### 3.2 Step 1 — 图式激活（Predicting）

**策略**：Predicting — 通过标题和首段激活先验知识 | **聚焦段落**：¶1-2

#### Listen 阶段

**🧑‍🎓 学生端**：TTS 朗读策略说明 + 文字卡片展示 Predicting 核心公式（标题 + 首段 → 激活已知）。寻找冲突：两种对立的审美观。"不要逐字读——只需要足够的信息形成预测。"

**🍎 教师端**：等待学生自行学习。cueCards 显示教学要点和话术参考。

#### Practice 阶段 — quiz（3 道选择题）

**🧑‍🎓 学生端看到什么**

- 3 道单选题依次呈现，每题 4 个选项
- 选择后点击"提交"→ 即时反馈（✅ 正确 / ❌ 错误）
- 答错时：先显示 `hint`（引导定位原文），仍答错可查看 `walkthrough`（完整解题过程）
- 全部完成后自动进入 Discuss 阶段

| # | 问题 | 正确答案 | 考查点 |
|---|------|----------|--------|
| Q1 | What did Happiness Edem do to become "beautiful"? | B — Gained weight in a fattening room | ¶1 细节提取 |
| Q2 | What kind of beauty does modern media promote? | C — Slim and fair-skinned | ¶2 细节提取 |
| Q3 | What is the writer's main question? | B — Is one idea of physical beauty really more attractive than another? | ¶2 核心问题识别 |

**🍎 教师端看到什么**

- stepMetrics：Q1/Q2/Q3 各题正确率（byDimension）
- alertTag：如 "Q1 错误偏高" 或 "7 人Q1 选了 C（应为 B）"
- walkthrough 使用率统计

**🔬 观察**：练习提交 → `exercise_result` 系统事件，含 score 和各维度得分。

#### Discuss 阶段 — 苏格拉底讨论

**🧑‍🎓 学生端看到什么**

AI 开场问题：
> You've just read about Happiness Edem and modern media. Why do you think the writer chose to start the text with these two very different examples? What effect does that create?

脚手架提示：
- "The writer starts with..."
- "This creates a feeling of..."
- "The reader might wonder..."

保底选择题（6 轮/5 分钟后触发）：
- Why does the writer start with the story of Happiness Edem and then mention modern media beauty standards?
- 正确答案：B — To create a conflict that makes readers question whether one beauty standard is better than another

**学习目标**：学生认识到作者刻意用两种对立审美标准开头（冲突开场），引发读者质疑是否存在唯一正确的审美标准。

**🍎 教师端 + 🔬 观察**

| 期望触发指标 | 学生信号 | 教师仪表盘呈现 |
|-------------|---------|---------------|
| **K1** 冲突识别与预测 | 说出 "两个对立的例子"、"conflict"、"让读者思考" | ✅ 观察事件：`gist: "识别了¶1-2的对立结构"` |
| **M1** 字面理解局限 | 把 fattening room 理解为健康问题而非文化习俗 | ⚠️ 告警：`"张三 出现误解信号（字面理解局限）"` |
| **M4** 观点事实不分 | 把 ¶2 "shallow beauty ideals" 当作全文结论 | ⚠️ 告警：`"李四 出现误解信号（观点事实不分）"` |

#### Takeaway 阶段

**核心洞察**：文章用"冲突开头"——先给两个对立事实，再提出问题。这是议论文常见写法。

---

### 3.3 Step 2 — 结构解码（Skimming）

**策略**：Skimming — 只读每段首句 + 信号词，3 分钟拿到文章骨架 | **聚焦段落**：¶1-8（全文）

#### Listen 阶段

**🧑‍🎓 学生端**：TTS + 文字卡片展示核心公式：首句 + 信号词 = 段落功能。信号词示例：`change over time` → 历史，`different cultures` → 文化，`It appears that` → 结论。

#### Practice 阶段 — select-evidence（段落功能匹配 + 文本证据圈选）

**🧑‍🎓 学生端看到什么**

- 屏幕左侧：课文全文（8 段），可点击的词元高亮交互
- 屏幕右侧：3 个功能卡片（History / Culture / Conclusion）
- 操作：① 为每个区段选择正确的功能标签 ② 在文本中圈选支撑证据（信号词）
- 圈选到 `evidence` 词元 → 绿色高亮 ✅
- 圈选到 `distractor` 词元 → 橙色提示"这是细节不是信号词"
- 每个词元附有 `why` 解释，错选时显示

**三个区段**：

| 区段 | 段落 | 正确功能 | 关键信号词 |
|------|------|----------|-----------|
| ¶3-4 | p3-p4 | History | `change over time`, `different periods of history`, `Egyptian paintings`, `the early 1600s` |
| ¶5-7 | p5-p7 | Culture | `different cultures around the world`, `Borneo`, `New Zealand's Maoris`, `Myanmar`, `Indonesia` |
| ¶8 | p8 | Conclusion | `It appears that`, `show social position or display group identity`, `Whether it is... or...` |

> 注：select-evidence 使用客户端评分（`correctFunction`、`hint`、`aiCorrect`/`aiPartial` 保留在发给学生的数据中），服务端 `/submit` 作为最终评分来源。

**🍎 教师端看到什么**

- stepMetrics：各区段功能判断正确率
- byDimension 中区分功能判断 vs 证据圈选维度

**🔬 观察**：自动生成 `{section}_func` 维度。

#### Discuss 阶段 — 苏格拉底讨论

**🧑‍🎓 学生端看到什么**

AI 开场问题：
> You matched the sections to their functions. But here's a deeper question: why does the writer put History BEFORE Culture? Could the order be reversed? What would change?

保底选择题：Why does the writer discuss History before Culture? → C — To build a stronger argument: beauty changes across time AND place

**学习目标**：理解作者刻意的文章编排——History（时间维度）在前、Culture（空间维度）在后，层层递进使论证更有说服力。

**🍎 教师端 + 🔬 观察**

| 期望触发指标 | 学生信号 | 教师仪表盘呈现 |
|-------------|---------|---------------|
| **K2** 信号词与文章结构 | 能解释 History 在 Culture 前的原因（时间→空间，层层递进） | ✅ `gist: "理解了三段结构的刻意编排"` |
| **M2** 信号词辨识困难 | 混淆时间信号词和地点信号词，把 ¶5-7 归为 History | ⚠️ 告警：`"混淆时间/地点信号词"` |

> **教师动作建议**：如果大量学生触发 M2，说明信号词教学需要加强；可通过 quickAction「信号词提示」发全班广播。

#### Takeaway 阶段

**核心洞察**：文章结构是刻意的——历史(时间) + 文化(空间) = 审美不是普适的。层层递进比罗列更有说服力。

---

### 3.4 Step 3 — 矩阵构建（Scanning）

**策略**：Scanning — 带着具体问题阅读，定向提取信息 | **聚焦段落**：¶3-7

#### Listen 阶段

**🧑‍🎓 学生端**：TTS + 文字卡片。Scanning ≠ Skimming：这次是带着目标精读，像查字典一样定向搜索。目标是构建 Place × Practice × Reason 三维矩阵。

#### Practice 阶段 — matrix（信息矩阵填写）

**🧑‍🎓 学生端看到什么**

- 屏幕上方：课文 ¶3-7 文本（可翻看）
- 屏幕下方：矩阵表格（Demo 行 + 学生练习行）
- Demo 行（Ancient Egypt）已预填，供参考
- **practiceCount**（本课设为 3）：每位学生从 5 个非 Demo 行中随机抽取 3 行作为练习（基于 studentId 哈希的确定性子集，确保同一学生每次看到相同行）。未被选中的行以"额外示例"形式只读展示
- 每行配有 **paraRef**（段落引用），点击📍按钮可自动滚动到对应课文段落（如 `paraRef: [4]` → 定位到 ¶4）
- 支持自定义占位提示：**whatPrompt**（如"What body type?"）和 **whyPrompt** 替代默认的 "What did they do?" / "Why?"
- 行按顺序解锁：完成当前行后才显示下一行
- 每个空格点击后弹出文本输入框
- 卡住时点击 💡 图标查看 hint（定位关键短语）
- 提交后每个格子显示 ✅ / ❌ + 修正建议

| 行 | Place (Where) | Practice (What) | Reason (Why) | 来源 |
|----|-------|----------|--------|------|
| **Demo** | Ancient Egypt | slim dark-haired women in paintings | beauty ideal / normal practice | ¶3 |
| 1 | 1600s Europe | plump and pale-skinned | wealth | ¶4 |
| 2 | Borneo | tattoos | diary of events | ¶6 |
| 3 | NZ Maori | tattoos | position in society | ¶6 |
| 4 | Myanmar | metal neck rings | elegance | ¶7 |
| 5 | Indonesia | sharpened teeth | cultural identity | ¶7 |

**🍎 教师端看到什么**

- stepMetrics 中 byDimension：Where / What / Why 三列正确率
- 易错点提示卡（cueCards）：
  - ¶6 Maori：Practice 应写 "tattoos" 不是 "tā moko"（课文原文）
  - ¶7 含两个国家（Myanmar + Indonesia），常被误合并为一行
- alertTag 示例："Why 列错误偏高"

**🔬 观察**：`exercise_result` 事件 + 自动生成 `place`/`practice`/`reason` 维度。

#### Discuss 阶段 — 苏格拉底讨论

**🧑‍🎓 学生端看到什么**

AI 开场问题：
> Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about "looking good"? Or is something deeper going on?

**学习目标**：从矩阵的 Reason 列归纳共性——这些审美实践不只关乎外表，而是反映身份（Indonesia）、社会地位（Maori、Elizabethan England）、人生记录（Borneo）、文化价值观（Myanmar）。美是一种"文化语言"。

**🍎 教师端 + 🔬 观察**

| 期望触发指标 | 学生信号 | 教师仪表盘呈现 |
|-------------|---------|---------------|
| **K3** 矩阵信息定向提取 | （主要在练习阶段触发，讨论中体现为引用矩阵数据） | 练习评分：Where/What/Why 正确率 |
| **K4** 审美深层规律洞察 | 说出 "not just about looking good"、"identity"、"cultural language" | ✅ `gist: "归纳出审美是文化语言，不只是外表"` |
| **M3** 跨文化细节张冠李戴 | 把 Borneo 纹身说成 Maori 的，或混淆 Myanmar/Indonesia | ⚠️ 告警：`"跨文化细节混淆"` |

> **教师动作建议**：矩阵练习中如果 Reason 列错误率高，说明学生只在做信息提取，未深入理解文化含义——教师应在讨论前用 quickAction 提示"关注 Why 列"。

#### Takeaway 阶段

**核心洞察**：审美是一种文化语言——身份、地位、归属感。不只是"好看"。

---

### 3.5 Step 4 — 批判质疑（Evaluating）

**策略**：Evaluating — 用文本证据形成自己的批判性判断 | **聚焦段落**：¶2、¶8

#### Listen 阶段

**🧑‍🎓 学生端**：TTS + 策略说明卡片：
- 区分观点和事实：¶2 "many people are worried that... shallow beauty ideals" 是**他人观点**，不是作者结论
- 用矩阵证据判断：这些审美实践真的"肤浅"吗？
- 议论段模板：立场 → 证据（至少 2 条） → 推理

#### Practice 阶段 — map（二维平面拖拽 + 理由阐述）

**🧑‍🎓 学生端看到什么**

- 屏幕中央：二维坐标平面
  - X 轴：Just appearance ←→ Cultural meaning（"为什么做？"）
  - Y 轴：Temporary ←→ Permanent（"持久性如何？"）
- 屏幕底部：7 个可拖拽的审美实践芯片
- 操作：① 拖拽芯片到平面上合适位置 ② 每个芯片点击后弹出文本框，写理由（≥8 字）
- 提交后显示：每个 item 的位置评分 + AI 逐项评语

**7 个芯片**：

| ID | 标签 | 参考位置 (x, y) | 来源 |
|----|------|----------|------|
| kohl | Egyptian kohl | (0.55, -0.2) | ¶3 |
| plump | 1600s plump & pale | (-0.4, -0.5) | ¶4 |
| borneo | Borneo tattoos | (0.7, 0.85) | ¶5 |
| maori | Maori tā moko | (0.85, 0.9) | ¶6 |
| rings | Myanmar neck rings | (0.55, 0.55) | ¶7 |
| teeth | Indonesia teeth | (0.6, 0.8) | ¶7 |
| media | Modern media slim | (-0.7, -0.7) | ¶2 |

**评分机制（双分制）**：

1. **规则评分**（70%）：位置得分（欧氏距离）+ 完成度得分（是否放置 + 是否写理由）
2. **LLM 评分**（30%）：AI 评估每条理由的相关性 + 是否引用课文
3. **最终得分**：`0.7 × ruleScore + 0.3 × aiScore`

**🍎 教师端看到什么**

- stepMetrics 中每个 item 的 3 个自动维度：`{id}_placed`、`{id}_reasoned`、`{id}_positionScore`
- 告警规则：放置率 < 30% 或 理由缺失率 > 30% 或 位置偏差均分 < 30%
- LLM 评语（`llmFeedback` + `llmItems`）显示在 surfaces 面板
- **关键观察**：如果多个学生把 "Modern media slim" 放在了 Cultural meaning 端 → 对"肤浅"理解不到位

**🔬 观察**：`exercise_result` 事件 + 每 item 3 个自动维度。

#### Discuss 阶段 — 苏格拉底讨论

**🧑‍🎓 学生端看到什么**

AI 开场问题：
> The writer calls modern media beauty standards "shallow." That's a strong word. Do you think it's fair? What would make a beauty standard "deep" instead of "shallow"?

保底选择题：Why does the writer call modern media beauty standards "shallow"? → B — Because media only promotes one physical standard and ignores the cultural meanings of beauty

**学习目标**：用文本证据构建论证——现代媒体审美"肤浅"是因为它推崇单一外表标准（纤瘦、白皙），忽视了审美在不同文化中承载的丰富含义（身份、地位、价值观）。"深刻的"审美标准应承认美反映文化、历史和身份，而不只是外表。

**本步骤 AI 特别规则**：
- 推要求证据："Which example from your matrix supports that idea?"
- 推要求解释："So what does that prove about 'shallow'?"
- 学生只给观点 → 要求文本事实；只给事实 → 要求推理
- 引导构建 claim → evidence → explanation 链

**🍎 教师端 + 🔬 观察**

| 期望触发指标 | 学生信号 | 教师仪表盘呈现 |
|-------------|---------|---------------|
| **K5** 证据支撑的批判立场 | 构建了 claim→evidence→explanation 链，引用 ≥2 条证据 | ✅ `gist: "用 Borneo 和 Maori 证据论证 shallow 不准确"` |
| **M4** 观点事实不分 | 把 "many people are worried" 当作事实 | ⚠️ 告警：`"观点事实不分"` |
| **M5** 无证据空洞论述 | 只给感受（"I think beauty is important"）不引用文本 | ⚠️ 告警：`"无证据空洞论述"` |

> **教师动作建议**：这是本课认知要求最高的步骤。关注：① Map 中 "media" 芯片位置分布 ② 讨论中 M5 频次（空洞论述多 → quickAction 提示"引用矩阵证据"）③ `goal_reached` 比例。

#### Takeaway 阶段

**核心洞察**：观点→证据→解释。"肤浅"意味着忽视文化深度。好的论证需要三者缺一不可。

---

### 3.6 Step 5 — 复盘升华（Synthesizing）

**策略**：Synthesizing — 元认知回顾 + 策略迁移 | **聚焦段落**：¶8

#### Listen 阶段

**🧑‍🎓 学生端**：TTS 朗读 ¶8 + 策略回顾卡片。

#### Practice 阶段 — order（排序题）

**🧑‍🎓 学生端看到什么**

- 4 个可拖拽的策略卡片（乱序呈现）：
  0. Scanning — find specific details
  1. Predicting — read the title, ask questions
  2. Evaluating — form your own judgment
  3. Skimming — find the structure quickly
- 拖拽排列后点击"提交"→ 即时反馈
- 正确顺序：`[1, 3, 0, 2]` → Predicting → Skimming → Scanning → Evaluating

**🍎 教师端看到什么**

- stepMetrics：`correct` 维度（排序是否完全正确）
- 正确率统计

**🔬 观察**：`exercise_result` 事件。

#### Discuss 阶段 — 苏格拉底讨论

**🧑‍🎓 学生端看到什么**

AI 开场问题：
> Imagine your friend missed today's class and asks: "How did you manage to read such a long English article?" How would you explain your reading process step by step?

**学习目标**：能说出并解释 4 步阅读策略的顺序和目的，并理解这个过程可迁移到任何议论文/说明文。

**🍎 教师端 + 🔬 观察**

| 期望触发指标 | 学生信号 | 教师仪表盘呈现 |
|-------------|---------|---------------|
| **K6** 四步策略元认知 | 按顺序说出 4 步并解释目的，提到"可迁移" | ✅ `gist: "能复述四步策略并理解迁移性"` |
| **M6** 阅读策略混用 | 混淆 skimming 和 scanning，说不出顺序意义 | ⚠️ 告警：`"阅读策略混用"` |

> **教师动作建议**：这是复盘步骤，重点不是答题正确率，而是元认知能力。M6 频繁触发 → 前 4 步策略教学需在后续课程中加强。

#### Takeaway 阶段

**核心洞察**：预测→略读→寻读→评价。适用于任何议论文的可迁移阅读方法。

### 3.7 观察指标的步骤分布总览

| 步骤 | 主要 K 指标 | 主要 M 指标 | 说明 |
|------|------------|------------|------|
| Step 1 图式激活 | K1 | M1, M4 | 冲突识别 vs 字面理解/观点事实不分 |
| Step 2 结构解码 | K2 | M2 | 信号词识别 vs 信号词辨识困难 |
| Step 3 矩阵构建 | K3, K4 | M3 | 信息提取 + 深层规律 vs 张冠李戴 |
| Step 4 批判质疑 | K5 | M4, M5 | 证据论证 vs 观点事实不分/空洞论述 |
| Step 5 复盘升华 | K6 | M6 | 策略元认知 vs 策略混用 |

---

## 4. AI 提示词架构

### 4.1 分层上下文（L1-L8）

所有 AI 调用共享前 3 层基础上下文：

```
L1: 角色设定 — 苏格拉底式英语阅读教学助教
L2: 课文全文 — 标题 + 8 段全文（¶1-¶8）
L3: 当前步骤 — 步骤名、策略、描述、聚焦段落
```

#### 4.1.1 学生提问（/ai/ask）

```
L1-L3: 基础上下文
L4:    答案信息（知道但严禁告诉学生）
L5:    参考问答示例（few-shot，5 条）
L6:    分类指令 — 回答必须以【分类名】开头
       可用分类：概念理解、阅读策略、课文内容、解题求助
L7:    回答规则 — 中文、2-3 句、≤150 字、鼓励思考
```

**分类回答策略**：
| 分类 | 策略 |
|------|------|
| 概念理解 | 直接解释，给清晰定义和例子 |
| 阅读策略 | 给步骤指导，用课文例子说明 |
| 课文内容 | 引用原文段落回答 |
| 解题求助 | 苏格拉底式引导，绝不给答案 |

#### 4.1.2 苏格拉底讨论（/ai/discuss）

```
L1-L3: 基础上下文
L4:    学生练习表现（总分 + 各维度得分）
L4.5:  先前观察上下文（该学生在前序步骤的误解记录）
L5:    Manifest 中的 discuss.systemPrompt（覆盖 L1 的通用角色）
```

每个步骤的 `discuss.systemPrompt` 是高度定制的：
- 明确写出学习目标（LEARNING GOAL）
- 定义具体的引导规则（RULES）
- 指定 `[GOAL_REACHED]` 信号触发条件

#### 4.1.3 延续对话（Continue Chat）

```
L1:    角色覆写 — 答案已揭晓，可以自由讨论
L2-L3: 基础上下文
L4:    正确答案（完整 answerKey，可直接引用）
L5:    解析 + 核心洞察
L6:    回答规则 — 直接解释，≤200 字
```

### 4.2 LLM 配置

```env
LLM_API_KEY=...
LLM_MODEL=deepseek-v4-flash        # 默认模型
LLM_OBSERVER_MODEL=deepseek-v4-flash  # 观察 LLM
LLM_BASE_URL=https://api.deepseek.com
```

### 4.3 参考问答（Few-shot Examples）

| 问题 | 分类 | 回答要点 |
|------|------|----------|
| 什么是 skimming？ | 概念理解 | 快速阅读策略，浏览标题、首句和关键词 |
| signal words 有什么用？ | 阅读策略 | 判断段落功能和结构的路标 |
| Nigeria 的审美观是什么？ | 课文内容 | 引用 ¶1 原文 |
| 第3题的结构怎么分？ | 解题求助 | 苏格拉底引导，不给答案 |
| evaluating 策略怎么用？ | 阅读策略 | 批判性思考——问自己是否同意 |

---

## 5. 练习题型与评分

### 5.1 本课使用的 4 种题型

| 步骤 | 题型 | 评分维度 | 自动观测维度 |
|------|------|----------|-------------|
| Step 1 | quiz（选择题） | `q0`, `q1`, `q2` → Q1, Q2, Q3 | 每题正确/错误 |
| Step 2 | select-evidence（证据圈选） | 每区段功能判断 + 证据选择 | `{section}_func` 功能判断 |
| Step 3 | matrix（信息矩阵） | `place`(Where), `practice`(What), `reason`(Why) | 三维正确率 |
| Step 4 | map（二维平面拖拽） | 每 item 的放置/理由/位置得分 | `{id}_placed`, `{id}_reasoned`, `{id}_positionScore` |
| Step 5 | order（排序题） | `correct`（顺序是否正确） | 正确/错误 |

**通用字段**：

- **paraRef**（`number[]`，可选）：段落引用，标注题目/行对应的课文段落编号。前端渲染为📍定位按钮，点击后自动滚动到对应段落并高亮 5 秒。适用于 quiz、match、matrix 题型
- **practiceCount**（`number`，可选，matrix 专用）：从非 Demo 行中随机抽取的练习行数。基于 studentId 哈希确保每位学生看到确定性子集，未选中的行以只读示例展示
- **whatPrompt / whyPrompt**（`string`，可选，matrix 专用）：自定义输入框占位提示，替代默认的 "What did they do?" / "Why?"

### 5.2 评分结果结构

```typescript
interface GradeResult {
  total: number;              // 0-100%
  byDimension: Record<string, boolean | number>;  // 各维度得分
  attemptCounts?: Record<string, number>;          // 各维度尝试次数
  llmFeedback?: string;       // AI 整体评语（map 题型）
  llmItems?: Array<{          // AI 逐项评语（map 题型）
    index: number;
    relevant: boolean;
    reason: string;
  }>;
}
```

### 5.3 Walkthrough（答题引导）

quiz 题型的每道题配有两级提示：
1. **Hint**（练习中可查看）：引导学生定位原文关键句
2. **Walkthrough**（答错后展示）：完整解题过程，标注关键词和推理链

---

## 6. 观察指标体系

### 6.1 知识指标（K-indicators）

| ID | 标签 | 描述 |
|----|------|------|
| K1 | 冲突识别与预测 | 识别 ¶1-2 对立观点，理解冲突开头的写作意图 |
| K2 | 信号词与文章结构 | 通过首句信号词识别三段结构，区分时间词和地点词 |
| K3 | 矩阵信息定向提取 | 用 scanning 从 ¶3-7 提取 Place×Practice×Reason 三维信息 |
| K4 | 审美深层规律洞察 | 从 Reason 列归纳：审美是文化身份/社会地位/财富的表达 |
| K5 | 证据支撑的批判立场 | 对 "shallow beauty ideals" 形成有据立场，引用 ≥2 条证据 |
| K6 | 四步策略元认知 | 理解策略顺序和迁移性 |

### 6.2 误解指标（M-indicators）

| ID | 标签 | 描述 |
|----|------|------|
| M1 | 字面理解局限 | 把 fattening room 当健康问题、不理解比喻义 |
| M2 | 信号词辨识困难 | 无法区分时间信号词和地点信号词，混淆 History/Culture |
| M3 | 跨文化细节张冠李戴 | 把 A 文化的做法归给 B 文化 |
| M4 | 观点事实不分 | 把 "many people are worried" 当作作者结论 |
| M5 | 无证据空洞论述 | 只给个人感受不引用文本证据 |
| M6 | 阅读策略混用 | 混淆 skimming 和 scanning，不理解策略顺序意义 |

### 6.3 LLM 观察流水线

每轮学生-AI 对话触发观察 LLM 分析：

```
输入: 指标定义 + 已有事件日志 + 最新一轮对话
输出: {
  action: "skip" | "update" | "append",
  anchors: ["K1", "M2"],    // 触发的指标 ID
  gist: "一句话事实描述",
  quote: "学生原话" | null
}
```

**规则**：
- `skip`：本轮对话无可观察的学习信号
- `update`：更新已有事件（同一指标，新信息）
- `append`：新增一条观察事件
- gist 必须事实性、无判断、≤30 词
- 温度 0.3，response_format: json_object

### 6.4 系统事件

除 LLM 分析外，系统自动记录以下事件：

| 事件类型 | 触发时机 | 数据字段 |
|----------|----------|----------|
| `exercise_result` | 练习提交 | score, data |
| `discuss_complete` | 讨论完成 | completionType, method, roundsUsed, timeUsedSeconds, mcCorrect |
| `continue_chat_turn` | 延续对话 | message content |
| `idle_timeout` | 学生 > 3 分钟无活动 | — |
| `step_complete` | 步骤完成 | — |

### 6.5 学生状态推导

```
idle       ← 最后活跃时间 > 3 分钟
stuck      ← 近 5 分钟内 ≥3 条 M-indicator 事件（且 K 事件未抵消）
struggling ← 有 M-indicator 但未达 stuck 阈值
cruising   ← 练习正确率 ≥80% 且对话轮次 ≤2
active     ← 其他情况
```

---

## 7. 教师端仪表盘

### 7.1 健康卡片（4 张）

| 卡片 | 含义 | 数据来源 |
|------|------|----------|
| Furthest Step | 最快学生在哪一步 + 人数 | `students[].currentTask` |
| Median Step | 全班中位步骤 | 中位数计算 |
| Stuck Count | 卡住学生数 + 集中位置 | `status === 'stuck'` |
| AI Total | AI 对话总轮次 + 使用人数 | `ai_questions` 表 |

### 7.2 步骤卡片

每个 task 步骤一张卡片，包含：

- **步骤名 + 策略名**
- **完成率**（已提交/总人数）
- **平均得分**
- **各维度正确率**（byDimension 柱状图）
- **用时统计**（平均/中位，秒 → m:ss 格式）
- **AI 统计**（本步骤对话轮次 + 使用人数）
- **告警标签**（alertTag）：
  - 优先级 1：≥5 人卡住 → "5 人卡住"
  - 优先级 2：某维度错误率 ≥30% → "Q1 错误偏高"
  - 优先级 2.5：某维度 walkthrough 使用率 ≥50% → "Q1 半数需提示"
  - 优先级 3：具体错误模式（≥2 人相同错误） → "7 人Q1 选了 C（应为 B）"
- **问题聚合**（questionAggregates）：
  - 按分类统计学生 AI 提问频次
  - `isHigh` = 同分类 ≥4 人提问

### 7.3 教师操作

每个步骤的 `teacherView` 包含：

- **speechLine**：教师话术参考
- **quickActions**（快捷操作按钮）：
  - 💡 提示按钮 — 发送全班提示
  - ⏱ "再给 2 分钟" — 倒计时提醒
  - 📝 词汇/策略提示 — 针对性指导
- **cueCards**（教学提示卡）：
  - 当前步骤教学要点
  - 易错点提醒
  - 过渡到下一步骤的引导语

### 7.4 渐进式信息披露

```
卡片摘要 → 悬停看维度分布 → 点击看学生答案分布 → 点学生看完整历史
```

---

## 8. 个性化反馈（Personal Touch）

### 8.1 策略标签

| taskIdx | 策略 | Emoji |
|---------|------|-------|
| 1 | Predicting | 🔮 |
| 2 | Skimming | 👁 |
| 3 | Scanning | 🎯 |
| 4 | Evaluating | ⚖️ |

### 8.2 反馈等级

| 等级 | 最低分 | 标签 | 英文 | 视觉风格 |
|------|--------|------|------|----------|
| 金 | 85% | 策略达人 | Strategy Master | gold |
| 蓝 | 60% | 进步可期 | Getting There | blue |
| 灰 | 0% | 继续加油 | Keep Practicing | neutral |

### 8.3 AI 个性化评语

**生成规则**：
- 计算 4 个 task 步骤的平均得分 → 匹配最高适用等级
- AI 生成 3-5 句话（≤150 字）个性化评语
- 先肯定优点（最高分策略），再给一条具体建议（最低分策略）
- 鼓励语气，温暖真诚
- 不用"同学"称呼，直接用"你"

**降级处理**：AI 调用失败 → 使用默认文案"你完成了所有阅读策略练习，继续保持！"

---

## 9. 拓展阅读（Bonus Content）

### 9.1 拓展文章

**标题**：Beyond the Plate: Decoding Table Manners

**段落**：

| ID | 角色 | 内容 |
|----|------|------|
| bp1 | introduction | 每种文化都有餐桌礼仪的潜规则 |
| bp2 | example | 日本：吸面条声音大是对厨师的赞美 |
| bp3 | example | 印度/中东：用手吃饭是传统 |
| bp4 | example | 西方：吃光盘中食物是礼貌 |
| bp5 | conclusion | 餐桌礼仪和审美标准一样，没有放之四海而皆准的"正确" |

### 9.2 拓展练习

**解锁条件**：教师已推进到 Step 5（`currentStep < 5`）

| 步骤 | 题型 | 策略 | 内容 |
|------|------|------|------|
| 101 | match（结构匹配） | Skimming (Transfer) | 将 5 段匹配到 Introduction / Example / Conclusion |
| 102 | matrix（信息矩阵） | Scanning (Transfer) | 填写 Culture × Custom × Meaning 矩阵 |

**设计意图**：验证 4 步阅读法的迁移性——用一篇全新的文章（餐桌礼仪 vs 审美标准），让学生自主运用今天学到的 Skimming 和 Scanning 策略。

---

## 10. 会话与数据模型

### 10.1 会话生命周期

```
创建会话  →  开始  →  学生加入  →  [练习/对话/提交]  →  结束
POST /sessions  POST /start  POST /join   POST /submit etc.   POST /end
                 ↓                                              ↓
          观察引擎初始化                                   观察数据持久化
          (initSession)                                   (cleanupSession)
```

每次运行创建一个 **ClassroomSession**，分配 6 位随机码（如 `HX3KM7`）。同一课程可并发运行多个实例。

### 10.2 数据表

| 表 | 用途 |
|----|------|
| `lessons` | 课程清单 + manifest_json（完整 manifest） |
| `classroom_sessions` | 会话记录（code, lessonId, status, currentStep） |
| `reading_students` | 学生记录（sessionId, name, currentTask, currentPhase） |
| `reading_submissions` | 答题记录（step, dataJson, scoreJson, submittedAt） |
| `ai_questions` | AI 提问记录（step, question, answer, category） |
| `chat_messages` | 对话线程持久化（threadId, role, content, seq） |
| `observation_events` | 观察事件持久化（anchors, gist, quote, source） |
| `classroom_snapshots` | 教室状态快照（用于时间线回放） |

### 10.3 累积时间线

```json
"cumulativeMinutes": [0, 2, 7, 9, 17, 19, 34, 37, 49, 51, 56]
```

每个数字对应一个步骤阶段的累积时间（分钟），用于时间线回放和节奏把控。

---

## 11. 投屏黑板（Board）

### 11.1 步骤布局

每个步骤有独立的板书布局：

| 步骤 | 列结构 | 说明 |
|------|--------|------|
| Step 1 图式激活 | 现象(cool) / 对照(warm) / 悬念(accent) | 核心问句 + 媒体 vs 现实对比 |
| Step 2 结构解码 | 信号词(cool) / 骨架(accent) | 三段结构可视化 |
| Step 3 矩阵构建 | 矩阵(neutral) / 学生答题(warm) | 实时矩阵对比 |
| Step 4 批判质疑 | 论点(cool) / 立场(accent) / 评分点(muted) | 议论段模板 |
| Step 5 复盘升华 | 方法(cool) / 文本(muted) / 主题(accent) | 策略总结 + ¶8 主旨 |

### 11.2 板书块类型

- `heading`：步骤标题
- `quote`：课文引用（高亮关键词）
- `compare`：对比卡（如 Modern Media vs Real Cultures）
- `annotation`：教师批注（aha / note）

---

## 12. 容错与降级

| 故障点 | 降级策略 |
|--------|----------|
| LLM API 不可用 | 显示预写默认消息（如"AI 暂时不可用"） |
| 无效练习类型 | grader 返回 null，视为未完成 |
| 学生 > 3 分钟无活动 | 标记为 idle，教师端显示告警 |
| 讨论轮次/时间用完 | 自动触发保底选择题 |
| 对话历史截断 | 返回可用子集，记录警告 |
| JSON 解析失败 | LLM 修复尝试（重新调用 LLM 修正 JSON）→ 仍失败则使用原始文本 |
| 个性化评语生成失败 | 使用默认鼓励文案 |

---

## 13. 音频资源

课程配有完整的 TTS 音频（含正常语速和慢速两版）：

- 课文朗读：`p1.mp3` ~ `p8.mp3`（8 段 × 2 版 = 16 文件）
- 课程介绍：`lesson-intro.mp3`、`lesson-summary.mp3`
- 各步骤引导：`step-{id}-intro.mp3`、`step-{id}-summary.mp3`

---

## 14. 关键 API 端点

| 方法 | 路由 | 用途 |
|------|------|------|
| POST | `/api/classroom/sessions` | 创建会话 |
| POST | `/api/classroom/sessions/:code/start` | 开始会话（初始化观察引擎） |
| POST | `/api/classroom/:code/join` | 学生加入 |
| POST | `/api/classroom/:code/submit` | 提交答案 → 评分 + 广播 |
| GET | `/api/classroom/:code/state` | 完整教室状态（含 stepMetrics + healthCards） |
| GET | `/api/classroom/:code/stream` | SSE 实时推送 |
| POST | `/api/classroom/:code/step` | 教师推进步骤 |
| POST | `/api/classroom/:code/ai/ask` | 学生 AI 提问 |
| POST | `/api/classroom/:code/ai/discuss` | 苏格拉底讨论轮次 |
| POST | `/api/classroom/:code/ai/discuss-complete` | 标记讨论完成 |
| POST | `/api/classroom/:code/personal-touch` | 获取个性化反馈 |
| GET | `/api/classroom/:code/bonus/:step/exercise` | 拓展练习规格 |
| POST | `/api/classroom/:code/bonus/:step/check` | 检查拓展练习答案 |

---

## 15. 设计总结

Ideal Beauty 课是一个**紧密集成的教学系统**，将：

1. **结构化阅读**（8 段文章 + 6 步阶梯 + 丰富元数据）
2. **多样化练习**（5 种题型，自动评分 + 自动生成观测维度）
3. **苏格拉底 AI 对话**（目标驱动，含保底选择题安全网）
4. **实时观察系统**（LLM 分析 + 结构化指标 → 教师可操作的告警）
5. **个性化反馈**（基于个人表现的分级 AI 评语）
6. **策略迁移验证**（拓展阅读 "Beyond the Plate" 复用同一方法）

融合为一个完整的 45 分钟课堂体验。

所有课程数据由**单一 manifest.json 驱动**（2200+ 行），**严格 Zod 类型校验**，**全链路可观测**（每次交互均记录用于分析）。教师仪表盘提供**渐进式洞察**：从全班健康概览到个人误解检测。
