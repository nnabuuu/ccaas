# Task Specification

## Objective
将 chat-interface 的视觉质量提升至专业级水准，跨组件风格统一、移动端完全可用、交互有质感。

**定位原则**：
- **视觉语言**（色彩、字体、间距、动效、阴影）→ 对标 `design-system.md` 规范（源自 Claude Web design system）
- **功能和结构**（sidebar 内容、导航项、collapsed 行为）→ 对标产品自身需求（参考 HTML 原型）
- **Claude Web 独有功能**（Projects/Artifacts/Code/Customize）→ 不需要，不属于本产品

## Artifact Description

### Scope 1: Core — `packages/chat-interface/`
- **角色**: 可嵌入的 Chat UI 组件库（core 层）
- **Format**: React + Tailwind CSS + CSS custom properties
- **Dev server**: `http://localhost:5190`
- **Key files**:
  - `src/styles/globals.css` — CSS 变量定义（light/dark）
  - `src/styles/tokens.css` — 设计 token（被 Solution 层引用）
  - `src/styles/prose.css` — Markdown 排版覆盖
  - `src/components/` — 所有 UI 组件
  - `src/components/ChatSidebar.tsx` — Sidebar 组件（standalone，props-based）
  - `src/widgets/components/` — 11 个 widget 组件
  - `src/components/SkillBadge.tsx` — Skill 标签（消息级）
  - `src/components/SessionContextBar.tsx` — Context chips 栏
  - `src/components/QuickSuggestions.tsx` — 快捷建议
  - `src/App.tsx` — Dev app / demo shell。只透传 URL 参数，不造假数据。core 默认状态应干净（无 chip、generic suggestions），Solution 通过 props 注入领域数据

### Scope 2: Edu-Platform — `solutions/business/edu-platform/frontend/`
- **角色**: Solution 层参考实现 — 消费 chat-interface 库，注入领域数据
- **Dev server**: `http://localhost:5290`
- **Design system**: `DESIGN_SYSTEM.md`（与 core 有重要差异：零阴影、0.5px 边框、无 accent 色、system font only）
- **Key files**:
  - `src/App.tsx` — Solution App，展示 core/solution 分层的正确用法
  - `src/components/ClassSwitcher.tsx` — 自定义班级切换器（通过 `contextBarTrailing` 注入 context bar）
  - `src/components/LoginPage.tsx` — 自定义登录页
  - `src/hooks/useEduAuth.ts` — Solution 认证逻辑
  - `src/data/mock-classes.ts` — 领域 mock 数据
  - `src/index.css` — 引入 core tokens + 自定义样式

### Core vs Solution 分层关键点
| 关注点 | Core (chat-interface) | Solution (edu-platform) |
|--------|----------------------|------------------------|
| Context chips | 默认空数组，bar 自动隐藏 | 注入领域数据（班级/学科/学校） |
| Quick suggestions | Generic prompts（Summarize/Analyze） | 领域 prompts（备课/出题/学情分析） |
| 设计 tokens | Claude-style（accent, shadows） | 覆盖为教育平台风格（零阴影、0.5px 边框） |
| 认证 | 直接 apiKey | Solution backend → ccaasApiKey |
| 定制 | `contextBarTrailing`, `customWidgets` 等 props | ClassSwitcher, LoginPage 等自定义组件 |

## Sidebar 当前状态（已实现）
Sidebar 已具备以下功能（v3 完成）：
- **搜索输入框** — 顶部搜索会话 ✅
- **会话分组** — Starred / Recents / Yesterday / Previous 7 Days / Earlier ✅
- **新建会话按钮** — 明确的 "+ New chat" 入口 ✅
- **折叠/展开 toggle** ✅
- **用户菜单 + 登出** ✅
- **折叠状态** — 显示 chat bubble 图标列表（最近会话），保留此设计 ✅

### 需要清理的项目
- **移除禁用导航项**：展开状态中不应有 Projects/Artifacts/Code 等禁用的导航按钮，这些是 Claude Web 独有功能，不属于本产品。只保留 Chats 导航
- **收缩状态保持不变**：当前的 chat bubble 图标列表是产品设计选择，不做修改

### 产品结构参考
功能结构以 HTML 原型为准（`packages/chat-interface/reference/`）：
- `chat-interface.html` — 教师 Chat 入口，有 context chips、skill tags、widgets
- `skill-management-ccaas-light.html` — ccaas-core Skill 管理面板（Tenant 视角，未来从 sidebar 进入）
- `lesson-plan-wizard.html` — 备课向导

### 体验质量检查项（v4+ 新增）

除了视觉合规和功能验证外，每轮迭代还需关注以下用户体验维度：

1. **交互完整性**: 不仅测试 happy path，还要测试中断流（cancel/stop）、错误状态、边界情况
2. **视觉层级**: 分割线/边框/背景色不应抢过内容的视觉权重。分割线应 "感觉得到但看不太到"
3. **默认状态观感**: 空状态/首屏应该看起来专业完整。chat-interface 是 core 组件库 — 基础设施参数（tenantId 等）不应泄漏到用户 UI；无 Solution 注入数据时，context bar 应自动隐藏

### 打磨范围与排除

**在范围内 — Core**（稳定组件，值得打磨）：
- MessageRenderer / Composer / CodeBlock — 核心 chat 体验
- SkillBadge — 消息上的 skill 标签
- SessionContextBar + chips — 顶部上下文选择器
- QuickSuggestions — 底部快捷建议
- Widget 渲染（StepWizard / TreeSelector / BarList 等 11 个 widget）
- ChatSidebar — 会话管理
- App.tsx — dev app / demo shell

**在范围内 — Edu-Platform**（Solution 参考实现）：
- LoginPage.tsx — 登录/注册页面（当前大量 inline style，需改为 Tailwind + CSS 变量）
- ClassSwitcher.tsx — 班级切换下拉菜单
- App.tsx — Solution 层 Props 组装（context chips, suggestions, contextBarTrailing）

**排除**（即将重建，不打磨）：
- `SkillPanel.tsx` — 当前 98 行的简易列表，将被 `skill-management-ccaas-light.html` 原型替代，不投入打磨
- `ChatInterfaceSkillPanel.tsx` — SkillPanel 的 wrapper，同步排除

## Backend Credentials (for browser verification)
Generator 和 Evaluator 需要登录后端以验证实际交互效果：
- **Login endpoint**: `POST http://localhost:3001/api/v1/auth/login`
- **Credentials**: `{ "username": "admin", "password": "dev123" }`
- **Response**: `{ "apiKey": "...", "user": { "id": "...", "username": "admin", "name": "Dev Admin" } }`
- **Usage**: 使用返回的 `apiKey` 作为 `x-api-key` header 访问需认证的 API

## Audience
- **最终用户**: 使用 chat UI 交互的人。关心视觉质感、交互流畅度、移动端可用性
- **集成开发者**: 使用 compound components 的人。关心 API 稳定性、CSS 变量可定制性

## Frozen Constraints
- ChatInterfaceContext / ChatCoreContext 的 provider 架构不应大改
- Widget 系统（catalog、registry、11 个 widget 的核心 props 接口）尽量保持稳定
- **ChatSidebar 保持 props-based 架构**，不引入新的 Context Provider — 所有数据通过 props 传入
- 组件对外 API 接口（props）可以灵活调整，但改动需在改动说明中标记
- 每轮改动后 `npm run typecheck` 和 `npm test` 必须通过
- 不引入不必要的新依赖（现有 Tailwind + lucide-react + sonner + react-markdown 足够）

## Available Inputs
- **设计系统文档**: `packages/chat-interface/docs/design-system.md` — 完整的 CSS 变量、排版、间距、动效规范（视觉标准）
- **HTML 原型**: `packages/chat-interface/reference/*.html` — 产品功能结构参考
- **参考截图**: `packages/chat-interface/reference/` — Claude Web 桌面端截图（仅用于视觉语言参考）
- **架构文档**: `packages/chat-interface/ARCHITECTURE.md` — 组件层次和 context 架构
- **Feature backlog**: `packages/chat-interface/docs/feature-backlog.md` — 功能差距清单
- **CSS 变量**: `packages/chat-interface/src/styles/globals.css` — 已定义的 design tokens

## Size/Format Constraints
- 文件格式: `.tsx` (React components), `.css` (styles)
- 样式方案: Tailwind utility classes + CSS custom properties (var(--xxx))
- 不使用 CSS modules 或 styled-components
- 所有颜色必须走 CSS 变量，不得硬编码
