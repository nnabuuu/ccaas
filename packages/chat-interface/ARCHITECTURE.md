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
│   ├── ChatInterface.tsx      # 主组件 (composer, 消息区, 空状态)
│   ├── MessageRenderer.tsx    # 消息渲染 (用户/助手布局)
│   ├── CodeBlock.tsx          # 代码块 (语言标签 + 复制)
│   ├── ThinkingDots.tsx       # 思考动画指示器
│   ├── SessionContextBar.tsx  # 顶部上下文栏
│   ├── QuickSuggestions.tsx   # 快捷建议
│   ├── SkillPanel.tsx         # 技能面板
│   ├── SkillBadge.tsx         # Skill 标签
│   ├── WidgetRenderer.tsx     # Widget 渲染入口
│   ├── NextActions.tsx        # 后续操作按钮
│   └── FileCard.tsx           # 文件卡片
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
│   └── ChatInterfaceContext.tsx
└── widgets/
    ├── catalog.ts             # Widget catalog 定义
    └── mcp-bridge.ts          # MCP 数据源桥接
```
