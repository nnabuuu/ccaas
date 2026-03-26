# Chat Layout Convention

布局对齐 Claude web / ChatGPT / Gemini 的主流 AI Chat 全屏布局范式。

## 设计原则

1. **Container-filling**: `ChatInterface` 组件用 `w-full h-full flex flex-col` 填充父容器，不在组件内部设 max-width 约束外壳
2. **Content centering**: 消息和输入内容通过 `max-w-3xl mx-auto` (48rem/768px) 居中，保持可读性
3. **Flex column layout**: 上下结构 Header → Messages(`flex-1 overflow-y-auto`) → Suggestions → Input(`flex-shrink-0`)
4. **Empty state**: 空状态使用 `min-h-full flex items-center justify-center` 垂直居中
5. **Dual-mode compatible**: App.tsx 提供全屏容器 (`h-screen`)；嵌入场景由父容器决定尺寸

## 布局结构

```
┌──────────────────────────────────────────────┐
│  App.tsx: h-screen flex flex-col              │
│  ┌──────────────────────────────────────────┐│
│  │ ChatInterface: w-full h-full flex flex-col││
│  │ ┌──────────────────────────────────────┐ ││
│  │ │ Header (flex-shrink: 0)              │ ││
│  │ ├──────────────────────────────────────┤ ││
│  │ │ Messages (flex-1, overflow-y: auto)  │ ││
│  │ │   ┌────────────────────┐             │ ││
│  │ │   │ max-w-3xl mx-auto  │             │ ││
│  │ │   └────────────────────┘             │ ││
│  │ ├──────────────────────────────────────┤ ││
│  │ │ Input (flex-shrink: 0)               │ ││
│  │ │   ┌────────────────────┐             │ ││
│  │ │   │ max-w-3xl mx-auto  │             │ ││
│  │ │   └────────────────────┘             │ ││
│  │ └──────────────────────────────────────┘ ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

背景色全宽延伸，内容区居中。消息区 `flex-1` 自动占满剩余高度。

## Sidebar 布局

App.tsx 登录后始终显示 Sidebar（API key 认证通过后进入主界面）：

```
┌──────────────────────────────────────────────┐
│  App.tsx: h-screen flex                      │
│  ┌─────────┬────────────────────────────────┐│
│  │ Sidebar  │ ChatInterface                  ││
│  │ 260px /  │ flex-1 min-w-0                 ││
│  │ 52px     │                                ││
│  │ collapsed│                                ││
│  └─────────┴────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

- **Desktop (≥768px)**: Sidebar 固定左侧，可折叠（260px ↔ 52px）
- **Mobile (<768px)**: Sidebar 隐藏，通过 hamburger 按钮打开 overlay drawer
- `ChatInterface` 通过 `key={sessionId}` 在切换时完全重新挂载
- `useSessionList` hook 从 `GET /api/v1/user-sessions` 获取会话列表
