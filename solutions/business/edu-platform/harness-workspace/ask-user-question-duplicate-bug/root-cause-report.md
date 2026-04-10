# Root Cause Report

## Bug: AskUserQuestion 重复渲染 (×3) & LLM 自动应答

## Summary

这是一个**组合根因** — 4 个假设中 3 个 CONFIRMED，共同导致了用户观察到的症状。

## Confirmed Root Causes

### 根因链条（因果顺序）

```
H3 (Prompt Gap)       → LLM 选择使用 AskUserQuestion 而非 show_info_card
        ↓
H1 (bypassPermissions) → AskUserQuestion 在 headless 模式下自动返回空结果
        ↓
H2 (LLM Triple Retry)  → LLM 认为失败，重试 3 次，产生 3 个不同 toolId
        ↓
Frontend (正确行为)     → 每个 toolId 渲染 1 个 Widget → 3 个相同面板
        ↓
LLM gives up          → 自行填入默认值，继续执行出题
```

### RC1: `--permission-mode bypassPermissions` 导致 AskUserQuestion 无法暂停 (H1)

**证据**: `cli-process.service.ts:68-73` — CLI spawn 参数包含 `--permission-mode bypassPermissions`

AskUserQuestion 是 Claude Code 内置工具，正常模式下会暂停等待用户输入。但 `bypassPermissions` 模式下自动接受所有工具调用，AskUserQuestion 立即返回空/默认 tool_result，不等待真实用户输入。

**这是最核心的根因** — 即使修复了 H3，只要 bypassPermissions 存在，AskUserQuestion 就无法正常工作。

### RC2: quiz-generator Skill Prompt 未控制 AskUserQuestion 使用 (H3)

**证据**: `quiz-generator/SKILL.md` 零 AskUserQuestion 引用；MCP server 无 AskUserQuestion 工具定义

Skill 使用 `show_info_card` + `actions` 收集参数，但未禁止 LLM 使用 Claude Code 内置的 AskUserQuestion。LLM 判断 AskUserQuestion 更匹配"参数收集"语义，自行选择使用。

### RC3: LLM 因空 tool_result 重试导致 3 次调用 (H2)

**证据**: 基于 H1 + 前端 3 个 Widget 推断（待运行时 SSE 验证）

空 tool_result → LLM 重试 → 3 个不同 toolId → 前端渲染 3 个 Widget。

## Eliminated Hypothesis

### H4: 前端去重失败 — ELIMINATED (重新评估)

前端 streaming 路径确实没有跨 toolId 去重，但这是**设计正确的行为**（每个 toolId 应渲染 1 个 Widget）。问题不在前端，而在 LLM 的 3 次调用。

## Fix Recommendations

### 短期修复（Quick Win）

**方案 A: Skill Prompt 禁止 AskUserQuestion** (修复 H3)

在 `quiz-generator/SKILL.md` 和其他 Skills 中添加：

```markdown
## 禁止使用的工具
- **不要使用 AskUserQuestion 工具**。使用 show_info_card 的 actions section 收集参数。
```

**效果**: LLM 不再调用 AskUserQuestion → 症状消失
**局限**: 如果其他场景确实需要 AskUserQuestion 功能，此方案不适用

**方案 B: CLI 工具黑名单** (修复 H3 的工具层方案)

在 CLI spawn 参数中添加 `--disallowedTools AskUserQuestion`（如果 Claude Code 支持）。

### 长期修复（Proper Fix）

**方案 C: 实现 AskUserQuestion Human-in-the-Loop** (修复 H1)

```
1. CLI 发送 AskUserQuestion tool_use → SSE tool_activity(start) 到前端
2. 前端渲染 AskUserQuestion Widget → 用户交互
3. 用户提交选择 → 前端调用 backend API
4. Backend 通过 stdin 向 CLI 写入 tool_result
5. CLI 恢复执行
```

需要新增：
- Backend: stdin 写入路径，专门处理 AskUserQuestion 用户响应
- Frontend: Widget 提交后的 API 调用
- CLI integration: 暂停-恢复机制（可能需要 Claude Code 支持）

**效果**: AskUserQuestion 真正可用，用户体验完整
**成本**: 需要 backend + frontend + CLI integration 的联合改动

### 防御层修复

**方案 D: 前端同名工具合并**

在 postprocessor 中对同一 assistant turn 内相同 toolName 的多次调用做合并展示（只显示最后一次）：

```typescript
// 在 streaming 路径添加 toolName dedup
const seenTools = new Map<string, number>()
for (const block of contentBlocks) {
  if (block.type === 'tool_use') {
    const prev = seenTools.get(block.toolName)
    if (prev !== undefined) {
      contentBlocks[prev] = null // mark for removal
    }
    seenTools.set(block.toolName, i)
  }
}
```

**效果**: 即使 LLM 调用 3 次，用户只看到 1 个 Widget
**局限**: 可能误合并有意义的多次调用

## Recommended Fix Order

1. **立即**: 方案 A（Skill Prompt 禁止）— 最快，零代码改动
2. **本周**: 方案 B（CLI 工具黑名单）— 工具层防御
3. **下个迭代**: 方案 C（Human-in-the-Loop）— 彻底解决

## Investigation Summary

| Round | Hypothesis | Status | Key Finding |
|-------|-----------|--------|-------------|
| 1 | H1: CLI auto-accept | CONFIRMED | `--permission-mode bypassPermissions` 自动接受 AskUserQuestion |
| 1 | H3: Skill prompt gap | CONFIRMED | Skill 未提及 AskUserQuestion，LLM 自行使用 |
| 1 | H4: Frontend dedup | ELIMINATED | 前端行为正确，问题在上游 |
| 1 | H2: LLM triple-call | CONFIRMED (inference) | 空 tool_result → 重试 3 次 → 3 个 Widget |
