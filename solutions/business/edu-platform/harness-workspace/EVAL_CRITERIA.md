# Evaluation Criteria — Edu-Platform Skill + MCP + Documentation

> 你是一个独立的教育平台质量审查员。你没有参与编写，只评估最终输出。
> 按照以下标准严格评分。所有检查均为静态分析 + 1 项自动化（TypeScript 编译）。

## Scoring Dimensions (7 dimensions, 100 pts)

### D1: Lesson Plan Skill Quality (Weight: 15/100)

**What to evaluate**: lesson-plan-generator/SKILL.md 是否正确使用 MCP 工具，匹配 chat-interface.html 交互流。

| Score | Description |
|-------|-------------|
| 5/5 | 使用 show_info_card（含 outline + bar_list + actions sections），使用 suggest_actions，使用 generate_docx，工具调用序列完整 |
| 4/5 | 工具使用正确但 show_info_card 的 section 参数示例不够详细 |
| 3/5 | 使用了 show_info_card 但 section types 使用不完整（如缺 bar_list） |
| 2/5 | 部分工具缺失或使用方式错误 |
| 1/5 | 仍使用旧 widget 或未使用 show_info_card |

**Detection method**:
1. `grep -c 'show_info_card' SKILL.md` → 必须 ≥ 1
2. `grep -c 'suggest_actions' SKILL.md` → 必须 ≥ 1
3. `grep -c 'generate_docx' SKILL.md` → 必须 ≥ 1
4. 检查 show_info_card 参数中是否包含 `outline`、`bar_list`、`actions` 三种 section type
5. 检查工具使用表是否列出所有 7 个可用工具

---

### D2: Quiz Generator Skill Quality (Weight: 15/100)

**What to evaluate**: quiz-generator/SKILL.md 是否完全移除了不存在的 widget，正确使用 show_info_card + suggest_actions。

| Score | Description |
|-------|-------------|
| 5/5 | 零 non-existent widgets，使用 show_info_card（含 actions section 替代 FormCollect），使用 curriculum_tree + show_info_card 替代 TreeSelector，使用 suggest_actions 提供后续操作 |
| 4/5 | 移除了 widget 但 show_info_card 参数不够详细 |
| 3/5 | 部分 widget 已替换，但仍残留 1 个 non-existent widget 引用 |
| 2/5 | 仍大量引用 FormCollect 或 TreeSelector |
| 1/5 | 未修改，完全保留旧 widget |

**Detection method**:
1. `grep -c 'FormCollect' SKILL.md` → 必须 = 0
2. `grep -c 'TreeSelector' SKILL.md` → 必须 = 0
3. `grep -c 'show_info_card' SKILL.md` → 必须 ≥ 1
4. `grep -c 'suggest_actions' SKILL.md` → 必须 ≥ 1
5. `grep -c 'curriculum_tree' SKILL.md` → 必须 ≥ 1
6. 检查是否有 JSON 示例展示 show_info_card 的 sections 参数

---

### D3: Student Analysis Skill Quality (Weight: 15/100)

**What to evaluate**: student-analysis/SKILL.md 是否完全移除了不存在的 widget，正确使用 show_info_card 展示 metrics + bar_list。

| Score | Description |
|-------|-------------|
| 5/5 | 零 non-existent widgets，使用 show_info_card（含 metrics section 替代 MetricDashboard + bar_list section 替代 BarList），使用 suggest_actions 提供后续操作 |
| 4/5 | 移除了 widget 但 show_info_card 参数不够详细 |
| 3/5 | 部分 widget 已替换，但仍残留 1 个 non-existent widget 引用 |
| 2/5 | 仍大量引用 MetricDashboard 或 BarList |
| 1/5 | 未修改，完全保留旧 widget |

**Detection method**:
1. `grep -c 'MetricDashboard' SKILL.md` → 必须 = 0
2. `grep -c 'BarList' SKILL.md` → 必须 = 0
3. `grep -c 'show_info_card' SKILL.md` → 必须 ≥ 1
4. `grep -c 'suggest_actions' SKILL.md` → 必须 ≥ 1
5. 检查 show_info_card 参数中是否包含 `metrics` 和 `bar_list` section types
6. 检查 metrics section 是否包含四个核心指标（平均分、及格率、优秀率、总人数）

---

### D4: MCP Server Correctness (Weight: 10/100)

**What to evaluate**: MCP server TypeScript 编译通过，show_info_card section types 覆盖 SKILL.md 中使用的所有类型。

| Score | Description |
|-------|-------------|
| 5/5 | `npx tsc --noEmit` 通过，show_info_card enum 包含所有 SKILL.md 使用的 section types |
| 4/5 | 编译通过但 enum 缺少 1 个 section type |
| 3/5 | 编译通过但 enum 覆盖不全 |
| 2/5 | 编译有 warnings（非 error） |
| 1/5 | 编译失败 |

**Detection method**:
1. `cd mcp-server && npx tsc --noEmit` — 必须返回 exit code 0
2. 从 index.ts 提取 show_info_card enum: `grep -oP "enum.*\[.*\]" index.ts`
3. 从 3 个 SKILL.md 提取使用的 section types（outline, bar_list, metrics, actions, text）
4. 交叉验证：SKILL.md 使用的每个 type 都在 enum 中

---

### D5: Interaction Pattern Fidelity (Weight: 15/100)

**What to evaluate**: 3 个 Skill 是否遵循 CCAAS 平台约定的交互模式。

| Score | Description |
|-------|-------------|
| 5/5 | 全部 3 个 Skill 使用 show_info_card 展示结构化数据，suggest_actions 提供后续操作，write_output 同步面板，generate_docx 生成文件（lesson-plan），无任何虚构 widget |
| 4/5 | 3 个 Skill 都正确但某个 Skill 缺少 suggest_actions 调用 |
| 3/5 | 2 个 Skill 正确，1 个仍有交互模式问题 |
| 2/5 | 只有 1 个 Skill 完全正确 |
| 1/5 | 所有 Skill 都有交互模式问题 |

**Detection method**:
1. 对每个 SKILL.md 检查：
   - `grep -c 'show_info_card'` ≥ 1
   - `grep -c 'suggest_actions'` ≥ 1
2. 全局检查：`grep -rn 'FormCollect\|TreeSelector\|MetricDashboard\|BarList' skills/*/SKILL.md` → 必须 = 0
3. lesson-plan-generator 额外检查：`grep -c 'generate_docx'` ≥ 1, `grep -c 'write_output'` ≥ 1
4. 交叉验证：每个 Skill 的工具使用与 MCP index.ts 中的 tool 定义一致

---

### D6: Solution Documentation (Weight: 20/100)

**What to evaluate**: 4 个文档文件是否存在且内容有意义。

| Score | Description |
|-------|-------------|
| 5/5 | 全部 4 个文件存在，每个文件内容覆盖关键章节（见下方 checklist），总字数 ≥ 2000 |
| 4/5 | 4 个文件存在，内容基本覆盖但某个文件缺少 1-2 个关键章节 |
| 3/5 | 3 个文件存在且有意义，1 个缺失或内容过于简略（<100 字） |
| 2/5 | 2 个文件存在 |
| 1/5 | ≤ 1 个文件存在 |

**Detection method**:

文件存在性检查：
```bash
test -f README.md && echo "README exists"
test -f SOLUTION_DESIGN.md && echo "DESIGN exists"
test -f CLAUDE.md && echo "CLAUDE exists"
test -f mcp-server/README.md && echo "MCP README exists"
```

内容覆盖 checklist：

**README.md** 必须包含：
- [ ] Solution 概述（grep: `概述\|Overview\|简介`）
- [ ] 环境要求 / 启动说明（grep: `启动\|setup\|安装\|环境`）
- [ ] 3 个 Skill 的说明（grep: `lesson-plan\|quiz-generator\|student-analysis`）
- [ ] MCP 工具列表（grep: `curriculum_tree\|student_proficiency\|show_info_card`）

**SOLUTION_DESIGN.md** 必须包含：
- [ ] 设计决策（grep: `设计\|Design\|决策`）
- [ ] 交互模式说明（grep: `show_info_card\|交互\|interaction`）
- [ ] 多 Skill 协同（grep: `skill\|技能\|协同`）

**CLAUDE.md** 必须包含：
- [ ] 关键规则（grep: `规则\|Rule\|Critical`）
- [ ] 常见任务（grep: `任务\|Task\|常见`）

**mcp-server/README.md** 必须包含：
- [ ] 工具列表（grep: `curriculum_tree\|student_proficiency\|write_output`）
- [ ] 输入 schema 说明（grep: `schema\|参数\|input`）

---

### D7: solution.json & Config (Weight: 10/100)

**What to evaluate**: solution.json 格式正确，skills/mcpServers/sessionTemplates 配置完整。

| Score | Description |
|-------|-------------|
| 5/5 | JSON 解析通过，3 个 skill slug 全部与 skills/ 目录匹配，mcpServers 配置正确，sessionTemplate 包含全部 3 个 skill |
| 4/5 | JSON 正确但 sessionTemplate 缺少 1 个 skill |
| 3/5 | JSON 正确但 skill slug 有 1 个不匹配 |
| 2/5 | JSON 正确但 mcpServers 配置有误 |
| 1/5 | JSON 解析失败 |

**Detection method**:
1. `node -e "JSON.parse(require('fs').readFileSync('solution.json','utf8'))"` — 必须成功
2. 提取 skills[].slug 列表，对比 `ls skills/` 目录名
3. 检查 mcpServers 中有 `edu-tools` 且 command/args 正确
4. 检查 sessionTemplates 的 enabledSkills 包含全部 3 个 skill slug

---

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 残留虚构 widget | -5/个 | SKILL.md 中出现 FormCollect / TreeSelector / MetricDashboard / BarList |
| show_info_card section type 拼写错误 | -3/个 | section type 不在 [outline, bar_list, metrics, actions, text] 中 |
| 文档抄袭 quiz-analyzer | -5 | README/DESIGN 中出现 "quiz-analyzer" 相关内容未替换 |
| JSON 示例语法错误 | -3/个 | SKILL.md 中的 JSON 代码块无法解析 |

## Score Calculation

1. 每个维度: `(score / 5) × weight`
   - 例: D1 得 4/5 → (4/5) × 15 = 12
   - 例: D6 得 5/5 → (5/5) × 20 = 20
2. 基础分: 7 个维度加权分之和
3. 扣分: Penalty 扣分
4. **总分 = 基础分 - Penalty 扣分**（满分 100）
5. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Thresholds

- **Pass**: 70/100
- **Target**: 85/100
- **Estimated baseline**: ~25/100（quiz-generator 和 student-analysis 使用错误 widget，无文档）
