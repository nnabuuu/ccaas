# Harness Specification: Tool Usage Display

## Task
- **Artifact**: `packages/chat-interface` 中的工具调用和思考过程展示组件（ToolActivityBlock, ThinkingBlockView, ToolGroup, MessageRenderer 中的相关逻辑）
- **Current state**: 功能已实现（工具调用和思考数据可传入渲染），但视觉交互与 Claude Web 有显著差距——工具用边框卡片包裹，彩色 emoji 图标，✅+耗时文字噪音多，整体打断阅读流
- **Target audience**: 1) 开发者/设计者（视觉对标 Claude Web）2) edu-platform 终端用户（老师，需要无技术背景可理解）
- **Goal**: 让工具/思考展示从"插入的 UI 组件"变为"对话的自然延续"，视觉语言对齐 Claude Web

## Reference Images

评估时必须参考以下图片（均在 `packages/chat-interface/reference/` 下）：

| 文件名 | 内容 |
|--------|------|
| `tool-usage-show.png` | Claude Web 工具展开态：bash 命令灰底块 + 输入/输出标签 + 步骤列表 |
| `工具-思考中.png` | Claude Web 思考态 + 右侧 edu-platform Widget 渲染效果 |
| `工具-折叠.png` | Claude Web 工具折叠态设计说明 |
| `工具-展开.png` | Claude Web 工具展开态：无边框步骤列表 + 文件产物 chip + ✅完成图标 |

## Frozen Constraints

以下文件/逻辑**不可修改**：
- Widget 渲染组件（`WidgetRenderer.tsx`, `InfoCard`, `BarList`, `NextActions`, `MetricDashboard` 等）
- `postprocessor.ts` 中 `show_info_card` / `suggest_actions` 的 widget 转换逻辑
- `react-sdk/src/hooks/useAgentChat.ts` 的事件处理逻辑
- `chat-interface/src/types/chat.ts` 和 `types/widget.ts` 的类型定义
- `ChatCoreContext.tsx` 中 sdkBlocks → ChatMessage 的转换流程
- `ChatInterfaceContext.tsx` 中 `toolRenderers` 扩展点机制

## Modifiable Files

Generator 可以修改以下文件：
- `packages/chat-interface/src/components/ToolActivityBlock.tsx` — 单个工具渲染
- `packages/chat-interface/src/components/ThinkingBlockView.tsx` — 思考过程渲染
- `packages/chat-interface/src/components/ToolGroup.tsx` — 工具分组容器
- `packages/chat-interface/src/components/MessageRenderer.tsx` — `groupBlocks()` 分组逻辑 + ContentBlockView 中 `tool_use` / `thinking` case
- `packages/chat-interface/src/harness/postprocessor.ts` — 非 widget 工具的 ToolUseBlock 构建逻辑（如 description 字段填充）
- `packages/chat-interface/tailwind.config.js` — 新增样式 token（如动画、颜色）

## Eval Rubric

### Scoring Dimensions

| # | Dimension | Weight | Detection Method |
|---|-----------|--------|------------------|
| 1 | 内联融合度 | 20/100 | 截图对比：工具行是否无边框、与文本共享排版节奏 |
| 2 | 视觉轻量感 | 15/100 | 截图对比：图标是否克制、状态指示是否内敛 |
| 3 | 展开内容格式 | 15/100 | 截图对比 + 代码审查：灰底块+标签风格 |
| 4 | 折叠/展开交互 | 10/100 | 截图对比 + 代码审查：分组逻辑、默认状态 |
| 5 | 教育场景可理解性 | 15/100 | 截图审查：MCP 工具名是否转为人类可读标签 |
| 6 | Widget 兼容性 | 10/100 | 截图对比：InfoCard/BarList/NextActions 渲染正常 |
| 7 | 页面完整性回归 | 15/100 | 全页面截图审查：Composer、侧栏、空状态、布局是否因改动而损坏 |

### Dimension Details

#### D1: 内联融合度（20 points）
- **5/5 (20pts)**: 工具行无边框无背景，与文本行共享相同排版节奏（字号、行高、缩进）；工具间可穿插 AI 叙述文本；步骤图标与文字左对齐。参考：Claude Web `工具-展开.png` 中 ⏱/📋/✅ 行的样式
- **3/5 (12pts)**: 工具行有轻微视觉区分（如极浅背景 hover），但不使用独立边框/卡片；基本融入对话流
- **1/5 (4pts)**: 工具用 `border` 包裹成独立卡片，视觉上像嵌入的外来 UI 组件，打断阅读连续性

#### D2: 视觉轻量感（15 points）
- **5/5 (15pts)**: 小型分类徽章（参考 `工具-折叠.png`：紫色 M=MCP，蓝色 AI=LLM，绿色 F=文件），不使用彩色 emoji；状态通过图标变化表达（如 spinner → ✓），不显示耗时文字；整体视觉重量与 Claude Web 一致
- **3/5 (9pts)**: 图标克制（小且不刺眼），可能有轻微耗时显示但不突出；视觉噪音可接受
- **1/5 (3pts)**: 彩色 emoji 图标 + ✅❌ 文字 + 耗时 ms 文字并列，视觉元素过多

#### D3: 展开内容格式（15 points）
- **5/5 (15pts)**: 展开区使用灰底圆角块，有明确标签（如 "bash" / "命令输出"）；代码用 monospace；参考 `tool-usage-show.png` 中 "Create prototypes directory" 的展开样式
- **3/5 (9pts)**: 有合理的展开区分（背景或缩进），但标签不够清晰或样式不够统一
- **1/5 (3pts)**: 展开内容仅用 `border-l` 分隔或无任何背景区分，与折叠行视觉混淆

#### D4: 折叠/展开交互（10 points）
- **5/5 (10pts)**: 思考过程可折叠为单行摘要（`>` chevron）；多步骤工具链默认折叠为摘要行；执行中自动展开显示进度；完成后默认折叠；单个工具可独立点击展开详情
- **3/5 (6pts)**: 有折叠/展开功能但默认状态不合理（如完成后仍展开），或分组粒度不当
- **1/5 (2pts)**: 不可折叠，或所有工具永远展开，或折叠逻辑混乱

#### D5: 教育场景可理解性（15 points）
- **5/5 (15pts)**: MCP 工具使用自然语言描述（如 `teaching_progress` → "查询教学进度"）；描述文本是行为导向（"正在查询..." / "已获取数据"）而非技术导向；老师无需技术知识即可理解
- **3/5 (9pts)**: 显示简化工具名（strip MCP prefix）+ 辅助摘要，老师大致能猜到在做什么
- **1/5 (3pts)**: 显示原始工具名和 JSON 参数，需要技术背景才能理解

#### D6: Widget 兼容性（10 points）
- **5/5 (10pts)**: InfoCard/BarList/NextActions/FileCard 渲染完全不受影响；Widget 与工具展示在同一消息中共存且视觉协调；没有重复渲染（widget 工具不同时显示为 ToolUseBlock）
- **3/5 (6pts)**: Widget 能渲染但与工具展示有轻微样式冲突（间距不一致等）
- **1/5 (2pts)**: Widget 被工具展示逻辑干扰，渲染异常或丢失

#### D7: 页面完整性回归（15 points）
- **5/5 (15pts)**: 改动后全页面无任何布局/功能回归：Composer 输入区位置正确、发送按钮在右侧、侧栏展开/折叠正常、空状态页面正常、滚动行为正常、响应式布局不受影响
- **3/5 (9pts)**: 页面主要功能正常但有轻微视觉问题（如间距不一致、元素微偏移），不影响核心操作
- **1/5 (3pts)**: 改动引入了明显的布局/功能回归：按钮位置错误、输入区不可用、侧栏异常、页面元素重叠或错位

### Penalty Rules
- Widget 工具（`show_info_card`, `suggest_actions`）同时作为 ToolUseBlock 显示 → **-10 分**
- `tsc --noEmit` 编译失败 → **该轮直接 0 分，必须先修复**
- 修改了 Frozen 文件 → **该轮直接 0 分，必须回退**
- 引入新的 npm 依赖 → **-5 分**（应尽量用 tailwind + 内联 SVG 解决）
- **引入新的 UI bug（布局错位、按钮位置错误、功能不可用）→ -10 分/个**

### Threshold
- **Pass score**: 80/100
- **Target score**: 95/100

## Agent Architecture

### Generator
- **Role**: 修改 chat-interface 组件代码，使工具/思考展示对标 Claude Web 参考图
- **Perspective**: 你是一个前端工程师，目标是让工具调用展示从"独立 UI 卡片"变成"对话流中的自然步骤"。每轮聚焦 Evaluator 指出的最大问题。
- **Input**:
  - 可修改文件的当前代码
  - 4 张参考截图（`packages/chat-interface/reference/`）
  - 上一轮 evaluator 的评分和反馈（`eval-reports/vN-eval.md`）
  - `progress.md` 历史记录
- **Output**:
  - 修改后的组件文件
  - `changelogs/vN-changelog.md` — 描述本轮改动和改动原因
- **Constraints**:
  - 每轮修改后必须 `tsc --noEmit` 通过
  - 不可修改 Frozen 文件
  - 优先解决 Evaluator 标记的最大失分维度

### Evaluator
- **Role**: 独立上下文评估，截图对比 + 代码审查，逐维度打分
- **Perspective**: 你是 UX 评审专家，从未参与过代码编写。你对比实际截图和 4 张参考图，按 rubric 逐维度打分。你对视觉细节极度挑剔。**你必须审视整个页面，不只是工具展示区域。**
- **Input**:
  - 4 张参考截图
  - 当前版本截图（由 harness 自动截取，**必须包含全页面截图**）
  - 可修改文件的当前代码（用于验证 penalty rules）
  - Eval rubric（本文件）
- **Output**: `eval-reports/vN-eval.md`，包含：
  - 7 维度各自的分数 + 具体问题描述
  - 总分
  - 下一轮建议优先改进的 1-2 个维度
  - 截图中的具体问题标注（**包括非工具区域的问题**）
- **Isolation**: 必须在独立上下文中运行，不共享 Generator 的对话历史

## Verification Steps (per iteration)

```bash
# 1. Type check
cd packages/chat-interface && npx tsc --noEmit

# 2. Build
cd packages/chat-interface && npm run build

# 3. Edu-platform type check
cd solutions/business/edu-platform/frontend && npx tsc --noEmit

# 4. Screenshot (via browse tool)
# Navigate to http://localhost:5290
# Send test message: "帮我查一下八年级2班的教学进度和学生掌握情况"
# Wait for response, take screenshots (ALL required):
#   a. 全页面顶部（含工具展示 + Composer 输入区可见）
#   b. 展开工具详情（点击一个工具，验证展开格式）
#   c. 全页面底部（Composer 区域 + 发送按钮 + Quick suggestions）
#   d. 空状态页面（新建对话，验证 Composer 在无消息时的布局）
#   e. 侧栏折叠/展开状态
```

### Baseline 对比

每轮迭代**开始前**，先截一张当前状态的全页面截图作为 baseline。改动后对比差异，确保：
- Composer 区域未被影响
- 发送按钮位置未变
- 侧栏交互未被破坏
- 空状态/欢迎页面正常

## Exit Conditions
- **Target**: 总分 ≥ 95/100
- **Max iterations**: 8 轮
- **Diminishing returns**: 连续 2 轮得分提升 < 3 分时停止
- **Hard stop**: `tsc --noEmit` 失败连续 2 轮 → 停止，人工介入
- **Regression stop**: D7 得分 ≤ 1/5 → 必须先修复回归再继续迭代

## Progress Tracking
- **Log file**: `harness-workspace/tool-usage-display/progress.md`
- **Per-iteration record**: 版本号, 时间戳, 总分, 各维度得分（含 D7）, 本轮主要改动, Evaluator 指出的最大未解决问题

## Estimated Resource Usage
- **Iterations**: 5-8 轮
- **Tokens per iteration**: ~30K (generator) + ~20K (evaluator) + ~5K (screenshot verification)
- **Total estimated cost**: ~$3-5
