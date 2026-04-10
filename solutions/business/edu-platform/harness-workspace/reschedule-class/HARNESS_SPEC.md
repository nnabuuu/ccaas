# Harness Specification: Reschedule-Class Skill + Dynamic Mock MCP

## Task

- **Artifact**: `skills/reschedule-class/SKILL.md`（Skill prompt）+ `mcp-server/src/index.ts`（6 个 timetable mock tools）+ `solution.json`（配置注册）
- **Current state**: 无。从零开始创建 Skill prompt 和 mock MCP 工具
- **Target audience**: 中小学教师（通过 Chat 自然语言交互）；评估者同时是 AI Evaluator + Playwright E2E
- **Goal**: 生成可直接上线的调课助手 Skill，AI 能正确选择工具、展示结构化方案、在提交前强制确认，mock 工具基于共享课表数据动态推算结果

## Frozen Constraints

### 不可修改的文件

- `solutions/business/edu-platform/backend/` — 整个后端冻结
- `solutions/business/edu-platform/frontend/` — 整个前端冻结
- `packages/` — 所有核心包冻结
- `mcp-server/src/index.ts` 中已有的 7+ 个工具（curriculum_tree, student_proficiency, teaching_progress, generate_docx, write_output, show_info_card, suggest_actions, show_step_wizard, show_review_panel）定义和 handler 不可修改，只能添加新工具

### 必须遵守的规则

- `show_info_card` 只允许 5 种 section type: `outline`, `bar_list`, `metrics`, `actions`, `text`
- 禁止使用虚构 widget: `FormCollect`, `TreeSelector`, `MetricDashboard`, `BarList`
- 工具名在 SKILL.md 和 mcp-server 中必须完全一致（下划线命名）
- solution.json 必须保持合法 JSON
- SKILL.md 中 JSON 示例必须可解析（无尾逗号、正确引号）
- 每次调 `timetable_submit_request` 前必须有明确确认步骤
- 中文输出

## Eval Rubric

### Scoring Dimensions

| # | Dimension | Weight | Detection Method |
|---|-----------|--------|------------------|
| D1 | 工具决策树清晰度 | 20/100 | SKILL.md 静态审查：意图→工具映射、决策分支、歧义处理 |
| D2 | 动态 Mock 正确性 | 20/100 | 代码审查：共享数据模型、推算逻辑、交叉一致性 |
| D3 | 确认流程严密性 | 15/100 | SKILL.md 审查：confirm-before-submit、变更摘要、批量逐项确认 |
| D4 | 输出格式合规性 | 10/100 | 自动检测：section type 合规、JSON 可解析、禁止 widget |
| D5 | 集成正确性 | 10/100 | 自动检测：solution.json 合法、skill 注册、tsc 通过、工具名一致 |
| D6 | E2E 教师体验 | 25/100 | Playwright 6 场景自动化：启动完整服务 → 模拟教师对话 → 验证 AI 行为 |

### Dimension Details

#### D1: 工具决策树清晰度 (20/100)

AI 面对教师的自然语言请求时，能否正确选择工具序列。

- **5/5**: SKILL.md 中有完整的意图解析树（4 种调课类型各自的触发条件 + 模糊意图的分流逻辑），每种类型有明确的 MCP 调用序列，工具使用表列出所有 8 个工具（6 timetable + show_info_card + suggest_actions）及其调用时机
- **3/5**: 4 种类型有基本流程但缺少歧义处理（如"帮我想想办法"归到哪个类型），或部分工具的调用时机不明确
- **1/5**: 只有 1-2 种类型的流程，或工具调用序列混乱，AI 会困惑该调哪个工具

子项（每项 0-1 分，共 5 项，× 4 = 20 分）：
1. 意图解析树完整：4 种类型各有触发关键词/条件
2. 歧义处理：模糊描述（"有事""想办法"）有分流逻辑（先查课表再分析）
3. 工具使用表完整：8 个工具全部列出，含用途和调用条件
4. 调用序列明确：每种类型有完整的 step-by-step MCP 调用链
5. Context 感知：明确从 sessionContext 获取 teacherId/classId 等

#### D2: 动态 Mock 正确性 (20/100)

Mock 工具不是硬编码返回值，而是基于共享课表数据推算。

- **5/5**: 有统一的课表数据结构（≥5 教师 × 5 天 × 8 节），所有 6 个工具从同一数据源推算；`find_available_slots` 通过排除已占用时段计算；`check_conflicts` 通过交叉查询检测；`find_substitute_teachers` 通过空闲计算 + 学科匹配计算 matchScore
- **3/5**: 有共享数据但推算逻辑不完整（如 `find_available_slots` 仍有硬编码结果），或交叉一致性有 1-2 处矛盾
- **1/5**: 各工具独立硬编码返回值，数据不共享，一致性无法保证

子项（每项 0-1 分，共 5 项，× 4 = 20 分）：
1. 共享数据模型：有 `SCHEDULE_DATA` 或等价的统一课表常量，≥5 教师 × 完整周课表
2. `query_schedule` 正确查询：按 teacherId/classId/week 从共享数据过滤
3. `find_available_slots` 动态推算：通过排除已占用时段得出空闲
4. `check_conflicts` 交叉验证：读取共享数据判断 none/soft/hard
5. `find_substitute_teachers` 计算排序：matchScore 由学科匹配 + 教过该班 + 空闲时段数推算

#### D3: 确认流程严密性 (15/100)

防止 AI 静默提交调课申请。

- **5/5**: 每次 `submit_request` 前有变更摘要卡片（show_info_card）→ suggest_actions [确认提交] [修改方案] → 只有用户选择确认才提交；批量调课逐项列出 + 逐项确认；取消/修改路径存在
- **3/5**: 有确认步骤但不够严密（如只是文字询问，没有用 suggest_actions 显式确认按钮）
- **1/5**: 没有确认步骤，或确认步骤是软性的（AI 可以跳过）

子项（每项 0-1 分，共 5 项，× 3 = 15 分）：
1. 变更摘要卡片：提交前用 show_info_card 展示变更详情（原课时 → 目标课时）
2. 显式确认按钮：用 suggest_actions 提供 [确认提交] [修改方案] [取消] 按钮
3. 硬性门控：SKILL.md 明确写 "在用户选择确认之前，禁止调用 timetable_submit_request"
4. 批量调课逐项确认：多节课调课时逐条列出变更
5. 取消/修改路径：用户说"不对"或"换一个方案"时有对应处理

#### D4: 输出格式合规性 (10/100)

SKILL.md 中的 JSON 示例和 widget 使用符合平台规范。

- **5/5**: 所有 JSON 代码块可解析；section type 只用 5 种允许类型；无禁止 widget；show_info_card 示例覆盖方案推荐、提交结果、状态查询 3 种场景
- **3/5**: JSON 基本正确但有 1-2 处尾逗号；或 section type 有 1 处拼写错误
- **1/5**: JSON 无法解析；或使用了禁止的 widget

子项（每项 0-1 分，共 5 项，× 2 = 10 分）：
1. JSON 可解析：所有 `json` 代码块可通过 JSON.parse
2. Section type 合规：只使用 outline/bar_list/metrics/actions/text
3. 无禁止 widget：不含 FormCollect/TreeSelector/MetricDashboard/BarList
4. show_info_card 示例丰富：≥3 个不同场景的 JSON 示例
5. suggest_actions 使用正确：含 label + prompt + 可选 skill_hint

#### D5: 集成正确性 (10/100)

配置文件正确，编译通过，工具名一致。

- **5/5**: solution.json 合法 + skill 注册 + session template 更新 + 工具名 100% 一致 + tsc 零错误
- **3/5**: 基本正确但有 1 处遗漏（如 session template 没更新）
- **1/5**: tsc 失败，或 solution.json 不合法

子项（每项 0-1 分，共 5 项，× 2 = 10 分）：
1. solution.json 可解析
2. Skill slug 注册到 skills 数组
3. Session template 包含 reschedule-class
4. SKILL.md 中所有 timetable 工具名在 mcp-server 中有定义
5. `cd mcp-server && npx tsc --noEmit` 零错误

#### D6: E2E 教师体验 (25/100)

启动完整服务栈，用 Playwright 模拟教师对话，验证 AI 行为。

> **激活条件**: D1-D5 总分 ≥ 53/75（70%）时才执行。未达到时 D6 = 0 但不惩罚。

6 个 Playwright 场景（每个约 4 分，向上取整）：

| # | 场景 | 验证点 |
|---|------|--------|
| S1 | 简单互换 | "帮我把周三第5节和王老师换一下" → AI 查课表 → 展示方案卡片 → 确认后提交 |
| S2 | 代课推荐 | "下周三第5-6节请假找代课" → AI 推荐候选教师 → 按匹配度排序 → 选择后提交 |
| S3 | 模糊描述 | "下周三下午有事" → AI 先查下午所有课 → 逐课推荐方案 → 组合方案 |
| S4 | 状态查询 | "我的调课申请批了吗" → AI 调 list_my_requests → 展示申请列表 |
| S5 | 无可用时段 | 触发场景：所有时段已满 → AI 给出降级建议（不能直接放弃） |
| S6 | 硬冲突阻止 | 触发场景：方案有 hard 冲突 → AI 阻止提交 + 说明原因 + 提供替代方案 |

E2E 评分规则：
- 每个场景 Pass/Fail（Pass = 4 分，Fail = 0 分），S1-S4 各 4 分 + S5-S6 各 4.5 分 = 25 分
- Pass 条件：AI 的工具调用序列正确 + 输出中包含预期卡片/按钮 + 确认流程存在

### Penalty Rules

- **禁止 widget**: SKILL.md 使用 FormCollect/TreeSelector/MetricDashboard/BarList → D4 直接 0 分
- **JSON 语法错误**: SKILL.md JSON 代码块不可解析 → D4 扣 1 子项
- **已有工具被修改**: 现有 7+ 个工具定义或 handler 被改 → D5 直接 0 分
- **tsc 失败**: `npx tsc --noEmit` 有 TS 错误 → 总分 0/100（Pre-gate）
- **静默提交**: SKILL.md 允许不经确认直接 submit_request → D3 直接 0 分

### Threshold

- **Pass score**: 75/100
- **Target score**: 90/100

## Agent Architecture

### Generator

- **Role**: Prompt 工程师 + TypeScript 开发者，实现调课 Skill 和 dynamic mock MCP 工具
- **Perspective**: 你是一个为教师用户设计 AI 助手的开发者。你要让 AI 清楚知道何时调用哪个工具，并且永远不能静默提交调课申请
- **Input**: SPEC.md, EVAL_CRITERIA.md, progress.md, 上轮 eval report, reference/prd-summary.md, 标杆 Skill (lesson-plan-generator), mcp-server/src/index.ts, solution.json
- **Output**: 修改 SKILL.md + mcp-server/src/index.ts + solution.json + 写 changelog
- **Isolation**: 每轮 fresh context（`claude -p`）

### Evaluator (两阶段)

- **Role**: 独立代码质量评估员
- **Perspective**: 你没有参与创建过程，没有感情投入。基于观察到的事实打分，不打曲线分
- **Input**: EVAL_CRITERIA.md, source files, reference files
- **Output**: eval-reports/v{N}-eval.md

**Phase A（每轮执行）**: 静态分析 D1-D5
- 自动化检查（tsc, JSON parse, grep 禁止 widget, 工具名一致性）
- 人工审查（决策树完整度、mock 推算逻辑、确认流程严密性）

**Phase B（条件执行）**: E2E 测试 D6
- 激活条件: D1-D5 总分 ≥ 53/75
- 启动完整服务栈 → Playwright 执行 6 场景 → 收集 AI 行为日志 → 打分
- 未激活时 D6 = 0，总分仅基于 D1-D5 折算

## Exit Conditions

- **Score threshold**: 总分 ≥ 90/100
- **Max iterations**: 10 轮
- **Diminishing returns**: 连续 2 轮提升 < 3 分
- **Cost cap**: $150
- **Regression**: 分数下降 > 5 分 → 回滚源码到上一版本，不计入 diminishing returns

## Progress Tracking

- **Log file**: `harness-workspace/reschedule-class/progress.md`
- **Per-iteration record**: version, timestamp, total score, D1-D6 per-dimension scores, top issue
- **Git snapshot**: 每轮 generator 产出和 eval 报告各 commit 一次

## Estimated Resource Usage

- **Iterations**: ~6-8 expected（v1-5 静态迭代，v6-8 加入 E2E）
- **Tokens per iteration**: ~30k (generator) + ~15k (evaluator Phase A) + ~25k (evaluator Phase B, conditional)
- **Cost per iteration**: ~$3 (without E2E) / ~$6 (with E2E)
- **Total estimated cost**: ~$30-50
