# Spec — live-lesson-interactive-features

## Objective

在 e2e-collaboration 管道（100/100）基础上，实现 6 个 backlog/partial 功能：教师直接推步、推送提示、AI 助教自由提问、学生提问聚类、实时计时器、延长时间。

### 前提

- e2e-collaboration 管道已完成（join → submit → state → stream 全部工作正常）
- 现有 `useTeacherStream` 使用 `es.onmessage` 捕获无名 event，继续工作
- 新功能通过 **SSE 命名事件** (`addEventListener`) 扩展，不破坏现有管道

---

## Feature Group A: Teacher Direct Step Sync (US-T9)

### 新端点

```
POST /api/classroom/:lessonId/step
Content-Type: application/json
Body: { "step": <number 0-4> }
Response: { "ok": true, "currentStep": <number> }
Side effect: SSE named event → event: step_sync\ndata: {"currentStep": <number>, ...state}
```

### 改动

**Backend `classroom.service.ts`**:
- 新增内存 `Map<string, number>` 记录每个 lesson 的 `currentStep`
- `setStep(lessonId, step)` → 更新 map → 发送 **命名 SSE 事件** `step_sync`
- 命名事件格式：`event: step_sync\ndata: ${JSON.stringify(payload)}\n\n`

**Backend `classroom.controller.ts`**:
- 新增 `@Post(':lessonId/step')` endpoint + DTO 校验

**Frontend `useClassroom.ts`**:
- 新增 `useStudentStream(lessonId)` hook：
  - `new EventSource(API_BASE + '/' + lessonId + '/stream')`
  - `es.addEventListener('step_sync', handler)` — 监听命名事件
  - `es.addEventListener('notification', handler)` — 监听通知
  - 返回 `{ currentStep, notification }`

**Frontend `TeacherShell.tsx`**:
- Step rail `onClick` → `POST /api/classroom/:lessonId/step` (替代纯本地 `setStep`)
- "进入 Step N →" 按钮也调 API
- "← 上一步" 按钮也调 API

**Frontend `StudentShell.tsx`**:
- 接入 `useStudentStream` hook
- 当收到 `step_sync` 事件时，`setStep(data.currentStep)`

### DTO

```typescript
// step.dto.ts
import { IsInt, Min, Max } from 'class-validator';

export class StepDto {
  @IsInt()
  @Min(0)
  @Max(4)
  step: number;
}
```

---

## Feature Group B: Push Notifications (US-T7)

### 新端点

```
POST /api/classroom/:lessonId/notify
Content-Type: application/json
Body: { "message": <string>, "type": "hint"|"vocab"|"time"|"general" }
Response: { "ok": true }
Side effect: SSE named event → event: notification\ndata: {"message": "...", "notifyType": "hint"}
```

### 改动

**Backend `classroom.service.ts`**:
- `notify(lessonId, message, type)` → 发送命名 SSE 事件 `notification`

**Backend `classroom.controller.ts`**:
- 新增 `@Post(':lessonId/notify')` endpoint + DTO

**Frontend `TeacherShell.tsx`**:
- 4 个 quick-push 按钮绑定预设消息：
  - "Myanmar 位置提示" → `{message: "...", type: "hint"}`
  - "Practice 写法示例" → `{message: "...", type: "hint"}`
  - "tā moko 生词卡" → `{message: "...", type: "vocab"}`
  - "再给 2 分钟" → `{message: "...", type: "time"}`
- "推送提示给全班" 按钮 → 通用推送 dialog 或直接推送当前步骤提示

**Frontend `StudentShell.tsx`**:
- 监听 `notification` SSE 事件
- 显示 toast/banner（3-5s 自动消失）

### DTO

```typescript
// notify.dto.ts
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export class NotifyDto {
  @IsString()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsEnum(['hint', 'vocab', 'time', 'general'])
  type?: 'hint' | 'vocab' | 'time' | 'general';
}
```

---

## Feature Group C: AI Assistant Free Questions (US-S7)

### 新端点

```
POST /api/classroom/:lessonId/ai/ask
Content-Type: application/json
Body: { "studentId": <string>, "question": <string>, "step": <number> }
Response: { "answer": <string> }
```

### 改动

**Backend `classroom.service.ts`** (或新文件 `ai.service.ts`):
- 基于 step + keyword 的模板回答（不依赖 CCAAS Agent Engine）
- 关键词匹配规则（简单实现即可）：
  - step 0: schema/predict → 关于 predicting 策略的回答
  - step 1: skim/structure/signal → 关于 skimming 策略的回答
  - step 2: matrix/place/practice/reason → 关于 matrix building 的回答
  - step 3: critical/reason/shallow → 关于 critical thinking 的回答
  - step 4: recap/strategy → 关于 recap 的回答
  - default: 通用鼓励回答

**Frontend `AiPanel.tsx`**:
- `sendCustom()` → `POST /api/classroom/:lessonId/ai/ask` + loading 状态 + 渲染回答
- 需要传入 `lessonId`, `studentId`, `step` props（从 `StudentShell` 传下来）

**Frontend `StudentShell.tsx`**:
- 传 `lessonId`, `session.studentId`, `step` 给 `AiPanel`

---

## Feature Group D: Timer (US-T11 + US-T8)

### 前端 only

**数据来源**:
- `manifest.readingSteps[i].duration` 已有每步分钟数
- `cumulativeMinutes` 可从 manifest 计算: `[0, 5, 13, 28, 40, 45]`

**改动**:

**`TeacherShell.tsx`**:
- 当 step 变化时，记录 `stepStartedAt = Date.now()`
- `setInterval(1000)` 倒计时：`remaining = stepDuration * 60 - elapsed`
- 显示 `MM:SS` 格式（替代 `—:—` 占位符）
- "延长 2 min" 按钮 → `stepDuration += 2`

**`StudentShell.tsx`**:
- 可选：从 `step_sync` SSE 事件中同步 timer 起点
- 或简单显示步骤名称（teacher 控制时间）

---

## 向后兼容约束

1. 现有 `useTeacherStream` (`es.onmessage`) 继续接收无名 data event — **不能改**
2. 新 `useStudentStream` 用 `addEventListener('step_sync', ...)` 监听命名事件
3. `broadcast()` 方法仍然使用 `data: ...\n\n` 格式（无名事件）
4. 新的 `broadcastNamed(lessonId, eventName, payload)` 使用 `event: ...\ndata: ...\n\n`
5. 现有 join/submit/state/stream 端点不可破坏

---

## Frozen Constraints

| ID | Constraint | Penalty |
|----|------------|---------|
| FC-1 | `packages/` NOT modified | D1 = 0 |
| FC-2 | `solutions/business/recipe-book/` NOT modified | D1 = 0 |
| FC-3 | `solutions/business/live-lesson/mcp-server/` NOT modified | D1 = 0 |
| FC-4 | `solutions/business/live-lesson/skills/` NOT modified | D1 = 0 |
| FC-5 | Frontend port 5283, backend port 3007 | — |

**Modifiable**: `solutions/business/live-lesson/frontend/` and `solutions/business/live-lesson/backend/`

---

## Service Architecture

| Service | Port | Start Command |
|---------|------|---------------|
| CCAAS core backend | 3001 | `npm run dev:backend` (repo root) |
| Live-lesson backend | 3007 | `node dist/main.js` (after `npx nest build`) |
| Frontend dev server | 5283 | `npx vite --port 5283` |

---

## Exit Conditions

| Condition | Value |
|-----------|-------|
| Target | 95/100 |
| Pass | 90/100 |
| Max iterations | 8 |
| Diminishing returns | < 3 pts for 2 consecutive iterations |
| Cost cap | $250 |
