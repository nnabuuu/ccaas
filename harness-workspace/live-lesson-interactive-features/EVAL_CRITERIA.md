# Eval Criteria — live-lesson-interactive-features

## 评分体系

6 个维度，总分 100 分。Playwright multi-tab 为主要测试方法（65+ 分）。

---

### D1: Build + Service Health (10/100)

验证构建通过、服务启动、新端点可达。

| Check | Points | Detection |
|-------|--------|-----------|
| Frontend `tsc --noEmit` 通过 | 2 | `cd frontend && npx tsc --noEmit` |
| Backend `nest build` 通过 | 2 | `cd backend && npx nest build` |
| Backend :3007 响应 | 2 | `curl -sf http://localhost:3007/api/lessons` |
| `POST /step` 返回 200 | 2 | `curl -sf -X POST .../step -d '{"step":2}'` |
| `POST /notify` 返回 200 | 1 | `curl -sf -X POST .../notify -d '{"message":"test","type":"hint"}'` |
| `POST /ai/ask` 返回 200 + answer | 1 | `curl -sf -X POST .../ai/ask -d '{"studentId":"x","question":"what is skimming","step":1}'` |

**Penalty P1**: 修改 frozen 目录 → D1 = 0

---

### D2: Teacher Step Sync (25/100)

**Playwright multi-tab** 验证教师推步 → 学生端自动同步。

| Check | Points | Detection |
|-------|--------|-----------|
| Teacher step rail 有 5 个可点击按钮 | 3 | Playwright: snapshot teacher page, verify 5 step buttons |
| Teacher 点 step 3 → API 调用成功 | 4 | Playwright: click step 3 + network check or snapshot update |
| SSE 发送 `step_sync` 命名事件 | 5 | bash: `curl -sN .../stream` 后台 + `POST /step` 前台 + `grep 'event: step_sync'` |
| Student tab 自动切步到 step 3 | 8 | Playwright multi-tab: teacher click step → wait → student tab verify step 3 content |
| "进入 Step N →" 按钮工作 | 3 | Playwright: click "进入 Step" button, verify step advances |
| "← 上一步" 按钮工作 | 2 | Playwright: click back button, verify step decrements |

**Playwright D2 流程**:
```
1. Tab 1: navigate → teacher/ideal-beauty-reading
2. snapshot → verify step rail (5 buttons)
3. Tab 2 (new): navigate → student/ideal-beauty-reading
4. Tab 2: type name + click join
5. Tab 1 (select): click step 3 button
6. wait 2s (SSE propagation)
7. Tab 2 (select): snapshot → verify step 3 content visible
```

---

### D3: Push Notifications (20/100)

**Playwright multi-tab** 验证教师推送 → 学生端收到 toast。

| Check | Points | Detection |
|-------|--------|-----------|
| Teacher 有 4 个 quick-push 按钮 | 3 | Playwright: snapshot teacher page, verify 4 push buttons |
| Teacher 点 push 按钮 → API 返回 200 | 4 | Playwright: click push button + network or snapshot |
| SSE 发送 `notification` 命名事件 | 5 | bash: `curl -sN .../stream` + `POST /notify` + `grep 'event: notification'` |
| Student tab 出现 toast/banner | 8 | Playwright multi-tab: teacher push → wait → student tab verify toast text |

**Playwright D3 流程**:
```
1. (继续 D2 的 tab 状态)
2. Tab 1 (teacher): click push button (e.g., "Myanmar 位置提示")
3. wait 3s
4. Tab 2 (student): snapshot → verify toast/notification visible
```

---

### D4: AI Assistant (20/100)

**Playwright** 验证学生自由提问 → 获得回答。

| Check | Points | Detection |
|-------|--------|-----------|
| Student AI dock 按钮可点击 | 2 | Playwright: snapshot, find AI dock button, click |
| AI panel 打开 | 3 | Playwright: snapshot after click, verify AI panel visible |
| 输入自定义问题 + Enter | 4 | Playwright: type question in input + press Enter |
| 显示 loading 状态 | 2 | Playwright: snapshot immediately after submit (optional — if loading visible) |
| 回答出现 | 6 | Playwright: wait_for answer text + snapshot verify Q&A pair |
| 回答与 step/keyword 相关 | 3 | Playwright: verify answer contains relevant content (not error message) |

**Playwright D4 流程**:
```
1. Tab 2 (student): click AI dock button
2. snapshot → verify AI panel open
3. type "what is skimming" in input
4. press Enter
5. wait_for assistant response text
6. snapshot → verify Q&A pair (user question + assistant answer)
```

---

### D5: Timer & Polish (10/100)

**Playwright** 验证计时器显示和延长功能。

| Check | Points | Detection |
|-------|--------|-----------|
| Teacher page timer 显示 `MM:SS` (非 `—:—`) | 4 | Playwright: snapshot teacher page, verify timer format |
| Timer 正在倒计时 (两次 snapshot 值不同) | 3 | Playwright: snapshot → wait 3s → snapshot → compare timer |
| "延长 2 min" 按钮工作 | 3 | Playwright: click extend button, verify timer increases |

---

### D6: Regression Guard (15/100)

验证现有 e2e-collaboration 管道不被破坏。

| Check | Points | Detection |
|-------|--------|-----------|
| `POST /join` 仍返回 studentId | 3 | curl POST join |
| `POST /submit` 仍返回 `{ok:true}` | 3 | curl POST submit |
| `GET /state` 仍返回 ClassroomState | 3 | curl GET state, verify students + metrics |
| SSE stream 仍推送无名 data event | 3 | curl stream + grep `^data:` |
| Playwright: teacher page matrix card 仍渲染 | 3 | Playwright: navigate teacher page, verify matrix |

**Penalty P2**: 任何 curl submit 返回非 200 → D6 = 0

---

## Penalties

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | `packages/` or `solutions/business/recipe-book/` or frozen dirs modified | D1 = 0 |
| P2 | Existing join/submit/state APIs broken | D6 = 0 |

Frozen directories:
- `packages/`
- `solutions/business/recipe-book/`
- `solutions/business/live-lesson/mcp-server/`
- `solutions/business/live-lesson/skills/`

---

## Score Format

评分报告必须以如下格式结尾（用于 harness.sh 正则提取）：

```
总分: XX/100
```
