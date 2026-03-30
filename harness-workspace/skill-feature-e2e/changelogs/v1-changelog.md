# v1 Changelog

## Changes
- [useSkills.ts]: Added `throw err` re-throw in toggleSkill catch block so callers can detect failures
- [SkillPanel.tsx]: Passed `apiKey` prop to SolutionTab component
- [SkillPanel.tsx]: Changed SolutionTab `onToggle` type from `(id: string) => void` to `(id: string) => Promise<void>`
- [SkillPanel.tsx]: Created `handleToggle` async helper in SolutionTab with auth pre-check and try/catch
- [SkillPanel.tsx]: Replaced sync `onToggle(skill.id); toast.success(...)` on "停用" button (line 243) with `handleToggle(skill, '停用')`
- [SkillPanel.tsx]: Replaced sync `onToggle(skill.id); toast.success(...)` on "启用" button (line 265) with `handleToggle(skill, '启用')`

## Bugs Fixed
- Bug 1 (Critical): Toast no longer fires before API response — now awaits toggleSkill result before showing success/error toast
- Bug 2: Added apiKey pre-check — shows `toast.warning('请先登录才能操作 Skill')` when not authenticated, prevents API call
- Bug 3: Toggle errors now shown via `toast.error` near the action, not buried in panel header error state

## Verification
- typecheck: PASS (npx tsc --noEmit — clean exit, no errors)
- grep `onToggle.*toast`: PASS (no matches — no sync toast patterns remain)
- grep `throw err` in useSkills.ts: PASS (line 84)
