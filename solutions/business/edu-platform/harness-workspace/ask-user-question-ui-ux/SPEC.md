# Spec: AskUserQuestion Widget — UI/UX 实现

## Context

edu-platform 的 chat-interface 需要一个嵌入式参数收集组件（AskUserQuestion Widget）。当 AI Skill 需要收集用户偏好时（出题的题型/难度、学情报告的维度/周期等），在消息流中渲染结构化选项面板，减少用户打字。

**现有状态**:
- `AskUserQuestionRenderer.tsx` 已有基础实现（简单的选项按钮列表）
- 已注册在 `App.tsx` 的 `customToolRenderers` 中
- 使用 `useChatCore().handleAction()` 发送用户选择
- HTML 原型 `ask-user-question.html` 定义了完整的交互设计

**核心差距**: 当前实现只有扁平选项列表，缺少 Chips 导航、多问题切换、推荐预选、Other 输入、Preview 分栏、提交流程等。

## Goal

将 AskUserQuestionRenderer 从简单列表升级为完整的多问题卡片组件，匹配 HTML 原型的视觉和交互。8 轮内达到 **95+**/100 分。每轮必须通过浏览器截图和实际交互验证。

## 原型文件

| 文件 | 描述 |
|------|------|
| `ask-user-question.html` | 四个可交互示例：标准三问、多选、Preview 分栏、已提交状态 |
| `ASK-USER-QUESTION-SPEC.md` | 完整产品规格（数据结构、交互规则、状态定义） |

## 工作项 (W1-W7)

### W1: Header Chips 行 (12/100)

匹配原型 `.auq-chips` 区域：

1. **Pill 形状 chips**: 每个问题一个 chip，包含状态圆点 + header 文字 + 已选值
2. **状态圆点**: 灰色 = 未回答，绿色 = 已回答
3. **已选值文本**: 回答后显示在 header 右边，截断过长文本（ellipsis）
4. **点击切换**: 点击 chip 切换到对应问题面板
5. **当前高亮**: 当前 chip 有背景和边框高亮

### W2: 选项列表 + 交互 (22/100)

匹配原型 `.auq-opts` + `.auq-other` 区域：

1. **Radio / Checkbox indicator**: 单选圆形、多选方形，选中填充 info 色
2. **选项卡片**: label + description，选中边框和背景变为 info 色
3. **推荐 badge**: `recommended` 选项显示绿色"推荐"小标签，初始化时默认预选
4. **单选自动跳转**: 单选模式点选后 200ms 自动跳下一个未回答 tab
5. **Other 区域**: 虚线边框，输入框始终可见，打字自动勾选 Other（单选下取消其他）
6. **实时更新 chip**: 选择变化时 chip 已选值实时更新

### W3: Footer + 提交流程 (12/100)

匹配原型 `.auq-footer` 区域：

1. **进度文本**: "2 / 3 已回答"，已回答数字绿色高亮
2. **确认按钮**: 所有问题都回答后激活，否则 disabled
3. **点击确认**: 发送汇总选择（通过 handleAction），Widget 进入已提交状态
4. **已提交状态**: Widget 锁定，选中项变绿，未选中淡化，按钮消失，Footer 显示 "✓ 值1 · 值2 · 值3"

### W4: Preview 分栏模式 (12/100)

匹配原型 `.auq-body.has-preview` 区域：

1. **左右分栏**: `question.preview = true` 时，左边选项列表，右边预览区域
2. **预览区域**: 等宽字体、浅灰背景，显示选中选项的 `previewContent`
3. **实时切换**: 切换选项时右侧预览实时更新
4. **Other 预览**: 选了 Other 并输入时，预览显示"根据你的描述：[输入]"

### W5: 面板高度 + 状态管理 (17/100)

1. **固定高度**: 容器高度 = 所有面板中最高那个（CSS Grid 叠放，opacity 切换）
2. **三种状态**: 初始态（推荐预选）→ 交互态 → 已提交态
3. **数据流集成**: 正确读取 `block.toolInput.questions`，正确处理 `block.toolOutput.answers`
4. **Phase 过滤**: 只在 `phase === 'end'` 时渲染，避免重复

### W6: 设计系统一致性 (10/100)

1. **CSS 变量**: 所有颜色通过 `var(--bg1)`, `var(--info-bg)` 等 CSS 变量
2. **边框**: 0.5px solid var(--b1)
3. **圆角**: 小 var(--r) = 8px，大 var(--rl) = 12px
4. **无阴影**: 零 box-shadow
5. **暗色模式**: 通过 CSS 变量自动适配

### W7: 持久化链路修复 (15/100)

1. `useAgentChat.ts` 的 `loadMessageHistory` 添加 `&includeToolEvents=true`
2. 历史消息转换时，从 `msg.toolEvents[]` 重建 `contentBlocks[]`（toolEvents → ToolBlock 映射）
3. 刷新后 `block.toolOutput` 非空 → `SubmittedView` 正确渲染
4. API 验证：`GET /sessions/:id/messages?includeToolEvents=true` 返回 toolOutput

## Frozen Constraints

1. **packages/chat-interface/** — 仅允许修改 postprocessor 和 ChatCoreContext 中的历史消息转换逻辑
2. **packages/react-sdk/** — 仅允许修改 useAgentChat.ts 的 message history fetch
3. **Backend** — 不修改（后端已正确保存 toolOutput）
4. **App.tsx 注册方式不变**: `customToolRenderers` 注册机制不变
5. **handleAction API 不变**: 仍通过 `handleAction({ label, prompt })` 发送选择
6. **ToolRenderer 签名不变**: `(block: ToolUseBlock) => ReactNode | null`

## 可修改文件范围

| 文件 | 用途 |
|------|------|
| `frontend/src/components/AskUserQuestionRenderer.tsx` | **主战场** — 组件实现 |
| `frontend/src/index.css` | CSS 补充（如需） |
| `frontend/src/App.tsx` | 仅在需要调整注册时修改 |
| `packages/react-sdk/src/hooks/useAgentChat.ts` | 仅修改 loadMessageHistory 的 URL 参数 |
| `packages/chat-interface/src/context/ChatCoreContext.tsx` | 仅修改历史消息 contentBlocks 重建逻辑 |

## 验证方式

- **Pre-gate**: `cd solutions/business/edu-platform/frontend && npx tsc --noEmit`
- **浏览器验证（MANDATORY）**: 每轮 Generator 和 Evaluator 都必须通过 Playwright 进行实际交互验证：
  1. 启动 edu-platform 全栈（core backend + edu backend + frontend）
  2. 登录教师账户
  3. 发消息触发 AskUserQuestion（如 "帮我出5道关于全等三角形判定的题"）
  4. 截图初始态 → 与 HTML 原型视觉对比
  5. 实际点击选项、切换 tab、输入 Other 文本 → 截图交互过程
  6. 点击确认提交 → 截图已提交状态
  7. 所有截图保存到 `screenshots/v{N}/`
- **浏览器不可用时**: D1-D5 max 3/5（无法验证运行时渲染和交互）
