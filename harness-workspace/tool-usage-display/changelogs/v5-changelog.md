# V5 Changelog

## Changes

### D3/D5: Simplified Agent/default tool input in expanded view (ToolActivityBlock.tsx)
- Agent tools (`subagent_type` or `prompt` present) now display:
  - `描述: {description}` (truncated to 80 chars)
  - `类型: {subagent_type}` (e.g., "Explore")
  - `指令: {prompt}` (only if no description, truncated to 120 chars)
- MCP tools and tools with ≤5 key-value pairs now display as `key: value` lines instead of raw JSON
- Only falls back to `JSON.stringify` for tools with >5 parameters

### Before vs After
**Before (v4):**
```json
{
  "description": "查看 edu-platform MCP 工具",
  "prompt": "Read the file at /Users/.../src/index.ts to understand...",
  "subagent_type": "Explore"
}
```

**After (v5):**
```
描述: 探索 edu-platform MCP 工具
类型: Explore
```

## Files Modified
- `packages/chat-interface/src/components/ToolActivityBlock.tsx` — formatInput default case
