# Creator v7 — 信息架构重构文档

> 从 v6 到 v7 的设计决策记录

---

## 一、核心问题

v6 的页面层级存在三类信息混淆：

| 层次 | 定义 | v6 的问题 |
|---|---|---|
| **项目身份** | 创建时确定，不随编辑变化 | 左侧 header 混入执行设计统计（5 Steps / 13 模块 / 9 Ref） |
| **项目内容** | 用户创作的可编辑内容 | 教案/执行/Skills/Review 的层级和入口不清晰 |
| **项目评估** | 从内容推导的计算结果 | 健康度/洞察重复出现在 AI 面板和 Review tab |

**根本原则：每一层信息只出现在一个位置，不重复。**

---

## 二、架构决策

### 2.1 顶栏 — 项目身份

**决策**：项目身份统一放入全宽顶栏。

| 属性 | 保留/删除 | 理由 |
|---|---|---|
| 课程标题 | ✓ 保留 | 项目固有属性 |
| 学科（英语） | ✓ 保留 | 项目固有属性 |
| 年级（高一） | ✓ 保留 | 项目固有属性 |
| 时长（45min） | ✓ 保留 | 项目固有属性 |
| 班级（高一3班） | ✗ 删除 | 班级是执行时概念，谁 join 就是谁 |
| Steps/模块/Ref/AI模块 | ✗ 删除 | 执行设计的衍生统计，不是项目属性 |

### 2.2 左侧面板 — 纯 AI 对话

**决策**：左侧面板只做一件事 — AI 对话。

删除的内容：
- ~~"✦ AI 助手" header~~ — 用户看到 chat 自然知道是 AI
- ~~"上下文" context bar~~ — 上下文信息融入 input placeholder
- ~~"◇ 洞察" tab~~ — 健康度/洞察合入 Review
- ~~Stats row~~ — 项目身份移到顶栏
- ~~Suggestion buttons~~ — 移除固定建议，AI 在对话中自然推荐

保留：
- 对话消息流
- 输入框（placeholder 根据当前编辑上下文动态变化）
- 未来支持多 conversation

### 2.3 右侧 — 固定 tabs + 动态 tabs

**固定 tabs**（始终存在）：
- **教案设计** — 教学要求、素养目标、模块划分
- **执行设计** — Steps / Blocks 画布
- **Skills·连接器** — AI 技能启停 + MCP 数据源

**动态 tabs**（按需打开，可关闭）：
- **文件 tab** — 从 📁 文件 popover 点击打开，按类型渲染
- **Review 审计 tab** — 点击"◇ 运行审计"生成

### 2.4 文件系统 — 轻量入口

**决策**：文件是"偶尔看看底层"，不需要独立 tab。

- 📁 文件按钮在顶栏，popover 展示分类文件列表
- 点击文件 → 打开为动态 tab（不是 slide-over）
- ref 文件显示"跳转到模块 →"按钮
- markdown 文件渲染为富文本，JSON 格式化展示

### 2.5 教案设计 — Source of Truth

**决策**：教案是信息源头，不展示衍生状态。

- 删除"已覆盖/未覆盖"标签 — 覆盖状态是 Review 的职责
- 删除右侧 stats sidebar — 统计数据重复了主编辑器的内容
- 教学要求改为"从学业要求库选取"（picker modal），不是自由文本
- 每条要求显示来源分类 + 课标编号

### 2.6 Review — 生成结果，非固定 tab

**决策**：Review 是一次审计生成的结果，不是常驻视图。

- 从固定 tab 改为"◇ 运行审计"触发按钮
- 每次生成一个可关闭的动态 tab
- 未来可支持多次审计结果对比

---

## 三、信息流向

```
学业要求库 ──pick──→ 教案设计（教学要求）
课标知识图谱 ────→ 教案设计（素养目标）
课文库 ──assign──→ 项目（顶栏标题）

教案设计 ──参考──→ 执行设计（Steps/Blocks）
执行设计 ──$ref──→ 模块文件（JSON）
模块文件 ──配置──→ AI Skills

教案 + 执行 ──AI lint──→ Review 审计（按需生成）
```

---

## 四、文件清单

| 文件 | 角色 |
|---|---|
| `creator-v7.html` | 入口 HTML |
| `creator-v7-app.jsx` | 主 App：顶栏、动态 tab 系统、文件 tab 内容 |
| `creator-v7-ai-left.jsx` | 左侧纯 AI 对话面板 |
| `creator-v3-plan.jsx` | 教案设计 tab（含学业要求库 picker） |
| `creator-v6-exec.jsx` | 执行设计画布（unchanged） |
| `creator-v6-skills.jsx` | Skills·连接器 tab（unchanged） |
| `creator-v3-views.jsx` | Review tab 内容（unchanged） |
| `creator-v3-content.jsx` | Block 编辑器内容 tab（unchanged） |
| `creator-v2-observe.jsx` | 观察/规则/预览 tab（unchanged） |
| `creator-shared.jsx` | 共享组件：Btn, Badge, etc |
| `creator-v4-data.jsx` | 数据：课程、文件系统、组件注册 |
