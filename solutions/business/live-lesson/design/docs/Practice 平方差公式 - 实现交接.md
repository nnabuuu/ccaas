# Practice 平方差公式 · 实现交接文档

> 给 local Claude Code 用的实现说明 —— 页面是 AI 助教用平方差公式示范解 $(y+1)(y-1)$ 的教学场景。
> 
> 入口：`Practice 平方差公式.html` → `practice-squarediff.jsx`
> 设计 tokens：`colors_and_type.css`（warm-neutral + 7 个语义色对）

---

## 1. 页面目标

一道例题 `(y+1)(y-1)`，AI 助教**自动演示**完整解题过程。学生看完后再自己做下一题。

**不是**让学生答题的界面 —— 是**示范 / 讲解**界面。所以：
- 没有手写画布、提交按钮、批改流程（那是 `Practice 多项式乘法 v3.html` 的事）
- 左右栏都在演示，节奏由 stage timeline 驱动
- 最后给「重新演示 / 我来试试」两个出口

## 2. 布局

```
┌─────────────────────────────────┬───────────────────────┐
│  Task Column (flex:1)           │  Lecture Sidebar      │
│  ─────────────────              │  (400px, 固定)         │
│  • 例题卡（题目 + 动画标注）       │  ─────────            │
│  • AI 演示卡（3 步走）            │  • 公式卡（带标注图例） │
│  • 重播 / 下一题按钮（终态出现）    │  • 步骤① 找相同项       │
│                                 │  • 步骤② 找相反项       │
│                                 │  • 步骤③ 套公式 + 警告  │
└─────────────────────────────────┴───────────────────────┘
```

两栏**同时存在、同时动画**：左边 AI 演示进行到第 N 步时，右边对应步骤卡高亮、之前的标绿。

## 3. 核心设计点

### 3.1 双轨标注系统（贯穿整个页面）

整个页面靠**两种线** + **两种颜色**承载语义：

| 标注 | SVG | 颜色 | 含义 | 对应公式 |
|---|---|---|---|---|
| 双横线（两条平行线） | `DoubleUnderline` | teal `#0d5245` | **相同项** | a |
| 波浪线 | `WavyUnderline` | coral `#6b2a14` | **相反项** | b |

这套语言出现在 4 个地方，**必须保持一致**：
1. 例题里的 `y` 和 `1`（动画绘出）
2. 右侧公式卡的 `(a+b)(a-b) = a²-b²`（持续显示，作为参考）
3. 右侧步骤①/②/③ 的迷你示意（持续显示）
4. 第二步对应图（演示卡内的上下对照）

### 3.2 上下对照图（第二步的核心）

第二步「找相同项 / 找相反项」用的是**对齐网格**而不是文字描述：

```
( y + 1 )( y − 1 )      ← 题目（teal y, coral 1）
  ┊       ┊       ┊         ← 垂直虚线连接对应列
( a + b )( a − b )      ← 公式
```

实现用 CSS Grid（`.demo-map`）：
- `grid-template-columns: repeat(10, ...)` 把每个字符放在独立列，确保上下严格对齐
- 中间一行专门放 bridge（连接线），只有 `tok` 列有线
- 动画分两拍：先 teal y↔a（stage 2），再 coral 1↔b（stage 3）
- bridge 用 `::before` + `scaleY(0→1)` 做"从上往下画出"

### 3.3 竖式解答

数学计算必须用竖式，`=` 号对齐：

```
解：原式 = y² − 1²
        = y² − 1
```

实现：`.demo-sol` 用 `display: inline-grid; grid-template-columns: auto auto 1fr`
- 第一列：label（"解：原式" 只在第一行出现）
- 第二列：`=`（每行都有，自动对齐）
- 第三列：表达式

**注意**：第二行的 label 单元格留空，**不要省略**否则 grid 会塌掉。

### 3.4 步骤卡的三态

右侧每个步骤卡有 3 个视觉状态，由 `activeStep` 控制：

| 状态 | className | 视觉 |
|---|---|---|
| 未开始 | （无） | 普通卡片 |
| 进行中 | `.active` | 左边紫色 3px 强调条 + 紫色背景 + 数字徽章变紫 |
| 已完成 | `.done` | 左边绿色强调条 + 数字徽章变绿（白底） |

切换是动画的（`transition: border-color .25s, background .25s`），不要换成瞬切。

---

## 4. Stage Timeline（最重要的实现细节）

整个页面的状态机靠一个 `stage` 数字驱动（0-6），useEffect 自动推进：

```js
const delays = [900, 2200, 1600, 1700, 1500, 1200]; // ms
// stage 0 → 1: 900ms 后显示步骤1
// stage 1 → 2: 2200ms 后开始标注相同项
// ...
```

| stage | 左侧（演示卡） | 题目标注 | 右侧（讲解栏） |
|---|---|---|---|
| 0 | idle | 无 | 全部 inactive |
| 1 | 第一步：理思路（active） | 无 | 全部 inactive |
| 2 | 第二步 partial：y↔a 出现 | y 双横线绘出 | ① active |
| 3 | 第二步 full：1↔b 出现 | 1 波浪线绘出 | ② active |
| 4 | 第三步：`解：原式 = y² − 1²` | 全部显示 | ③ active |
| 5 | 第三步：`= y² − 1` | 全部显示 | ③ active |
| 6 | 完成，重播按钮淡入 | 全部显示 | 全部 done |

**replay 时只需 `setStage(0)`** —— 所有 derived state 自动归零。**不要**把动画状态分散到多个 useState 里，否则 replay 同步会出 bug。

---

## 5. 实现注意点

### 5.1 SVG 下划线动画
`DoubleUnderline` / `WavyUnderline` 用 `strokeDasharray` + `strokeDashoffset` 从 100→0 来"画出"。
- 容器必须 `position: relative`，下划线 `position: absolute; bottom: -9px`
- 双横线两条线 stagger 150ms（第二条延迟）
- 不要用 `transform: scaleX` —— 波浪线会被压扁

### 5.2 字体
- 数学符号（y, a, b, 1）用 **斜体 italic**（`font-style: italic`）—— 这是数学排版惯例
- 括号、运算符（+, −, =）用**正体**（`font-style: normal`）—— 它们不是变量
- 整个页面用 **Plus Jakarta Sans + PingFang SC** fallback（在 `colors_and_type.css` 里 @import）

### 5.3 上标 `²`
用 `<sup>2</sup>`，CSS 里给 sup 设 `font-size: 0.7em; vertical-align: super` 由浏览器默认。**不要**用 `²` 字符（Unicode 上标），渲染粗细不一致。

### 5.4 颜色绝对不要硬编码
所有颜色走 token：
- 主要文本：`var(--t1)` / `var(--t2)` / `var(--t3)`（三级灰，warm-tinted，**不是** #000/#888）
- teal（相同项）：`var(--teal)` + `var(--teal-bg)`
- coral（相反项）：`var(--coral)` + `var(--coral-bg)`
- purple（AI / 讲解）：`var(--purple)` + `var(--purple-bg)`
- green（完成、答案）：`var(--green)` + `var(--green-bg)`
- amber（警告）：`var(--amber)` + `var(--amber-bg)`

绝对**不要**用纯黑纯白纯灰。`#000` 在这个 warm-neutral 系统里会刺眼。

### 5.5 间距走 token
`--sp-1` (4px) ~ `--sp-10` (64px)。但例题区的字号、对照图的 column-gap 等"视觉密度"参数可以微调，目前的值是调好的，**改之前先截图对比**。

### 5.6 不要在 React 渲染前删掉 Babel
HTML 用 `<script type="text/babel" src="practice-squarediff.jsx">` 加载。**不要**预编译成 .js —— 编辑体验会变差，文件也会变大。生产时再考虑。

### 5.7 React script tag 必须用钉版本 + integrity
见 HTML head，**不要**改成 `react@18` 或拿掉 integrity hash，否则可能被 CDN 切到不同版本导致行为变化。

---

## 6. 容易踩的坑

1. **替换 y 时漏改**：解题示范、答案、图例、注释都有 `y`，全文检索时小心不要把 "yes" / 变量名里的 y 误改。
2. **上下对照图列数变化**：如果题目从 `(y+1)(y-1)` 改成别的，`grid-template-columns: repeat(10, ...)` 的 10 要同步改 —— 必须等于一行的 span 数。
3. **stage 推进与动画时长不匹配**：`delays` 数组里的毫秒数必须 ≥ 对应阶段的 CSS transition 时长（最长 .55s = 550ms），否则下一阶段会打断上一个的动画。当前所有 delay 都 ≥ 900ms，安全。
4. **replay 时 setTimeout 残留**：useEffect 已有 cleanup `clearTimeout(timerRef.current)`，但 `replay()` 函数里**也要**主动 clearTimeout 再 setStage(0)，否则快速点会触发多个 timer。**已经处理**，改的时候别误删。
5. **sidebar 在窄屏会挤掉演示卡**：目前 `.lecture-panel` 是 `width: 400px; flex-shrink: 0`，task-col 是 `flex: 1`。如果加响应式，断点 < 1100px 建议 sidebar 折叠为底部 drawer，**不要**简单 stacking —— 教师场景默认大屏。

---

## 7. 文件清单

| 文件 | 内容 | 行数 |
|---|---|---|
| `Practice 平方差公式.html` | HTML shell（只挂载点 + script 标签，~25 行） | small |
| `practice-squarediff.css` | 页面专属样式（topbar / 题卡 / 演示卡 / 侧栏 / 对照图 / 警告框） | ~250 |
| `practice-squarediff-marks.jsx` | `DoubleUnderline` `WavyUnderline` `Marked` `StaticMarked`（标注图元） | ~55 |
| `practice-squarediff-demo.jsx` | `AIDemoCard`（左栏 AI 演示卡，3 步走 + 上下对照图 + 竖式解答） | ~115 |
| `practice-squarediff-sidebar.jsx` | `LectureSidebar`（右栏讲解：公式卡 + 3 步骤卡 + 警告） | ~135 |
| `practice-squarediff-app.jsx` | `PracticeApp` + stage timeline + 挂载入口 | ~135 |
| `colors_and_type.css` | design tokens（项目共用，**不要**为本页改动它） | — |
| `Practice 平方差公式 (offline).html` | 单文件离线版本（自动生成，**不要**手改） | — |

### 模块加载顺序（HTML 里 script 标签顺序必须保持）

```
React → ReactDOM → Babel
   ↓
marks.jsx        (定义 DoubleUnderline / WavyUnderline / Marked / StaticMarked)
   ↓
demo.jsx         (使用 ref-same / ref-opp className，不直接依赖 Marked)
sidebar.jsx      (使用 StaticMarked → 必须在 marks 之后)
   ↓
app.jsx          (使用 AIDemoCard、LectureSidebar、Marked → 必须最后)
```

### Babel scope 注意 ⚠️

每个 `<script type="text/babel">` 都有独立作用域（Babel 编译后 IIFE 包裹）。组件文件**结尾必须** `Object.assign(window, { ComponentA, ComponentB })` 把组件挂到 window，否则后续 script 拿不到。当前 4 个 jsx 文件都已经这么做了。

修改时如果新增组件：要么在它**所在的文件里使用完**，要么记得加进 `Object.assign(window, ...)`。

## 8. 扩展方向（如果要继续做）

- 把 `(y+1)(y-1)` 抽成 prop，做成「示范完一题后切换到下一题」的连续教学流
- 给学生加一个「我来试试」按钮，跳转到 v3 答题界面，预填同公式但换数字
- 第二步的上下对照图换成更通用的 `<MapDiagram problem={...} formula={...} />` 组件
- 老师视角（Teacher Observation）显示班里多少学生看完了示范、停在哪一步
