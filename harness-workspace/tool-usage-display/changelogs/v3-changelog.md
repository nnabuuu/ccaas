# V3 Changelog

## Changes

### D4: Auto-collapse when tools finish (ToolGroup.tsx)
- Added `useEffect` that sets `expanded = false` when `allComplete` becomes true and `shouldAutoExpand` is false
- Tool groups now auto-expand during execution and auto-collapse when all tools finish
- Users can still manually expand/collapse groups

### D3: Output path shortening (ToolActivityBlock.tsx)
- Added `shortenPathsInText()` function that replaces absolute paths in output text
  - Keeps last 3 segments: `/Users/.../edu-platform/mcp-server/src/types.ts` → `…/mcp-server/src/types.ts`
- Applied to all tool output formatting in `formatOutput()`

### D5: Chinese labels (ToolActivityBlock.tsx)
- Generic tool display text now uses Chinese verbs:
  - Read → "读取 …/path", Write → "写入 …/path", Edit → "编辑 …/path"
  - Glob → "搜索文件: pattern", Grep → "搜索内容: pattern"
  - Bash → shortened command, WebFetch/WebSearch → "搜索网页", Task → "子任务"
- Expanded detail labels:
  - "Input" → "输入", "Output" → "输出"
  - "File" → "文件", "Search pattern" → "搜索模式", "Search" → "搜索"
- Glob/Grep display text now shortens absolute paths in patterns (keeps last 4 segments)
- Bash command display shortens absolute paths (keeps last 3 segments)
- Skill/agent tools: formatted as "技能: X\n参数: Y" instead of raw JSON

## Files Modified
- `packages/chat-interface/src/components/ToolGroup.tsx` — auto-collapse effect
- `packages/chat-interface/src/components/ToolActivityBlock.tsx` — Chinese labels, path shortening, skill formatting
