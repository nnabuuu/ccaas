# @kedge-agentic/chat-interface — 架构文档索引

> 即见 Jijian 平台 · 上海即驰教育科技有限公司
> Widget 引擎: json-render (Vercel Labs)

## 文档目录

| 文档 | 内容 | 关键词 |
|------|------|--------|
| [平台概览](./docs/platform-overview.md) | 四层模型、角色分层、备课/出题场景 | 顶层架构, 角色, 备课助手, 出题组卷 |
| [Widget 系统](./docs/widget-system.md) | json-render 选型、三层渲染管线、教育 Widget Catalog | widget, catalog, harness, json-render |
| [Chat 协议](./docs/chat-protocol.md) | 消息管线、Session Context、Skill 激活、消息混排 | message, session, prompt, skill |
| [Skill 生态](./docs/skill-ecosystem.md) | 生命周期、Fork 机制、参数化定制、权限矩阵 | skill, fork, params, 权限 |
| [数据结构](./docs/data-structures.md) | 课标知识点树、Skill 元数据 | curriculum, 知识点, data |
| [Extension API](./docs/extension-api.md) | Solution 扩展、Widget 合并、MCP Bridge、Exports | extension, widget, mcp, exports |
| [Chat 布局](./docs/chat-layout.md) | 全屏布局范式、Sidebar、响应式 | layout, sidebar, responsive |
| [设计系统](./docs/design-system.md) | Claude Web 对标、色板、排版、Composer、动效 | design, claude, color, serif, shadow |
| [Feature Backlog](./docs/feature-backlog.md) | Claude Web 对标功能差距、23 项 gap、优先级 | gap, backlog, priority, dump |

## 关键文件清单

```
src/
├── components/
│   ├── ChatInterface.tsx      # 主组件 (thin wrapper composing compound sub-components)
│   ├── chat/                  # Compound sub-components (可独立使用)
│   │   ├── ChatInterfaceRoot.tsx         # Provider wrapper + 布局容器
│   │   ├── ChatInterfaceContextBar.tsx   # 顶部上下文栏 + 技能切换
│   │   ├── ChatInterfaceSkillPanel.tsx   # 技能面板 (reads context)
│   │   ├── ChatInterfaceMessages.tsx     # 消息区 (scroll + 空状态 + 加载 + 思考)
│   │   ├── ChatInterfaceEmptyState.tsx   # 空状态 (标题 + 建议卡片)
│   │   ├── ChatInterfaceQuickSuggestions.tsx  # 快捷建议
│   │   ├── ChatInterfaceComposer.tsx     # 输入区 (textarea + 发送/停止 + 免责声明)
│   │   ├── ChatInterfaceToaster.tsx      # Toast 通知
│   │   └── index.ts                     # barrel export
│   ├── MessageRenderer.tsx    # 消息渲染 (用户/助手布局)
│   ├── CodeBlock.tsx          # 代码块 (语言标签 + 复制)
│   ├── ThinkingDots.tsx       # 思考动画指示器
│   ├── SessionContextBar.tsx  # 底层上下文栏组件
│   ├── QuickSuggestions.tsx   # 底层快捷建议组件
│   ├── SkillPanel.tsx         # 底层技能面板组件
│   ├── SkillBadge.tsx         # Skill 标签
│   ├── WidgetRenderer.tsx     # Widget 渲染入口
│   ├── ActionToolbar.tsx      # 消息操作栏 (复制 + 时间戳)
│   ├── NextActions.tsx        # 后续操作按钮
│   └── FileCard.tsx           # 文件卡片
├── utils/
│   ├── relative-time.ts       # 相对时间格式化
│   └── url.ts                 # URL utilities
├── styles/
│   └── globals.css            # CSS 变量 (Claude 色板 + 滚动条)
├── types/
│   ├── chat.ts                # Chat 消息类型 + SkillResponse
│   ├── session-context.ts     # Session context
│   └── widget.ts              # Widget 类型
├── harness/
│   ├── preprocessor.ts        # buildAppendPrompt (see ADR-0012)
│   ├── postprocessor.ts       # 响应后处理 (widget 路由/MCP 执行)
│   └── submit-engine.ts       # submitToEngine 实现
├── context/
│   ├── ChatInterfaceContext.tsx  # Widget/block 注册 (config concern)
│   └── ChatCoreContext.tsx      # 连接/消息/输入/动作 (runtime concern)
└── widgets/
    ├── catalog.ts             # Widget catalog 定义
    └── mcp-bridge.ts          # MCP 数据源桥接
```

## Compound Component 模式

`ChatInterface` 支持两种使用方式：

**默认（零改动兼容）：**
```tsx
<ChatInterface serverUrl="..." tenantId="..." />
```

**自定义组合：**
```tsx
<ChatInterface.Root serverUrl="..." tenantId="...">
  <ChatInterface.Toaster />
  <ChatInterface.ContextBar chips={chips} />
  <ChatInterface.Messages emptyState={<WelcomeScreen />} />
  <FileAttachmentBar />          {/* 自定义注入 */}
  <ChatInterface.Composer disclaimer={null} />
</ChatInterface.Root>
```

**Context 分层：**
- `ChatInterfaceContext` — widget/block 注册表 + MCP bridge (config concern)
- `ChatCoreContext` — 连接状态、消息、输入、动作 (runtime concern)
- `useChatCore()` — 在自定义组件中访问 chat 状态
