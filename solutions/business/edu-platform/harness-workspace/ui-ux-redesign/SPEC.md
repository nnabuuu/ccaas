# Spec: UI/UX Redesign — Edu-Platform Chat Interface

## Context

edu-platform 的 chat-interface 功能已基本完成（消息、Composer、侧边栏、Widget、工具活动展示等），但视觉实现与最新 HTML 原型存在偏差。本次 redesign 目标是让前端完整匹配 `prototypes/components/` 下的 9 个 HTML 原型。

**现有状态**:
- `packages/chat-interface/` — 核心聊天组件库（ChatInterface、ChatSidebar、MessageRenderer、ToolGroup 等）
- `solutions/business/edu-platform/frontend/` — solution 层（App.tsx、index.css、widget-registry、自定义 widget）
- CSS 变量体系（`--ck-*`）已建立
- 3 个自定义 widget（EduMetricDashboard、EduStepWizard、EduReviewPanel）已存在

**核心差距**: 组件布局、间距、颜色、交互细节与 HTML 原型不一致。

## Goal

通过 CSS 调整 + 组件逻辑修改，使 edu-platform 前端在视觉和交互上完整匹配 9 个 HTML 原型。6 轮内达到 **85+**/100 分。

## 原型文件清单

| 原型文件 | 覆盖范围 | 对应工作项 |
|---------|---------|-----------|
| `chat-full-layout.html` | 整体布局、侧边栏、Landing Page | W1, W2 |
| `chat-full-layout-dark.html` | 暗色模式 | W5 |
| `message-bubbles.html` | 用户/AI 消息气泡、Skill 标签、思考中 | W3 |
| `tool-usage-group.html` | 工具调用三层折叠 | W3 |
| `session-input-suggestions.html` | 浮动输入框、快捷建议 | W2 |
| `step-wizard.html` | 备课向导四步 | W4 |
| `review-panel.html` | 试题审核面板 | W4 |
| `metric-dashboard.html` | 学情仪表盘 | W4 |
| `file-card-actions.html` | 文件卡片 + Next Actions | W4 |

## 工作项 (W1-W5)

### W1: 整体布局 + 侧边栏 (20/100)

匹配 `chat-full-layout.html`：

1. **左右分栏**: 侧边栏固定宽度 + 主内容区自适应，满屏高度
2. **侧边栏 Header**: 产品名 + 新建会话"+"按钮
3. **搜索栏**: 会话历史过滤
4. **会话历史列表**: 按时间分组（今天/昨天/本周），状态圆点（蓝=进行中，灰=完成），当前高亮
5. **Skills 列表**: 图标颜色区分来源（绿=Solution 内置，橙=Tenant 自建），末尾"+ 管理 Skills"
6. **底部用户信息**: 头像 + 姓名 + 角色，固定不滚动
7. **用户菜单**: 向上弹出，圆角阴影，邮箱→分隔线→设置/导出/帮助→分隔线→退出登录

### W2: Landing Page + 浮动输入框 (20/100)

匹配 `chat-full-layout.html` + `session-input-suggestions.html`：

1. **Landing 视图**: 垂直居中，动态问候语（早上好/下午好/晚上好 + 教师姓名），副标题
2. **Skill 快捷卡片**: 2x2 网格，图标 + 名称 + 描述，点击发送预设 prompt
3. **Prompt 示例**: "试试这样说" + 2-3 条示例，点击直接发送
4. **浮动输入框**: 独立浮动卡片（圆角、边框、底部间距），textarea 多行自动增高
5. **发送按钮**: textarea 右侧底部对齐，圆角方形
6. **底部工具栏**: 左侧功能按钮扩展口
7. **Landing ↔ Chat 切换**: 发送消息后 Landing 消失，进入对话

### W3: 消息渲染 + 工具活动 (25/100)

匹配 `message-bubbles.html` + `tool-usage-group.html`：

**消息气泡**:
1. **用户消息**: 靠右，深色背景白色文字，右下角小圆角
2. **AI 回复**: 靠左，无背景，允许 Widget 撑满宽度
3. **Skill 激活标签**: AI 回复上方，绿色=Solution 内置，橙色=自建
4. **思考中**: 三点闪烁动画 + 文字提示
5. **错误**: 红色浅背景文字块

**工具调用三层折叠**:
6. **第一层**: 自然语言摘要卡片，默认折叠，整行可点击展开
7. **第二层**: 步骤列表（状态图标：紫=MCP/蓝=推理/绿=完成 + 描述 + 工具名灰色等宽 + 耗时）
8. **第三层**: Table / JSON 切换详情（Table=Postman 风格 Key-Value，分 Request/Response；JSON=代码块）
9. **事件冒泡**: 内层点击不触发外层

### W4: Widget 组件视觉精修 (25/100)

匹配 `step-wizard.html` + `review-panel.html` + `metric-dashboard.html` + `file-card-actions.html`：

**StepWizard** — `step-wizard.html`:
1. 步骤指示器: flex row + 2.5px 下边框，active=粗体+深色，done=绿色勾，pending=灰色
2. 表单字段: 0.5px 边框 select，focus=info-t 边框色
3. 章节树: 200px max-height 滚动，18px 缩进，checkbox 切换
4. 条形图: 7px 高度 bar + emphasis toggle（16×16, warn-bg active）
5. 摘要卡片: bg2 背景，灰色 label + 粗体 value
6. 导航: 前进/后退按钮，disabled=opacity 0.35，submit=深色

**ReviewPanel** — `review-panel.html`:
7. 全部展示式，0.5px 边框卡片
8. 状态: kept=绿边+浅绿背景, replaced=黄边+浅黄背景, removed=opacity 0.4+删除线
9. 元信息标签: 11px, bank=info 色, ai=warn 色
10. 操作按钮: 11px, per-action 样式, active=outline
11. Footer: 进度计数 + "全部保留" + "确认组卷"

**MetricDashboard** — `metric-dashboard.html`:
12. 指标卡: 3-4 列 grid, 22px value font-weight:600, delta 内联
13. Bar list: 7px track, 颜色阈值（danger≥42%, warn≥35%, success<22%）
14. Section title: 12px font-weight:500
15. Widget header: 12px 标题 + 10px badge (info-bg)

**文件卡片 + Next Actions** — `file-card-actions.html`:
16. 图标颜色: .docx=蓝, .pdf=珊瑚, .pptx=青, .xlsx=紫
17. hover 视觉反馈
18. Next Actions 按钮行

### W5: 设计系统一致性 + 暗色模式 (10/100)

匹配 `chat-full-layout-dark.html` + 全局规范：

1. **CSS 变量**: 所有颜色通过 `--ck-*` 变量，无 hardcoded hex/rgb
2. **边框**: 0.5px solid，统一使用 `--ck-b1`
3. **圆角**: 小=8px (`--ck-r`), 大=12px (`--ck-rl`)
4. **阴影**: edu-platform 零阴影（边框替代），仅 Composer 特例
5. **暗色模式**: 完整色板切换，所有组件暗色下可读
6. **Responsive**: 移动端侧边栏 drawer，Composer 自适应

## Frozen Constraints

1. **packages/react-sdk/** — 不可修改
2. **packages/backend/** — 不可修改
3. **packages/vue-sdk/** — 不可修改
4. **packages/chat-interface/src/context/** — Context providers 结构不变
5. **packages/chat-interface/src/widgets/registry.tsx** — builtin registry 不变
6. **packages/chat-interface/src/widgets/catalog.ts** — builtin catalog 不变
7. **packages/chat-interface/src/widgets/mcp-bridge.ts** — MCP bridge 不变
8. **解决方案后端不变**: `solutions/business/edu-platform/backend/` 和 `mcp-server/` 功能接口不变

## 可修改文件范围

### Edu-Platform Solution（主战场）
- `solutions/business/edu-platform/frontend/src/App.tsx`
- `solutions/business/edu-platform/frontend/src/index.css`
- `solutions/business/edu-platform/frontend/src/widget-registry.ts`
- `solutions/business/edu-platform/frontend/src/widgets/*.tsx`
- `solutions/business/edu-platform/frontend/src/hooks/*.ts`
- `solutions/business/edu-platform/frontend/src/data/*.ts`

### Chat-Interface 组件（视觉调整）
- `packages/chat-interface/src/components/ChatInterface.tsx`
- `packages/chat-interface/src/components/ChatSidebar.tsx`
- `packages/chat-interface/src/components/MessageRenderer.tsx`
- `packages/chat-interface/src/components/NextActions.tsx`
- `packages/chat-interface/src/components/SkillPanel.tsx`
- `packages/chat-interface/src/components/SessionContextBar.tsx`
- `packages/chat-interface/src/components/QuickSuggestions.tsx`
- `packages/chat-interface/src/components/ToolActivityBlock.tsx`
- `packages/chat-interface/src/components/ToolGroup.tsx`
- `packages/chat-interface/src/components/ThinkingBlockView.tsx`
- `packages/chat-interface/src/components/chat/ChatInterfaceComposer.tsx`
- `packages/chat-interface/src/components/chat/ChatInterfaceEmptyState.tsx`
- `packages/chat-interface/src/components/chat/ChatInterfaceRoot.tsx`
- `packages/chat-interface/tailwind.config.js`
- `packages/chat-interface/src/types/chat.ts`
- `packages/chat-interface/src/types/widget.ts`
- `packages/chat-interface/src/index.ts`

## 验证方式

- **Pre-gate**: `cd solutions/business/edu-platform/frontend && npx tsc --noEmit`
- **Pre-gate**: `cd packages/chat-interface && npx tsc --noEmit`
- **E2E**: 启动 edu-platform 前后端 → 浏览器截图 → 与 HTML 原型视觉对比
- **Dark mode**: 切换暗色模式截图验证
