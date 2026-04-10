# Eval Criteria: Reschedule-Class Skill + Dynamic Mock MCP

## Pre-gate

```bash
cd solutions/business/edu-platform/mcp-server && npx tsc --noEmit
```

**未通过 → 总分 0/100**。Evaluator 仍需报告具体错误以供 Generator 修复。

## Scoring Dimensions

| # | Dimension | Weight | Detection Method |
|---|-----------|--------|------------------|
| D1 | 工具决策树清晰度 | 20/100 | SKILL.md 静态审查 |
| D2 | 动态 Mock 正确性 | 20/100 | 代码审查 + 交叉一致性验证 |
| D3 | 确认流程严密性 | 15/100 | SKILL.md 审查 + 门控关键词检测 |
| D4 | 输出格式合规性 | 10/100 | 自动检测 (grep/JSON parse) |
| D5 | 集成正确性 | 10/100 | 自动检测 (tsc/JSON parse/grep) |
| D6 | E2E 教师体验 | 25/100 | Playwright 6 场景 (条件激活) |

> **D6 激活条件**: D1-D5 总分 ≥ 53/75（70%）。未达到时 D6 = 0，总分仅基于 D1-D5。

## D1: 工具决策树清晰度 (20/100)

按子项打分（每项 0-1 分，共 5 项，× 4 = 20 分）：

1. **意图解析树完整**: 4 种调课类型（swap/substitute/reschedule/makeup）各有明确的触发关键词和条件
2. **歧义处理**: 模糊描述（"有事""想想办法"）有分流逻辑 — 先调 query_schedule 查课表，分析受影响课时后再推荐
3. **工具使用表完整**: 列出所有 8 个工具（6 timetable + show_info_card + suggest_actions），含用途和调用条件
4. **调用序列明确**: 每种类型有 step-by-step MCP 调用链（query → search → show → confirm → submit）
5. **Context 感知**: 明确从 sessionContext 获取 teacherId/classId/grade/subject，不要求教师手动输入

**Detection**:
```bash
# 4 种类型关键词
grep -c '互换\|swap' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
grep -c '代课\|substitute' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
grep -c '改时\|reschedule\|改到' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
grep -c '补课\|makeup' solutions/business/edu-platform/skills/reschedule-class/SKILL.md

# 歧义处理
grep -c '模糊\|歧义\|不明确\|有事\|想办法' solutions/business/edu-platform/skills/reschedule-class/SKILL.md

# 工具使用表
grep -c 'timetable_query_schedule' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
grep -c 'timetable_find_available_slots' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
grep -c 'show_info_card' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
grep -c 'suggest_actions' solutions/business/edu-platform/skills/reschedule-class/SKILL.md

# Context 感知
grep -c 'sessionContext' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
```

## D2: 动态 Mock 正确性 (20/100)

按子项打分（每项 0-1 分，共 5 项，× 4 = 20 分）：

1. **共享数据模型**: 有统一的课表数据结构（常量或顶部对象），≥5 教师 × 完整周课表（5天×8节），`SCHEDULE` 或等价命名
2. **query_schedule 查询正确**: 按 teacherId/classId/week 从共享数据过滤，非硬编码
3. **find_available_slots 动态推算**: 通过遍历排除已占用时段得出空闲，不是独立硬编码
4. **check_conflicts 交叉验证**: 读取共享课表判断冲突级别 — none(无冲突)/soft(同班同日多节同科)/hard(教室/教师时间冲突)
5. **find_substitute_teachers 计算排序**: matchScore 有公式（如：同学科+40, 教过该班+30, 每空闲节+10），非随机

**Detection**: 代码审查 `mcp-server/src/index.ts`：
```bash
# 共享数据存在
grep -c 'SCHEDULE\|scheduleData\|MOCK_SCHEDULE' solutions/business/edu-platform/mcp-server/src/index.ts

# 动态推算关键词
grep -c 'filter\|find\|some\|reduce' solutions/business/edu-platform/mcp-server/src/index.ts

# matchScore 计算
grep -c 'matchScore\|match_score' solutions/business/edu-platform/mcp-server/src/index.ts
```

## D3: 确认流程严密性 (15/100)

按子项打分（每项 0-1 分，共 5 项，× 3 = 15 分）：

1. **变更摘要卡片**: 提交前用 show_info_card 展示变更详情（原课时 → 目标课时、涉及教师、冲突状态）
2. **显式确认按钮**: 用 suggest_actions 提供 [确认提交] [修改方案] [取消] 等操作按钮
3. **硬性门控**: SKILL.md 明确写 "在用户选择确认之前，禁止调用 timetable_submit_request" 或语义等价表述
4. **批量逐项确认**: 多节课调课时逐条列出每个变更
5. **取消/修改路径**: 用户说"不对""换个方案"时有对应处理流程

**Detection**:
```bash
# 确认关键词
grep -c '确认\|confirm' solutions/business/edu-platform/skills/reschedule-class/SKILL.md

# 禁止静默提交
grep -c '禁止\|不得\|必须.*确认.*才.*提交\|before.*submit' solutions/business/edu-platform/skills/reschedule-class/SKILL.md

# suggest_actions 确认按钮
grep -c '确认提交\|修改方案\|取消' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
```

## D4: 输出格式合规性 (10/100)

按子项打分（每项 0-1 分，共 5 项，× 2 = 10 分）：

1. **JSON 可解析**: SKILL.md 中所有 `json` 代码块可通过 JSON.parse
2. **Section type 合规**: 只使用 outline/bar_list/metrics/actions/text
3. **无禁止 widget**: 不含 FormCollect/TreeSelector/MetricDashboard/BarList
4. **show_info_card 示例丰富**: ≥3 个不同场景的 JSON 示例（方案推荐、提交结果、状态查询）
5. **suggest_actions 使用正确**: 含 label + prompt + 可选 skill_hint/primary

**Detection**:
```bash
# Section type 检查
grep -oP '"type"\s*:\s*"[^"]*"' solutions/business/edu-platform/skills/reschedule-class/SKILL.md | sort -u
# 只应出现: "actions" "bar_list" "metrics" "outline" "text"

# 禁止 widget
grep -c 'FormCollect\|TreeSelector\|MetricDashboard\|BarList' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
# 必须为 0

# JSON 块数量
grep -c '```json' solutions/business/edu-platform/skills/reschedule-class/SKILL.md
# 应 ≥ 3
```

## D5: 集成正确性 (10/100)

按子项打分（每项 0-1 分，共 5 项，× 2 = 10 分）：

1. **solution.json 可解析**: `node -e "JSON.parse(...)"`
2. **Skill slug 注册**: skills 数组含 `{ "slug": "reschedule-class" }`
3. **Session template 更新**: lesson-planning.enabledSkills 含 "reschedule-class"
4. **工具名一致性**: SKILL.md 引用的每个 timetable 工具在 mcp-server 中有定义
5. **tsc 通过**: `cd mcp-server && npx tsc --noEmit` 零错误

**Detection**:
```bash
cd solutions/business/edu-platform

# solution.json 合法
node -e "JSON.parse(require('fs').readFileSync('solution.json','utf8'))" && echo "VALID" || echo "INVALID"

# Skill 注册
node -e "const s=JSON.parse(require('fs').readFileSync('solution.json','utf8')); console.log(s.skills.some(k=>k.slug==='reschedule-class'))"

# Session template
node -e "const s=JSON.parse(require('fs').readFileSync('solution.json','utf8')); console.log(s.sessionTemplates['lesson-planning'].enabledSkills.includes('reschedule-class'))"

# 工具名一致性
for tool in $(grep -oP 'timetable_\w+' skills/reschedule-class/SKILL.md 2>/dev/null | sort -u); do
  count=$(grep -c "'${tool}'" mcp-server/src/index.ts)
  echo "${tool}: ${count} matches"
done

# tsc
cd mcp-server && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

## D6: E2E 教师体验 (25/100)

> **仅在 D1-D5 ≥ 53/75 时执行。**

6 个 Playwright 场景，每个 Pass/Fail:

| # | 场景 | 输入 | Pass 条件 | 分值 |
|---|------|------|-----------|------|
| S1 | 简单互换 | "帮我把周三第5节和王老师换一下" | AI 调用 query_schedule → show_info_card 含方案 → suggest_actions 含确认按钮 → submit_request | 4 |
| S2 | 代课推荐 | "下周三第5-6节请假找代课" | AI 调用 find_substitute_teachers → show_info_card 含候选排名 → 选择后提交 | 4 |
| S3 | 模糊描述 | "下周三下午有事" | AI 先调 query_schedule 查下午课 → 逐课推荐 → 组合方案 | 4 |
| S4 | 状态查询 | "我的调课申请批了吗" | AI 调用 list_my_requests → show_info_card 展示申请列表 | 4 |
| S5 | 无可用时段 | 触发无空闲场景 | AI 不直接放弃，给出降级建议 | 4.5 |
| S6 | 硬冲突阻止 | 触发 hard 冲突 | AI 阻止提交 + 展示替代方案 | 4.5 |

**E2E 执行流程**: 启动 backend + mcp-server → 创建 session → 发消息 → 等待 AI 回复 → 检查工具调用日志 + 输出内容

## Summary Table Template

Evaluator 必须输出以下格式的总结表：

```markdown
## 总分: XX/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | X/5 | XX/20 | ... |
| D2 | 动态 Mock 正确性 | X/5 | XX/20 | ... |
| D3 | 确认流程严密性 | X/5 | XX/15 | ... |
| D4 | 输出格式合规性 | X/5 | XX/10 | ... |
| D5 | 集成正确性 | X/5 | XX/10 | ... |
| D6 | E2E 教师体验 | X/6 | XX/25 | (条件激活) |

## Priority Fix
1. [最优先修复项]
2. [次优先修复项]
3. [第三修复项]
```

## Penalty Rules

- **禁止 widget**: SKILL.md 使用 FormCollect/TreeSelector/MetricDashboard/BarList → D4 直接 0 分
- **JSON 语法错误**: SKILL.md JSON 代码块不可解析 → D4 扣 1 子项
- **已有工具被修改**: 现有工具定义或 handler 被改 → D5 直接 0 分
- **tsc 失败**: `npx tsc --noEmit` 有错误 → 总分 0/100 (Pre-gate)
- **静默提交**: SKILL.md 无确认门控 → D3 直接 0 分
- **工具名不一致**: SKILL.md 引用的 tool name 在 mcp-server 中不存在 → D5 扣 2 子项
