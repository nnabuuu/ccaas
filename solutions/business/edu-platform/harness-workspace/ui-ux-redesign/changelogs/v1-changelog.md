# v1 Changelog — Layout + Sidebar + Landing Page

## Target Dimensions
- **D1 (Layout + Sidebar)**: 20/100
- **D2 (Landing Page + Composer)**: 20/100

## Changes Made

### 1. ChatSidebar.tsx (packages/chat-interface/src/components/)
**Full rewrite** to match `chat-full-layout.html` prototype.

- **Header**: Product name ("即见教育") on left + bordered "+" new chat button on right
- **Search**: Bordered input with focus color transition, matching prototype `.side-search`
- **Session list**: Status dots (blue=active, gray=done), timestamps, date grouping (今天/昨天/本周/更早)
- **Skills list**: Individual skill items with colored icon badges (solution=green, custom=coral), "管理 Skills" entry
- **User footer**: Avatar + name + role, upward popover menu with settings/export/help/logout (matching `.user-menu`)
- **i18n**: ZH_LABELS / EN_LABELS system with `locale` prop
- **New props**: `productName`, `locale`, `skills` (SidebarSkillItem[]), `userRole`
- **New exports**: `SidebarSkillItem` type

### 2. EduEmptyState.tsx (solutions/.../frontend/src/components/)
**New component** matching `chat-full-layout.html` landing section.

- Dynamic greeting based on time of day (早上好/下午好/晚上好 + 教师姓名)
- Subtitle "我是你的教学助手"
- Context line (第N周 · 班级 · 学科)
- 2x2 starter cards grid (备课/出题/学情/错题本) with colored icons matching prototype
- "试试这样说" prompt examples with arrow hover animation
- Connected via `EduEmptyStateConnected` wrapper using `useChatCore().handleAction`

### 3. index.css (solutions/.../frontend/src/)
**Floating composer** replacing flat input bar.

- Composer wrapper: transparent background, 20px side padding, 16px bottom padding
- Composer card: `border-radius: 16px`, `0.5px solid` border, `box-shadow: 0 2px 12px rgba(0,0,0,0.06)` — matches `.input-box-float`
- Textarea: borderless inside floating card, 14px font, transparent background
- Send button: 32px square with `border-radius: 10px` — matches `.send`
- Landing page CSS: `.edu-landing`, `.edu-starter`, `.edu-prompt` classes matching all prototype values

### 4. App.tsx (solutions/.../frontend/src/)
**Updated** to pass new sidebar props and custom empty state.

- `productName="即见教育"`, `locale="zh"`
- `skills={SIDEBAR_SKILLS}` — 4 skills (3 solution, 1 custom) matching prototype
- `userRole` — dynamic from class info
- `emptyState={<EduEmptyStateConnected />}` — wired to ChatCoreContext
- Composer placeholder changed to "描述你的需求..."

### 5. index.ts (packages/chat-interface/src/)
- Added `SidebarSkillItem` to type exports

## Files Modified
| File | Type |
|------|------|
| `packages/chat-interface/src/components/ChatSidebar.tsx` | Rewritten |
| `packages/chat-interface/src/index.ts` | Edited (export) |
| `solutions/.../frontend/src/App.tsx` | Rewritten |
| `solutions/.../frontend/src/index.css` | Rewritten |
| `solutions/.../frontend/src/components/EduEmptyState.tsx` | New |

## Verification
- `cd packages/chat-interface && npx tsc --noEmit` — PASS
- `cd packages/chat-interface && npm run build` — PASS
- `cd solutions/.../frontend && npx tsc --noEmit` — PASS
