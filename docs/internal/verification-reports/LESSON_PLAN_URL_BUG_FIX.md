# Lesson Plan Designer - URL 拼接 Bug 修复

**日期**: 2026-02-09
**问题**: 前端 API 请求失败，返回 404 和 CORS 错误
**严重程度**: 🔴 Critical - 功能完全失效

---

## 问题症状

### 浏览器错误日志

```
Failed to load resource: the server responded with a status of 404 (Not Found)

Sub-agent polling error: Error: HTTP 404
    at useSubAgentPolling.ts:30:15

Access to fetch at 'http://api/v1/sessions/lpd_...' from origin 'http://localhost:5280'
has been blocked by CORS policy: Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.

Uncaught (in promise) TypeError: Failed to fetch
    at attemptSend (useAgentChat.ts:357:30)
```

### 错误分析

前端尝试访问:
```
http://api/v1/sessions/lpd_0b177901-c897-49c8-afd8-5938c7ab98b1/completion
```

**问题**: URL 中缺少主机名和端口号！
- ❌ `http://api/v1/sessions/...` (错误)
- ✅ `http://localhost:5280/api/v1/sessions/...` (正确)

---

## 根本原因

### URL 拼接错误

**文件**: `solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts`

```typescript
// 第 24 行 (修复前)
const SOCKET_URL = '/' // Use relative URL, proxied by Vite
```

**react-sdk 中的 URL 拼接**:

```typescript
// packages/react-sdk/src/hooks/useAgentChat.ts:357
const response = await fetch(`${connection.serverUrl}/api/v1/sessions/${connection.sessionId}/completion`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(chatPayload),
})
```

**拼接结果**:
```typescript
connection.serverUrl = '/'
`${connection.serverUrl}/api/v1/sessions/...`
= '/' + '/api/v1/sessions/...'
= '//api/v1/sessions/...'  // ← 协议相对 URL (Protocol-relative URL)
```

**浏览器解析**:
```
'//api/v1/sessions/...'  →  http://api/v1/sessions/...
```

浏览器将 `//` 开头的 URL 解析为**协议相对 URL**，使用当前页面的协议（http），导致：
- 主机名变成 `api` (无效域名)
- 丢失端口号 `5280`
- 丢失 `localhost`

---

## 修复方案

### 方案 1: 使用空字符串 (已采用) ✅

**修改**: `useLessonPlanSession.ts:24`

```typescript
// 修复前
const SOCKET_URL = '/' // Use relative URL, proxied by Vite

// 修复后
const SOCKET_URL = '' // Empty string to avoid protocol-relative URL bug (// prefix)
```

**拼接结果**:
```typescript
connection.serverUrl = ''
`${connection.serverUrl}/api/v1/sessions/...`
= '' + '/api/v1/sessions/...'
= '/api/v1/sessions/...'  // ← 正确的相对 URL
```

**浏览器解析**:
```
当前页面: http://localhost:5280
相对 URL: /api/v1/sessions/...
最终 URL: http://localhost:5280/api/v1/sessions/...  ✅
```

**Vite 代理处理**:
```typescript
// vite.config.ts:10-13
'/api/v1/sessions': {
  target: 'http://localhost:3001',
  changeOrigin: true,
}
```

最终请求发送到: `http://localhost:3001/api/v1/sessions/...` ✅

---

### 方案 2: 使用绝对 URL (未采用)

```typescript
const SOCKET_URL = 'http://localhost:3001'
```

**优点**:
- 更明确
- 不依赖 Vite 代理

**缺点**:
- 硬编码端口号
- 无法利用 Vite 代理（开发环境优势）
- 生产环境需要不同配置

---

### 方案 3: 修改 react-sdk (未采用)

修改 `useAgentChat.ts` 处理尾部斜杠：

```typescript
const baseUrl = connection.serverUrl.endsWith('/')
  ? connection.serverUrl.slice(0, -1)
  : connection.serverUrl

const response = await fetch(`${baseUrl}/api/v1/sessions/...`)
```

**缺点**:
- 需要修改共享库 (@ccaas/react-sdk)
- 影响其他 solutions (quiz-analyzer 使用绝对 URL)
- 增加维护成本

---

## 修复文件

### 主要文件

1. **useLessonPlanSession.ts**
   ```diff
   - const SOCKET_URL = '/' // Use relative URL, proxied by Vite
   + const SOCKET_URL = '' // Empty string to avoid protocol-relative URL bug (// prefix)
   ```

### 测试文件

2. **useLessonPlanSession.connection.test.ts**
   ```diff
   - serverUrl: '/',
   + serverUrl: '',
   ```

3. **useLessonPlanSession.chat.test.ts**
   ```diff
   - serverUrl: '/',
   + serverUrl: '',
   ```

4. **useLessonPlanSession.status.test.ts**
   ```diff
   - serverUrl: '/',
   + serverUrl: '',
   ```

---

## 验证步骤

### 1. 检查前端编译

```bash
# Vite 应该自动重新编译（HMR）
# 检查浏览器控制台，确认无编译错误
```

### 2. 测试 API 请求

1. 打开浏览器: http://localhost:5280
2. 打开开发者工具 → Network 标签
3. 发送消息或点击快捷操作
4. 检查请求 URL:
   - ✅ 应该是: `http://localhost:5280/api/v1/sessions/.../completion`
   - ❌ 不应该是: `http://api/v1/sessions/.../completion`

### 3. 检查代理转发

在 Network 标签中：
- Request URL: `http://localhost:5280/api/v1/sessions/.../completion`
- Vite 代理转发到: `http://localhost:3001/api/v1/sessions/.../completion`
- 后端响应: 200 OK

---

## 对比：quiz-analyzer 的正确实现

**文件**: `solutions/quiz-analyzer/frontend/src/hooks/useQuizSession.ts`

```typescript
// 第 17 行
const BACKEND_URL = import.meta.env.VITE_CCAAS_BACKEND_URL || 'http://localhost:3001'

// 第 99 行
const connection: UseAgentConnectionReturn = useAgentConnection({
  serverUrl: BACKEND_URL,  // 使用绝对 URL
  sessionPrefix: 'quiz',
})
```

**为什么 quiz-analyzer 没有这个问题**:
- 使用绝对 URL `http://localhost:3001`
- 不依赖 Vite 代理（直接访问 CCAAS backend）
- 不会产生协议相对 URL 问题

**为什么 lesson-plan-designer 需要不同方案**:
- lesson-plan-designer 有自己的 backend (端口 3002)
- 需要 Vite 代理区分不同的 API 路由:
  - `/api/v1/sessions` → CCAAS backend (3001)
  - `/api/lesson-plans` → Solution backend (3002)
- 使用相对 URL 可以利用 Vite 代理的灵活性

---

## 教训

### 1. 协议相对 URL 陷阱

**定义**: 以 `//` 开头的 URL 是协议相对 URL（Protocol-relative URL）。

**示例**:
```html
<script src="//cdn.example.com/lib.js"></script>
```

**浏览器解析**:
- 在 `http://` 页面上 → `http://cdn.example.com/lib.js`
- 在 `https://` 页面上 → `https://cdn.example.com/lib.js`

**常见错误**:
```typescript
const baseUrl = '/'
const path = '/api/v1/users'
const url = baseUrl + path  // '/' + '/api/v1/users' = '//api/v1/users'
// ❌ 浏览器解析为: http://api/v1/users
```

**正确写法**:
```typescript
// 方案 1: 使用空字符串
const baseUrl = ''
const url = baseUrl + path  // '' + '/api/v1/users' = '/api/v1/users' ✅

// 方案 2: 移除尾部斜杠
const baseUrl = '/'
const url = baseUrl.slice(0, -1) + path  // '' + '/api/v1/users' = '/api/v1/users' ✅

// 方案 3: 智能拼接
function joinUrl(base: string, path: string): string {
  if (!base || base === '/') return path
  return base.replace(/\/$/, '') + path
}
```

---

### 2. TDD 原则再次被验证

**问题**: 修复前没有运行集成测试，只依赖单元测试（mock）。

**单元测试的局限**:
```typescript
// 测试中 mock 了 fetch，没有验证实际 URL
vi.mocked(global.fetch).mockResolvedValueOnce(
  new Response(JSON.stringify({ ok: true }), { status: 200 })
)
```

**需要的集成测试**:
```typescript
it('should send correct URL to backend', async () => {
  const { result } = renderHook(() => useLessonPlanSession())

  await act(async () => {
    await result.current.sendMessage('test')
  })

  const calls = vi.mocked(global.fetch).mock.calls
  const url = calls[0][0] as string

  // 验证 URL 格式
  expect(url).toMatch(/^https?:\/\/localhost:\d+\/api\/v1\/sessions\//)
  expect(url).not.toMatch(/^\/\/api/) // ❌ 不应该是协议相对 URL
})
```

---

### 3. E2E 测试的重要性

**问题**: 没有在真实浏览器环境中测试。

**E2E 测试会立即发现**:
- CORS 错误
- 404 错误
- 协议相对 URL 问题

**建议**:
```typescript
// e2e/lesson-plan.spec.ts
test('should create lesson plan and send message', async ({ page }) => {
  await page.goto('http://localhost:5280')

  // 监听网络请求
  page.on('request', request => {
    const url = request.url()
    // 验证 URL 格式
    if (url.includes('/api/v1/sessions')) {
      expect(url).toMatch(/^http:\/\/localhost:5280\/api\/v1\/sessions/)
    }
  })

  // 执行操作
  await page.click('[data-testid="send-message"]')

  // 验证响应
  await expect(page.locator('[data-testid="message"]')).toBeVisible()
})
```

---

## 相关问题

### quiz-analyzer 是否也有这个问题？

**答**: ❌ 没有

**原因**:
- quiz-analyzer 使用绝对 URL: `http://localhost:3001`
- 不依赖 Vite 代理
- 不会产生协议相对 URL 问题

### 这个 bug 会影响其他 solutions 吗？

**答**: ⚠️ 可能会

**检查方法**:
```bash
# 搜索所有使用 '/' 作为 serverUrl 的 solutions
grep -r "serverUrl.*['\"]/" solutions/*/frontend/src
```

**预防措施**:
- 添加 ESLint 规则检查协议相对 URL
- 在 react-sdk 中添加运行时验证
- 在文档中明确说明 serverUrl 的正确用法

---

## 后续行动

### 立即验证

- [ ] 打开浏览器测试 lesson-plan-designer
- [ ] 确认 API 请求 URL 正确
- [ ] 确认无 CORS 错误
- [ ] 确认功能正常

### 预防措施

- [ ] 添加集成测试验证 URL 格式
- [ ] 在 react-sdk 文档中说明 serverUrl 用法
- [ ] 考虑在 react-sdk 中添加 URL 验证逻辑
- [ ] 检查其他 solutions 是否有相同问题

### 文档更新

- [ ] 更新 lesson-plan-designer CLAUDE.md
- [ ] 更新 MEMORY.md 记录这个教训
- [ ] 创建 "常见陷阱" 文档

---

**修复状态**: ✅ 已修复
**验证状态**: ⏳ 待浏览器验证
**影响范围**: lesson-plan-designer frontend
**修复时间**: 2026-02-09
