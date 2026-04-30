# Eval Criteria — live-lesson-e2e-collaboration

## 评分体系

5 个维度，总分 100 分。每个 Check 有明确的检测方法（curl / Playwright / bash）。

---

### D1: Build + Service Health (15/100)

验证前后端构建通过、服务启动正常。

| Check | Points | Detection |
|-------|--------|-----------|
| Frontend `tsc --noEmit` 通过 | 2 | `cd frontend && npx tsc --noEmit` |
| Frontend `vite build` 通过 | 2 | `cd frontend && npx vite build` |
| Backend `nest build` 通过 | 2 | `cd backend && npx nest build` |
| Backend :3007 在 30s 内响应 | 3 | `curl -sf http://localhost:3007/api/lessons` |
| Frontend :5283 在 30s 内响应 | 3 | `curl -sf http://localhost:5283` |
| `GET /api/lessons` 包含 ideal-beauty-reading | 3 | `curl ... \| grep ideal-beauty-reading` |

**Penalty P1**: 修改 frozen 目录 → D1 = 0

---

### D2: Student Join + 5-Step Submission (25/100)

验证加入课堂和每步提交的 API 管道。

| Check | Points | Detection |
|-------|--------|-----------|
| JOIN: `POST /join {"name":"Alice"}` 返回 200 + studentId | 3 | curl POST + 解析 JSON |
| STEP 0: submit `{q1:"aim",q2:"media"}` 返回 `{ok:true}` | 4 | curl POST |
| STEP 1: submit `{selections:{"0":"History","1":"Culture","2":"Conclusion"}}` 返回 ok | 4 | curl POST |
| STEP 2: submit `{matrix:{"Borneo":{practice:"p",reason:"r"},...4 locations}}` 返回 ok | 5 | curl POST |
| STEP 3: submit `{text:"reflection text"}` 返回 ok | 3 | curl POST |
| STATE: `GET /state` 显示 4 个 submission (steps 0-3) | 3 | curl + 验证 submissions 对象有 4 个 key |
| UI: Playwright 打开学生页，填名字，点加入，验证进入课堂 | 3 | Playwright navigate + type + click + snapshot |

**Penalty P2**: 任何 curl submit 返回非 200 → D2 = 0

---

### D3: Teacher Real-Time Dashboard (25/100)

验证 SSE 实时推送和教师端数据呈现。

| Check | Points | Detection |
|-------|--------|-----------|
| SSE 连接: stream 首条 message 包含 `metrics` | 4 | `timeout 5 curl -sN .../stream \| head -3` |
| SSE 实时: submit 后 stream 推送新 event，metrics 变化 | 5 | 后台 curl stream + foreground submit + 验证第二条 message |
| Matrix 聚合: step-2 提交后，`GET /state` 的 students[].submissions 含 step 2 | 5 | curl state + JSON 解析 |
| Student list: state.students[] 包含已 join 的学生名字 | 4 | curl state + grep name |
| Metrics 正确: total >= 1, submitted 匹配实际提交数 | 4 | curl state + 比较 metrics |
| Playwright: 教师页加载，hero section 可见，matrix card 可见 | 3 | Playwright navigate + snapshot |

**Penalty P3**: SSE stream 无法连接 → D3 = 0

---

### D4: Three-Surface Sync (20/100)

验证 Demo 编排器同步三端。

| Check | Points | Detection |
|-------|--------|-----------|
| Demo 页加载 3 个 iframe | 4 | Playwright navigate + evaluate 验证 3 iframe |
| Conductor step 按钮可点击，界面更新 | 4 | Playwright click step 按钮 + snapshot |
| 键盘快捷键: ArrowRight 推进 step | 3 | Playwright press_key + snapshot |
| Board iframe 加载并显示板书内容 | 3 | Playwright navigate /board/ + snapshot |
| Student 页响应 step sync (独立打开时 step 0 可见) | 3 | Playwright navigate /student/ + snapshot |
| Teacher step rail 高亮当前 step | 3 | Playwright navigate /teacher/ + snapshot + 检查 active class |

---

### D5: Data Integrity + Edge Cases (15/100)

验证幂等、upsert、校验、持久化。

| Check | Points | Detection |
|-------|--------|-----------|
| 幂等 Join: 同名字第二次 join 返回相同 studentId | 3 | curl join × 2，比较 studentId |
| Upsert Submit: 重新提交 step 0，data 被更新 | 3 | curl submit × 2 不同 data，GET state 验证最新值 |
| 校验拒绝: step=5 返回 400 | 2 | `curl -w "%{http_code}" ... -d '{"step":5,...}'` |
| 校验拒绝: 空 name 返回 400 | 2 | `curl -w "%{http_code}" ... -d '{"name":""}'` |
| 持久化: restart 后端后 GET /state 仍返回之前数据 | 3 | kill backend → restart → curl state → 验证 students 非空 |
| 多学生: join 2 个不同学生，state.metrics.total = 2 | 2 | curl join × 2 不同名字 → GET state |

---

## Penalties

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | `packages/` or `solutions/business/recipe-book/` has new changes | D1 = 0 |
| P2 | Any curl submit returns non-200 | D2 = 0 |
| P3 | SSE stream cannot connect | D3 = 0 |

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
