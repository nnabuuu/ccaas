# SPEC — Skill Feature E2E Harness v2

## Goal

修复 Skill toggle 完整链路的功能缺陷 + 代码审查修复 + 单元测试覆盖。

**范围**: toggle 链路修复、Guard 装饰器顺序修复、死代码清理、4 个测试套件、文档补全。

---

## 修改范围（12 files）

### 源码修复（5 files）

| 文件 | 修改内容 |
|------|----------|
| `packages/chat-interface/src/components/SkillPanel.tsx` | async handleToggle, auth 前置检查, 错误详情 toast |
| `packages/react-sdk/src/hooks/useSkills.ts` | toggleSkill 中 `throw err` 重抛 |
| `packages/backend/src/sessions/sessions.controller.ts` | 交换 `@OptionalAuth()` / `@UseGuards(TenantGuard)` 顺序 |
| `packages/backend/src/sessions/conversations-alias.controller.ts` | 同上装饰器顺序修复 |
| `packages/backend/src/skills/guards/skill-permission.guard.ts` | 删除未使用的 `isOptionalAuth` 变量 |

### 测试文件（4 files）

| 文件 | 操作 | 框架 |
|------|------|------|
| `packages/backend/src/skills/skills.service.toggle.spec.ts` | **新建** | Jest |
| `packages/backend/src/sessions/services/skill-management.service.spec.ts` | **扩展** | Jest |
| `packages/react-sdk/__tests__/useSkills.test.ts` | **新建** | Vitest |
| `packages/chat-interface/src/components/__tests__/SkillPanel.test.tsx` | **扩展** | Vitest |

### 文档文件（3 files）

| 文件 | 操作 | 内容 |
|------|------|------|
| `docs/gitbook/en/api/rest.md` | **扩展** | 添加 `PATCH /skills/:id/toggle` endpoint 文档 |
| `docs/gitbook/zh/api/rest.md` | **扩展** | 同上中文版 |
| `packages/chat-interface/ARCHITECTURE.md` | **扩展** | 添加 SkillPanel 组件 props 和使用说明 |

---

## 代码审查发现（Code Review Findings）

### CRITICAL-1: Guard 执行顺序（影响 D3, 8 pts）

TypeScript 装饰器自下而上应用。当前 sessions.controller.ts 中的模式：
```typescript
@OptionalAuth()          // 第二个应用 → ApiKeyGuard 排第二
@UseGuards(TenantGuard)  // 第一个应用 → TenantGuard 先执行
// 结果: TenantGuard → ApiKeyGuard（错误 — TenantGuard 需要 request.context）
```

**修复**: 交换顺序，`@UseGuards(TenantGuard)` 放在 `@OptionalAuth()` 上面：
```typescript
@UseGuards(TenantGuard)  // 第二个应用 → TenantGuard 在 Auth 之后执行
@OptionalAuth()          // 第一个应用 → ApiKeyGuard 先执行
```

同样修复 conversations-alias.controller.ts。

### MEDIUM-2: 死代码 `isOptionalAuth`（影响 D3, 4 pts）

`skill-permission.guard.ts` 第 42-45 行：`isOptionalAuth` 被赋值但从未使用。直接删除。

### SUGGESTION-3: Toast 错误详情（影响 D3, 3 pts）

SkillPanel handleToggle catch 块：toast.error 应包含 `err.message`，而非固定字符串。

---

## 测试要求

### Backend: `skills.service.toggle.spec.ts`（新建）

遵循 `skills.service.files.spec.ts` 的 mock 模式：

```typescript
describe('SkillsService - Toggle', () => {
  // 1. toggle 将 enabled: true → false
  // 2. toggle 将 enabled: false → true
  // 3. toggle 不存在的 skill → NotFoundException
});
```

需要的 mock：
- `skillRepository.findOne` — 返回 mock skill 或 null
- `skillRepository.save` — 返回更新后的 skill

### Backend: `skill-management.service.spec.ts`（扩展）

新增 `describe('loadEnabledSkills')`：

```typescript
describe('loadEnabledSkills', () => {
  // 1. 混合 enabled 的 skills → 只返回 enabled:true
  // 2. 全部 disabled → 返回空数组
  // 3. slug 过滤被尊重
});
```

需要 mock `SkillsService.findPublished()` 返回混合 enabled 的 skills 数组。

### React SDK: `useSkills.test.ts`（新建）

遵循 `__tests__/*.test.ts` 中的模式（renderHook, vi.fn, global.fetch mock）：

```typescript
describe('useSkills', () => {
  // 1. fetchSkills 挂载时填充 skills
  // 2. toggleSkill 发送 PATCH 并更新本地状态
  // 3. toggleSkill 错误时重抛
  // 4. searchQuery 过滤 skills
});
```

### Chat Interface: `SkillPanel.test.tsx`（扩展）

新增 3 个测试：

```typescript
// 1. apiKey undefined 时 → toast.warning('请先登录...')
// 2. toggle 成功 → toast.success
// 3. toggle 失败 → toast.error
```

---

## 文档要求

### Gitbook REST API: Toggle Endpoint

在 `docs/gitbook/en/api/rest.md` 的 Skill Management 区块 `POST /skills/:id/deprecate` 之后添加：

```markdown
### PATCH /skills/:id/toggle

Toggle skill enabled/disabled state. Requires `skills:write` scope.

**Auth**: Required (`X-API-Key` header)

**Response** (200):
```json
{
  "id": "uuid",
  "name": "My Skill",
  "enabled": false,
  ...
}
```
```

同步更新 `docs/gitbook/zh/api/rest.md`。

### Chat Interface ARCHITECTURE.md: SkillPanel Props

在 `packages/chat-interface/ARCHITECTURE.md` 的 SkillPanel 提及处添加组件 props 文档：

```markdown
#### SkillPanel Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| serverUrl | string | Yes | Backend API URL |
| tenantId | string | Yes | Tenant identifier |
| open | boolean | Yes | Panel visibility |
| onClose | () => void | Yes | Close handler |
| apiKey | string | No | Auth key (required for toggle) |
```

### Backend: loadEnabledSkills JSDoc

在 `skill-management.service.ts` 的 `loadEnabledSkills` 方法上添加 JSDoc：

```typescript
/**
 * Load skills available for agent sessions.
 * Filters to only published AND enabled skills.
 * Optionally further filters by slug list (from session config).
 */
```

---

## 架构约束

### 不能改的
- `useSkills` hook 的对外接口签名
- Backend skills.controller.ts 的端点定义
- ChatCoreContext 的 controlled component pattern
- SkillPanel 的 props 接口

### 可以改的
- SkillPanel.tsx 内部实现（onClick handlers, error handling）
- useSkills.ts 的 toggleSkill 返回值（重抛错误）
- Guard 装饰器顺序
- 移除死代码
- 新增/扩展测试文件

---

## 验收标准 (Definition of Done)

1. **Backend 测试**: `npx jest skills.service.toggle skill-management.service` 全部通过
2. **Frontend 测试**: `npx vitest run useSkills` 和 `npx vitest run SkillPanel` 全部通过
3. **Guard 顺序**: grep 确认 sessions/conversations 控制器中 `@UseGuards(TenantGuard)` 在 `@OptionalAuth()` 上面
4. **死代码**: `isOptionalAuth` 从 skill-permission.guard.ts 中移除
5. **Toggle E2E**: 浏览器中 toggle 正常工作，toast 时序正确
6. **Auth 检查**: 未登录 → toast.warning，不发 API 请求
7. **loadEnabledSkills**: 测试证明 disabled skills 被排除
8. **文档**: gitbook REST 文档包含 toggle endpoint，SkillPanel 有 props 文档，loadEnabledSkills 有 JSDoc
