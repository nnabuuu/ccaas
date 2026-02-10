# Lesson Plan Designer - Textbook API URL Fix

## 修复日期
2026-02-09

## 问题描述

### 症状
`useTextbook.ts` 中的 `API_BASE` 使用了绝对 URL `http://localhost:3002`，导致：
1. 与其他 hooks 不一致（其他都使用相对路径）
2. 绕过 Vite 代理配置
3. 在生产环境可能失败

### 根本原因
```typescript
// 修复前
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002'

// 导致生成的 URL
`${API_BASE}/api/textbook/subjects`
// → http://localhost:3002/api/textbook/subjects
```

这直接访问 backend，而不是通过 Vite 代理。

## 修复方案

### 代码变更

**文件**: `solutions/lesson-plan-designer/frontend/src/hooks/useTextbook.ts`

#### 变更 1: 修改 API_BASE（Line 10）

```typescript
// 修改前
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002'

// 修复后
const API_BASE = '/api'  // Use relative path, proxied by Vite
```

#### 变更 2: 移除 fetch 调用中的 /api 前缀（Lines 79, 104, 130, 160, 190）

```typescript
// 修改前（错误：导致 /api/api/textbook/... 双重路径）
fetch(`${API_BASE}/api/textbook/subjects`)
fetch(`${API_BASE}/api/textbook/grades?...`)
fetch(`${API_BASE}/api/textbook/publishers?...`)
fetch(`${API_BASE}/api/textbook/volumes?...`)
fetch(`${API_BASE}/api/textbook/chapters?...`)

// 修复后（正确：生成 /api/textbook/...）
fetch(`${API_BASE}/textbook/subjects`)
fetch(`${API_BASE}/textbook/grades?...`)
fetch(`${API_BASE}/textbook/publishers?...`)
fetch(`${API_BASE}/textbook/volumes?...`)
fetch(`${API_BASE}/textbook/chapters?...`)
```

### 生成的 URL（修复后）

所有 fetch 调用现在生成正确的相对路径：
```
/api/textbook/subjects                    ✅
/api/textbook/grades?subject=...          ✅
/api/textbook/publishers?subject=...&gradeId=...  ✅
/api/textbook/volumes?subject=...&gradeId=...&publisher=...  ✅
/api/textbook/chapters?subject=...&gradeId=...&publisher=...&volume=...  ✅
```

这些请求会被 Vite 代理到 `http://localhost:3002`（开发环境）。

## 一致性验证

### 对比其他文件

修复后，所有 lesson-plan-designer 前端文件都使用相同的 URL 模式：

| 文件 | API_BASE / 模式 | 状态 |
|------|----------------|------|
| `api.ts` | `const API_BASE = '/api'` | ✅ 已正确 |
| `useTextbook.ts` | `const API_BASE = '/api'` | ✅ 已修复 |
| `useContextSync.ts` | 直接使用 `/api/v1/...` | ✅ 已正确 |
| `useSubAgentPolling.ts` | 直接使用 `/api/v1/...` | ✅ 已正确 |
| `useSkills.ts` | 直接使用 `/api/v1/...` | ✅ 已正确 |
| `useLessonPlanSession.ts` | `SOCKET_URL = ''` | ✅ 已修复 |

### Vite 代理配置

**文件**: `vite.config.ts`

```typescript
proxy: {
  '/api/v1/sessions': {
    target: 'http://localhost:3001',  // CCAAS backend
    changeOrigin: true,
  },
  '/api/v1/skills': {
    target: 'http://localhost:3001',  // CCAAS backend
    changeOrigin: true,
  },
  '/api': {
    target: 'http://localhost:3002',  // Solution backend
    changeOrigin: true,
  },
}
```

相对路径 `/api/textbook/*` 会匹配第三个规则，代理到 `http://localhost:3002`。

## 验证步骤

### 1. 自动编译验证

Vite HMR 会自动重新编译文件，检查终端无错误。

### 2. 手动功能测试

**测试场景**: 创建新备课方案

1. 打开浏览器: `http://localhost:5280`
2. 点击"创建新备课方案"
3. 验证教材选择流程：
   - [ ] 科目列表加载成功
   - [ ] 选择科目后，年级列表加载成功
   - [ ] 选择年级后，出版社列表加载成功
   - [ ] 选择出版社后，册别列表加载成功
   - [ ] 选择册别后，章节列表加载成功

### 3. Network 检查

打开浏览器开发者工具 → Network 标签，验证：

**预期请求 URL**:
```
✅ http://localhost:5280/api/textbook/subjects
✅ http://localhost:5280/api/textbook/grades?subject=...
✅ http://localhost:5280/api/textbook/publishers?subject=...&gradeId=...
✅ http://localhost:5280/api/textbook/volumes?subject=...&gradeId=...&publisher=...
✅ http://localhost:5280/api/textbook/chapters?subject=...&gradeId=...&publisher=...&volume=...
```

**不应该是**:
```
❌ http://localhost:3002/api/textbook/...
```

所有请求应该返回 `200 OK`。

## 影响范围

### 修改的文件
1. `solutions/lesson-plan-designer/frontend/src/hooks/useTextbook.ts` (Line 10)

### 不需要修改的文件
- `api.ts` - 已使用正确的相对路径
- `useContextSync.ts` - 已使用正确的相对路径
- `useSubAgentPolling.ts` - 已使用正确的相对路径
- `useSkills.ts` - 已使用正确的相对路径
- `useLessonPlanSession.ts` - 已修复（SOCKET_URL = ''）
- `vite.config.ts` - 代理配置正确

## 修复总结

### 问题
- `useTextbook.ts` 使用绝对 URL `http://localhost:3002`
- 与其他 hooks 不一致
- 绕过 Vite 代理

### 解决方案
- 修改 `API_BASE` 为 `'/api'`
- 与其他文件保持一致
- 利用 Vite 代理配置

### 结果
- ✅ 所有 lesson-plan-designer 前端文件现在使用统一的 URL 模式
- ✅ 开发环境使用 Vite 代理
- ✅ 生产环境兼容 reverse proxy

## 相关修复

这是 lesson-plan-designer 前端的第三个 URL 相关修复：

1. **协议相对 URL bug** (`useLessonPlanSession.ts`)
   - 修复: `SOCKET_URL = '/'` → `SOCKET_URL = ''`
   - 文档: `LESSON_PLAN_URL_BUG_FIX.md`

2. **Messages 状态 bug** (`useLessonPlanSession.ts`)
   - 修复: 本地 messages 状态 → 使用 `chat.messages`
   - 文档: `LESSON_PLAN_MESSAGES_BUG_FIX.md`

3. **Textbook API URL 不一致** (`useTextbook.ts`) ← 本次修复
   - 修复: 绝对 URL → 相对路径 `'/api'`
   - 文档: `LESSON_PLAN_TEXTBOOK_URL_FIX.md`

所有三个修复都遵循相同的原则：
- 使用相对路径，避免硬编码的绝对 URL
- 与 codebase 其他部分保持一致
- 利用 Vite 代理配置（开发环境）
- 兼容 reverse proxy（生产环境）
