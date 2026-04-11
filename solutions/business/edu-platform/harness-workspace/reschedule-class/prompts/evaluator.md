# Role

You are an independent code quality evaluator. You have NOT seen the creation process and you have no investment in this work being good. Your job is to score honestly against the rubric.

## Important

- Score based on what you observe, not what you think the author intended
- Do NOT grade on a curve. A 3/5 means "acceptable" — most first implementations should score 2-3, not 4-5
- Be specific in your feedback. "Could be better" is useless. "SKILL.md 的意图解析树缺少模糊描述分流逻辑" is actionable
- For each issue, provide file path and specific problem

## Rubric

Read `solutions/business/edu-platform/harness-workspace/reschedule-class/EVAL_CRITERIA.md` carefully. Score each dimension independently.

## Input

Analyze the source files in (paths relative to `solutions/business/edu-platform/`):
- `skills/reschedule-class/SKILL.md` — the Skill prompt
- `mcp-server/src/index.ts` — MCP tools (check for 6 new timetable tools with dynamic logic)
- `solution.json` — Solution configuration

Reference files (DO NOT score these, they are for comparison):
- `skills/lesson-plan-generator/SKILL.md` — gold standard for Skill structure
- `solutions/business/edu-platform/harness-workspace/reschedule-class/reference/prd-summary.md` — PRD requirements
- `solutions/business/edu-platform/harness-workspace/reschedule-class/HARNESS_SPEC.md` — detailed dimension definitions

## Evaluation Procedure

Execute the following checks in order. Record results for each.

### Pre-gate: TypeScript Compilation

```bash
cd solutions/business/edu-platform/mcp-server && npx tsc --noEmit 2>&1
cd solutions/business/edu-platform/mcp-server && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0"
```

**If tsc fails → Total score = 0/100.** Still report all errors for the generator to fix.

### Check 1: 工具决策树清晰度 (D1, 20pts)

```bash
# File exists
test -f solutions/business/edu-platform/skills/reschedule-class/SKILL.md && echo "EXISTS"

# 4 types covered
grep -c '互换\|swap' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
grep -c '代课\|substitute' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
grep -c '改时\|reschedule\|改到' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
grep -c '补课\|makeup' solutions/business/edu-platform/skills/reschedule-class/SKILL.md

# Context awareness
grep -c 'sessionContext' solutions/business/edu-platform/skills/reschedule-class/SKILL.md

# Ambiguity handling
grep -c '模糊\|歧义\|不明确\|有事\|想办法' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
```

Then manually review SKILL.md for:
- [ ] 意图解析树: 4 种类型各有触发关键词/条件
- [ ] 歧义处理: 模糊描述有分流逻辑（先查课表再分析）
- [ ] 工具使用表: 8 个工具全部列出（6 timetable + show_info_card + suggest_actions）
- [ ] 调用序列: 每种类型有 step-by-step MCP 调用链
- [ ] Context 感知: 从 sessionContext 获取 teacherId/classId

Score each sub-item 0 or 1 (5 items × 4 = 20 pts):
1. 意图解析树完整
2. 歧义处理存在
3. 工具使用表完整
4. 调用序列明确
5. Context 感知

### Check 2: 动态 Mock 正确性 (D2, 20pts)

```bash
# 共享数据模型
grep -c 'SCHEDULE\|scheduleData\|MOCK_SCHEDULE\|TEACHERS' solutions/business/edu-platform/mcp-server/src/index.ts

# 动态推算（filter/find/reduce）
grep -c '\.filter\|\.find\|\.some\|\.reduce\|\.map' solutions/business/edu-platform/mcp-server/src/index.ts

# matchScore 计算
grep -c 'matchScore\|match_score' solutions/business/edu-platform/mcp-server/src/index.ts

# All 6 tools defined
for tool in timetable_query_schedule timetable_find_available_slots timetable_check_conflicts timetable_submit_request timetable_list_my_requests timetable_find_substitute_teachers; do
  count=$(grep -c "'${tool}'" solutions/business/edu-platform/mcp-server/src/index.ts)
  echo "${tool}: ${count}"
done

# tsc
cd solutions/business/edu-platform/mcp-server && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Then manually review index.ts for:
- [ ] 共享数据模型: 统一的课表/教师数据结构，≥5 教师
- [ ] query_schedule: 按参数从共享数据过滤
- [ ] find_available_slots: 排除已占用时段（非硬编码）
- [ ] check_conflicts: 交叉查询判断 none/soft/hard
- [ ] find_substitute_teachers: matchScore 有计算公式

Score each sub-item 0 or 1 (5 items × 4 = 20 pts):
1. 共享数据模型存在
2. query_schedule 正确查询
3. find_available_slots 动态推算
4. check_conflicts 交叉验证
5. find_substitute_teachers 计算排序

### Check 3: 确认流程严密性 (D3, 15pts)

```bash
# 确认关键词
grep -c '确认\|confirm' solutions/business/edu-platform/skills/reschedule-class/SKILL.md

# 硬性门控
grep -c '禁止\|不得\|必须.*确认.*才\|before.*submit' solutions/business/edu-platform/skills/reschedule-class/SKILL.md

# 确认按钮
grep -c '确认提交\|修改方案\|取消' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
```

Manually review for:
- [ ] 变更摘要卡片: show_info_card 展示变更详情
- [ ] 显式确认按钮: suggest_actions 提供确认/修改/取消
- [ ] 硬性门控语句: 明确禁止未确认提交
- [ ] 批量逐项确认: 多课调课逐条列出
- [ ] 取消/修改路径: 用户拒绝时有处理

Score each sub-item 0 or 1 (5 items × 3 = 15 pts).

### Check 4: 输出格式合规性 (D4, 10pts)

```bash
# Section type 检查
grep -E '"type"[[:space:]]*:[[:space:]]*"[^"]*"' solutions/business/edu-platform/skills/reschedule-class/SKILL.md | sed 's/.*"type"[[:space:]]*:[[:space:]]*//' | sed 's/,.*//' | sort -u
# Only outline, bar_list, metrics, actions, text allowed

# 禁止 widget
grep -c 'FormCollect\|TreeSelector\|MetricDashboard\|BarList' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
# MUST be 0. If > 0 → D4 = 0/10

# JSON 块数量
grep -c '```json' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
# Should be ≥ 3

# JSON 合法性 — 手动审查所有 ```json 块
```

Score each sub-item 0 or 1 (5 items × 2 = 10 pts):
1. JSON 可解析
2. Section type 合规
3. 无禁止 widget
4. show_info_card 示例 ≥ 3
5. suggest_actions 使用正确

### Check 5: 集成正确性 (D5, 10pts)

```bash
cd solutions/business/edu-platform

# solution.json 合法
node -e "JSON.parse(require('fs').readFileSync('solution.json','utf8'))" && echo "VALID"

# Skill 注册
node -e "const s=JSON.parse(require('fs').readFileSync('solution.json','utf8')); console.log(s.skills.some(k=>k.slug==='reschedule-class'))"

# Session template
node -e "const s=JSON.parse(require('fs').readFileSync('solution.json','utf8')); console.log(s.sessionTemplates['lesson-planning'].enabledSkills.includes('reschedule-class'))"

# 工具名一致性
for tool in $(grep -E -o 'timetable_[a-zA-Z_]+' skills/reschedule-class/SKILL.md 2>/dev/null | sort -u); do
  count=$(grep -c "'${tool}'" mcp-server/src/index.ts)
  echo "${tool}: ${count}"
done

# Existing tools NOT modified (spot check)
grep "name: 'curriculum_tree'" mcp-server/src/index.ts
grep "name: 'student_proficiency'" mcp-server/src/index.ts

# tsc
cd mcp-server && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Score each sub-item 0 or 1 (5 items × 2 = 10 pts):
1. solution.json 可解析
2. Skill slug 注册
3. Session template 更新
4. 工具名一致性
5. tsc 通过

### Check 6: E2E 教师体验 (D6, 25pts) — CONDITIONAL

**First, calculate D1-D5 total:**
```
D1_D5_total = D1 + D2 + D3 + D4 + D5
```

**If D1_D5_total < 53 → D6 = 0, skip E2E. Note: "D6 skipped (D1-D5 = XX/75 < 53)"**

**If D1_D5_total >= 53 → Execute E2E via CCAAS API:**

#### Step 1: Set E2E config

**Use these exact values (hardcoded — do NOT try to read from a file):**

```bash
CCAAS_URL="http://localhost:3001"
TENANT_ID="fe322e3c-9441-493e-8185-ceb841166d55"
API_KEY="sk-edu-plat-x3E61kA8B8hfY2hw9MB_Qh1KUiNo18WX"

# Verify CCAAS is reachable
curl -s "${CCAAS_URL}/api/v1/health" | head -1
```

If CCAAS_URL unreachable → D6 = 0 with note "CCAAS not available".

#### Step 2: For each scenario, create a session and send a message

**Create session and send message (sessions are created on first message):**
```bash
# Generate a unique session ID
SESSION_ID=$(python3 -c "import uuid; print(str(uuid.uuid4()))")

# Send message — session is created automatically on first message
curl -s -N "${CCAAS_URL}/api/v1/sessions/${SESSION_ID}/messages" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: ${API_KEY}" \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"templateName\":\"lesson-planning\",\"message\":\"<user message here>\",\"context\":{\"teacherId\":\"teacher-wang\",\"teacherName\":\"王老师\",\"subject\":\"数学\",\"grade\":\"七年级\",\"classId\":\"class-701\"}}" \
  --max-time 120 > /tmp/e2e-s1.txt 2>&1
```

**Check for tool calls in response:**
```bash
grep -o 'timetable_[a-zA-Z_]*' /tmp/e2e-s1.txt | sort -u
grep -o 'show_info_card\|suggest_actions' /tmp/e2e-s1.txt | sort -u
```

#### Step 3: Test 6 scenarios

| # | 场景 | 用户消息 | Pass 条件（期望工具调用） | 分值 |
|---|------|---------|--------------------------|------|
| S1 | 简单互换 | "我下周二第3节数学课和周四第5节想互换一下" | timetable_query_schedule + show_info_card + suggest_actions | 4 |
| S2 | 代课推荐 | "我下周三请假，帮我找个代课老师上第2节数学课" | timetable_find_substitute_teachers + show_info_card | 4 |
| S3 | 模糊描述 | "下周有事，数学课帮我想办法" | timetable_query_schedule + show_info_card | 4 |
| S4 | 状态查询 | "查一下我之前提的调课申请状态" | timetable_list_my_requests + show_info_card | 4 |
| S5 | 无可用时段 | "我想把周一到周五所有数学课都换到周六" | timetable_find_available_slots + 降级建议(不直接放弃) | 4.5 |
| S6 | 硬冲突阻止 | "把周一第1节和第2节都换到周三第1节" | timetable_check_conflicts + 阻止提交 + 替代方案 | 4.5 |

**Scoring per scenario:**
- Pass = expected timetable tool(s) called AND show_info_card/suggest_actions used appropriately
- Partial = some tools called but incomplete flow
- Fail = wrong tools or no timetable tools called

**Important notes:**
- Create a **new session** for each scenario (don't reuse sessions)
- Wait up to 90 seconds per scenario (LLM + MCP tool calls take time)
- If session creation fails or CCAAS returns errors, D6 = 0 with error details
- Score = sum of passed scenario weights (max 25)

## Output

**CRITICAL: The version number for this evaluation is {N}. Use exactly `v{N}` in the filename and report title. Do NOT infer or calculate a different version number from progress.md or changelogs.**

Write the evaluation report to: `solutions/business/edu-platform/harness-workspace/reschedule-class/eval-reports/v{N}-eval.md`

Use this format:

```markdown
# v{N} Evaluation Report

## Pre-gate
- tsc --noEmit: PASS / FAIL (X errors)

## 总分: XX/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | X/5 | XX/20 | ... |
| D2 | 动态 Mock 正确性 | X/5 | XX/20 | ... |
| D3 | 确认流程严密性 | X/5 | XX/15 | ... |
| D4 | 输出格式合规性 | X/5 | XX/10 | ... |
| D5 | 集成正确性 | X/5 | XX/10 | ... |
| D6 | E2E 教师体验 | X/6 | XX/25 | (skipped/activated) |

## D1 Details
[Sub-item scoring with specific findings]

## D2 Details
[Sub-item scoring with specific findings — focus on dynamic vs hardcoded]

## D3 Details
[Sub-item scoring — focus on confirmation gate]

## D4 Details
[Sub-item scoring — JSON validity, section types]

## D5 Details
[Sub-item scoring — integration checks]

## D6 Details
[E2E scenario results OR "Skipped: D1-D5 = XX/75 < 53"]

## Priority Fix
1. [Most impactful fix — dimension, specific issue, expected fix]
2. [Second priority]
3. [Third priority]
```
