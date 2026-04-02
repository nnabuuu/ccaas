# Chat 对话协议

## 消息处理管线

System prompt 由**服务端**组装（见 ADR-0012），前端只通过 `appendSystemPrompt` 字段补充服务端无法得知的信息。

```
服务端 system prompt 组装:
  ├── Skill prompt (SkillManagementService)
  ├── Template appendSystemPrompt (租户配置)
  ├── MCP tool descriptions (自动生成)
  └── 前端 appendSystemPrompt (widget catalog + static context)

前端职责 (buildAppendPrompt):
  ├── Widget catalog description (服务端不知前端注册了哪些 widget)
  └── 少量 static context (角色/学校等不变信息)
  注: domain-specific dynamic data 通过 MCP server 提供, 不注入 system prompt

用户输入
  ↓
Agentic 引擎 completion (LLM 推理 + tool_use)
  ↓
Harness 后处理:
  ├── text block → Markdown 气泡
  ├── tool_use: render_widget → json-render Renderer
  ├── tool_use: generate_file → 文件下载卡片
  └── tool_use: call_mcp → MCP 执行, 结果注入下一轮
```

## Session Context

顶部上下文栏显示当前会话绑定的 班级/学科/学校, 教师可切换。

```typescript
interface SessionContext {
  userId: string;
  role: "district_admin" | "school_admin" | "teacher" | "student";
  schoolId?: string;
  classId?: string;
  subject?: Subject;
  gradeSemester?: GradeSemester;
  semesterPhase: "early" | "mid" | "late" | "exam";
}
```

切换 context 不需要新建会话 — 修改 session.context 后, 下一轮 completion 的 system_prompt 自动更新。

## Skill 激活可见性

AI 回复上方显示绿色标签标注当前激活的 Skill (如 "备课助手")。
由 Harness 层在 response metadata 中标注 `active_skill` 字段。

## 消息类型混排

Chat 流中混合三种渲染:
- 纯文本 Markdown 气泡
- json-render Widget (备课向导/学情图表等)
- 文件卡片 (.docx / .pdf)

## 后续操作链

Skill 输出可附带 next_actions:

```typescript
interface SkillResponse {
  content: ContentBlock[];
  next_actions?: Array<{
    label: string;
    prompt: string;
    skill_hint?: SkillId;
  }>;
}
```

## AskUserQuestion → Wizard 交互

当 LLM 调用 `AskUserQuestion` 工具时，CLI 暂停并通过 `control_request` 协议发送请求。前端收到 `tool_activity(start)` 事件后渲染交互 UI：

```
tool_activity(start, toolName='AskUserQuestion', toolInput={questions, requestId})
  ↓
前端检查 wizardRegistry 是否有匹配的 Wizard 配置
  ├── 有 → 渲染 WizardRenderer（多步向导：form / tree-select / data-review / summary）
  └── 无 → 渲染默认 AskUserQuestion 问答 UI（单选/多选）
  ↓
用户完成交互 → POST /sessions/:id/control-response { requestId, answers }
  ↓
CLI 恢复，LLM 收到结构化 JSON answers
```

### Wizard 组件

通用 Wizard 框架位于 `src/components/wizard/`：
- `WizardRenderer.tsx` — 通用多步向导渲染器（step indicator + navigation）
- `steps/FormStep.tsx` — 表单步骤（select / text / number）
- `steps/TreeSelectStep.tsx` — 树形多选步骤
- `steps/DataReviewStep.tsx` — 数据表格 + emphasis toggle
- `steps/SummaryStep.tsx` — 只读摘要确认
- `registry.ts` — Wizard 配置注册表（按 skill slug 查找）
- `types.ts` — WizardConfig / WizardStep / FormFieldConfig 类型

Solution 通过 `registerWizard(skillSlug, config)` 注册自定义向导配置。

## 快捷建议

输入框上方快捷按钮由规则引擎动态生成 (不走 LLM):
- 基于角色 + 学科 + 教学进度 + 近期使用频率 + 日历上下文
