# live-lesson — Ideal Beauty 三端联动 Demo

> 一个高中英语阅读课（B7U2 *Ideal Beauty*）的**三端联动教学原型**：教师控制台 + 学生端 + 投屏黑板。通过"指挥官"顶栏推进课堂步骤，三端同步响应。本仓库是 design → implementation 的交接包。

---

## ⚠️ 不要直接双击 HTML

大多数 HTML 通过 `<script type="text/babel" src="*.jsx">` 加载 JSX 文件，浏览器在 `file://` 协议下会被 CORS 拦截 — 页面会**白屏**或**只渲染骨架**。

**正确打开方式：**

```bash
./serve.sh                 # 一行启动本地 server（默认 8000 端口）
# 然后浏览器打开 http://localhost:8000/index.html
```

可以**直接双击**的文件（自包含 HTML + CSS，无 JSX）：`Architecture Deck.html` / `Pitch Deck.html` / `index.html` / `teacher-guide.html` / `student-guide.html` / `plugin-preview-guide.html` / `guidance-system.html` / `help-patterns.html` / `student-ai-translate.html` / `demo.html`。

其他所有 `Practice*.html` / `Teacher Observation*.html` / `Guided Discovery*.html` / `Lesson Builder.html` / `Architecture Map.html` / `Template Library.html` / `practice-v3.html` 都**必须**通过 server 打开。

---

## 1. 项目定位 · 一句话

**AI as Skill, not Chat** —— 把 AI 嵌进教师的课堂节奏里（5 步阅读策略骨架），不是一个可以"问问题"的聊天框。教师推进一步 → 学生端和投屏黑板同步进入对应状态。

---

## 2. 运行 (本地)

静态站点，无构建：

```bash
# 任意静态服务器即可
npx serve .
# 或
python3 -m http.server 8000
```

打开 `http://localhost:8000/index.html`（launcher）或直接 `/demo.html`（三端联动主视图）。

---

## 3. 文件结构

```
/
├── index.html                    # Launcher — 产品介绍 + 三端入口
├── demo.html                     # ⭐ 主交付：三端联动舞台（指挥官 + featured + filmstrip）
├── surfaces/
│   ├── student-v1.html            # ⭐ 学生端 v1 — 文本优先布局 + Dock 面板 (iPad, 1400×1050)
│   ├── student.html              # 学生端 v0（旧版，保留备用）
│   ├── teacher-v2.html            # ⭐ 课堂观察台 v2 — Step Cards + Journey Strip + 问题聚类 (MacBook, 1600×1000)
│   ├── teacher.html              # 教师端 v0（旧版，保留备用）
│   ├── teacher-v1.html            # 教师端 v1（保留备用）
│   ├── board.html                # 投屏黑板 (Projector, 1400×1100)
│   ├── board-data.js             # 黑板内容 schema（5 步 × N 个 reveal block）
│   ├── board-renderer.js         # 纯函数渲染器：schema → DOM
│   └── colors_and_type.css       # 颜色/字体 token（spacing 待补，见 §7）
├── docs/
│   ├── spacing-gap-report.md     # ⚠️ Spacing system 缺口报告（必读）
│   ├── student-modal-redesign.md # 学生详情弹窗重设计方案
│   └── teacher-dashboard-design.md # 课堂观察台 v2 设计文档
└── frames/                       # 设备外壳（未使用，保留备用）
```

---

## 4. 三端职责

| 端 | 文件 | 设备 | 职责 |
|---|---|---|---|
| **课堂观察台** | `surfaces/teacher-v2.html` | MacBook 16:10 | 实时监控面板：Health Cards → Step Cards（学生点阵）→ 观察要点 → 问题聚类；点击学生进入 Journey Strip 弹窗查看跨步骤表现 |
| **学生端** | `surfaces/student-v1.html` | iPad 4:3 | 文本优先布局（Newsela 模式）：课文居中 + 右侧任务区，板书/课文/AI 助教通过 Dock 面板按需展开；AI 理解反馈（明白了/还不明白）|
| **投屏黑板** | `surfaces/board.html` | 教室 16:9 投影 | 一个由 schema 驱动的"渐进式黑板"：5 步 × N 个 reveal block，随课堂推进逐块出现 |

---

## 5. 三端联动协议

`demo.html` 通过 iframe 同时挂载三个端，用 `postMessage` 做单向广播。

### 5.1 消息合约

```js
// 指挥官 → 三端
{ type: 'sync', step: 0..4 }        // 步骤变化 (0-indexed; 对应 §6 五步阅读骨架)
{ type: 'reveal', blockId: string } // 单独揭示某个 board block (选配)

// 三端 → 指挥官 (可选)
{ type: 'ready', role: 'student'|'teacher'|'board' }   // iframe 初始化完成
{ type: '__edit_mode_available' }                      // Tweaks 按钮可用
```

### 5.2 各端响应

| 端 | 收到 `{type:'sync', step:N}` 的行为 |
|---|---|
| student | 切到对应步骤的任务卡片；刷新进度条 |
| teacher | step-rail 高亮到 N；mirror view / AI 建议同步更新 |
| board | pointer 跳到 step=(N+1)、sub=max；已 reveal 的块全部保留显示 |

### 5.3 embed mode

三端都支持 `?embed=1`，隐藏自带的 lesson-bar / scrubber / 外层 chrome，只保留内容区，适合被 demo 外壳包裹。

---

## 6. 课堂五步骨架（所有端共享）

| # | 步骤 | 时长 | 核心动作 |
|---|---|---|---|
| 1 | 图式激活 (Activate schema) | 3' | 先观察 · 媒体 vs 现实 · 悬念引入 |
| 2 | 结构解码 (Decode structure) | 6' | 段落主旨 · 论证链路 · 信号词 |
| 3 | 矩阵构建 (Build matrix) | 17' | 文化 × 美的维度 的二维对照表 |
| 4 | 批判质疑 (Critically evaluate) | 12' | 挑战 "shallow" · 证据 · 议论段模板 |
| 5 | 复盘升华 (Synthesize) | 7' | 回到主问题 · 结论 · 迁移 |

累计时间节点 `CUM = [0, 3, 9, 26, 38, 45]` (min)。

---

## 7. ⚠️ 已知设计系统缺口（开发前必读）

详见 **`docs/spacing-gap-report.md`**。摘要：

- 当前 design system **没有** spacing / radius / shadow / type-size token，所有 `padding / gap / margin / font-size / border-radius` 都是魔数
- 这直接导致了一个线上 bug：`.column { padding: 0 18px }` 让列标题顶到容器边缘
- 已加 hotfix（`.column { padding: 10px 18px 4px }`），但**不是长久之计**
- 建议实现时同步补全 `--sp-*` / `--fs-*` / `--rad-*` / `--shadow-*` token，并遵守"任何带 border/background 的容器，上下 padding 不为 0 且对称（规则 C-1）"

---

## 8. 产品 principle（实现时请遵守）

### 8.1 Chalk & Paper 二元视觉语言（黑板端）

黑板是**中性书写面**，不是"一堆彩色盒子"：

- 列标题（现象 / 对照 / 悬念）是**粉笔式排版信号**：手写体 + 墨线下划线，**不要**背景填充
- 只有"物理 artifact"（学生卡片、引文纸条、图表）才是带 border 的 block
- 颜色收敛到 **2+1**：纸 / 墨为主（95%+），一个语义重点色（绿 = 已达成的共识/证据）

### 8.2 非对称对比 (Asymmetric comparison)

"A vs B" 的比较几乎从不是对等的。通常其中一方是**被质疑的 claim**，另一方是**反驳的证据**：

- Claim 侧：灰化、斜体、加引号、tentative
- Evidence 侧：墨黑、实心、关键词加粗、confident
- 分隔符用手写体"vs" + 问号，**不要**用对等的两个彩色块

反例：当前 `Modern Media` vs `Real Cultures` 旧版用等权的 `--blue-bg` / `--amber-bg` —— 视觉"吵架" + 语义错误。

### 8.3 课堂节奏是一等公民

所有 UI 的组织都围绕"课堂此刻在第几步"。避免把 AI 做成聊天框；把 AI 做成**每一步的辅助工具**（prompt 建议、学生答题 misconception 归类、下一步候选等）。

---

## 9. Demo 交互约定（demo.html）

- **键盘**：`← →` 上/下一步；`1–5` 跳步；`S/B/C` 切换 featured 到 学生/黑板/教师；`T` 打开 Tweaks
- **Tweaks 面板**：布局（主视图+缩略 / 三端并排）· 外壳（设备壳 / 极简）· 自动推进（关 / 慢 8s / 快 3s）
- **持久化**：当前步骤、featured 端、布局、外壳、自动模式 都存 `localStorage`

---

## 10. 实现任务清单（给 Claude Code 的入口）

按优先级：

### P0 · Design system 补全（1-2 天）
- [ ] 在 `surfaces/colors_and_type.css` 加入 `--sp-*`（4px grid，详见 gap report §2）
- [ ] 加入 `--fs-*` / `--lh-*`，特别处理 `--hand` 粉笔体的额外 top-space 规则
- [ ] 加入 `--rad-*` / `--shadow-*`
- [ ] 写入"规则 C-1：容器带 border/bg 时上下 padding 不为 0 且对称"到 design system 文档
- [ ] 把 `board.html / student.html / teacher.html` 的魔数替换为 token（可分批）

### P1 · 数据层抽离
- [ ] `board-data.js` 已经是好范本；把 `student.html` / `teacher.html` 的硬编码内容也抽成同样的 schema
- [ ] 建立"一份 lesson schema 驱动三端"的真正单源（目前三端是各自维护的视图，只靠 step 索引对齐）

### P2 · 后端对接
- [ ] `sync` 消息改走 WebSocket / BroadcastChannel，支持真实多设备（目前只在单页 iframe 间）
- [ ] 学生端答题数据回流到教师端 mirror view（目前是假数据）
- [ ] AI 建议接入真实模型（`window.claude.complete` 或后端 API）

### P3 · 内容扩展
- [ ] 支持多课时：目前是 B7U2 *Ideal Beauty* 单课时；需要支持 lesson picker
- [ ] 教师端"课前备课"流程
- [ ] 学生端"课后回看"流程

---

## 11. 不要做的事

- ❌ 不要给 demo 加聊天框风格的 AI 入口（违反 §1 的产品定位）
- ❌ 不要往黑板上加更多颜色的 `tone-*`（违反 §8.1）
- ❌ 不要在没有 `--sp-*` token 前新写 block 类型（会继续制造魔数）
- ❌ 不要把 slide 风格的 16:9 固定比例套到所有端上 —— iPad 是 4:3，黑板可以更高（内容决定高度，参见 `demo.html` ROLES 配置）

---

## 12. 设计决策备忘

- **为什么是 iframe 而不是组件组合**：三端是独立产品面，各有自己的 DOM / 状态 / 键盘焦点；iframe 是最干净的隔离。
- **为什么是 postMessage 而不是 BroadcastChannel**：demo 阶段三端同页，`postMessage` 最直接；产品化时再升级。
- **为什么 board 的 step = conductor.step + 1**：黑板的 step=1 是 "开课前预告"，conductor 的 step=0 对应 "图式激活" —— 黑板的 step=2 才开始真正写内容。这是业务语义，不是 bug。

---

## 13. 联系 / 反馈

把问题、发现的魔数、新的 block 类型需求，直接贴到 `docs/` 下新建 markdown 或 comment 到相应文件。