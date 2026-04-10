# Hypothesis H3: quiz-generator Skill Prompt 未限制 AskUserQuestion 使用

## Verification Steps (actually executed)

1. 读 `solutions/business/edu-platform/skills/quiz-generator/SKILL.md`，搜索 AskUserQuestion
2. 检查参数收集方式（题型/难度/题量用什么工具）
3. 搜索所有 edu-platform skills 中的 AskUserQuestion 引用
4. 检查 MCP server 工具列表中是否包含 AskUserQuestion

## Collected Evidence

### quiz-generator SKILL.md

- **Line 6-8**: 明确说 "使用 show_info_card 呈现结构化选项，使用 suggest_actions 提供后续操作"
- **Line 27-34**: 工作流使用 "一段文本 + show_info_card 工具"
- **Line 152-163**: 工具表列出: `show_info_card`, `suggest_actions`, `write_output`, `generate_docx` — **无 AskUserQuestion**
- AskUserQuestion **零引用**

### 全部 3 个 Skills 搜索结果

```
grep -r "AskUserQuestion" solutions/business/edu-platform/skills/
# 结果: 零匹配
```

所有 skills（lesson-plan-generator, quiz-generator, student-analysis）都不提 AskUserQuestion。

### MCP Server 工具列表 (mcp-server/src/index.ts)

定义的工具: `curriculum_tree`, `student_proficiency`, `teaching_progress`, `generate_docx`, `write_output`, `show_info_card`, `show_step_wizard`, `show_review_panel`, `suggest_actions`

**AskUserQuestion 不在 MCP 工具列表中。** 它是 Claude Code 内置工具，不是 edu-platform 的 MCP 工具。

### 前端 AskUserQuestion 注册 (App.tsx:11, 20-22)

```typescript
import { askUserQuestionRenderer } from './components/AskUserQuestionRenderer'
const customToolRenderers: ToolRendererMap = {
  AskUserQuestion: askUserQuestionRenderer,
}
```

前端注册了 AskUserQuestion 的自定义渲染器，说明系统**预期**会收到该工具的调用。

## Judgment: CONFIRMED

## Rationale

AskUserQuestion 是 Claude Code 的**内置工具**（类似 Read, Write, Bash），不需要 MCP 注册即可使用。

LLM 在执行 quiz-generator Skill 时：
1. 看到 Skill Prompt 要求收集题型/难度/题量参数
2. 同时在可用工具列表中看到 Claude Code 内置的 AskUserQuestion
3. AskUserQuestion 的功能描述正好匹配"向用户提问并收集答案"的需求
4. LLM 自行决定使用 AskUserQuestion 而非 Skill 指定的 show_info_card

这不是 bug，而是 **Skill Prompt 未覆盖的行为** — Skill 没有明确禁止使用 AskUserQuestion，也没有指导 LLM 在需要收集参数时"只用 show_info_card"。

## Root Cause Description

quiz-generator Skill Prompt 使用 show_info_card + actions 模式收集参数，但未禁止 LLM 使用 Claude Code 内置的 AskUserQuestion 工具。LLM 看到 AskUserQuestion 更匹配"参数收集"的语义，自行选择使用它。

## Suggested Fix Direction

两种修复方向：
1. **Prompt 层**: 在 SKILL.md 中明确禁止使用 AskUserQuestion（"不要使用 AskUserQuestion 工具，使用 show_info_card 的 actions section 收集参数"）
2. **工具层**: 在 CLI 启动参数中通过 `--disallowedTools AskUserQuestion` 限制（如果支持）
