# Generator Agent — Skill Feature E2E v2

You are fixing functional bugs, code review findings, writing unit tests, and updating documentation for the Skill toggle feature. This is NOT a visual/UI task — focus on **correct behavior**, **test coverage**, and **documentation completeness**.

## Context

Read these files FIRST:
1. `harness-workspace/skill-feature-e2e/SPEC.md` — bug descriptions, code review findings, test requirements
2. `harness-workspace/skill-feature-e2e/progress.md` — previous scores
3. Latest eval report in `harness-workspace/skill-feature-e2e/eval-reports/` (if exists)

## Files You May Modify

### Source fixes (5 files)
```
packages/chat-interface/src/components/SkillPanel.tsx          # Toggle handler, auth check, error toast
packages/react-sdk/src/hooks/useSkills.ts                      # toggleSkill re-throw
packages/backend/src/sessions/sessions.controller.ts           # Decorator order fix
packages/backend/src/sessions/conversations-alias.controller.ts # Same decorator order fix
packages/backend/src/skills/guards/skill-permission.guard.ts   # Remove dead isOptionalAuth
```

### Test files (4 files)
```
packages/backend/src/skills/skills.service.toggle.spec.ts           # CREATE — toggle unit tests
packages/backend/src/sessions/services/skill-management.service.spec.ts  # EXTEND — loadEnabledSkills tests
packages/react-sdk/__tests__/useSkills.test.ts                      # CREATE — hook unit tests
packages/chat-interface/src/components/__tests__/SkillPanel.test.tsx # EXTEND — toast tests
```

### Documentation files (3 files)
```
docs/gitbook/en/api/rest.md                    # EXTEND — add PATCH /skills/:id/toggle
docs/gitbook/zh/api/rest.md                    # EXTEND — same in Chinese
packages/chat-interface/ARCHITECTURE.md        # EXTEND — add SkillPanel props docs
```

**DO NOT modify any other files.**

---

## Execution Order: 3 Layers

### Layer 1: Code Review Fixes (do these FIRST)

#### Fix 1.1: Guard decorator order (CRITICAL-1)

In `sessions.controller.ts`, find ALL occurrences of:
```typescript
@OptionalAuth()
@UseGuards(TenantGuard)
```
Swap to:
```typescript
@UseGuards(TenantGuard)
@OptionalAuth()
```

**Why**: TypeScript decorators apply bottom-to-top. `@OptionalAuth()` must be below `@UseGuards(TenantGuard)` so auth runs first, then TenantGuard has access to `request.context`.

Same fix in `conversations-alias.controller.ts`.

#### Fix 1.2: Remove dead `isOptionalAuth` variable (MEDIUM-2)

In `skill-permission.guard.ts`, find and DELETE these lines (approximately lines 42-45):
```typescript
const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
  context.getHandler(),
  context.getClass(),
]);
```

This variable is assigned but never used anywhere in the function.

#### Fix 1.3: Error detail in toast (SUGGESTION-3)

In `SkillPanel.tsx` handleToggle catch block, include error detail:
```typescript
catch (err) {
  const message = err instanceof Error ? err.message : '未知错误'
  toast.error(`${action}失败: ${message}`)
}
```

### Layer 2: Write Unit Tests

#### Test 2.1: `skills.service.toggle.spec.ts` (NEW FILE)

Follow the mock pattern from `skills.service.files.spec.ts`. Create a Jest test:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SkillsService } from './skills.service';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SkillFile } from './entities/skill-file.entity';
import { SkillVersionFile } from './entities/skill-version-file.entity';
import { SessionService } from '../sessions/session.service';

describe('SkillsService - Toggle', () => {
  // Setup similar to skills.service.files.spec.ts
  // Test: toggle true → false
  // Test: toggle false → true
  // Test: non-existent → NotFoundException
});
```

Key mocking:
- `skillRepo.findOne` returns a mock Skill with `enabled: true` or `false`
- `skillRepo.save` returns the passed skill (simulates DB save)
- For non-existent: `skillRepo.findOne` returns `null`

#### Test 2.2: `skill-management.service.spec.ts` (EXTEND)

Add a new `describe('loadEnabledSkills')` block. The service's `loadEnabledSkills` method:
1. Calls `skillsService.findPublished(tenantId)` — mock this
2. Filters by `skill.enabled === true`
3. Optionally filters by slug list

```typescript
describe('loadEnabledSkills', () => {
  it('should return only enabled skills', async () => {
    // Mock findPublished to return mix of enabled/disabled
    // Verify only enabled ones returned
  });

  it('should return empty when all disabled', async () => {
    // Mock findPublished with all enabled:false
    // Verify empty array
  });

  it('should filter by slug list when provided', async () => {
    // Mock with enabled skills, pass slug filter
    // Verify only matching slugs returned
  });
});
```

You need to mock `SkillsService` with `findPublished` method:
```typescript
{ provide: SkillsService, useValue: { findPublished: jest.fn() } }
```

#### Test 2.3: `useSkills.test.ts` (NEW FILE)

Follow pattern from `useFiles.test.ts` — use `renderHook`, `vi.fn()`, `global.fetch` mock:

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSkills } from '../src/hooks/useSkills';
import { vi } from 'vitest';

global.fetch = vi.fn() as any;

describe('useSkills', () => {
  it('should fetch skills on mount', async () => {
    // Mock fetch to return skills array
    // renderHook(useSkills, { initialProps: { serverUrl, tenantId } })
    // waitFor: skills populated
  });

  it('should toggle skill via PATCH', async () => {
    // Mock initial fetch, then PATCH response
    // call toggleSkill
    // verify PATCH called, state updated
  });

  it('should re-throw toggle errors', async () => {
    // Mock PATCH to return 500
    // expect toggleSkill to reject
  });

  it('should filter by searchQuery', async () => {
    // Test filteredSkills computed property
  });
});
```

#### Test 2.4: `SkillPanel.test.tsx` (EXTEND)

Add 3 tests to the existing describe block:

```typescript
it('shows warning toast when toggling without apiKey', async () => {
  // Render WITHOUT apiKey prop
  // Click toggle button
  // Verify toast.warning called with login message
  // Verify toggleSkill NOT called
});

it('shows success toast after successful toggle', async () => {
  // Render WITH apiKey
  // Mock toggleSkill to resolve
  // Click toggle button
  // Verify toast.success called
});

it('shows error toast when toggle fails', async () => {
  // Render WITH apiKey
  // Mock toggleSkill to reject
  // Click toggle button
  // Verify toast.error called
});
```

### Layer 3: UI Bug Fixes (if not already fixed from v1)

#### Fix 3.1: toggleSkill error propagation (useSkills.ts)

In the catch block, add re-throw:
```typescript
catch (err) {
  setError(err instanceof Error ? err.message : 'Failed to toggle skill')
  throw err  // ← ADD THIS
}
```

#### Fix 3.2: SkillPanel async toggle handler

Replace ALL synchronous toast patterns with async/await + try/catch + auth pre-check. The handler should be:
```typescript
const handleToggle = async (skill: FullSkill, action: '启用' | '停用') => {
  if (!apiKey) {
    toast.warning('请先登录才能操作 Skill')
    return
  }
  try {
    await onToggle(skill.id)
    toast.success(`已${action}「${skill.name}」`)
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    toast.error(`${action}失败: ${message}`)
  }
}
```

### Layer 4: Documentation Updates

#### Doc 4.1: Gitbook REST API — Toggle Endpoint

In `docs/gitbook/en/api/rest.md`, find the Skill Management section. After `### POST /skills/:id/deprecate`, add:

```markdown
### PATCH /skills/:id/toggle

Toggle skill enabled/disabled state. Flips the `enabled` boolean.

**Auth**: Required — `X-API-Key` header with `skills:write` scope.

**Path Parameters**: `id` — Skill ID or slug

**Response** (200):

\`\`\`json
{
  "id": "uuid",
  "name": "My Skill",
  "slug": "my-skill",
  "enabled": false,
  "status": "published",
  ...
}
\`\`\`

**Errors**: `404` if skill not found, `403` if unauthorized.
```

Do the same in `docs/gitbook/zh/api/rest.md` (in Chinese):

```markdown
### PATCH /skills/:id/toggle

切换 Skill 的启用/停用状态。翻转 `enabled` 布尔值。

**认证**: 需要 — `X-API-Key` header，需 `skills:write` 权限。

**路径参数**: `id` — Skill ID 或 slug

**响应** (200):

\`\`\`json
{
  "id": "uuid",
  "name": "My Skill",
  "slug": "my-skill",
  "enabled": false,
  "status": "published",
  ...
}
\`\`\`

**错误**: `404` Skill 不存在，`403` 未授权。
```

#### Doc 4.2: SkillPanel Props in ARCHITECTURE.md

In `packages/chat-interface/ARCHITECTURE.md`, find where SkillPanel is mentioned (around line 41). Add a props table:

```markdown
#### SkillPanel Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `serverUrl` | `string` | Yes | Backend API base URL (e.g., `http://localhost:3001`) |
| `tenantId` | `string` | Yes | Tenant identifier for multi-tenancy |
| `open` | `boolean` | Yes | Controls panel visibility |
| `onClose` | `() => void` | Yes | Called when user closes the panel |
| `apiKey` | `string` | No | API key for authenticated operations (toggle requires this) |

When `apiKey` is not provided, toggle buttons will show a "请先登录" warning instead of making API calls.
```

#### Doc 4.3: loadEnabledSkills JSDoc

In `packages/backend/src/sessions/services/skill-management.service.ts`, add JSDoc above the `loadEnabledSkills` method:

```typescript
/**
 * Load skills available for agent sessions.
 *
 * Filters published skills to only include those with `enabled: true`.
 * Optionally further filters by a slug allowlist (from session config).
 *
 * @param tenantId - Tenant to load skills for
 * @param enabledSkills - Optional slug allowlist; if provided, only matching slugs are returned
 * @returns Array of SkillInfo objects (slug, name, description)
 */
```

---

## Verification Checklist

After all changes:

1. **Backend typecheck**: `cd packages/backend && npx tsc --noEmit`
2. **Chat-interface typecheck**: `cd packages/chat-interface && npx tsc --noEmit`
3. **React-SDK typecheck**: `cd packages/react-sdk && npx tsc --noEmit`
4. **Backend tests**: `cd packages/backend && npx jest --no-coverage skills.service.toggle skill-management.service`
5. **React SDK tests**: `cd packages/react-sdk && npx vitest run useSkills`
6. **Chat interface tests**: `cd packages/chat-interface && npx vitest run SkillPanel`
7. **Guard order grep**:
   ```bash
   grep -B1 '@UseGuards(TenantGuard)' packages/backend/src/sessions/sessions.controller.ts
   # Should show @OptionalAuth() or @Auth() BELOW @UseGuards
   ```
8. **Dead code grep**:
   ```bash
   grep 'isOptionalAuth' packages/backend/src/skills/guards/skill-permission.guard.ts
   # Should return NOTHING
   ```
9. **Re-throw grep**:
   ```bash
   grep -n 'throw err' packages/react-sdk/src/hooks/useSkills.ts
   ```
10. **Doc: Toggle in gitbook**:
    ```bash
    grep -i 'toggle' docs/gitbook/en/api/rest.md
    grep -i 'toggle' docs/gitbook/zh/api/rest.md
    ```
11. **Doc: SkillPanel props**:
    ```bash
    grep -A5 'SkillPanel.*[Pp]rop' packages/chat-interface/ARCHITECTURE.md
    ```
12. **Doc: loadEnabledSkills JSDoc**:
    ```bash
    grep -B5 'async loadEnabledSkills' packages/backend/src/sessions/services/skill-management.service.ts
    ```

## Changelog Format

Write to `harness-workspace/skill-feature-e2e/changelogs/v{VERSION}-changelog.md`:

```markdown
# v{VERSION} Changelog

## Code Review Fixes
- [file]: description

## Tests Added/Extended
- [file]: description

## UI Bug Fixes
- [file]: description

## Documentation Updates
- [file]: description

## Verification
- backend typecheck: PASS/FAIL
- chat-interface typecheck: PASS/FAIL
- backend tests: PASS/FAIL (N passed, M failed)
- frontend tests: PASS/FAIL
- grep checks: PASS/FAIL
- doc checks: PASS/FAIL
```

## Important

- Do NOT touch styling, CSS, or layout
- Do NOT add new features or components
- Focus on the 4 layers: code review → tests → UI fixes → documentation
- If eval report mentions a specific failure, address THAT specific issue
- Run ALL typechecks and tests before writing changelog
