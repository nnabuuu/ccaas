# Spec — live-lesson-e2e-collaboration

## Objective

验证 ideal-beauty-reading 课程的完整 5-step 协作流 — 从学生加入课堂到教师实时看到提交数据，端到端自动化验证。

### 目标

1. 学生输入姓名加入课堂 → backend 持久化 → SSE 推送教师
2. 每个 step (0-4) 的学生端 UI 可交互，提交正确数据格式到 backend
3. 教师端 SSE 实时接收 metrics、student list、matrix 聚合
4. Demo 编排器通过 postMessage 同步三端 step 状态
5. 数据持久化 (restart 不丢)、幂等 join、upsert submit、输入校验

### 现状

- 后端 classroom API (join/submit/state/stream) 已在 `backend/src/classroom/` 实现
- 前端 hooks (`useStudentSession`/`useTeacherStream`) 已在 `frontend/src/hooks/useClassroom.ts` 接入
- 学生提交 → SSE 广播 → 教师接收的管道理论上通了，但没有 harness 验证
- 教师端 MatrixCard 聚合逻辑、tab 计数、timer 可能是占位值
- Reading surfaces UI 已得分 98/100

---

## 5-Step Data Contract

从 TaskPanel.tsx 提取的每步提交数据形状：

| Step | stepIdx | Task Type | Submit Data Shape |
|------|---------|-----------|-------------------|
| Schema Activation | 0 | 2 short-answer inputs | `{q1: string, q2: string}` |
| Structure Decode | 1 | 3-card matching | `{selections: {"0":"History","1":"Culture","2":"Conclusion"}}` |
| Matrix Building | 2 | 4 locations × Practice + Reason | `{matrix: {"Borneo":{practice,reason}, "NZ Maori":{...}, "Myanmar":{...}, "Indonesia":{...}}}` |
| Critical Thinking | 3 | Free text | `{text: string}` |
| Recap | 4 | Read-only review | No submit |

---

## API Contract

Base path: `http://localhost:3007/api/classroom/:lessonId`

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| `POST` | `/:lessonId/join` | `{name: string}` | `{studentId: string, name: string}` |
| `POST` | `/:lessonId/submit` | `{studentId: string, step: number, data: object}` | `{ok: true}` |
| `GET` | `/:lessonId/state` | query `?step=N` (optional) | `ClassroomState` (see below) |
| `GET` | `/:lessonId/stream` | — | SSE text/event-stream |

### ClassroomState shape

```json
{
  "currentStep": 0,
  "students": [
    {
      "id": "uuid",
      "name": "Alice",
      "submissions": {
        "0": { "step": 0, "data": {...}, "submittedAt": "ISO" },
        "2": { "step": 2, "data": {...}, "submittedAt": "ISO" }
      }
    }
  ],
  "metrics": {
    "total": 1,
    "submitted": 1,
    "inProgress": 0
  }
}
```

### SSE Format

- First message on connect: full `ClassroomState`
- On every join/submit: full `ClassroomState` broadcast
- Heartbeat every 30s: `: heartbeat\n\n`
- Data frame: `data: <JSON>\n\n`

### Validation Rules

- `name`: MinLength(1), MaxLength(20)
- `step`: IsInt, Min(0), Max(4)
- `data`: IsObject, JSON size <= 10 KB
- `lessonId`: must match `/^[a-zA-Z0-9-]+$/`

---

## Frozen Constraints

| ID | Constraint | Penalty |
|----|------------|---------|
| FC-1 | `packages/` NOT modified | D1 = 0 |
| FC-2 | `solutions/business/recipe-book/` NOT modified | D1 = 0 |
| FC-3 | `solutions/business/live-lesson/mcp-server/` NOT modified | D1 = 0 |
| FC-4 | `solutions/business/live-lesson/skills/` NOT modified | D1 = 0 |
| FC-5 | Frontend port 5283, backend port 3007 | — |

**Modifiable**: `solutions/business/live-lesson/frontend/` and `solutions/business/live-lesson/backend/` — allowed to fix collaboration pipeline bugs.

---

## Service Architecture

| Service | Port | Start Command |
|---------|------|---------------|
| CCAAS core backend | 3001 | `npm run dev:backend` (repo root) |
| Live-lesson backend | 3007 | `node dist/main.js` (after `npx nest build`) |
| Frontend dev server | 5283 | `npx vite --port 5283` |

---

## Dependencies

- Backend: NestJS, TypeORM (SQLite), class-validator
- Frontend: React, Vite, TypeScript, react-router-dom
- DB: SQLite file in backend directory (tables: `reading_students`, `reading_submissions`)

---

## Exit Conditions

| Condition | Value |
|-----------|-------|
| Target | 95/100 |
| Pass | 90/100 |
| Max iterations | 8 |
| Diminishing returns | < 3 pts for 2 consecutive iterations |
| Cost cap | $250 |
