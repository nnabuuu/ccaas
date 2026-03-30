# v1 Changelog

## 改动文件
- `src/context/ChatCoreContext.tsx` — Added controlled component pattern: `skillPanelOpen?` + `onSkillPanelChange?` props to `ChatCoreProviderProps`. External prop takes priority over internal state.
- `src/components/chat/ChatInterfaceRoot.tsx` — Added `skillPanelOpen?` + `onSkillPanelChange?` props to `ChatInterfaceRootProps`, threaded to `ChatCoreProvider`.
- `src/components/ChatInterface.tsx` — Added `skillPanelOpen?` + `onSkillPanelChange?` props to `ChatInterfaceProps`. Conditional rendering: when `skillPanelOpen` is true, show `ChatInterfaceSkillPanel` instead of ContextBar + Messages + QuickSuggestions + Composer.
- `src/components/ChatSidebar.tsx` — Added `onSkillsClick?` + `skillsActive?` props. Added `IconPuzzle` SVG icon. Added Skills entry button in both expanded and collapsed sidebar states (between session list and user menu).
- `src/App.tsx` — Added `skillPanelOpen` state. Wired `onSkillsClick`, `skillsActive`, `skillPanelOpen`, `onSkillPanelChange` props.
- `solutions/business/edu-platform/frontend/src/App.tsx` — Same wiring as core App.tsx.

## 对应维度
- D1 (原型对齐): SkillPanel visual already matches HTML prototype (was pre-built in previous work). No visual changes needed this round — focus was on architecture.
- D2 (Sidebar 集成): Full implementation — Skills entry in expanded sidebar (Puzzle icon + "Skills" text with active state highlight) and collapsed sidebar (icon-only with active bg). Clicking opens SkillPanel replacing chat area.
- D3 (功能验证): Panel opens from sidebar click, replaces chat area. Close button (X) restores full chat. Tab switching works. Backend skills load and display correctly. Both core and edu-platform verified.
- D4 (响应式): Mobile (375x812) verified — stat cards 2-col, skill cards 1-col. Sidebar Skills button hidden on mobile (sidebar is drawer-based on mobile).
- D5 (代码质量): All props optional (backward compatible). TypeScript strict mode passes (`tsc --noEmit`). All 81 tests pass. Controlled component pattern follows React best practices. No new dependencies.

## Props 接口变更
- `ChatCoreProviderProps`: +`skillPanelOpen?: boolean`, +`onSkillPanelChange?: (open: boolean) => void`
- `ChatInterfaceRootProps`: +`skillPanelOpen?: boolean`, +`onSkillPanelChange?: (open: boolean) => void`
- `ChatInterfaceProps`: +`skillPanelOpen?: boolean`, +`onSkillPanelChange?: (open: boolean) => void`
- `ChatSidebarProps`: +`onSkillsClick?: () => void`, +`skillsActive?: boolean`

## Architecture
```
App.tsx (owns state)
  ├─ ChatSidebar (onSkillsClick → setSkillPanelOpen(true), skillsActive)
  └─ ChatInterface (skillPanelOpen, onSkillPanelChange)
       └─ ChatInterfaceRoot
            └─ ChatCoreProvider (controlled pattern: external prop > internal state)
                 └─ {skillPanelOpen ? <SkillPanel/> : <Chat UI/>}
```

## 验证结果
- TypeScript: PASS (0 errors)
- Tests: 81/81 PASS
- Core (localhost:5190): Sidebar Skills → Panel opens → Close → Chat restores
- Edu-Platform (localhost:5290): Same flow verified, shows edu-platform specific skills
- Mobile (375x812): Responsive layout verified

## 本轮重点
V1: 实现 Controlled Component Pattern 架构 — sidebar Skills 入口 → panel 替换 chat 主区域 → 关闭恢复 chat。完整 prop 穿透链 App → ChatInterface → ChatInterfaceRoot → ChatCoreProvider。
