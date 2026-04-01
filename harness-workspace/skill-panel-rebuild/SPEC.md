# Task Specification — SkillPanel Rebuild

## Objective
重建 SkillPanel 组件，使其：
1. 从 sidebar 进入，替换 chat 主区域（Claude Web 模式）
2. 视觉对标 `skill-management-ccaas-light.html` 原型（Tenant 视角，3 tabs）
3. 通过 Controlled Component Pattern 实现 sidebar ↔ panel 状态联动

## Artifact Description

### Scope 1: Core — `packages/chat-interface/`
- **角色**: 可嵌入的 Chat UI 组件库（core 层）
- **Dev server**: `http://localhost:5190`
- **Key files**:
  - `src/components/SkillPanel.tsx` — 主面板组件（~364行，需视觉重建）
  - `src/components/chat/ChatInterfaceSkillPanel.tsx` — Context bridge（16行）
  - `src/components/ChatSidebar.tsx` — 需新增 Skills 入口
  - `src/components/ChatInterface.tsx` — 需新增 `skillPanelOpen` + `onSkillPanelChange` props
  - `src/components/chat/ChatInterfaceRoot.tsx` — 透传新 props
  - `src/context/ChatCoreContext.tsx` — 支持 controlled skillPanelOpen
  - `src/App.tsx` — 持有 skillPanelOpen state

### Scope 2: Edu-Platform — `solutions/business/edu-platform/frontend/`
- **角色**: Solution 层参考实现
- **Dev server**: `http://localhost:5290`
- **Key file**: `src/App.tsx` — 需同样接入 skillPanelOpen 控制

## 核心架构：Controlled Component Pattern

### 问题
ChatSidebar 在 `App.tsx`，skillPanelOpen 在 `ChatCoreContext` 内部。Sidebar 无法直接控制 panel 开关。

### 方案：App.tsx 持有 state，通过 props 下传

```
App.tsx:
  const [skillPanelOpen, setSkillPanelOpen] = useState(false)

  <ChatSidebar
    onSkillsClick={() => setSkillPanelOpen(true)}     // NEW
    skillsActive={skillPanelOpen}                       // NEW
  />
  <ChatInterface
    skillPanelOpen={skillPanelOpen}                     // NEW
    onSkillPanelChange={setSkillPanelOpen}              // NEW
  />
```

### Prop 穿透链（4 层）

| Layer | Component | 新 Props |
|-------|-----------|----------|
| 1 | `ChatInterface.tsx` | `skillPanelOpen?: boolean`, `onSkillPanelChange?: (open: boolean) => void` |
| 2 | `ChatInterfaceRoot.tsx` | 透传到 ChatCoreProvider |
| 3 | `ChatCoreProvider` | 有外部 prop 用外部的，没有用内部 useState |
| 4 | `ChatInterfaceSkillPanel` / Messages | 从 context 读取 |

### ChatCoreContext 改造要点

```typescript
// ChatCoreContext.tsx — Provider
interface ChatCoreProviderProps {
  // ... existing props ...
  skillPanelOpen?: boolean           // NEW: external controlled state
  onSkillPanelChange?: (open: boolean) => void  // NEW: external callback
}

// Inside provider:
const [internalSkillPanelOpen, setInternalSkillPanelOpen] = useState(false)

// Controlled pattern: external takes priority
const skillPanelOpen = props.skillPanelOpen ?? internalSkillPanelOpen
const setSkillPanelOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
  const newValue = typeof open === 'function' ? open(skillPanelOpen) : open
  if (props.onSkillPanelChange) {
    props.onSkillPanelChange(newValue)
  } else {
    setInternalSkillPanelOpen(newValue)
  }
}, [props.onSkillPanelChange, skillPanelOpen])
```

## ChatSidebar 入口设计

### 展开态
在底部 user menu 上方或会话列表下方添加 Skills 按钮：
- Icon: `Puzzle` 或 `Sparkles` (from lucide-react)
- Text: "Skills"
- Active 态: 背景高亮（类似当前会话 active 态）

### 收缩态
在 icon strip 中添加 Skills 图标：
- 同样使用 `Puzzle` 或 `Sparkles` icon
- Active 态: 背景高亮

### 新增 Props
```typescript
interface ChatSidebarProps {
  // ... existing props ...
  onSkillsClick?: () => void    // NEW
  skillsActive?: boolean         // NEW
}
```

## SkillPanel 视觉规范

对标 `packages/chat-interface/reference/skill-management-ccaas-light.html`

### 布局结构
```
┌─────────────────────────────────────────────┐
│  Skill 管理              [TenantName] Badge  │  ← Header
├─────────────────────────────────────────────┤
│  Solution Skills │ 自建 Skills │ 使用统计     │  ← Tab bar
├─────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │  ← Stat cards (4)
│  │ 内置  │ │ 已启用│ │ 未启用│ │ 本月  │       │
│  │  5   │ │  3   │ │  2   │ │ 579  │       │
│  └──────┘ └──────┘ └──────┘ └──────┘       │
│                                             │
│  ── 已启用 (3) ──                            │  ← Section header
│  ┌───────────────┐ ┌───────────────┐        │
│  │ 备课方案生成器  │ │ 出题组卷助手   │        │  ← Skill cards (2-col)
│  │ 已启用 badge   │ │ 已启用 badge   │        │    with params section
│  │ desc + meta    │ │ desc + meta    │        │
│  │ [params box]   │ │ [params box]   │        │
│  │ [配置] [停用]  │ │ [配置] [停用]  │        │
│  └───────────────┘ └───────────────┘        │
│                                             │
│  ── 未启用 (2) ──                            │
│  ┌───────────────┐ ┌───────────────┐        │
│  │ 课堂观察记录   │ │ AI素养实验室   │        │
│  └───────────────┘ └───────────────┘        │
└─────────────────────────────────────────────┘
```

### CSS Token 对照（HTML → React/Tailwind）
| HTML Class | CSS Value | Tailwind 对应 |
|------------|-----------|---------------|
| `.sp-frame` | bg white, border .5px, rounded 16px | `bg-[var(--bg1)] border-[0.5px] border-[var(--b1)] rounded-2xl` |
| `.sp-tab.act` | font-weight 600, border-bottom 2.5px | `font-semibold border-b-[2.5px] border-[var(--t1)]` |
| `.sp-stat` | bg bg2, rounded 8px, padding 12px 14px | `bg-[var(--bg2)] rounded-lg p-3` |
| `.sp-card` | border .5px, rounded 12px, padding 16px 18px | `border-[0.5px] border-[var(--b1)] rounded-xl p-4` |
| `.sp-badge-active` | success-bg + success-t | `bg-[var(--success-bg)] text-[var(--success-t)]` |
| `.sp-badge-draft` | bg2 + t2 | `bg-[var(--bg2)] text-[var(--t2)]` |
| `.sp-badge-solution` | info-bg + info-t | `bg-[var(--info-bg)] text-[var(--info-t)]` |
| `.sp-badge-custom` | coral-bg + coral-t | `bg-[var(--coral-bg)] text-[var(--coral-t)]` |
| `.sp-param` | font-size 12px, border-bottom .5px | `text-xs border-b-[0.5px]` |

### 缺失的 CSS 变量
需要在 `globals.css` 中添加：
```css
--success-bg: #EAF3DE;
--success-t: #27500A;
--warn-bg: #FAEEDA;
--warn-t: #854F0B;
--info-bg: #E6F1FB;
--info-t: #0C447C;
--coral-bg: #FAECE7;
--coral-t: #712B13;
--purple-bg: #EEEDFE;
--purple-t: #3C3489;
```

## 主区域切换逻辑

当 `skillPanelOpen === true` 时：
- 隐藏 Messages + Composer + ContextBar + QuickSuggestions
- 显示 SkillPanel（全宽占满主区域）

当 `skillPanelOpen === false` 时：
- 显示正常 chat 界面
- SkillPanel 隐藏

实现方式：在 `ChatInterface.tsx` 的 compound children 中条件渲染：
```tsx
{skillPanelOpen ? (
  <ChatInterfaceSkillPanel />
) : (
  <>
    <ChatInterfaceContextBar ... />
    <ChatInterfaceMessages />
    <ChatInterfaceQuickSuggestions />
    <ChatInterfaceComposer />
  </>
)}
```

## Backend Credentials
- **Login**: `POST http://localhost:3001/api/v1/auth/login`
- **Body**: `{ "username": "admin", "password": "dev123" }`
- **Response**: `{ "apiKey": "...", "user": {...} }`
- **Skills API**: `GET http://localhost:3001/api/v1/skills` with `x-api-key` header

## Frozen Constraints
- ChatInterfaceContext / ChatCoreContext 的 provider 架构不应大改（仅新增 controlled props）
- Widget 系统不动
- ChatSidebar 保持 props-based 架构
- 所有新 props 均 optional（向后兼容）
- `npm run typecheck` 和 `npm test` 必须通过
- 不引入新依赖（lucide-react 已有）
- 不能破坏现有 chat 功能

## Available Inputs
- **HTML 原型**: `packages/chat-interface/reference/skill-management-ccaas-light.html` — 视觉标准
- **设计系统**: `packages/chat-interface/docs/design-system.md` — CSS 变量规范
- **现有代码**: `src/components/SkillPanel.tsx` — 已有功能逻辑，需视觉重建
- **架构文档**: `packages/chat-interface/ARCHITECTURE.md`
