# Spec: AskUserQuestion Wizard — control_request E2E + WizardRenderer 打磨

## Context

edu-platform 实现了 AskUserQuestion 的 `control_request` 协议 + 通用 Wizard 渲染框架：

1. **Backend**: CLI spawn 添加 `--permission-prompt-tool stdio`，EventMapper 处理 `control_request` 事件，新增 `POST /sessions/:id/control-response` endpoint
2. **Frontend**: WizardRenderer（4 种 step 子组件）、registry 注册机制、AskUserQuestionRenderer 的 ControlRequestView
3. **Lesson-plan wizard**: 注册为 `'备课向导'`，4 步流程（选范围 → 选章节 → 学情分析 → 确认生成）

**现有状态**: 架构和数据流已实现（typecheck 通过、1287 tests 通过），但**未经 E2E 实际运行验证**。组件视觉、交互细节、错误处理均未打磨。

## Goal

打磨 control_request 全链路 + WizardRenderer 组件，8 轮内达到 **90+**/100 分。每轮必须通过浏览器实际触发 AskUserQuestion 并验证完整流程。

## Architecture

```
LLM calls AskUserQuestion          Frontend renders Wizard
         │                                    │
         ▼                                    ▼
┌─────────────┐  control_request  ┌──────────────┐   SSE    ┌──────────────┐
│  Claude CLI  │ ──────────────►  │   Backend    │ ───────►  │   Frontend   │
│  (paused)    │                  │              │           │              │
│              │                  │ EventMapper  │  wizard_  │ WizardRenderer│
│              │                  │  new case    │  request  │  (generic)   │
│              │                  │              │           │   ├─ Form    │
│              │  control_response│              │  POST     │   ├─ Tree   │
│  (resumes)   │ ◄──────────────  │ stdin write  │ ◄───────  │   ├─ Review │
│ LLM gets     │                  │              │  /control │   └─ Summary│
│ JSON answer  │                  │              │  -response│              │
└─────────────┘                  └──────────────┘           └──────────────┘
```

## 工作项 (W1-W6)

### W1: control_request E2E 数据流 (20/100)

验证并修复完整的 control_request 数据流：

1. **Backend → Frontend**: EventMapper 正确发射 `tool_activity(start)` + `wizard_request` SSE 事件
2. **SSE 事件解析**: useAgentChat / ChatCoreContext 正确接收 `wizard_request` 或 `tool_activity` 事件并转为 ToolUseBlock
3. **ToolRenderer 路由**: AskUserQuestionRenderer 在 `phase === 'start'` 时渲染 ControlRequestView（而非 SubmittedView）
4. **用户提交回传**: POST `/sessions/:id/control-response` 成功写入 stdin → CLI 恢复 → LLM 收到 JSON answers
5. **LLM 继续执行**: LLM 收到 answers 后按预期继续生成教案（不重试、不报错）

### W2: ControlRequestView 默认 UI (15/100)

当无匹配 wizard config 时，ControlRequestView 作为 AskUserQuestion 的默认交互界面：

1. **问题渲染**: 与已有 AskUserQuestion widget（ask-user-question-ui-ux harness v6）视觉一致
2. **选项选择**: chips + options + Other 输入 + 确认提交
3. **提交流程**: 点击确认 → POST /control-response → 等待状态 → 成功反馈
4. **错误处理**: 网络失败时显示重试按钮和错误信息

### W3: WizardRenderer 通用框架 (20/100)

打磨 WizardRenderer 组件的视觉和交互：

1. **Step indicator bar**: 步骤序号 + 标题 + 当前/完成/待处理状态（颜色区分）
2. **面板切换**: 前进/后退按钮，已完成步骤可点击回跳
3. **FormStep**: select/text/number 输入，contextKey 自动填充，字段验证（必填高亮）
4. **依赖检查**: `dependsOn` 步骤未完成时显示提示而非空白
5. **最终提交**: 最后一步"确认"按钮 → 收集所有 answers → POST /control-response
6. **设计系统**: CSS 变量、无 shadow、圆角一致

### W4: TreeSelectStep + DataReviewStep 动态数据 (15/100)

Wizard 的两个动态步骤需要从 backend 获取数据：

1. **TreeSelectStep**: 调 `/api/mcp/edu-tools/tools/get_textbook_tree` 获取章节树 → 渲染可展开/折叠的树形 checkbox → 支持全选/全不选
2. **DataReviewStep**: 调 `/api/mcp/edu-tools/tools/get_class_analysis` 获取学情数据 → 渲染进度条列表 + emphasis toggle
3. **Loading 状态**: 数据加载中显示 spinner/skeleton
4. **错误处理**: API 失败时显示错误信息和重试按钮
5. **Mock 兼容**: 当 MCP server 不可用时，使用 mock 数据保证 UI 可渲染

### W5: SummaryStep + 提交确认 (10/100)

1. **摘要展示**: 分步显示所有选择（步骤标题 + key-value 列表）
2. **可编辑跳回**: 点击某步骤的摘要可跳回该步骤修改
3. **确认按钮**: 绿色强调，点击后收集所有步骤 answers 提交
4. **提交动画**: 按钮变为 loading → 成功 → 面板替换为"已提交"状态

### W6: 备课向导 4 步流程 (20/100)

端到端验证 lesson-plan wizard：

1. **触发**: 对话中发送"帮我备课" → AI 调用 AskUserQuestion（header="备课向导"） → 前端匹配 wizard config → 渲染 4 步向导
2. **Step 1 选范围**: 学科/年级/班级/课型/课时 5 个 select，contextKey 自动填充 sessionContext 值
3. **Step 2 选章节**: 调 MCP 获取章节树 → 用户勾选
4. **Step 3 学情分析**: 调 MCP 获取学情 → 显示知识点掌握率 + emphasis toggle
5. **Step 4 确认生成**: 显示所有选择摘要 → 点击确认
6. **回传 LLM**: JSON answers 包含所有字段 → LLM 继续生成教案

## 可修改文件范围

| 文件 | 用途 |
|------|------|
| `packages/chat-interface/src/components/wizard/*.tsx` | WizardRenderer + step 子组件 |
| `packages/chat-interface/src/components/wizard/types.ts` | Wizard 类型定义 |
| `packages/chat-interface/src/components/wizard/registry.ts` | Wizard 注册表 |
| `packages/chat-interface/src/context/ChatCoreContext.tsx` | 仅修改 control_request 事件处理 |
| `packages/react-sdk/src/hooks/useAgentChat.ts` | 仅修改 control_request SSE 事件处理 |
| `packages/backend/src/sessions/event-mapper.service.ts` | 仅修改 control_request case |
| `packages/backend/src/sessions/services/cli-process.service.ts` | 仅修改 sendControlResponse |
| `edu-platform/frontend/src/components/AskUserQuestionRenderer.tsx` | ControlRequestView 组件 |
| `edu-platform/frontend/src/wizards/lesson-plan.wizard.ts` | 备课向导 config |
| `edu-platform/frontend/src/App.tsx` | 仅在需要调整注册时修改 |
| `edu-platform/skills/lesson-plan-generator/SKILL.md` | 仅调整 AskUserQuestion 指引 |

## Frozen Constraints

1. **不修改已有 AskUserQuestion widget 的 SubmittedView** — ask-user-question-ui-ux harness 已打磨到 98 分
2. **不修改 ChatSidebar、ChatInterface 等核心 UI 组件**
3. **不修改 backend 的 session/skill/mcp CRUD 逻辑**
4. **不破坏 bypassPermissions 对 Bash/Read/Write 的自动放行**
5. **保持 Wizard registry API 不变**: `registerWizard(slug, config)` / `getWizardConfig(slug)`
6. **CSS 变量优先**: 所有颜色通过 var(--bg1) 等 CSS 变量

## Pre-gate

```bash
# Backend
cd packages/backend && npx tsc --noEmit && npx jest --no-coverage

# Chat-interface
cd packages/chat-interface && npx tsc --noEmit

# Edu-platform frontend
cd packages/chat-interface && npm run build
cd solutions/business/edu-platform/frontend && npx tsc --noEmit
```

## 浏览器验证（MANDATORY）

每轮 Generator 和 Evaluator 都必须通过 Playwright 进行 E2E 验证：

1. 启动全栈（core backend:3001 + edu backend:3011 + frontend:5290）
2. 登录教师账户
3. 发消息触发 AskUserQuestion（"帮我备课" 或 "帮我出5道题"）
4. 截图 control_request 到达时的初始态
5. 操作 Wizard：选择各步骤 → 确认提交
6. 截图提交后 LLM 恢复执行的响应
7. 所有截图保存到 `screenshots/v{N}/`

**无浏览器验证时**: D1/D6 max 2/5（无法确认 E2E 数据流和完整流程）
