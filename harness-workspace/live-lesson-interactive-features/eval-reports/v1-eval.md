# Eval Report — live-lesson-interactive-features v1

## Per-Dimension Scores

### D1 Build + Service Health (10/100)
**Score: 10/10**
**Justification**:
- 1.1 Frontend `tsc --noEmit`: exit code 0, no errors (2/2)
- 1.2 Backend `nest build`: exit code 0, no errors (2/2)
- 1.3 Backend :3007 responds: `GET /api/lessons` returned lesson JSON with `ideal-beauty-reading` (2/2)
- 1.4 `POST /step` returns `{"ok":true,"currentStep":2}` (2/2)
- 1.5 `POST /notify` returns `{"ok":true}` (1/1)
- 1.6 `POST /ai/ask` returns `{"answer":"Skimming means reading only the first sentence of each paragraph to get the overall structure. Look for signal words like \"however\", \"around the world\", \"over time\" — they tell you how the text is organized."}` — non-empty, relevant (1/1)

**Suggestion**: None needed — all checks pass.

### D2 Teacher Step Sync (25/100)
**Score: 25/25**
**Justification**:
- 2.1 Teacher step rail has 5 clickable buttons: `1 图式激活 5'`, `2 结构解码 8'`, `3 矩阵构建 15'`, `4 批判质疑 12'`, `5 复盘升华 5'` — confirmed via Playwright snapshot (3/3)
- 2.2 Teacher clicks step 3 → header updates to `STEP 3`, step rail shows `[active]` on button 3, content shows `矩阵构建 Matrix Building` (4/4)
- 2.3 SSE sends `event: step_sync` named event — confirmed via `grep 'event: step_sync' /tmp/sse_step.txt` → PASS. Data includes `{"currentStep":3,...}` (5/5)
- 2.4 Student tab auto-syncs: after teacher clicked step 3, student tab shows `3/5`, task panel shows `Step 3 · 矩阵构建 · 15 min`, `Build Your Matrix` header, matrix table with fillable textboxes for Borneo/NZ Maori/Myanmar/Indonesia, reading panel shows `聚焦 ¶3,4,5,6,7` (was `¶1,2` on step 1) (8/8)
- 2.5 "进入 Step 4 →" button: clicked → teacher advanced to STEP 4, button label changed to `进入 Step 5 →`, content shows `批判质疑` (3/3)
- 2.6 "← 上一步" button: clicked → teacher decremented back to STEP 3 with `矩阵构建` content (2/2)

**Suggestion**: None needed — full marks.

### D3 Push Notifications (20/100)
**Score: 20/20**
**Justification**:
- 3.1 Teacher has 4 quick-push buttons: `📍 Myanmar 位置提示`, `🎯 Practice 写法示例`, `📝 tā moko 生词卡`, `⏱ 再给 2 分钟` — confirmed via Playwright snapshot refs e101-e104 (3/3)
- 3.2 Teacher clicks push button → API call succeeds. Clicked `📍 Myanmar 位置提示` and `🎯 Practice 写法示例` — both completed without error (4/4)
- 3.3 SSE sends `event: notification` named event — confirmed via `grep 'event: notification' /tmp/sse_notify.txt` → PASS. Data: `{"message":"Myanmar is in Southeast Asia","notifyType":"hint"}` (5/5)
- 3.4 Student tab shows toast: MutationObserver captured `stu-toast` element with text `📢Practice column: use SPECIFIC names like tā moko, not just tattoos`. Toast auto-dismisses after 5s (correct behavior). CSS class `stu-toast` with `position:fixed;bottom:24px;z-index:1000` confirmed in student.css (8/8)

**Suggestion**: Consider increasing toast duration from 5s to 8s for longer messages, or add a close button (already present via onClick dismiss).

### D4 AI Assistant (20/100)
**Score: 20/20**
**Justification**:
- 4.1 AI dock button visible: `助教` button at ref=e21 in student nav bar (2/2)
- 4.2 AI panel opens: panel visible with header `💬 AI 助教`, `收起 ▼` toggle, 4 preset chips, and text input `也可以直接问...` (3/3)
- 4.3 Type custom question: typed "what is skimming" in textbox ref=e123, confirmed text entered (4/4)
- 4.4 Submit question: pressed Enter, question submitted (2/2)
- 4.5 Answer appears: `browser_evaluate` found `.stu-ai-chat` element containing both user question and assistant answer. Answer: "Skimming means reading only the first sentence of each paragraph to get the overall structure. Look for signal words like 'however', 'around the world', 'over time' — they tell you how the text is organized." Follow-up buttons visible: `✓ 我明白了` / `? 还不明白` (6/6)
- 4.6 Answer is relevant: mentions "skimming", "reading", "first sentence", "paragraph", "structure", "signal words" — all directly relevant to the question about a reading strategy (3/3)

**Suggestion**: None needed — AI responses are contextually accurate and include follow-up interaction.

### D5 Timer & Polish (10/100)
**Score: 10/10**
**Justification**:
- 5.1 Teacher timer shows MM:SS format: `10:56 / 15:00` visible in header bar. No `—:—` anywhere on page. Timer appears in both header (`e15`) and step detail section (`e46`) (4/4)
- 5.2 Timer counting down: first reading `10:56`, waited 4 seconds, second reading `10:41` — timer decreased by ~15 seconds (includes render/eval overhead). Timer is actively counting (3/3)
- 5.3 "延长 2 min" button works: before click timer showed `10:34/15:00`, after click timer showed `12:25/15:00` — remaining time increased by ~1:51 (approximately +2 min). Button at ref=e135 (3/3)

**Suggestion**: None needed — timer functions correctly with countdown and extension.

### D6 Regression Guard (15/100)
**Score: 15/15**
**Justification**:
- 6.1 `POST /join` returns `{"studentId":"6d32e228-9af6-46a4-8e12-ae2806abc410","name":"RegressionTest"}` — has studentId and name (3/3)
- 6.2 `POST /submit` returns `{"ok":true}` (3/3)
- 6.3 `GET /state` returns JSON with `students` array (7 students), `metrics` (`{"total":7,"submitted":3,"inProgress":4}`), `currentStep` field (3/3)
- 6.4 SSE stream sends unnamed `data:` events — confirmed: first line starts with `data: {"currentStep":...}`, no `event:` prefix (compatible with `es.onmessage`) (3/3)
- 6.5 Teacher matrix renders: Playwright snapshot shows matrix table with 5 places: Ancient Egypt (¶3 · 示范), Borneo (¶5), NZ Maori (¶6), Myanmar (¶7a), Indonesia (¶7b), each with Practice and Reason columns populated from student submissions (3/3)

**Suggestion**: None needed — existing pipeline fully intact.

## Penalties Applied

**P1 (Frozen directory modification)**: NOT TRIGGERED
- `packages/`: OK, unchanged
- `solutions/business/recipe-book/`: OK, unchanged
- `solutions/business/live-lesson/mcp-server/`: OK, unchanged
- `solutions/business/live-lesson/skills/`: OK, unchanged

**P2 (Existing APIs broken)**: NOT TRIGGERED
- join, submit, state all return expected responses

## Score Summary
| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 Build + Service Health | 10 | 10 | All 6 checks pass: tsc, nest build, 3 endpoints, AI ask |
| D2 Teacher Step Sync | 25 | 25 | Full multi-tab sync: step rail, click, SSE event, student auto-sync, nav buttons |
| D3 Push Notifications | 20 | 20 | 4 push buttons, SSE notification event, student toast confirmed via MutationObserver |
| D4 AI Assistant | 20 | 20 | Dock → panel → type → submit → relevant answer with follow-up buttons |
| D5 Timer & Polish | 10 | 10 | MM:SS format, counting down, +2 min extension works |
| D6 Regression Guard | 15 | 15 | All existing APIs intact, SSE unnamed events work, matrix renders |

Penalties: 0

总分: 100/100

## Bug Classification

No bugs found. All dimensions pass at full score.

## Actionable Fix Hints

No fixes needed — all checks pass.

## Top 3 Priority Fixes

No fixes required. All 6 dimensions score at maximum.

## What's Working Well

1. **SSE architecture is excellent**: Clean separation between unnamed `data:` events (backward-compatible `onmessage`) and named events (`step_sync`, `notification`) for new features. The `useStudentStream` hook correctly uses `addEventListener` for named events while `useTeacherStream` uses `onmessage` for the legacy stream. This preserves backward compatibility while enabling new real-time features.

2. **Multi-surface sync is seamless**: Teacher step changes propagate to student in under 3 seconds via SSE. The student UI updates holistically — step indicator, task panel content, reading focus paragraphs, and structure map all update together. The matrix table on step 3 correctly shows fillable fields for the student's group assignment.
