# PRD: @ Picker Reference v4 — 双触发模型

## 1. 概述

### 1.1 产品定位

Jijian 平台 Chatbox 提供两种内联触发器，分别服务于**引用**和**执行**两种意图：

| 触发符 | 名称 | 意图 | 产出 |
|---|---|---|---|
| `@` | Reference Picker | 将实体注入上下文 | Token pill 内嵌在消息中 |
| `/` | Command Palette | 触发技能执行 | 执行一个 Skill/Action |

**`@` = 引用（"我在说这个"）**：把一个实体（人、文件、菜谱、班级...）拉进当前对话的上下文。用户选中后，实体以 Token pill 形式内嵌在输入框中，随消息一起发送。Agent 可以根据 Token 中的 EntityRef 去获取该实体的完整数据。

**`/` = 命令（"帮我做这个"）**：触发一个 Skill 的执行。类似 Claude Code 中的 `/` 命令、Slack 的 slash command、Notion 的 `/` 块菜单。用户选中后，Skill 接管对话流程（可能需要额外参数输入）。

**两者的协作场景：** 用户先用 `@` 引用实体，再用 `/` 触发技能：`@鱼香肉丝 @红烧牛腩 /roundtable-discussion`（把两道菜引入上下文，然后触发圆桌讨论技能来对比它们）。

### 1.2 双触发的交互差异

| 维度 | `@` Reference Picker | `/` Command Palette |
|---|---|---|
| 触发条件 | 行首或空白后键入 `@` | 行首或空白后键入 `/` |
| 初始视图 | Smart Landing（上下文+最近+分类） | Skill 分组列表 |
| 多选支持 | ✅ Space 添加多个引用 | ❌ 单选插入 |
| 选中后行为 | 插入 Token pill，可继续输入 | 插入 /command pill，可继续输入参数 |
| Esc 行为 | 两层递进（深层→Landing→关闭） | 一层关闭 |
| 层级导航 | ✅ 分类→实体→子项→ref | ❌ 扁平列表+搜索 |
| 数据结构 | EntityRef（路径寻址） | SkillId（直接标识） |

**关键统一原则：`@` 和 `/` 都只是往输入框里插入内容，不触发任何执行。** 真正的发送/执行是用户编辑完整条消息后按发送按钮。这允许用户在同一条消息中自由组合引用、命令和自然语言：

```
@三年一班 @张小明 /smart-questions 请帮他梳理关于函数的提问
```

### 1.3 核心设计洞察

> **`@` 是一个键盘行为，所以 Picker 的全部操作都应该可以在键盘上完成。**

"选择"不是一个单一动作。用户面对的操作语义有三种：

| 操作 | 键 | 意图 | 类比 |
|---|---|---|---|
| **Select & Close** | Enter | 确认当前项（+暂存区），关闭 Picker | 购物车"结算" |
| **Add & Stay** | Space / 行内 + 按钮 | 我要这个，继续选别的 | 购物车"加入" |
| **Drill In** | → / 行内 n › 按钮 | 看子级/更细粒度 | 文件管理器"进入文件夹" |

**Enter 和 Esc 的语义分工：**

```
Enter = 确认（正向动作）——"我选好了"
Esc   = 退出（中性动作）——"我要退一步"
```

按键行为完全由焦点位置决定，不依赖隐藏状态：

| 焦点位置 | Enter | Esc |
|---|---|---|
| 搜索框 | 选中第一个搜索结果 | 关闭 Picker（暂存保留） |
| 列表 — 分类项 | Drill In（始终进入） | 回 Landing / 关闭（暂存保留） |
| 列表 — 实体/子项 | 加入 + 暂存提交 + 关闭 | 回 Landing / 关闭（暂存保留） |

### 1.4 目标用户

| 角色 | 典型场景 | 主要操作 |
|---|---|---|
| B2B 开发者 | 引用 1 个文件来分析代码 | @ Select & Close |
| 解决方案工程师 | 引用 3 个 MCP Tool + 1 个模板做 PoC | @ Add & Stay |
| 教师 | 引用教案 → 跳转到课堂记录 → 选一段视频 | @ Drill In |
| 教师 | @三年一班 @张小明 /smart-questions 帮学生提问 | @ + / 协作 |

---

## 2. 实体引用寻址模型（Entity Reference Addressing）

### 2.1 核心问题

当用户在 Picker 中选中 "食材准备" 并插入 Token 时，这个 Token 指向的到底是什么？

如果只存 `{ name: "食材准备" }`，这个引用是**悬空的**——系统不知道它是鱼香肉丝的食材准备还是红烧牛腩的食材准备。更复杂的情况是：教案引用了课堂记录，课堂记录引用了课堂视频——一个引用可能穿越多个实体边界。

**因此，每一个 Token 必须携带从根到叶的完整路径——即 EntityRef。**

### 2.2 EntityRef 结构

```typescript
/**
 * EntityRef 是 @ Picker 产出的核心数据结构。
 * 它编码了从 Picker 根节点到被选中节点的完整导航路径，
 * 使得任何引用都可以被唯一定位和解析。
 */
interface EntityRef {
  /** 
   * 路径段数组，从根到叶。
   * 每一段对应 Picker 导航树中的一个层级。
   */
  path: EntityRefSegment[];

  /** 叶节点的实体 ID（最终被引用的对象） */
  leafId: string;

  /** 叶节点的显示名 */
  leafName: string;

  /** 叶节点所属分类的 ID */
  categoryId: string;
}

interface EntityRefSegment {
  /** 段的类型 */
  type: "category" | "entity" | "child" | "ref";

  /** 该层级节点的 ID */
  id: string;

  /** 该层级节点的显示名 */
  name: string;
}
```

### 2.3 路径示例

**直接子项选择：** 用户导航 `@ → Recipes → 鱼香肉丝 → 食材准备`

```typescript
{
  path: [
    { type: "category", id: "recipes",  name: "Recipes 菜谱" },
    { type: "entity",   id: "r1",       name: "鱼香肉丝" },
    { type: "child",    id: "r1a",      name: "食材准备" },
  ],
  leafId: "r1a",
  leafName: "食材准备",
  categoryId: "recipes",
}
```

**选择实体本身（不进入子级）：** 用户导航 `@ → Recipes → 鱼香肉丝`，直接 Enter

```typescript
{
  path: [
    { type: "category", id: "recipes", name: "Recipes 菜谱" },
    { type: "entity",   id: "r1",      name: "鱼香肉丝" },
  ],
  leafId: "r1",
  leafName: "鱼香肉丝",
  categoryId: "recipes",
}
```

**跨实体引用：** 用户导航 `@ → 教案 → 第三课教案 → (ref) 课堂记录-03-15 → 课堂视频片段`

```typescript
{
  path: [
    { type: "category", id: "lesson-plans", name: "教案" },
    { type: "entity",   id: "lp3",          name: "第三课教案" },
    { type: "ref",      id: "cr-0315",      name: "课堂记录-03-15" },  // 跨实体边界
    { type: "child",    id: "cv-clip-2",    name: "视频片段: 小组讨论" },
  ],
  leafId: "cv-clip-2",
  leafName: "视频片段: 小组讨论",
  categoryId: "lesson-plans",  // 起始分类，不是目标实体的分类
}
```

### 2.4 Token 显示规则

Token 在输入框中的显示需要同时传达**是什么**和**从哪来**：

| 路径深度 | Token 显示 | 例 |
|---|---|---|
| 2 段（分类+实体） | `[icon entityName]` | `[🍳 鱼香肉丝]` |
| 3 段（+子项） | `[icon parentName › childName]` | `[🍳 鱼香肉丝 › 食材准备]` |
| 4+ 段（含 ref） | `[icon ...parentName › leafName]` | `[📋 ...课堂记录 › 视频片段]` |

**规则：**
- 始终显示分类 icon
- 始终显示叶节点名称
- 如果路径 ≥ 3 段，显示叶节点的直接父级 + `›` + 叶节点
- 如果路径 ≥ 4 段，用 `...` 省略中间层级
- Hover/tooltip 显示完整路径：`Recipes 菜谱 → 鱼香肉丝 → 食材准备`

### 2.5 实体间引用（Entity-to-Entity Refs）

实体可以声明对其他实体的引用关系。这些引用在 Picker 中表现为**可导航的跳转点**。

```typescript
interface PickerItem {
  id: string;
  name: string;
  description?: string;
  children?: PickerChild[];     // 自身的子项
  refs?: EntityRefLink[];       // 指向其他实体的引用
}

interface EntityRefLink {
  /** 被引用实体的 ID */
  targetEntityId: string;

  /** 被引用实体所在的分类 ID */
  targetCategoryId: string;

  /** 引用关系的语义标签，如 "关联课堂记录"、"引用数据源" */
  label: string;

  /** 可选：加载被引用实体的子项（懒加载） */
  loadTarget?: () => Promise<PickerItem>;
}
```

**Picker 中的呈现：**

当用户 Drill In 一个有 refs 的实体时，列表分为两个区域：

```
┌─────────────────────────────────────────┐
│ 📋 第三课教案                            │  ← Entity Banner
│ "函数与变量——基础入门"                    │
├─────────────────────────────────────────┤
│ ◆ 自身内容                               │  ← 分组标题
│   ○ 教学目标                             │
│   ○ 教学步骤                             │
│   ○ 课后作业                             │
├─────────────────────────────────────────┤
│ ◇ 关联引用                               │  ← 分组标题（ref 区域）
│   ↗ 课堂记录-03-15          3 ›          │  ← ref，可继续 drill
│   ↗ 学生名单-三年一班                     │  ← ref，无子项
└─────────────────────────────────────────┘
```

**视觉区分：**
- 自身子项（children）：实心圆点 `○` + 分类色
- 引用项（refs）：`↗` 箭头 + 较淡色调，表示"跳转到外部实体"
- ref 项的右侧同样可以显示 `n ›` 表示可继续 drill

**导航行为：**
- 在 ref 项上按 → 或点击 `n ›` → 加载被引用实体的子项，navStack push `{ type: "ref", ... }`
- ref 项本身也可以被 Space 添加或 Enter 选择（引用的是目标实体整体）
- ← 返回时，回到原实体的子项列表

**引用链无深度限制，但检测循环：**

Ref 可以无限嵌套——教案 → 课堂记录 → 视频 → 标注 → ... 都可以一路 Drill 下去。但如果引用链形成了环路（A → B → C → A），需要检测并跳出：

```typescript
/**
 * 循环检测：navStack 中已存在相同 entityId 时，该 ref 不可 drill。
 * 
 * 示例：navStack 包含 [教案, 第三课教案, ref:课堂记录, ref:视频]
 *       此时如果视频有 ref 指向 第三课教案（id 已在 stack 中）→ loop detected
 */
function isLoopRef(navStack: NavEntry[], targetEntityId: string): boolean {
  return navStack.some(entry => 
    (entry.type === "children" && entry.parentId === targetEntityId) ||
    (entry.type === "ref" && entry.refTarget?.id === targetEntityId) ||
    (entry.type === "items" && entry.entityId === targetEntityId)
  );
}
```

**Loop ref 在列表中的呈现：**

```
┌──────────────────────────────────────────┐
│ ◇ 关联引用                                │
│   ↗ 第三课教案              ⟲ 已在路径中  │  ← loop ref，不显示 ›，可选但不可 drill
│   ↗ 其他文档                   3 ›        │  ← 正常 ref，可继续 drill
└──────────────────────────────────────────┘
```

- Loop ref 右侧显示 `⟲ 已在路径中`，灰色调
- 仍然可以 Space 添加或 Enter 选择（引用的是目标实体整体）
- 但 → 和 `n ›` 按钮不可用，防止无限循环

**EntityRef 路径中的 loop 压缩：**

如果最终选择的路径包含 loop（A → B → C → A），存储时压缩为 A：
```
导航路径: 教案 → 第三课教案 → ref:课堂记录 → ref:视频 → ref:第三课教案
存储路径: 教案 → 第三课教案   （loop 回到起点 = 起点本身）
```

但如果 loop 中间有选择子项，路径保留到子项为止：
```
导航路径: 教案 → 第三课教案 → ref:课堂记录 → 视频片段
存储路径: 教案 → 第三课教案 → ref:课堂记录 → 视频片段   （无 loop，正常路径）
```

### 2.6 搜索结果中的路径显示

搜索结果跨所有层级匹配时，每条结果需要显示完整的来源路径：

```
┌─────────────────────────────────────────┐
│ 搜索: "食材"                             │
├─────────────────────────────────────────┤
│ 🍳 Recipes › 鱼香肉丝                    │  ← 分类+父级路径
│ + ○ 食材准备                             │
│     猪里脊、木耳、胡萝卜...               │
├─────────────────────────────────────────┤
│ 🍳 Recipes › 红烧牛腩                    │
│ + ○ 选材要点                             │
│     牛腩切块、焯水去腥                    │
└─────────────────────────────────────────┘
```

这样用户可以清楚看到同名子项来自不同的父实体。

---

### 2.7 Entity Icon 三层体系

每个可引用的实体都应有视觉可区分的 icon，分三层优先级：

| 层级 | 说明 | 示例 | 何时显示 |
|---|---|---|---|
| **L1: Category icon** | 分类级别的通用图标 | 🍳 菜谱, 📋 教案, 🔧 工具 | 始终显示（Token pill、列表） |
| **L2: Entity type icon** | 实体类型的语义图标 | 👤 学生, 🏫 班级, 📖 教材, 🎬 视频 | 列表中显示，Token 中作为 L1 的替代 |
| **L3: Custom icon** | 用户上传的头像/缩略图 | 张小明的头像照片 | 列表中优先显示，Token 中显示为小圆形头像 |

**显示优先级：** L3 > L2 > L1。如果学生有头像（L3），列表和 Token 中显示头像；没有头像则显示 👤（L2）；如果连 entity type 都没定义，回退到分类图标 🏫（L1）。

```typescript
interface EntityIcon {
  /** L1: 分类图标（emoji 或 icon name） */
  categoryIcon: string;
  
  /** L2: 实体类型图标（可选） */
  typeIcon?: string;
  
  /** L3: 自定义图标 URL（可选，如头像） */
  customIconUrl?: string;
}
```

**Token pill 中的 icon 规格：** 16x16px，圆角 3px（通用 icon）或全圆（头像）。确保在小尺寸下依然清晰可辨。

---

### 2.8 多路径导航（Multi-path Navigation）

同一个实体可以从不同的 Category 入口到达。例如学生 "张小明"：

```
路径 A: @ → 班级 → 三年一班 → 张小明      （班级上下文）
路径 B: @ → 学生 → 张小明                   （个人上下文）
```

**设计原则：路径即语义。** 两条路径产生不同的 EntityRef，因为它们携带不同的上下文含义。教师引用"三年一班的张小明"和引用"张小明本人"，在 Agent 处理时可能触发不同的行为（如拉取班级成绩 vs 拉取个人档案）。

**搜索结果中的多路径呈现：**

```
搜索 "张小明":
┌──────────────────────────────────────────┐
│ 👤 学生                                  │  ← Entity type icon
│ + [头像] 张小明              个人档案     │  ← Custom icon (L3)
├──────────────────────────────────────────┤
│ 🏫 班级 › 三年一班                        │  ← Category path
│ + [头像] 张小明              班级成员     │  ← 同一个人，不同路径
└──────────────────────────────────────────┘
```

两条结果使用相同的头像（L3 icon），但路径标签不同，帮助用户明确选择语义。

**底层 ID 相同，路径不同：** `EntityRef.leafId` 相同（都是张小明的 ID），但 `EntityRef.path` 不同。系统可以在需要时通过 leafId 做去重或关联。

---

### 2.9 / Command Palette 规格

`/` 触发的 Command Palette 与 `@` Picker 共用同一套键盘导航基础设施，但结构更简单：

**初始视图：** 按分组显示所有可用 Skills，最近使用的排在最上面。

```
┌──────────────────────────────────────────┐
│ / 执行技能                                │
├──────────────────────────────────────────┤
│ ◷ 最近使用                                │
│   ⚡ article-logic-analyzer               │
│   ⚡ roundtable-discussion                │
├──────────────────────────────────────────┤
│ 📝 分析与诊断                              │
│   ⚡ article-logic-analyzer               │
│   ⚡ narrative-tension-analyzer            │
│   ⚡ prompt-optimization-analyzer          │
├──────────────────────────────────────────┤
│ 🎨 创作与生成                              │
│   ⚡ chibi-scene-generator                │
│   ⚡ article-to-shot-script               │
├──────────────────────────────────────────┤
│ 🛠 工作流                                  │
│   ⚡ smart-questions                      │
│   ⚡ roundtable-discussion                │
│   ⚡ ux-user-story                        │
└──────────────────────────────────────────┘
```

**键盘操作（简化版）：**
- ↑↓ 导航
- Enter 插入选中的 Skill 命令到输入框（不执行）
- 键入文字搜索过滤
- Esc 关闭

**无 Space 多选、无层级导航、无 ref 跳转——`/` 是纯扁平单选。**

**选中后行为（与 `@` 统一原则）：**
- Picker 关闭
- 输入框中插入 `/skill-name` pill（金色样式，与 `@` Token 的蓝/紫色区分）
- 光标移到 pill 后方，**用户可继续键入自然语言参数**
- Backspace 可整体删除 pill（与 `@` Token 一致）
- 最终发送消息时，Agent 解析 SkillCommand + EntityRefs + 自然语言

```typescript
interface SkillCommand {
  id: string;
  name: string;
  description: string;
  group: string;          // 分组名
  icon?: string;          // 自定义 icon，默认 ⚡
  requiresParams?: boolean;
  recentUsedAt?: number;  // 排序用
}
```

---

### 2.10 搜索 UX 优化

**高亮匹配文字：** 搜索结果中，匹配的字符用加粗或高亮色标记。例如搜索 "logic"，结果中的 "article-**logic**-analyzer" 和 "**Logic** Skeleton" 中匹配部分加粗。

```typescript
function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
```

**数量限制（来自 Baymard Institute 研究）：**
- Smart Landing 每个区域：3-5 项，超出折叠到 "更多 ›"
- 搜索结果总数：≤ 10 项（桌面端），≤ 8 项（移动端）
- 超过限制时显示 "还有 N 项匹配，继续键入以缩小范围"

---

### 2.11 ARIA 无障碍规格

Picker 浮层必须符合 WAI-ARIA combobox 模式：

```html
<div role="combobox" aria-expanded="true" aria-haspopup="listbox" aria-owns="picker-list">
  <input aria-autocomplete="list" aria-controls="picker-list" 
         aria-activedescendant="picker-item-3" />
</div>

<ul id="picker-list" role="listbox" aria-label="引用资源">
  <li id="picker-item-1" role="option" aria-selected="false">...</li>
  <li id="picker-item-2" role="option" aria-selected="false">...</li>
  <li id="picker-item-3" role="option" aria-selected="true">...</li>
</ul>
```

**关键要求：**
- `aria-activedescendant` 跟随键盘高亮，让屏幕阅读器朗读当前项
- 分组标题用 `role="group"` + `aria-label`
- Token pill 用 `role="button"` + `aria-label="移除 [name]"`
- Picker 打开/关闭时 announce 状态变化

---

### 2.12 微交互动画规格（Micro-interaction Animations）

每一个操作都必须有可感知的视觉反馈。以下动画解决审查中发现的"静默操作"问题。

#### A. Picker 打开 — Slide Up

Picker 浮层从下方滑入，持续 120ms，ease-out 缓动。

```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

#### B. Space 添加 — 行闪绿 + Token 弹入

用户按 Space 或点击 + 按钮添加一项时，**两处同时反馈**：

**行级反馈（flash-add）：** 被添加的行闪一下绿色背景，600ms 淡出。让用户确认"我刚才操作了这一行"。

```css
@keyframes flashGreen {
  0%   { background: rgba(52, 199, 123, 0.25); }
  100% { background: rgba(52, 199, 123, 0); }
}
```

**暂存区反馈（pop-in）：** 新出现的 token pill 从 80% 缩放弹到 100%，250ms。建立"列表中的项飞到了暂存区"的因果关系——特别是第一次 Space 添加时，暂存区从无到有出现，pop 动画帮助用户注意到这个新区域。

```css
@keyframes popIn {
  0%   { transform: scale(0.8); opacity: 0; }
  50%  { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}
```

**触发条件：** 仅在添加时触发，移除时不触发（移除的反馈是 ✓ 变回 + 和 token 从暂存区消失，已经足够明确）。

#### C. Loop Ref 阻断 — Shake + Tooltip

当用户在 ⟲ loop ref 上按 → 试图 drill in 时：

**行级反馈（shake）：** 整行左右抖动，400ms，振幅 ±4px 递减。模拟物理世界中"推不动"的反馈。

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  15%      { transform: translateX(-4px); }
  30%      { transform: translateX(4px); }
  45%      { transform: translateX(-3px); }
  60%      { transform: translateX(3px); }
  75%      { transform: translateX(-1px); }
  90%      { transform: translateX(1px); }
}
```

**内联 tooltip：** shake 的同时，⟲ 图标旁弹出一个短暂的红色文字提示 "已在路径中，无法展开"，pop-in 动画进入，shake 结束后自动消失。

**触发条件：** 仅 → 键触发。鼠标 hover 在 ⟲ 上时只显示 tooltip 不 shake（因为 hover 不是"尝试操作"）。

#### D. Esc 回 Landing — 视图切换过渡

从深层 Esc 回到 Landing 时，列表内容应有一个轻微的淡入（150ms），避免视图跳变感。不需要滑动方向——Landing 不是层级关系中的"上一级"，它是"首页"。

#### E. 动画禁用

尊重系统级的 `prefers-reduced-motion` 设置：

```css
@media (prefers-reduced-motion: reduce) {
  .shake-row, .pop-token, .flash-add {
    animation: none !important;
  }
}
```

#### 动画总览

| 操作 | 动画 | 位置 | 时长 | 目的 |
|---|---|---|---|---|
| Picker 打开 | slideUp | 整个浮层 | 120ms | 空间出现感 |
| Space/+ 添加 | flashGreen | 被操作的行 | 600ms | 确认"我操作了这行" |
| Space/+ 添加 | popIn | 暂存区新 token | 250ms | 因果关系（列表→暂存区） |
| Loop ref 按 → | shake | 被阻断的行 | 400ms | "推不动"的物理反馈 |
| Loop ref 按 → | popIn + 自动消失 | ⟲ 旁 tooltip | 400ms | 解释为什么推不动 |
| Esc 回 Landing | fadeIn | 列表内容 | 150ms | 避免跳变 |
| `prefers-reduced-motion` | 全部禁用 | — | — | 无障碍 |

---

## 3. 信息架构

### 3.1 完整层级结构

```
@
├── Skills 技能                                    [category]
│   ├── article-logic-analyzer                     [entity]
│   │   ├── Writing Guardrails                     [child]
│   │   ├── Logic Skeleton                         [child]
│   │   └── Argument Chain                         [child]
│   ├── roundtable-discussion                      [entity, no children]
│   └── chibi-scene-generator                      [entity]
│       ├── Single Scene                           [child]
│       └── Multi-panel                            [child]
├── Recipes 菜谱                                   [category]
│   ├── 鱼香肉丝                                   [entity]
│   │   ├── 食材准备                               [child]
│   │   ├── 调味汁配比                             [child]
│   │   └── 烹饪步骤                               [child]
│   └── 红烧牛腩                                   [entity]
│       ├── 选材要点                               [child]
│       └── 炖煮时间                               [child]
├── 教案                                           [category]
│   └── 第三课教案                                  [entity]
│       ├── 教学目标                               [child]
│       ├── 教学步骤                               [child]
│       ├── ↗ 课堂记录-03-15                       [ref → entity]
│       │   ├── 课前点名                           [child of ref target]
│       │   ├── 视频片段: 小组讨论                  [child of ref target]
│       │   ├── ↗ 课堂视频-完整版                   [ref → entity, 可继续 drill]
│       │   │   ├── 00:00-15:00 讲解段             [child]
│       │   │   ├── 15:20-22:40 小组段             [child]
│       │   │   └── ↗ 第三课教案                    [ref → loop! ⟲ 已在路径中，不可 drill]
│       └── ↗ 学生名单-三年一班                     [ref → entity, no children]
└── Tools 工具                                     [category]
    └── ...
```

### 3.2 双焦点模型（Dual-Focus Model）

Picker 打开后，有两个焦点区域：**搜索框**（顶部）和**列表**（下方）。按键语义完全由当前焦点区域决定，不依赖任何隐藏状态。

```
┌─────────────────────────────────────────┐
│ 🔍 [搜索框 — 默认聚焦，光标闪烁]        │  ← 焦点区域 A
├─────────────────────────────────────────┤
│ ★ 当前上下文                             │
│   🍳 鱼香肉丝                  4 ›      │  ← 焦点区域 B（列表）
│ ◷ 最近访问                              │     需要 ↓ 才能进入
│   📋 第三课教案                          │
│   ...                                   │
└─────────────────────────────────────────┘
```

**焦点切换规则：**
- `@` 键入 → Picker 打开 → **搜索框自动聚焦**
- 搜索框中按 `↓` → 焦点跳入列表第一项
- 列表中按 `↑` 超过第一项 → 焦点回到搜索框
- 鼠标点击列表中的任何项 → 直接操作（不改变焦点模型）
- 鼠标点击搜索框 → 焦点回到搜索框

**按焦点区域的按键行为表：**

| 按键 | 搜索框聚焦 | 列表聚焦 |
|---|---|---|
| **↑** | — | 上移高亮（到头回搜索框） |
| **↓** | 跳入列表第一项 | 下移高亮（循环） |
| **←** | 光标左移 | 返回上级 |
| **→** | 光标右移 | Drill In（分类/有子项的实体） |
| **Space** | 输入空格字符 | Toggle 添加/移除 |
| **Enter** | 选中列表第一项（带高亮预览） | 执行高亮项的默认动作 |
| **Esc** | 关闭 Picker（保留暂存） | 回到 Landing / 关闭（保留暂存） |
| **字符** | 输入到搜索框 | 焦点回搜索框 + 输入字符 |

**Enter 在列表中的行为——纯粹由高亮项类型决定（不再依赖暂存状态）：**

| 高亮在 | Enter 行为 |
|---|---|
| 分类项 | Drill In（进入） |
| 未添加的实体/子项/ref | 加入 + 暂存区一起提交 + 关闭 |
| 已添加的实体（✓） | 去重，提交暂存区 + 关闭 |

**Enter 在搜索框中的行为：**
- 列表中有结果 → 选中第一个结果（等同于 `↓` + `Enter` 的快捷合并）
- 列表中无结果 → 无操作
- 第一个结果始终有明显高亮（即使焦点在搜索框），让用户按 Enter 前看到会选中什么

**Esc 行为——始终是"退一步"：**

| 焦点 | 当前层级 | Esc |
|---|---|---|
| 搜索框 | 任何 | 关闭 Picker，暂存保留插入输入框 |
| 列表 | 深层 | 回到 Landing（暂存保留） |
| 列表 | Landing | 关闭 Picker，暂存保留插入输入框 |

### 3.3 设计原理：为什么是双焦点

这个模型的核心优势是**按键语义完全由焦点位置决定，不依赖隐藏状态**：

- 搜索框里：所有按键都是**文本编辑**行为（Space=空格、←→=光标、Enter=提交搜索）
- 列表里：所有按键都是**选择操作**行为（Space=toggle、←→=导航、Enter=确认）

用户不需要记住"暂存区是否有东西"来预测按键行为。焦点在哪里，行为就是什么——这符合 Raskin 的习惯化安全原则和 Norman 的 natural mapping。

同时，这个模型和 fzf、VS Code Command Palette、Raycast 的交互一致——开发者用户有现成的心智模型。

---

### 3.3 Smart Landing — 上下文感知的初始视图

当用户键入 `@` 时，Picker 不再显示裸分类列表，而是呈现一个**按优先级排列的 Smart Landing 页面**：

```
┌──────────────────────────────────────────┐
│ ★ 当前上下文                              │  ← 仅当 chatbox 有页面上下文时显示
│   🍳 鱼香肉丝                  4 ›       │     最高优先级，一眼可见
├──────────────────────────────────────────┤
│ ◷ 最近访问                     更多 ›     │  ← 最近 3-4 项，可 drill 查看更多
│ + 📄 harness-design-v2.md                │
│ + 📋 第三课教案                           │
│ + 🔧 playwright-mcp                      │
├──────────────────────────────────────────┤
│ 📁 浏览全部                               │  ← 所有分类，按使用频率排序
│   🍳 Recipes 菜谱              3 ›       │     常用的在上
│   📋 教案                      1 ›       │
│   🔧 Tools 工具                3 ›       │
│   ⚡ Skills 技能                5 ›       │     不常用的在下
└──────────────────────────────────────────┘
```

**各区域的设计原则：**

**🔍 搜索框（Search Box）：** Picker 打开时默认聚焦在搜索框。搜索框是整个 Picker 的视觉和交互锚点——用户的第一个操作要么是输入搜索词，要么是按 `↓` 跳入列表。搜索框始终可见，不随导航层级变化消失。

**★ 当前上下文（Current Context）：** 如果 chatbox 是从某个实体页面打开的（如正在编辑鱼香肉丝），该实体自动出现在列表最顶部。如果 chatbox 在首页/全局打开，则不显示此区域。

**◷ 最近访问（Recent）：** 最近修改或引用过的 3-4 个实体，跨分类混排。

**📁 浏览全部（Browse All）：** 按使用频率排序的分类列表。

**Smart Landing 的键盘导航：** 列表区域内 ↑↓ 在所有区域的项目间统一移动（跨区域连续导航）。分组标题不可选中，自动跳过。列表第一项 ↑ 回到搜索框。

**搜索行为：** 用户在搜索框中键入文字时，列表实时过滤为搜索结果。第一个结果始终带高亮预览（即使焦点在搜索框），表明"按 Enter 会选中这个"。

```typescript
interface SmartLandingData {
  /** 当前页面上下文中的实体（可选） */
  contextEntity?: {
    item: PickerItem;
    categoryId: string;
  };
  
  /** 最近访问的实体列表 */
  recentItems: Array<{
    item: PickerItem;
    categoryId: string;
    lastAccessedAt: number;
  }>;
  
  /** 按使用频率排序的分类 */
  sortedCategories: PickerCategory[];
}
```

---

## 4. 交互状态机

```
                              ┌──────────────────────────────────┐
                              │        PICKER CLOSED              │
                              └──────────┬───────────────────────┘
                                         │ 键入 @
                                         ▼
                    ┌──────────────────────────────────────────┐
                    │  🔍 搜索框 [默认聚焦]                     │
                    │  ─────────────────────────────────────── │
                    │  Smart Landing（上下文/最近/分类）         │
                    └────┬───────────────┬────────────────────┘
                         │               │
                    键入字符          ↓ 跳入列表
                    (实时过滤)            │
                         │               ▼
                         │      ┌─────────────────────┐
                         │      │ 列表聚焦             │
                         │      │ ↑ 过头 → 回搜索框    │
                         │      │ Space = toggle       │
                         │      │ → = Drill In         │
                         │      │ Enter = 确认         │
                         │      └───┬────────┬────────┘
                         │          │        │
                         │     → child   → ref
                         │          │        │
                         │          ▼        ▼
                         │     ┌──────┐  ┌──────────┐
                         │     │CHILD │  │ REF VIEW │
                         │     │VIEW  │  │ (∞ depth │
                         │     │      │  │  + loop  │
                         │     └──────┘  │  detect) │
                         │              └──────────┘
                         │
                         ▼
                ┌────────────────────┐
                │  搜索结果列表       │
                │  第一项自动高亮预览  │
                │  Enter = 选中第一项 │
                │  ↓ = 进入结果列表   │
                └────────────────────┘

    Enter / Esc 分工:
    ┌────────────────────────────────────────────────────────────┐
    │ 搜索框 Enter → 选中第一个高亮结果                           │
    │ 列表 Enter   → 分类=Drill / 实体=加入+暂存提交+关闭        │
    ├────────────────────────────────────────────────────────────┤
    │ 搜索框 Esc   → 关闭 Picker（暂存保留插入）                  │
    │ 列表深层 Esc → 回到 Landing（暂存保留）                     │
    │ 列表 Landing Esc → 关闭 Picker（暂存保留插入）              │
    └────────────────────────────────────────────────────────────┘
```

---

## 5. contenteditable 实现规格

### 5.1 技术路线：方案 A — contenteditable

输入区域采用 `<div contenteditable="true">`，Token 作为 `<span contenteditable="false">` 内联节点嵌入可编辑区域。

**选择理由：** Token 和文字在同一个编辑流里自然共存，光标可以在 Token 前后自由移动，Backspace 删除符合用户对"删除前一个元素"的直觉。

### 5.2 DOM 结构

```html
<div class="chat-input" contenteditable="true" role="textbox" aria-multiline="false">
  请用
  <span class="at-token" contenteditable="false" data-ref='{"path":[...],"leafId":"s3"}'>
    <span class="at-token-icon">⚡</span>
    <span class="at-token-label">smart-questions</span>
    <button class="at-token-remove" tabindex="-1">✕</button>
  </span>
  <!---->
  和
  <span class="at-token" contenteditable="false" data-ref='{"path":[...],"leafId":"r1a"}'>
    <span class="at-token-icon">🍳</span>
    <span class="at-token-label">鱼香肉丝 › 食材准备</span>
    <button class="at-token-remove" tabindex="-1">✕</button>
  </span>
  <!---->
  分析这道菜的备料流程
</div>
```

**关键细节：**
- `data-ref` 属性存储序列化的 `EntityRef`，这是引用的唯一真相来源
- Token 之间和文本之间插入空的 `<!---->` 注释节点或零宽空格 `\u200B`，确保光标能停在 Token 之间
- Token 内的 `<button>` 设置 `tabindex="-1"` 避免 Tab 键焦点被捕获

### 5.3 数据模型与 DOM 同步

维护一个独立于 DOM 的数据模型，DOM 只是渲染层：

```typescript
/** 输入区域的数据模型 */
type InputModel = InputSegment[];

type InputSegment =
  | { type: "text"; content: string }
  | { type: "token"; ref: EntityRef; displayLabel: string };

/** 从 DOM 提取数据模型 */
function serializeInput(container: HTMLDivElement): InputModel { ... }

/** 从数据模型渲染 DOM */
function renderInput(model: InputModel, container: HTMLDivElement): void { ... }

/** 提交消息时序列化为传输格式 */
function toMessagePayload(model: InputModel): MessagePayload {
  return {
    text: model.map(seg =>
      seg.type === "text" ? seg.content : `@[${seg.ref.leafName}]`
    ).join(""),
    refs: model
      .filter((seg): seg is TokenSegment => seg.type === "token")
      .map(seg => seg.ref),
  };
}
```

**同步策略：**
- 用户输入文字 → `input` 事件 → 从 DOM 提取最新模型 → 检测 `@` 触发
- Picker 选中 → 更新模型 → 重新渲染 DOM → 设置光标位置
- 不要在每次 keystroke 都重渲染 DOM，只在模型发生结构性变化（增删 Token）时才完整渲染

### 5.4 键盘事件处理

```typescript
inputDiv.addEventListener("beforeinput", (e: InputEvent) => {
  if (e.inputType === "deleteContentBackward") {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed) return;

    const node = sel.anchorNode;
    const offset = sel.anchorOffset;

    // Case 1: 光标在 Token 右侧的零宽空格中
    // → 删除整个 Token
    if (isZeroWidthSpace(node) && getPreviousSibling(node)?.classList?.contains("at-token")) {
      e.preventDefault();
      const token = getPreviousSibling(node);
      removeTokenFromModel(token.dataset.ref);
      rerenderAndRestoreCursor();
      return;
    }

    // Case 2: 光标在文本节点开头，前方是 Token
    // → 删除整个 Token
    if (offset === 0 && node.nodeType === Node.TEXT_NODE) {
      const prev = getPreviousContentNode(node);
      if (prev?.classList?.contains("at-token")) {
        e.preventDefault();
        removeTokenFromModel(prev.dataset.ref);
        rerenderAndRestoreCursor();
        return;
      }
    }
  }
});
```

### 5.5 中文输入法（IME）处理

```typescript
let isComposing = false;

inputDiv.addEventListener("compositionstart", () => {
  isComposing = true;
  // 如果 Picker 打开，暂停搜索过滤
});

inputDiv.addEventListener("compositionend", (e: CompositionEvent) => {
  isComposing = false;
  // 在 compositionend 后检测 @ 触发
  // 注意：某些浏览器中 compositionend 在 input 事件之前触发
  // 需要用 requestAnimationFrame 确保 DOM 已更新
  requestAnimationFrame(() => {
    const text = extractTextAroundCursor();
    checkAtTrigger(text);
  });
});

inputDiv.addEventListener("input", (e: InputEvent) => {
  if (isComposing) return; // composing 期间不处理
  checkAtTrigger(extractTextAroundCursor());
});
```

### 5.6 光标管理

```typescript
/** 将光标设置到指定节点之后 */
function setCursorAfter(node: Node): void {
  const sel = window.getSelection();
  const range = document.createRange();

  // 找到 Token 后面的零宽空格或文本节点
  const nextText = node.nextSibling;
  if (nextText && nextText.nodeType === Node.TEXT_NODE) {
    range.setStart(nextText, nextText.textContent?.startsWith("\u200B") ? 1 : 0);
  } else {
    // 如果没有后续文本节点，创建一个
    const spacer = document.createTextNode("\u200B");
    node.parentNode?.insertBefore(spacer, node.nextSibling);
    range.setStart(spacer, 1);
  }

  range.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** 
 * Selection normalize: 
 * 点击 Token 后方时，anchorNode 可能落在 Token 内部，
 * 需要校正到 Token 的父节点上
 */
function normalizeSelection(): void {
  const sel = window.getSelection();
  if (!sel?.isCollapsed) return;

  let node = sel.anchorNode;
  while (node && node !== inputDiv) {
    if ((node as HTMLElement).classList?.contains("at-token")) {
      // 光标落在 Token 内部 → 移到 Token 后方
      setCursorAfter(node);
      return;
    }
    node = node.parentNode;
  }
}
```

### 5.7 @ 触发检测

```typescript
function checkAtTrigger(textAroundCursor: string): void {
  // 匹配: 行首的 @ 或空白字符后的 @，后面跟可选的搜索词
  const match = textAroundCursor.match(/(^|[\s\u200B])@([^\s]*)$/);

  if (match) {
    const query = match[2];
    openPicker(query);
  } else if (pickerOpen) {
    closePicker();
  }
}

function extractTextAroundCursor(): string {
  const sel = window.getSelection();
  if (!sel?.isCollapsed) return "";

  const node = sel.anchorNode;
  if (node?.nodeType !== Node.TEXT_NODE) return "";

  // 提取当前文本节点中光标前的文字
  return node.textContent?.slice(0, sel.anchorOffset) || "";
}
```

### 5.8 Token 插入

```typescript
function insertToken(ref: EntityRef): void {
  const sel = window.getSelection();
  if (!sel?.isCollapsed) return;

  // 1. 找到并删除 @+搜索词
  const textNode = sel.anchorNode as Text;
  const offset = sel.anchorOffset;
  const text = textNode.textContent || "";
  const atIndex = text.lastIndexOf("@");

  if (atIndex >= 0) {
    // 删除 @query 部分
    textNode.textContent = text.slice(0, atIndex);
  }

  // 2. 创建 Token DOM 节点
  const tokenEl = createTokenElement(ref);

  // 3. 插入 Token + 零宽空格
  const spacer = document.createTextNode("\u200B");
  textNode.parentNode?.insertBefore(tokenEl, textNode.nextSibling);
  tokenEl.parentNode?.insertBefore(spacer, tokenEl.nextSibling);

  // 4. 光标移到零宽空格后
  setCursorAfter(tokenEl);

  // 5. 更新数据模型
  updateModelFromDOM();
}
```

---

## 6. 数据接口

```typescript
/* ── Picker 数据源 ── */

interface PickerCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  items: PickerItem[];
  loadItems?: () => Promise<PickerItem[]>;  // 懒加载
}

interface PickerItem {
  id: string;
  name: string;
  description?: string;
  children?: PickerChild[];
  refs?: EntityRefLink[];
  metadata?: Record<string, unknown>;
}

interface PickerChild {
  id: string;
  name: string;
  description?: string;
}

interface EntityRefLink {
  targetEntityId: string;
  targetCategoryId: string;
  label: string;                             // "关联课堂记录"
  loadTarget?: () => Promise<PickerItem>;    // 懒加载被引用实体
}

/* ── 引用寻址 ── */

interface EntityRef {
  path: EntityRefSegment[];
  leafId: string;
  leafName: string;
  categoryId: string;
}

interface EntityRefSegment {
  type: "category" | "entity" | "child" | "ref";
  id: string;
  name: string;
}

/* ── 输入模型 ── */

type InputModel = InputSegment[];

type InputSegment =
  | { type: "text"; content: string }
  | { type: "token"; ref: EntityRef; displayLabel: string };

/* ── 消息传输 ── */

interface MessagePayload {
  text: string;          // 纯文本表示，Token 替换为 @[name]
  refs: EntityRef[];     // 所有引用的完整路径
}

/* ── Picker 事件 ── */

interface PickerCallbacks {
  onSelect: (refs: EntityRef[]) => void;
  onCancel: () => void;
}
```

---

## 7. User Stories

### US-1: 单选引用——选择一个资源并退出

**Use Case:**
- As a 在 Chat 中构建 prompt 的开发者
- I want to 键入 @，浏览到目标资源，按 Enter 选择并回到输入
- so that 我可以快速引用一个资源而不打断输入流

**Acceptance Criteria:**

Scenario 1: 完整流程，Token 携带完整路径
- Given: 输入框有文字 "请用"，用户键入 `@`，Picker 打开
- When: 用户导航到 Skills → smart-questions → 按 Enter
- Then: Picker 关闭，输入框插入 Token `[⚡ smart-questions]`，Token 的 `data-ref` 包含完整 EntityRef `path: [{category, "skills"}, {entity, "s3"}]`

Scenario 2: 选择子项，Token 显示父级上下文
- Given: 用户导航到 Recipes → 鱼香肉丝 → 食材准备
- When: 按 Enter
- Then: Token 显示为 `[🍳 鱼香肉丝 › 食材准备]`，EntityRef path 包含 3 段

---

### US-2: 多选引用——Add & Stay

**Use Case:**
- As a 需要引用多个工具的解决方案工程师
- I want to 用 Space 或 + 按钮逐个添加，最后 Esc 提交
- so that 不必反复触发 @

**Acceptance Criteria:**

Scenario 1: 键盘多选
- Given: 用户在 Tools 列表
- When: 在 playwright-mcp 上按 Space → ↓ → 在 notion-mcp 上按 Space
- Then: 暂存区显示 2 项，列表中两项显示 ✓

Scenario 2: 鼠标多选（+ 按钮）
- Given: 用户在 Tools 列表
- When: 点击 playwright-mcp 行左侧的 + 按钮
- Then: 该项添加到暂存区，+ 变为绿色 ✓；再次点击 toggle 移除

Scenario 3: 跨分类多选后提交
- Given: 暂存区有 2 个来自不同分类的 token
- When: 按 Esc
- Then: 所有 token 插入输入框，每个 Token 携带独立的完整 EntityRef

---

### US-3: 层级导航与实体上下文

**Use Case:**
- As a 需要引用菜谱特定章节的用户
- I want to Drill In 后清楚看到"我现在在哪"
- so that 不会把鱼香肉丝的食材准备和红烧牛腩的搞混

**Acceptance Criteria:**

Scenario 1: Entity Banner 显示上下文
- Given: 用户导航到 Recipes → 鱼香肉丝
- When: 按 → 进入子项列表
- Then: 列表顶部显示 Entity Banner（图标 + "鱼香肉丝" + 描述 + "4 sections"），面包屑显示 `@ › 🍳 Recipes 菜谱 › 鱼香肉丝`

Scenario 2: 面包屑可点击回跳
- Given: 用户在鱼香肉丝的子项列表
- When: 点击面包屑中的 `🍳 Recipes 菜谱`
- Then: 视图跳回 Recipes 分类的实体列表

---

### US-4: 跨实体引用导航

**Use Case:**
- As a 教师浏览教案时发现关联的课堂记录
- I want to 从教案直接 Drill In 到课堂记录的子项
- so that 我可以精确引用某段课堂视频而不必手动切换分类

**Acceptance Criteria:**

Scenario 1: ref 项在列表中显示
- Given: 用户进入 "第三课教案" 的子项列表
- When: 子项列表渲染完成
- Then: 列表分为两组——"自身内容"（教学目标、步骤...）和"关联引用"（↗ 课堂记录...），ref 项用 ↗ 箭头和较淡色调区分

Scenario 2: Drill Into ref
- Given: "↗ 课堂记录-03-15" 被高亮，右侧显示 `3 ›`
- When: 按 →
- Then: 懒加载课堂记录的子项（课前点名、视频片段...），Entity Banner 显示课堂记录的信息，面包屑 `@ › 📋 教案 › 第三课教案 › ↗ 课堂记录-03-15`

Scenario 3: 从 ref 的子项选择，Token 携带完整跨实体路径
- Given: 用户在课堂记录-03-15 的子项列表中
- When: 选择 "视频片段: 小组讨论" 并按 Enter
- Then: Token 显示 `[📋 ...课堂记录 › 视频片段]`，EntityRef path 为 4 段：`[教案, 第三课教案, ref:课堂记录, 视频片段]`

Scenario 4: Loop 检测——ref 指向路径中已存在的实体
- Given: 用户从 教案 → 第三课教案 → ref:课堂记录 → ref:课堂视频，课堂视频有 ref 指回第三课教案
- When: 列表渲染时检测到 第三课教案 已在 navStack 中
- Then: 该 ref 显示 `⟲ 已在路径中`，灰色调，不显示 `›`，→ 键无效，但仍可 Enter 选择或 Space 添加

Scenario 5: 在更深层级继续 drill ref（无深度限制）
- Given: 用户在 ref:课堂视频 的子项列表中，其中有 ref 指向 "标注文档"（路径中不存在）
- When: 按 → drill 进 "标注文档"
- Then: 正常进入标注文档的子项列表，面包屑追加 `↗ 标注文档`

---

### US-5: 搜索结果显示完整来源路径

**Use Case:**
- As a 搜索 "食材" 的用户
- I want to 搜索结果中看到每条结果来自哪个父实体
- so that 我可以区分鱼香肉丝的食材准备和红烧牛腩的选材要点

**Acceptance Criteria:**

Scenario 1: 搜索结果带路径标签
- Given: Picker 打开
- When: 用户键入 "食材"
- Then: 结果列表中，"食材准备" 上方显示路径标签 `🍳 Recipes › 鱼香肉丝`，"选材要点" 上方显示 `🍳 Recipes › 红烧牛腩`

---

### US-6: Token 管理

**Use Case:**
- As a 需要修正引用的用户
- I want to 在 contenteditable 输入框中用 Backspace 删除 Token
- so that 修正错误引用

**Acceptance Criteria:**

Scenario 1: Backspace 删除 Token
- Given: 输入框 `请用 [⚡ smart-questions]| 分析`（| 为光标位置）
- When: 按 Backspace
- Then: Token 被整体移除，光标回到 "请用 " 后方

Scenario 2: 点击 Token 上的 ✕
- Given: Token 显示 `[🍳 鱼香肉丝 › 食材准备] ✕`
- When: 点击 ✕
- Then: Token 从 DOM 和数据模型中移除

Scenario 3: Token hover 显示完整路径
- Given: Token 显示为 `[📋 ...课堂记录 › 视频片段]`（省略了中间层级）
- When: 鼠标 hover Token
- Then: Tooltip 显示完整路径 `教案 → 第三课教案 → ↗ 课堂记录-03-15 → 视频片段: 小组讨论`

---

### US-7: 双焦点模型——搜索框 vs 列表

**Use Case:**
- As a 在 Picker 中操作的用户
- I want to 按键行为完全由"我的焦点在搜索框还是列表"决定
- so that 我不需要记住隐藏的状态来预测按键结果

**Acceptance Criteria:**

Scenario 1: 打开 Picker → 搜索框自动聚焦
- Given: 用户键入 `@`
- When: Picker 打开
- Then: 搜索框聚焦（光标闪烁），下方显示 Smart Landing 内容，列表第一项带浅色高亮预览

Scenario 2: 搜索框中 Space = 空格
- Given: 焦点在搜索框，用户已输入 "红烧"
- When: 按 Space
- Then: 搜索框中输入空格字符，变为 "红烧 "，列表实时过滤

Scenario 3: ↓ 从搜索框跳入列表
- Given: 焦点在搜索框，列表显示 Smart Landing 内容
- When: 按 ↓
- Then: 焦点移到列表第一项，高亮加深，搜索框失去光标但保留文字

Scenario 4: 列表中 Space = toggle 添加（带动画反馈）
- Given: 焦点在列表，高亮在"鱼香肉丝"
- When: 按 Space
- Then: 鱼香肉丝添加到暂存区，该行闪绿色（flashGreen, 600ms），暂存区出现新 token pill（popIn 弹入, 250ms），列表中 + 变为绿色 ✓

Scenario 5: ↑ 过列表顶部 → 回到搜索框
- Given: 焦点在列表，高亮在第一项
- When: 按 ↑
- Then: 焦点回到搜索框，搜索词和列表高亮保留

Scenario 6: 搜索框中 Enter = 选中第一个结果
- Given: 焦点在搜索框，用户键入 "教案"，列表过滤显示"第三课教案"（第一项高亮预览）
- When: 按 Enter
- Then: "第三课教案" + 暂存区一起提交，Picker 关闭

Scenario 7: 列表中 Enter 在分类上 = 始终 Drill In
- Given: 焦点在列表，高亮在分类 "Recipes"，暂存区有 2 个 token
- When: 按 Enter
- Then: 进入 Recipes（Drill In），暂存区保留（**不提交**——Enter 在分类上始终是进入）

Scenario 8: 列表中 Enter 在实体上 = 加入 + 提交
- Given: 焦点在列表，高亮在"鱼香肉丝"，暂存区有 1 个 token
- When: 按 Enter
- Then: 鱼香肉丝加入 + 暂存区共 2 个 token 提交，Picker 关闭

Scenario 9: 列表中键入字符 → 焦点回搜索框
- Given: 焦点在列表
- When: 用户键入 "张"
- Then: 焦点回到搜索框，"张" 被输入，列表实时过滤

Scenario 10: Esc 从深层回 Landing（带淡入过渡）
- Given: 焦点在列表，用户在 教案 → 第三课教案 子项中，暂存区有 1 个 token
- When: 按 Esc
- Then: 视图切回 Smart Landing（列表内容 fadeIn 150ms，避免跳变），暂存区保留，焦点回到搜索框

Scenario 11: Esc 从 Landing 关闭（保留暂存）
- Given: 焦点在列表或搜索框，用户在 Landing，暂存区有 2 个 token
- When: 按 Esc
- Then: Picker 关闭，2 个 token 保留插入到输入框（永不丢弃）

---

### US-8: 鼠标辅助——行内 + 按钮与 n › 按钮

**Use Case:**
- As a 偏好鼠标操作的用户
- I want to 用 + 按钮添加、用 n › 按钮展开子级
- so that 每种操作都有明确的鼠标入口

**Acceptance Criteria:**

Scenario 1: + 按钮 = Add & Stay（带动画）
- Given: 实体列表中某项未被添加
- When: 点击行左侧的 + 按钮
- Then: 该项加入暂存区，行闪绿色（flashGreen），暂存区新 token 弹入（popIn），+ 变为绿色 ✓

Scenario 2: n › 按钮 = Drill In
- Given: 实体有 4 个子项，右侧显示 `4 ›`
- When: 点击 `4 ›`
- Then: 进入该实体的子项列表（等同于 →）

Scenario 3: 点击行本身 = Select & Close
- Given: 实体列表中某项被高亮
- When: 点击行主体区域（非 + 按钮、非 n › 按钮）
- Then: 等同于 Enter（选择并退出）

---

### US-9: Smart Landing——上下文感知的初始视图

**Use Case:**
- As a 键入 @ 的用户
- I want to 立刻看到与我当前工作最相关的引用候选
- so that 80% 的情况下我不需要浏览分类就能找到目标

**Acceptance Criteria:**

Scenario 1: 有页面上下文时显示当前实体
- Given: 用户在鱼香肉丝的编辑页面打开 chatbox
- When: 键入 @
- Then: Smart Landing 顶部显示 "★ 当前上下文" 区域，包含鱼香肉丝，可直接 Enter 引用或 → drill 进子项

Scenario 2: 全局/首页打开时无上下文区域
- Given: 用户在平台首页打开 chatbox
- When: 键入 @
- Then: Smart Landing 无 "★ 当前上下文" 区域，直接显示最近访问和分类浏览

Scenario 3: 最近访问区域
- Given: 用户过去 7 天访问过 harness-design-v2.md、第三课教案、playwright-mcp
- When: 键入 @
- Then: "◷ 最近访问" 区域显示这 3 项，可直接 Space 添加或 Enter 选择

Scenario 4: 分类按频率排序
- Given: 用户过去 30 天引用 Recipes 20 次、教案 8 次、Tools 3 次、Skills 0 次
- When: Smart Landing 的 "📁 浏览全部" 区域渲染
- Then: 分类按 Recipes → 教案 → Tools → Skills 排序

---

### US-10: Loop 检测——循环引用不可 Drill

**Use Case:**
- As a 在 ref 链中导航的用户
- I want to 系统自动检测循环引用并阻止我进入死循环
- so that 我不会在 A → B → C → A 中无限打转

**Acceptance Criteria:**

Scenario 1: Loop ref 标记
- Given: 用户在 教案 → 第三课教案 → ref:课堂记录 → ref:课堂视频，视频有 ref 指回 "第三课教案"
- When: 子项列表渲染
- Then: "↗ 第三课教案" 右侧显示 `⟲ 已在路径中`（灰色），不显示 `›`

Scenario 2: Loop ref 按 → 触发 shake 反馈
- Given: "↗ 第三课教案" 被高亮，标记为 loop
- When: 按 →
- Then: 该行触发 shake 动画（左右抖动 400ms），⟲ 旁弹出红色 tooltip "已在路径中，无法展开"（自动消失），不执行 Drill In
- When: 按 Enter
- Then: 正常选择 "第三课教案" 并退出（shake 不影响 Enter/Space 操作）

Scenario 3: Loop ref 可添加到暂存区
- Given: "↗ 第三课教案" 被高亮，标记为 loop
- When: 按 Space 或点击 +
- Then: 正常添加到暂存区

---

### US-11: / Command Palette——插入技能命令

**Use Case:**
- As a 需要用 Skill 处理引用内容的用户
- I want to 键入 `/` 选择一个技能插入到消息中
- so that 我可以在同一条消息中组合引用 + 命令 + 自然语言参数

**Acceptance Criteria:**

Scenario 1: 键入 / 打开 Command Palette
- Given: 输入框焦点在内，用户已插入 `@鱼香肉丝` Token
- When: 用户键入 `/`
- Then: Command Palette 浮层出现，显示最近使用的技能 + 按分组的技能列表

Scenario 2: 搜索过滤技能
- Given: Command Palette 打开
- When: 用户继续键入 "round"
- Then: 列表过滤为匹配项 "roundtable-discussion"，匹配文字加粗

Scenario 3: Enter 插入命令（不执行）
- Given: "roundtable-discussion" 被高亮
- When: 按 Enter
- Then: Command Palette 关闭，输入框中插入 `/roundtable-discussion` pill（金色样式），光标移到 pill 后方，**用户可继续输入参数文字**

Scenario 4: 完整的协作消息
- Given: 输入框包含 `@鱼香肉丝 @红烧牛腩 /roundtable-discussion 请对比这两道菜的难度`
- When: 用户按发送按钮
- Then: 消息携带 2 个 EntityRef + 1 个 SkillCommand + 自然语言参数

Scenario 5: / pill 可删除
- Given: 输入框包含 `/roundtable-discussion` pill
- When: 光标在 pill 右侧按 Backspace
- Then: pill 被整体删除，与 `@` Token 删除行为一致

**Notes:**
- `/` 和 `@` 的核心统一原则：**都只是往输入框里插入内容，不触发执行。** 发送消息才触发执行。
- 单条消息中允许最多 1 个 `/` 命令（如果需要多个技能串联，后续版本考虑 pipeline 语法）。

---

### US-12: 多路径导航——同一实体不同入口

**Use Case:**
- As a 教师想引用特定学生
- I want to 既能从班级进入找到学生，也能直接从学生分类找到
- so that 我可以根据当前操作语境选择最合适的引用路径

**Acceptance Criteria:**

Scenario 1: 搜索结果展示多条路径
- Given: 学生 "张小明" 同时存在于 "学生" 和 "班级 › 三年一班" 两个路径
- When: 用户搜索 "张小明"
- Then: 搜索结果显示两条记录，分别带有 `👤 学生` 和 `🏫 班级 › 三年一班` 的路径标签

Scenario 2: 不同路径产生不同 Token
- Given: 用户从 "班级 › 三年一班" 路径选择张小明
- When: Token 插入
- Then: Token 显示 `[🏫 三年一班 › 张小明]`，EntityRef path 为 3 段

Scenario 3: 从学生分类直接选择
- Given: 用户从 "学生" 分类选择张小明
- When: Token 插入
- Then: Token 显示 `[👤 张小明]`，EntityRef path 为 2 段

---

### US-13: Entity Icon 层级——不同实体不同视觉标识

**Use Case:**
- As a 在列表中浏览多种类型实体的用户
- I want to 通过图标快速区分实体类型
- so that 我不需要阅读文字就能定位目标

**Acceptance Criteria:**

Scenario 1: 自定义头像优先显示
- Given: 学生 "张小明" 有头像照片（L3 icon）
- When: 列表中显示该学生
- Then: 显示圆形头像，而不是通用的 👤 图标

Scenario 2: 无头像回退到类型图标
- Given: 学生 "李四" 没有头像
- When: 列表中显示该学生
- Then: 显示 👤 图标（L2 entity type icon）

Scenario 3: Token pill 中显示 icon
- Given: 张小明的 Token 被插入
- When: Token pill 渲染
- Then: pill 左侧显示 16x16 圆形头像，后跟名称

---

## 8. 边界情况

| 场景 | 处理 |
|---|---|
| 分类下无项目 | 显示 "暂无可用 [分类名]" |
| 搜索无结果 | 显示 "未找到匹配的资源" |
| 暂存区满（≥ 10） | + 按钮灰置，Space 无效 + toast |
| 同一项被重复 Space / + | Toggle：已添加 → 移除 |
| ref 加载失败 | ref 行显示 "加载失败" + 重试按钮 |
| ref 形成循环（A→B→A） | loop ref 显示 `⟲ 已在路径中`，可选不可 drill |
| ref 链很长（>10 跳） | 面包屑水平滚动 + Esc 跳回 Landing |
| 中文输入法 composing | compositionend 后检测 @ |
| 粘贴文本 | 关闭 Picker，粘贴正常插入 |
| 多个同名子项（不同父实体） | 通过 EntityRef path 保证唯一性 |
| Token 的 data-ref 被意外修改 | 提交时 re-validate，无效 ref 标红 |
| contenteditable 中 Selection 异常 | normalizeSelection 兜底 |

---

## 9. 性能要求

| 指标 | 目标 |
|---|---|
| Picker 出现 | < 80ms |
| 搜索过滤 | < 30ms（本地） |
| 子项 / ref 懒加载 | < 400ms |
| Token 插入到光标就位 | < 50ms |
| contenteditable rerender | < 16ms (1 frame) |
| 单消息最大 ref 数 | ≤ 20 |

---

## 10. 里程碑

| 阶段 | 范围 |
|---|---|
| **M1 Core** | contenteditable 输入框 + 三级导航 + Enter 选择 + EntityRef Token |
| **M2 Multi-select** | Space 添加 + + 按钮 + 暂存区 + Enter 确认/Esc 退出分工 |
| **M3 Refs** | Entity-to-Entity 引用导航 + 懒加载 + Loop 检测 |
| **M4 Smart Landing** | 上下文感知初始视图 + 最近访问 + 频率排序 |
| **M5 / Command** | / Command Palette + Skill 分组 + 最近使用 + @ / 协作 |
| **M6 Entity Icons** | 三层 icon 体系 + 头像渲染 + Token pill icon |
| **M7 Multi-path** | 同实体多路径 + 搜索结果多条展示 + 路径语义 |
| **M8 Search** | 跨层级模糊搜索 + 高亮匹配 + 数量限制 |
| **M9 A11y** | ARIA combobox 模式 + 屏幕阅读器 + 键盘无障碍 |
| **M10 Polish** | IME 处理、Selection normalize、动画、tooltip |

---

## 11. Open Questions

1. ~~**[RESOLVED]** ref 深度限制~~ → 无深度限制，改用 loop 检测
2. **[DECISION]** ref 加载失败时是否允许用户手动输入目标实体 ID？
3. **[DECISION]** EntityRef 是否需要版本号？如果被引用实体的结构变化（如菜谱新增了一个 section），旧引用如何处理？
4. **[VALIDATE]** Token 的省略显示规则（`…parentName › leafName`）是否直观？
5. **[TECH]** contenteditable 在移动端 Safari 的 Selection API 兼容性问题
6. ~~**[RESOLVED]** ref 的循环引用检测~~ → navStack 级 loop 检测 + `⟲ 已在路径中` 标记
7. **[DECISION]** 是否支持 `#` 作为第二触发符（频道/话题引用）？
8. **[VALIDATE]** Loop ref 的路径压缩规则（A→B→C→A 压缩为 A）是否符合用户预期？还是应该保留完整路径并标注 loop？
9. **[TECH]** 面包屑在 ref 链很长时的渲染策略——水平滚动？还是折叠中间段？
10. **[VALIDATE]** Smart Landing 的最近访问数量——3 项还是 5 项？太少不够用，太多挤压分类空间
11. **[DECISION]** 最近访问的时间窗口——7 天？30 天？还是按次数排？
