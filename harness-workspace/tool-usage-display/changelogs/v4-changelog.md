# V4 Changelog

## Changes

### D2+D5: Colored category badges (ToolActivityBlock.tsx)
- Replaced monochrome SVG `ToolIcon` with `CategoryBadge` component
- Three categories per design doc `工具-折叠.png`:
  - 紫色 **M** (bg-purple-100) = MCP tools (curriculum_tree, student_proficiency, etc.)
  - 蓝色 **AI** (bg-blue-100) = Agent/LLM tools (Bash, Grep, Glob, Task, etc.)
  - 绿色 **F** (bg-emerald-100) = File operations (Read, Write, Edit, generate_docx)
- Badge: 20x20px rounded square, 10px bold letter, pastel background
- `getToolCategory()` classifies by tool name prefix and known lists

### D5: Comprehensive English→Chinese mapping (ToolActivityBlock.tsx)
- Expanded `INTERNAL_LABELS` to cover all known backend descriptions:
  - "Executing AskUserQuestion" → "交互提问"
  - "Executing Tool" → "调用工具"
  - "ask_user_question" → "交互提问"
- Added catch-all regex: `/^Executing\s/i` → "正在处理"
- Added action verb stripping: "Reading:", "Writing:", "Editing:", "Running:" prefixes
- **Safety fallback**: if `cleanDescription` result is all-ASCII and > 20 chars, return "处理数据" instead of raw English
- This prevents ANY English technical text from leaking into the collapsed view

### Bug fix: ToolIcon → CategoryBadge reference
- Deleted `ToolIcon` function and replaced reference in main component with `CategoryBadge`

## Files Modified
- `packages/chat-interface/src/components/ToolActivityBlock.tsx` — category badges, English safety, internal labels
