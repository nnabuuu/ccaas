# AskUserQuestion Widget — 产品与设计规格

> 嵌入在 AI 回复中的参数收集组件。核心意图：减少用户打字，大多数场景通过点击选项完成。
> 参考原型：`prototypes/components/ask-user-question.html`（四个可交互示例）

---

## 一、概述

当 AI Skill 需要收集用户偏好时（出题的题型/难度、学情报告的维度/周期等），不用让用户打字描述，而是弹出一个结构化的选项面板。

一个 AskUserQuestion 可以包含 1~4 个问题，每个问题通过 header chip 切换，聚合在一个卡片内。

---

## 二、数据结构

```typescript
interface AskUserQuestion {
  questions: Question[];
}

interface Question {
  header: string;          // chip 上显示的短标签，≤12 字符，如"题型""难度"
  question: string;        // 面板内的问题文本
  hint?: string;           // 可选提示，如"可多选"
  multiSelect: boolean;    // false = 单选 radio, true = 多选 checkbox
  options: Option[];       // 2~4 个预设选项
  preview?: boolean;       // 是否启用 Preview 分栏模式
  // Other 选项由系统自动追加，不需要在 options 里声明
}

interface Option {
  label: string;           // 选项标签
  description: string;     // 选项说明
  recommended?: boolean;   // 是否标记为推荐（显示 badge，默认预选）
  value: string;           // 提交时的值
  previewContent?: string; // preview 模式下，选中此项时右侧显示的内容
}
```

---

## 三、布局结构

整个 Widget 是一个圆角卡片，嵌入在 AI 回复的消息流中。

```
┌─────────────────────────────────────────────┐
│  [题型: 混合出题]  [难度]  [题量]    ← chips │
├─────────────────────────────────────────────┤
│                                             │
│  问题文本                                    │
│                                             │
│  ○ 选项 A（推荐）                            │
│    描述文字                                  │
│  ○ 选项 B                                   │
│    描述文字                                  │
│  ○ 选项 C                                   │
│    描述文字                                  │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  ○ 或者自定义                                │
│    [____________________________]  ← 始终可见 │
│                                             │
├─────────────────────────────────────────────┤
│  3 / 3 已回答              [确认选择]        │
└─────────────────────────────────────────────┘
```

Preview 模式时，面板区域变成左右分栏：左边选项列表，右边预览内容（等宽字体，代码/结构展示）。

---

## 四、Header Chips

顶部一行 pill 形状的 chips，每个对应一个 question。

每个 chip 包含：状态圆点 + header 文字 + 已选值文本。

状态圆点：灰色 = 未回答，绿色 = 已回答。

已选值文本：回答后显示在 header 文字右边，如"题型: 混合出题"。未回答时不显示。当用户切换选项时实时更新。截断过长文本（max-width 限制 + ellipsis）。

点击 chip 切换到对应面板。当前 chip 有高亮背景和边框。

---

## 五、选项列表

### 5.1 预设选项

每个选项是一张卡片，包含：indicator + label + description。

单选（`multiSelect: false`）：indicator 为圆形 radio，同组互斥。
多选（`multiSelect: true`）：indicator 为方形 checkbox，可多选。

选中状态：边框和背景变为 info 色，indicator 实心填充。

有 `recommended: true` 的选项：label 后面显示绿色"推荐"小 badge，且在 Widget 初始化时默认预选。如果所有问题都有推荐项且用户都满意，可以直接点"确认选择"，零操作。

### 5.2 Other 选项

每个问题底部系统自动追加一个 Other 区域。

Other 和预设选项用虚线边框区分。包含：indicator + "或者自定义"标签 + 文本输入框。

输入框始终可见（不是选中后才显示）。用户直接在输入框打字，打第一个字符时自动勾选 Other（单选模式下同时取消其他预设选项）。清空输入框时取消勾选。

Other 的值会反映在 chip 的已选值上。

### 5.3 Preview 模式

当 `question.preview = true` 时，面板区域变成左右分栏。

左半边是选项列表（同上）。右半边是预览区域：等宽字体、浅灰背景，显示当前选中选项的 `previewContent`。切换选项时右侧实时更新。

如果选了 Other 并正在输入，预览区显示"根据你的描述：[输入内容]"。

---

## 六、容器高度

容器高度等于所有面板中最高那个的内容高度。切换 tab 时高度不变，不会导致页面跳动。

实现方式：CSS Grid 将所有面板叠放在同一个格子里（grid-row:1, grid-column:1），全部参与高度计算，只有当前面板 opacity:1 可见，其余 opacity:0 + pointer-events:none。

---

## 七、自动跳转（仅单选）

单选模式下，用户点选一个选项后，200ms 延迟后自动跳到下一个未回答的 tab。如果所有 tab 都已回答，不跳转。

多选模式不自动跳转（因为用户可能还要选更多）。

---

## 八、Footer

底部栏包含：进度文本 + 确认按钮。

进度文本："2 / 3 已回答"，已回答数量用绿色高亮。

确认按钮：当所有问题都有至少一个选项被选中时才激活（disabled → enabled）。点击后提交。

---

## 九、三种状态

### 9.1 初始状态
- 有推荐项的问题默认预选，chip 显示已选值和绿色圆点
- 没有推荐项的问题未选中，chip 显示灰色圆点
- 确认按钮：如果所有问题都已有推荐预选则激活，否则 disabled

### 9.2 交互中
- 用户点选选项，chip 实时更新已选值和状态
- 单选自动跳下一个未回答的 tab
- Other 输入框打字自动勾选
- 进度实时更新

### 9.3 已提交
- 整个 Widget 锁定
- 选中项边框和背景变为 success 绿色
- 未选中项变淡（opacity 降低）
- Other 输入框变只读
- 确认按钮消失
- Footer 显示汇总文字："✓ 混合出题 · 分层 · 5 题"
- Chips 不可再点击
- AI 在 Widget 下方继续回复

---

## 十、与其他组件的关系

AskUserQuestion 出现在 AI 回复的消息气泡内，和 Tool Usage 折叠、StepWizard、ReviewPanel 等 Widget 处于同一层级——都是 AI 回复中嵌入的交互元素。

典型出现场景：
- 出题组卷 Skill 收集题型/难度/题量偏好
- 学情分析 Skill 收集报告周期/维度/对比范围
- 备课助手 Skill 收集教案结构偏好（Preview 模式）

提交后的选择结果作为参数传给 Skill 引擎，驱动后续生成。

---

## 十一、实现 Checklist

- [ ] 实现 AUQ 卡片外框（圆角、边框）
- [ ] 实现 header chips 行（pill 形状、状态圆点、已选值文本、点击切换）
- [ ] 实现面板 grid 叠放（高度 = 最高面板，opacity 切换）
- [ ] 实现预设选项卡片（radio / checkbox indicator，选中样式）
- [ ] 实现推荐 badge + 默认预选
- [ ] 实现 Other 区域（虚线边框，输入框始终可见，打字自动勾选，清空自动取消）
- [ ] 实现 chip 已选值实时更新
- [ ] 实现单选自动跳转下一个未回答 tab
- [ ] 实现 footer 进度计数 + 确认按钮激活逻辑
- [ ] 实现已提交状态（锁定、变绿、汇总文字）
- [ ] 实现 Preview 分栏模式（左选项 + 右预览，选项切换时预览更新）
- [ ] 参考原型中四个示例的视觉细节（间距、字号、颜色）
