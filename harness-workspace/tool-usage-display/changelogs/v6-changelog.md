# V6 Changelog

## Changes

### SPEC: D2 rubric alignment with design doc
- Updated D2 5/5 description: "单色小图标" → "小型分类徽章（参考 `工具-折叠.png`：紫色 M=MCP，蓝色 AI=LLM，绿色 F=文件）"
- This aligns the rubric text with the authoritative reference design images

### D3/D5: Contextual output labels (ToolActivityBlock.tsx)
- Added `getOutputLabel(name)` function returning tool-specific Chinese labels:
  - Bash → "命令输出"
  - Read → "文件内容"
  - Write/Edit → "操作结果"
  - Glob → "匹配文件"
  - Grep → "搜索结果"
  - WebFetch/WebSearch → "搜索结果"
  - MCP tools → "查询结果"
  - Default → "输出"
- Error label: "Error" → "错误"
- Teachers now see contextual Chinese labels that describe what each section contains

### D5: Grep regex simplification
- When Grep pattern contains regex syntax and is > 30 chars, extract human-readable words
- Example: `c-8-2-math|八年级.*2班|mock.*progress` → `搜索内容: c-8-2-math 八年级 2班 mock progress`

### D3: Agent output content block extraction
- For Agent/Task outputs that return `[{ type: "text", text: "..." }]` arrays, extract the text content directly instead of showing raw JSON wrapper

## Files Modified
- `harness-workspace/tool-usage-display/SPEC.md` — D2 rubric alignment
- `packages/chat-interface/src/components/ToolActivityBlock.tsx` — contextual labels, error translation, grep simplification, output extraction
