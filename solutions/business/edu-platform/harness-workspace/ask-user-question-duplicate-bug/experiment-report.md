# AskUserQuestion control_request 协议验证实验报告

## 1. 假设摘要

**核心假设**: Claude Code CLI 在 `--output-format stream-json` 模式下，AskUserQuestion 工具通过 `control_request`/`control_response` 协议与宿主进程通信，宿主进程需要解析 `control_request` 并回传 `control_response` 才能完成 human-in-the-loop 交互。

**背景**: CCAAS 平台的 edu-platform 使用 Claude Code CLI 作为 Agent Engine。当 LLM 调用 AskUserQuestion 时，前端出现 3 次重复渲染的 bug。前期调查（`root-cause-report.md`）已确认根因链条，但未验证 `control_request` 协议的具体行为。

---

## 2. 实验方法

### 实验 1: bypassPermissions 模式下的 stdout 观察

```bash
echo '{"type":"user","message":{"role":"user","content":"请使用AskUserQuestion工具问我一个问题"}}' | \
env -u CLAUDECODE timeout 120 claude \
  --output-format stream-json --input-format stream-json \
  --permission-mode bypassPermissions --verbose 2>/dev/null | \
tee /tmp/cli-stdout-exp1.jsonl
```

**目的**: 观察 `bypassPermissions` 模式（CCAAS 生产配置）下 AskUserQuestion 是否触发 `control_request`。

### 实验 2: default 模式下的 stdout 观察

```bash
# 同上，但使用 --permission-mode default
```

**目的**: 排除 permission mode 对 `control_request` 出现与否的影响。

### 实验 3: --permission-prompt-tool stdio 模式

```bash
# 使用 named pipe + --permission-prompt-tool stdio
```

**目的**: 验证 `--permission-prompt-tool stdio` 标志是否是触发 `control_request` 协议的必要条件。

### 补充研究: Claude Code 文档与 Agent SDK 源码

通过官方文档、Agent SDK 源码、GitHub issues 研究 `control_request` 协议的完整规范。

---

## 3. 实验结果

### 实验 1 结果: bypassPermissions — 无 control_request

**CLI 版本**: Claude Code 2.1.63

stdout 事件序列（去除 system/hook 事件）：

```
[system/init] permissionMode=bypassPermissions
[assistant]   tool_use name=AskUserQuestion id=toolu_01WM6MQ4t6ZTTux1VZJtV9Bs
[rate_limit_event]
[user]        tool_result id=toolu_01WM6MQ4t6ZTTux1VZJtV9Bs is_error=True content="Answer questions?"
[assistant]   thinking: "it seems the tool returned an error..."
[assistant]   text: "已向你提问了..."
[result/success] duration=10616ms turns=2
              permission_denials=[{tool_name: "AskUserQuestion", ...}]
```

**关键发现**:
1. **stdout 中没有 `control_request` 事件**
2. CLI 自动生成了 `type: "user"` 的 `tool_result`，内容为 `is_error: true, content: "Answer questions?"`
3. `result` 事件的 `permission_denials` 数组明确列出 AskUserQuestion 被拒绝
4. CLI **不阻塞** — 立即返回错误 tool_result，进程正常退出

### 实验 2 结果: default 模式 — 同样无 control_request

stdout 事件序列与实验 1 **完全一致**：

```
[system/init] permissionMode=default
[assistant]   tool_use name=AskUserQuestion id=toolu_012b4Cxi4VKgT8fPwdj3cDCz
[user]        tool_result id=toolu_012b4Cxi4VKgT8fPwdj3cDCz is_error=True content="Answer questions?"
[assistant]   text: "已向你提问了..."
[result/success] duration=17056ms turns=2
              permission_denials=[{tool_name: "AskUserQuestion", ...}]
```

**关键发现**: `--permission-mode` 参数（无论 `bypassPermissions` 还是 `default`）**不影响** `control_request` 的出现与否。两种模式下行为完全相同。

### 实验 3 结果: --permission-prompt-tool stdio — Stream closed 错误

```
[system/init] permissionMode=default
[assistant]   tool_use name=AskUserQuestion id=toolu_01MDL2UeCASbhArHKFWeCCWF
[user]        tool_result id=toolu_01MDL2UeCASbhArHKFWeCCWF is_error=True
              content="Tool permission request failed: Error: Stream closed"
[result/success] turns=2 permission_denials=[1]
```

**关键发现**:
1. 错误信息从 `"Answer questions?"` 变为 `"Tool permission request failed: Error: Stream closed"`
2. **CLI 确实尝试通过 stdio 发送 control_request**，但因为 pipe 在 CLI 写入 control_request 之前关闭，导致写入失败
3. 这证明 `--permission-prompt-tool stdio` **是触发 control_request 协议的必要条件**

### 补充研究结果: control_request 协议规范

来源: Claude Code 官方文档、Agent SDK 源码、GitHub issues (#24594, #469)

#### 协议全貌

`control_request` 是 Claude Code CLI 的**真实协议**，但需要特定标志激活：

| CLI 参数 | control_request 行为 |
|----------|---------------------|
| 无 `--permission-prompt-tool` | **不触发** — CLI 内部处理所有权限，AskUserQuestion 返回 error |
| `--permission-prompt-tool stdio` | **触发** — CLI 在 stdout 发出 control_request，阻塞等待 stdin 的 control_response |

#### 权限评估链（决定是否触发 control_request）

```
1. Hooks (PreToolUse)          → 如果 hook 返回决策，停在这里
2. Deny rules (disallowedTools) → 总是拒绝，不触发 control_request
3. Permission mode              → bypassPermissions 自动允许；acceptEdits 自动允许文件操作
4. Allow rules (allowedTools)   → 匹配则自动允许
5. canUseTool / control_request → 只有到达这一步的工具才触发 control_request
```

**关键**: `--permission-prompt-tool stdio` 使步骤 5 通过 stdio 而非内置 UI 处理。

#### Wire Format

**CLI → 宿主 (stdout)**:
```json
{
  "type": "control_request",
  "request_id": "req_1_abc123",
  "request": {
    "subtype": "can_use_tool",
    "tool_name": "AskUserQuestion",
    "input": {
      "questions": [{"question": "你喜欢什么颜色？", ...}]
    }
  }
}
```

**宿主 → CLI (stdin)**:
```json
{
  "type": "control_response",
  "request_id": "req_1_abc123",
  "response": {
    "subtype": "success",
    "response": {
      "behavior": "allow",
      "updatedInput": {
        "questions": [...],
        "answers": {"你喜欢什么颜色？": "红色"}
      }
    }
  }
}
```

---

## 4. 结论

### 假设验证结果: 部分验证 ✅

| 假设 | 结论 |
|------|------|
| AskUserQuestion 使用 control_request 协议 | ✅ 是的，**但需要 `--permission-prompt-tool stdio`** |
| CCAAS 生产环境下触发 control_request | ❌ 否 — 因为未传 `--permission-prompt-tool stdio` |
| bypassPermissions 自动接受 AskUserQuestion | ❌ 否 — **自动拒绝**（返回 error），不是自动接受 |

### 核心发现

**CCAAS backend 的 CLI 启动参数缺少 `--permission-prompt-tool stdio`**，这是 AskUserQuestion 无法工作的根本原因：

```typescript
// cli-process.service.ts:68-73 — 当前配置
const args: string[] = [
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--verbose',
  '--permission-mode', 'bypassPermissions',  // ← 权限策略
  // ← 缺少: '--permission-prompt-tool', 'stdio'
];
```

没有 `--permission-prompt-tool stdio`，CLI 在遇到 AskUserQuestion 时：
1. 无法通过 stdout 发出 `control_request` 通知宿主
2. 无法阻塞等待 `control_response`
3. 直接返回 `is_error: true, content: "Answer questions?"` 的 tool_result
4. LLM 收到错误后重试 → 产生 3 个不同 toolId → 前端渲染 3 个 Widget

### 修正前期调查结论

前期 root-cause-report.md 认为 `bypassPermissions` 模式会"自动接受"AskUserQuestion 并返回"空结果"。实验证明这不准确：

| 前期结论 | 实验验证结果 |
|---------|-------------|
| ~~bypassPermissions 自动接受~~ | **自动拒绝**，`is_error=true` |
| ~~返回空/默认 tool_result~~ | 返回 **错误** tool_result: `"Answer questions?"` |
| ~~permission_denials 不存在~~ | `result` 事件中**明确列出** permission_denials |

---

## 5. 推荐修复方案

### 方案 A: 实现 control_request 协议（推荐 — 长期方案）

**原理**: 在 CLI spawn 参数中添加 `--permission-prompt-tool stdio`，backend 解析 `control_request`，通过 SSE 转发到前端，前端收集用户输入后通过 API 发回 `control_response`。

**改动**:

1. **cli-process.service.ts** — 添加 `--permission-prompt-tool stdio` 到 spawn 参数
2. **event-mapper.service.ts** — 添加 `case 'control_request'` 处理分支，映射为前端 `permission_request` 事件
3. **session-manager.service.ts** — 新增 `handleControlResponse()` 方法，将前端响应写入 CLI stdin
4. **chat.controller.ts** — 新增 endpoint: `POST /sessions/:id/control-response`
5. **前端** — AskUserQuestion Widget 提交时调用新 API

**优势**: AskUserQuestion 真正可用，支持 human-in-the-loop
**风险**: 需要处理 timeout、并发 control_request（subagent 场景）、CLI 进程意外退出

### 方案 B: Skill Prompt 禁止 + 前端防御（短期方案）

**原理**: 在 Skill prompt 中禁止使用 AskUserQuestion，同时在前端 postprocessor 中对同名工具去重。

**改动**:
1. 所有 SKILL.md 添加 `**不要使用 AskUserQuestion 工具**`
2. postprocessor.ts 添加同一 turn 内同名工具去重逻辑

**优势**: 零 backend 改动，立即可用
**局限**: 无法使用 AskUserQuestion 功能

### 方案 C: --permission-mode + allowedTools 组合（中期方案）

**原理**: 使用 `--permission-mode default` + `--allowedTools` 允许特定工具，AskUserQuestion 不在允许列表中时会走 control_request 路径。

**改动**: 需要同方案 A 的 control_request 协议实现

---

## 6. 影响范围

### 方案 A 需要改动的文件

| 文件 | 改动类型 | 改动描述 |
|------|---------|---------|
| `packages/backend/src/sessions/services/cli-process.service.ts` | 修改 | 添加 `--permission-prompt-tool stdio` |
| `packages/backend/src/sessions/event-mapper.service.ts` | 修改 | 添加 `control_request` 事件处理 |
| `packages/backend/src/sessions/session-manager.service.ts` | 修改 | 添加 `handleControlResponse()` |
| `packages/backend/src/chat/chat.controller.ts` | 修改 | 添加 control-response endpoint |
| `packages/backend/src/sessions/common/interfaces.ts` | 修改 | 添加 ControlRequest/ControlResponse 类型 |
| `packages/react-sdk/src/hooks/useAgentChat.ts` | 修改 | 处理 `permission_request` 事件 |
| `packages/chat-interface/src/context/ChatCoreContext.tsx` | 修改 | 添加 control-response 提交逻辑 |
| `solutions/business/edu-platform/frontend/src/components/AskUserQuestionRenderer.tsx` | 修改 | Widget 提交时调用 control-response API |

### 方案 B 需要改动的文件

| 文件 | 改动类型 |
|------|---------|
| `solutions/business/edu-platform/skills/*/SKILL.md` | 修改 |
| `packages/chat-interface/src/harness/postprocessor.ts` | 修改 |

---

## 7. 风险评估

### 方案 A 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `--permission-prompt-tool stdio` 影响所有工具（不只是 AskUserQuestion） | 高 — 所有非预授权工具都会触发 control_request | 组合使用 `--allowedTools` 预授权常用工具（Bash、Read、Write 等），只让 AskUserQuestion 走 control_request 路径 |
| CLI 版本升级可能改变 control_request 行为 | 中 — 协议尚未完全稳定 | 锁定 CLI 版本，添加集成测试 |
| control_request 超时处理 | 中 — 用户长时间不回答 | 设置 timeout，超时后发送 deny response |
| 并发 control_request（subagent 场景） | 低 — 多个工具同时请求权限 | 用 request_id 关联请求和响应 |

### 方案 B 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LLM 忽略 prompt 禁令仍调用 AskUserQuestion | 中 | 前端去重作为防御层 |
| 前端去重可能误合并有意义的多次调用 | 低 | 只对同一 assistant turn 内的同名工具去重 |

---

## 8. Backend 事件处理链分析（实验 3 补充）

### 当前数据流（无 --permission-prompt-tool stdio）

```
┌─────────────┐     stdout: stream-json      ┌──────────────┐     SSE      ┌──────────┐
│  Claude CLI  │ ──────────────────────────►  │   Backend    │ ──────────►  │ Frontend │
│              │                              │              │              │          │
│ AskUserQ     │  ① assistant: tool_use       │ handleCLI    │  tool_activity│          │
│ tool_use     │     name=AskUserQuestion     │   Output()   │  (start)     │  Widget  │
│              │                              │              │              │  渲染    │
│ auto-deny    │  ② user: tool_result         │ eventMapper  │  tool_activity│          │
│              │     is_error=true             │   .mapTo     │  (end,       │  3x 重复 │
│              │     "Answer questions?"       │   Session    │   error)     │          │
│              │                              │   Events()   │              │          │
│ LLM 重试x3  │  ③④⑤ 重复 ①②               │              │  3x 重复    │          │
│              │                              │              │              │          │
│              │  ⑥ result:                   │              │  agent_status│          │
│              │     permission_denials=[3]    │              │  (complete)  │          │
└─────────────┘                              └──────────────┘              └──────────┘
```

### event-mapper.service.ts 处理细节

`mapToSessionEvents()` 方法 (line 305-660) 的相关分支：

1. **`case 'assistant'`** (line 324): 遍历 `msg.content[]`
   - `tool_use` block → 生成 `tool_activity(start)` 事件
   - `text` block → 生成 `text_delta` 事件
   - **没有** `control_request` 判断

2. **`case 'user'`** (line 460): 遍历 `userMsg.content[]`
   - `tool_result` block → 生成 `tool_activity(end)` 事件
   - 检查 `is_error` → 设置 `success: false`
   - **AskUserQuestion 的错误 tool_result 被当作普通工具完成事件处理**

3. **`case 'result'`** (line 627):
   - 生成 `chat_response` 和 `agent_status(complete)` 事件
   - **`permission_denials` 字段完全被忽略** — backend 没有任何代码读取此字段

4. **缺失的 `case 'control_request'`**:
   - event-mapper 的 switch 语句没有 `control_request` 分支
   - 如果 CLI 发出 `control_request`，会落入 default case（静默忽略或 warn log）

### 前端接收的事件序列

每次 AskUserQuestion 调用，前端收到 2 个事件：
```
tool_activity(start): { toolName: "AskUserQuestion", toolId: "toolu_xxx", phase: "start", toolInput: {...} }
tool_activity(end):   { toolName: "AskUserQuestion", toolId: "toolu_xxx", phase: "end", success: false, toolError: "Answer questions?" }
```

LLM 重试 3 次 → 前端收到 6 个事件（3 对 start/end），产生 3 个独立 Widget。

### stdin 写入路径分析

`cli-process.service.ts` 的 `sendMessageToProcess()` (line 407-498):
- **只接受 `type: 'user'` 消息**
- 格式: `{"type":"user","message":{"role":"user","content":"..."}}`
- **没有 `control_response` 写入逻辑**
- 实现 control_response 需要新增专门的 stdin 写入方法

---

## 9. 目标数据流（实现 control_request 协议后）

```
┌─────────────┐     stdout: stream-json      ┌──────────────┐     SSE      ┌──────────┐
│  Claude CLI  │ ──────────────────────────►  │   Backend    │ ──────────►  │ Frontend │
│              │                              │              │              │          │
│ AskUserQ     │  ① assistant: tool_use       │ handleCLI    │  tool_activity│          │
│ tool_use     │     name=AskUserQuestion     │   Output()   │  (start)     │  Widget  │
│              │                              │              │              │  渲染    │
│ CLI 发出     │  ② control_request:          │ eventMapper  │  ask_user_   │          │
│ 权限请求     │     tool=AskUserQuestion     │   .mapTo...  │  question    │  交互式  │
│              │     input={questions:[...]}   │  (新增case)  │  (新事件)    │  UI      │
│              │                              │              │              │          │
│ CLI 阻塞     │  ... 等待 control_response   │   等待前端   │              │  用户    │
│ 等待响应     │                              │   响应       │              │  选择    │
│              │                              │              │              │          │
│              │  ③ 前端提交                  │ POST /sessions/:id/         │  提交    │
│              │                              │   control-response          │  答案    │
│              │                              │              │              │          │
│ CLI 恢复     │  ④ control_response 写入     │ handleControl│              │          │
│              │     stdin                    │   Response() │              │          │
│              │                              │              │              │          │
│ 工具完成     │  ⑤ user: tool_result         │              │  tool_activity│          │
│              │     content={answers:{...}}  │              │  (end, ok)   │  显示    │
│              │                              │              │              │  结果    │
│ LLM 继续     │  ⑥ assistant: text           │              │  text_delta  │          │
│              │     "你选择了红色..."         │              │              │          │
└─────────────┘                              └──────────────┘              └──────────┘
```

### 关键实现点

#### 9.1 CLI spawn 参数调整

```typescript
// cli-process.service.ts — 需要的参数组合
const args: string[] = [
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--verbose',
  '--permission-mode', 'bypassPermissions',        // 保持：自动允许 Bash/Read/Write 等
  '--permission-prompt-tool', 'stdio',              // 新增：启用 control_request 协议
  // 注意：bypassPermissions + permission-prompt-tool stdio 的组合行为需要验证
  // 可能需要改为 --permission-mode default + --allowedTools 列表
];
```

**关键问题**: `bypassPermissions` 会在权限评估链的第 3 步自动允许所有工具，`--permission-prompt-tool stdio` 在第 5 步才生效。如果 `bypassPermissions` 在第 3 步已经允许了 AskUserQuestion，control_request 就不会触发。

**可能需要的参数组合**:
```typescript
const args: string[] = [
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--verbose',
  '--permission-mode', 'default',                   // 改为 default
  '--permission-prompt-tool', 'stdio',              // 启用 control_request
  '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,...',  // 预授权常用工具
  // AskUserQuestion 不在 allowedTools 中 → 走 control_request 路径
];
```

#### 9.2 event-mapper 新增分支

```typescript
// event-mapper.service.ts — mapToSessionEvents() 新增
case 'control_request': {
  const request = (cliEvent as any).request;
  const requestId = (cliEvent as any).request_id;

  if (request?.subtype === 'can_use_tool' && request?.tool_name === 'AskUserQuestion') {
    // AskUserQuestion 特殊处理：转发到前端让用户交互
    events.push({
      type: 'ask_user_question',  // 新事件类型
      sessionId,
      clientId,
      payload: {
        requestId,                // 用于后续 control_response 关联
        toolName: request.tool_name,
        toolInput: request.input, // questions 数组
        timestamp,
      },
    });

    // 存储 requestId 以备 control_response 使用
    this.pendingControlRequests.set(`${sessionId}:${requestId}`, {
      requestId,
      toolName: request.tool_name,
      createdAt: Date.now(),
    });
  } else {
    // 非 AskUserQuestion 的 control_request → 自动允许
    // 需要通过 stdin 写入 control_response
    this.autoApproveControlRequest(sessionId, requestId, request);
  }
  break;
}
```

#### 9.3 control_response 写入

```typescript
// session-manager.service.ts 或 cli-process.service.ts — 新增方法
async handleControlResponse(
  sessionId: string,
  requestId: string,
  answers: Record<string, string>
): Promise<void> {
  const session = this.getSession(sessionId);
  if (!session?.cliProcess) throw new Error('No active CLI process');

  const response = {
    type: 'control_response',
    request_id: requestId,
    response: {
      subtype: 'success',
      response: {
        behavior: 'allow',
        updatedInput: {
          // 将用户答案合并到原始 input 中
          ...originalInput,
          answers,
        },
      },
    },
  };

  session.cliProcess.stdin.write(JSON.stringify(response) + '\n');
}
```

---

## 10. 开放问题

### Q1: bypassPermissions + permission-prompt-tool stdio 的组合行为

实验只测试了三种单独配置。未验证 `--permission-mode bypassPermissions` 和 `--permission-prompt-tool stdio` **同时使用**时的行为。可能的结果：
- bypassPermissions 在第 3 步允许所有工具 → control_request 永远不触发（stdio 标志无效）
- 或 `--permission-prompt-tool stdio` 覆盖 bypassPermissions 的部分行为

**需要后续实验验证**。

### Q2: AskUserQuestion 的 control_response 格式

实验 3 因 pipe 断裂未能验证 control_response 的完整 round-trip。`updatedInput` 中如何传递用户答案的具体 schema 需要参考 Agent SDK 源码确认。

### Q3: 非 AskUserQuestion 工具的 control_request 影响

如果使用 `--permission-mode default` 替代 `bypassPermissions`，所有未在 `--allowedTools` 中的工具都会触发 control_request。需要维护一个完整的 allowedTools 列表，包括所有 MCP 工具。

### Q4: Channels Reference 的替代方案

Claude Code 文档中提到 `notifications/claude/channel/permission_request` → `notifications/claude/channel/permission` 的 MCP notification 对作为 control_request 的 channels 层等价物。这可能是更稳定的集成方式，但需要更多研究。

---

## 附录: 实验原始数据

### 实验 1 完整事件流 (bypassPermissions)

文件: `/tmp/cli-stdout-exp1.jsonl` (11 行)

关键事件:
```json
// 1. LLM 调用 AskUserQuestion
{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_01WM6MQ4t6ZTTux1VZJtV9Bs","name":"AskUserQuestion","input":{"questions":[{"question":"你喜欢什么颜色？","header":"颜色偏好","options":[...]}]}}]}}

// 2. CLI 自动生成错误 tool_result（无 control_request）
{"type":"user","message":{"content":[{"type":"tool_result","content":"Answer questions?","is_error":true,"tool_use_id":"toolu_01WM6MQ4t6ZTTux1VZJtV9Bs"}]},"tool_use_result":"Error: Answer questions?"}

// 3. result 事件包含 permission_denials
{"type":"result","permission_denials":[{"tool_name":"AskUserQuestion","tool_use_id":"toolu_01WM6MQ4t6ZTTux1VZJtV9Bs","tool_input":{...}}]}
```

### 实验 3 错误变化 (--permission-prompt-tool stdio)

```json
// 错误信息变为 "Stream closed"，证明 CLI 尝试发出 control_request
{"type":"user","message":{"content":[{"type":"tool_result","content":"Tool permission request failed: Error: Stream closed","is_error":true,"tool_use_id":"toolu_01MDL2UeCASbhArHKFWeCCWF"}]}}
```

### 实验环境

- Claude Code CLI: v2.1.63
- Model: claude-opus-4-6
- OS: Darwin 23.6.0 (macOS)
- Node.js: v22.15.1
- 实验日期: 2026-04-02
