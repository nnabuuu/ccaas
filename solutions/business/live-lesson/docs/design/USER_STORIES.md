# User Stories — Live Lesson 阅读策略课

> 课型：高一英语阅读策略训练（B7U2 "Ideal Beauty"）
> 三端联动：教师控制台 (MacBook) + 学生端 (iPad) + 投屏黑板 (教室投影)

## 状态图例

| 标记 | 含义 |
|------|------|
| ✅ Done | 端到端验证通过（harness 100/100） |
| ⚠️ Partial | UI 完成但功能受限（标注具体限制） |
| 🔲 Stub | 仅 UI 占位，后端未实现 |
| 📋 Backlog | 未开发 |

---

## 角色定义

| 角色 | 设备 | 入口 | 核心目标 |
|------|------|------|----------|
| **教师 (Teacher)** | MacBook / 大屏 | `/teacher/:lessonId` | 用 4 种阅读策略引导全班 45 分钟阅读课，实时掌握学情，按节奏推进 |
| **学生 (Student)** | iPad / 笔记本 | `/student/:lessonId` | 跟随教师节奏，逐步完成 5 个阅读任务，在课文中寻找证据并提交答案 |
| 演示者 (Demo) | 任意 | `/demo/:lessonId` | 教研展示 / 公开课场景，同屏展示三端并控制节奏（非日常使用） |

---

## 一、学生 User Stories

### US-S1: 加入课堂 ✅ Done

**As a** 学生，
**I want to** 输入姓名一键加入课堂，
**so that** 我能快速进入学习状态，不需要账号注册。

**验收标准：**
- 打开页面看到课程标题 "Ideal Beauty — 阅读策略训练" 和姓名输入框
- 输入姓名后点击"加入课堂"或按 Enter 即可加入
- 加入过程显示"加入中..."，成功后直接进入课堂
- 刷新页面不需要重新加入（localStorage 持久化）
- 同一姓名重复加入返回相同身份（幂等 join）
- 空姓名提交被拒绝，显示错误提示

**数据流：** `POST /classroom/:lessonId/join { name }` → `{ studentId, name }` → localStorage

---

### US-S2: 按步骤完成阅读任务 ✅ Done

**As a** 学生，
**I want to** 在每个步骤看到明确的任务指引并提交答案，
**so that** 我能系统地练习 4 种阅读策略（Predicting → Skimming → Scanning → Evaluating）。

**验收标准：**

| 步骤 | 任务 | 交互形式 | 提交数据 |
|------|------|----------|----------|
| Step 1 图式激活 | 扫读 ¶1-2，找核心冲突 | 2 个简答输入框 | `{ q1, q2 }` |
| Step 2 结构解码 | 读首句判断段落结构 | 3 张匹配卡片，每张选 History/Culture/Conclusion | `{ selections: {0,1,2} }` |
| Step 3 矩阵构建 | Scanning ¶5-7 填写比较矩阵 | 4 行 × 2 列表格（Place → Practice + Reason） | `{ matrix: {Borneo, NZ Maori, Myanmar, Indonesia} }` |
| Step 4 批判质疑 | 引用矩阵事实，评价 "shallow beauty ideals" | 自由文本框 | `{ text }` |
| Step 5 复盘升华 | 回顾 4 种策略 + 课后作业 | 只读卡片，无提交 | — |

- 每步有任务标题（中英双语）、操作指引、段落跳转链接
- Step 3 第一行（Ancient Egypt）是教师示范行，标注"示范"，学生只填后 4 行
- 提交按钮状态：待提交 → 提交中... → ✓ 已提交（禁用）
- 重复提交同一步骤会更新答案（upsert）

---

### US-S3: 随时查阅课文原文 ✅ Done

**As a** 学生，
**I want to** 在做任务时随时查看课文全文，关键段落自动高亮，
**so that** 我能快速定位证据，不需要在纸质材料和屏幕间切换。

**验收标准：**
- 课文面板始终可见（左侧主区域），显示全部 8 个段落
- 每步自动聚焦相关段落（如 Step 1 聚焦 ¶1-2），非焦点段落变淡
- 关键段落的信号词（signal words）用高亮标注
- 任务面板中的 ¶N 链接可跳转到对应段落，跳转时有闪烁动画

---

### US-S4: 查看板书结构图 ✅ Done

**As a** 学生，
**I want to** 随时展开/收起板书的缩略预览，
**so that** 我能看到课程整体脉络，知道当前在哪一步。

**验收标准：**
- 左侧 Dock 栏有"板书"按钮，点击展开/收起 BoardDrawer
- BoardDrawer 显示各步骤节点的水平流：已完成步骤显示标题，未到步骤显示"· · ·"
- 节点之间有箭头连接，已过/当前/未来有不同视觉状态
- 教师推进步骤时自动展开 BoardDrawer（step >= 1 时）

---

### US-S5: 获取 AI 助教帮助 ⚠️ Partial

**As a** 学生，
**I want to** 在遇到困难时向 AI 助教提问，获得即时解答，
**so that** 我不用举手等待老师，也不打断课堂节奏。

**验收标准：**
- 左侧 Dock 栏有"助教"按钮，点击展开 AI 面板
- 提供 4 个预设问题芯片（如"什么是关键转折词？""History 和 Culture 怎么区分？"）
- 点击预设问题立即显示问答对
- 每个回答后有反馈按钮："✓ 我明白了" / "? 还不明白"
- 选"还不明白"会给出换一种说法的解释
- 支持自定义输入框提问

**当前限制：** AI 回答为预设静态内容，自定义提问暂无 LLM 后端响应。

---

### US-S6: 跟随教师节奏同步 ✅ Done

**As a** 学生，
**I want to** 当教师推进课堂步骤时，我的界面自动切换到对应步骤，
**so that** 全班保持一致进度，不会迷路。

**验收标准：**
- 教师通过 Demo 编排器推进步骤时，学生端自动切到对应步骤
- StepTabs 实时反映当前步骤（已完成/进行中/未开始）
- 同步通过 postMessage `{ type: 'sync', step: N }` 实现
- 学生也可以手动点击 StepTabs 回看已完成步骤

---

## 二、教师 User Stories

### US-T1: 一览课堂全局 ✅ Done

**As a** 教师，
**I want to** 打开控制台就能看到课堂概况（班级人数、当前步骤、整体进度），
**so that** 我能快速判断课堂状态，不用逐一询问学生。

**验收标准：**
- 顶部环境带显示：班级 "高一(3)班"、课程标题、在线人数（实时 SSE）
- 步骤进度 "Step N/5" 清晰可见
- Step Rail 显示 5 步按钮，当前步骤高亮，每步标注时长（如 "5'"）
- 右侧栏"班级视图"列出所有已加入学生，绿点=有提交，蓝点=仅加入

**数据流：** `GET /classroom/:lessonId/stream` (SSE) → 每次 join/submit 推送完整 ClassroomState

---

### US-T2: 实时掌握提交进度 ✅ Done

**As a** 教师，
**I want to** 实时看到有多少学生已提交当前步骤的答案，
**so that** 我能判断何时推进到下一步（如 80% 提交就可以了）。

**验收标准：**
- Hero Section 右侧显示 "已提交 N / M"（来自 SSE metrics）
- 右侧栏 PulseStats 显示三个实时数据：已提交 / 填写中 / 未开始
- 数据来自 SSE 实时推送，学生每次提交后 1-2 秒内更新
- 不需要手动刷新

---

### US-T3: 查看全班矩阵汇总 ✅ Done

**As a** 教师，
**I want to** 在 Step 3 矩阵构建时，看到全班学生的矩阵答案汇总到一张表，
**so that** 我能发现共性错误，选择典型作品点评。

**验收标准：**
- MatrixCard 显示 5 行表格（Ancient Egypt 示范行 + 4 个地点）
- 列：Place / Practice / Reason
- 学生提交后，对应行从"— 待填"变为学生的答案（聚合首个非空值）
- 表头显示 "live · N/M 提交" 实时标记
- 数据来源：SSE state → `students[].submissions[2].data.matrix` 聚合

---

### US-T4: 获取教学话术提示 ⚠️ Partial

**As a** 教师，
**I want to** 每步看到"下一句该说什么"的台词提示和教学要点卡片，
**so that** 新手教师也能流畅上课，不遗漏关键环节。

**验收标准：**
- SpeechLine 卡片显示当前步骤的"say out loud"英文台词
- 3 张 CueCards 提供教学要点：
  - "示范一行" — 如何用 Ancient Egypt 做 demo
  - "易错点" — 常见学生错误（如 Myanmar 和 Indonesia 写混）
  - "过渡到下一步" — 衔接话术
- 内容随步骤自动切换

---

### US-T5: 控制课堂节奏 ⚠️ Partial

**As a** 教师，
**I want to** 手动推进或回退课堂步骤，
**so that** 我能根据学生实际情况灵活调整节奏。

**验收标准：**
- Step Rail 每步可点击跳转
- 底部操作栏有"← 上一步"和"进入 Step N+1 →"按钮
- 点击后教师页立即切换，通过 Demo 编排器同步到学生端和黑板

**当前限制：**
- 教师页面的步骤切换不直接同步学生端 — 需通过 Demo 编排器中转
- "延长 2 min"和"推送提示给全班"按钮为 UI 占位，未接入后端
- 计时器显示为静态占位（—:—）

---

### US-T6: 查看学生提问队列 🔲 Stub

**As a** 教师，
**I want to** 看到学生通过 AI 助教仍无法解决的问题汇总，
**so that** 我能针对性解答高频困惑，而不是逐一回答相同问题。

**验收标准（目标态）：**
- 右侧栏 Tab "待处理" 显示未解决的学生提问
- 按影响（频次）/时间排序
- 支持搜索和筛选

**当前状态：** Tab 计数均为 0，队列显示"暂无学生提问"。AI 分析聚类功能待实现。

---

## 三、端到端场景 (Epic)

### Epic 1: 一堂完整的 45 分钟阅读课

**前置条件：** 教师打开 Demo 编排器 (`/demo/ideal-beauty-reading`)，学生各自打开学生端 (`/student/ideal-beauty-reading`)。

```
时间线   教师动作                     学生动作                    系统行为
─────────────────────────────────────────────────────────────────────────
0:00    打开控制台，确认人数          输入姓名加入课堂             SSE 推送 join 事件
        看到"30/35 人"                                          教师端人数+1

0:01    Step 1 — 说出台词            看到 Step 1 任务:           黑板显示 Step 1
        "Look at the title..."       扫读 ¶1-2，填 2 个问答       标题 + 预测框

0:05    观察提交进度 "28/35"         提交 { q1, q2 }             SSE 推送 submit
        推进到 Step 2                 自动切到 Step 2              postMessage sync

0:06    Step 2 — "read the first     看到 3 张匹配卡片            黑板显示段落
        sentence of each paragraph"  判断 History/Culture/         首句 + 信号词
                                     Conclusion

0:13    推进到 Step 3                 自动切到 Step 3              黑板显示矩阵

0:14    Step 3 — "Each group         看到矩阵表格:                MatrixCard 开始
        builds a matrix"             Ancient Egypt (示范行)        聚合学生提交
                                     Borneo / NZ Maori /
                                     Myanmar / Indonesia

0:20    查看 MatrixCard               填写 Practice + Reason      SSE 推送每次提交
        发现 Myanmar 行多人写错       遇到困难 → 点"助教"         教师端看到汇总
        → 说出"易错点"提示           获取 AI 解答                 矩阵表实时更新

0:28    推进到 Step 4                 自动切到 Step 4              黑板显示对比图

0:29    Step 4 — "Are these          看到写作框:                  compare block
        really shallow ideals?"      引用矩阵事实写观点            显示 claim vs
                                                                 evidence

0:40    推进到 Step 5                 看到复盘卡片                 黑板显示总结
        "We used 4 strategies"       4 策略回顾 + 课后作业         mindmap block

0:45    下课                          查看作业要求
```

---

## 四、未来 User Stories（Backlog）

> 以下 story 的 UI 占位已存在，但后端未实现。

| ID | Story | 当前状态 | 优先级建议 |
|----|-------|----------|-----------|
| US-T7 | 教师点击"推送提示给全班"，学生端弹出教师提示卡 | 🔲 按钮 UI 存在，无后端 | P1 — 课堂最高频需求 |
| US-T9 | 教师端直接推进步骤同步到学生端（不经过 Demo 编排器） | 🔲 Step Rail 可点击但不同步 | P1 — 日常上课必须，Demo 编排器仅用于教研 |
| US-S7 | AI 助教支持自由提问并返回 LLM 生成的回答 | 🔲 输入框存在，无 LLM 后端 | P2 — 接入 CCAAS Agent Engine |
| US-T10 | 教师端自动聚类学生提问，按频次排序展示 | 🔲 Tab UI 存在，计数为 0 | P2 — 依赖 US-S7 |
| US-T11 | 实时计时器与步骤时长对齐（含延长/暂停） | 🔲 时间显示为 —:— 占位 | P3 — 体验提升 |
| US-T8 | 教师点击"延长 2 min"，所有端计时器同步延长 | 🔲 按钮 UI 存在，计时器为占位 | P3 — 依赖 US-T11 |
