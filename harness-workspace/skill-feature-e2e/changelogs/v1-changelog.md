# v1 Changelog

## Code Review Fixes
- [sessions.controller.ts]: Swapped `@OptionalAuth()` / `@UseGuards(TenantGuard)` order on 3 endpoints (listSessions, searchSessions, getSessionTurns) — decorators now apply bottom-to-top correctly so Auth runs before TenantGuard
- [conversations-alias.controller.ts]: Same decorator order fix on 3 alias endpoints (listConversations, searchConversations, getConversationTurns)
- [skill-permission.guard.ts]: Removed dead `isOptionalAuth` variable (assigned but never read) and cleaned unused `IS_OPTIONAL_AUTH_KEY` import
- [SkillPanel.tsx]: Error toast now includes `err.message` detail instead of generic "请重试" string

## Tests Added/Extended
- [skills.service.toggle.spec.ts]: NEW — 3 tests: toggle true→false, false→true, NotFoundException for missing skill
- [skill-management.service.spec.ts]: EXTENDED — added `describe('loadEnabledSkills')` with 3 tests: only-enabled filter, all-disabled returns empty, slug-list filter
- [useSkills.test.ts]: NEW — 4 tests: fetch on mount, toggle via PATCH, error re-throw, searchQuery filtering
- [SkillPanel.test.tsx]: EXTENDED — 3 toast tests: warning without apiKey, success after toggle, error on failure. Fixed existing "calls toggleSkill" test to include apiKey (needed after auth pre-check)

## UI Bug Fixes
- [SkillPanel.tsx]: Already had async handleToggle + auth pre-check from baseline; only fix was error detail in catch block (see Code Review Fixes above)
- [useSkills.ts]: Already had `throw err` re-throw from baseline — no change needed

## Verification
- backend typecheck: PASS
- chat-interface typecheck: PASS
- backend tests: PASS (17 passed, 0 failed — skills.service.toggle + skill-management.service)
- react-sdk tests: PASS (4 passed — useSkills)
- chat-interface tests: PASS (18 passed — SkillPanel)
- grep checks: PASS (guard order correct, isOptionalAuth removed, throw err present)
