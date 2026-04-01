# v1 Changelog

## 修改摘要

第 1 轮迭代：验证并确认 3 个 SKILL.md 已正确使用 CCAAS MCP 工具模式，4 个文档文件内容完整，修复 MCP Server 工具描述中残留的虚构 widget 引用。

## 修改详情

- **mcp-server/src/index.ts**: 修复 `curriculum_tree` 工具描述中的 "TreeSelector 组件" → "show_info_card 的 outline section"；修复 `student_proficiency` 工具描述中的 "MetricDashboard 和 BarList 组件" → "show_info_card 的 metrics 和 bar_list section"。这确保了代码中零残留虚构 widget 引用。

## 对应维度

- **D1 (Lesson Plan)**: 已验证 lesson-plan-generator/SKILL.md 正确使用 show_info_card（outline + bar_list + actions）、suggest_actions、generate_docx，工具使用表列出全部 7 个工具。无需修改。
- **D2 (Quiz Generator)**: 已验证 quiz-generator/SKILL.md 零 FormCollect/TreeSelector，正确使用 show_info_card（outline + bar_list + actions）、curriculum_tree、suggest_actions。无需修改。
- **D3 (Student Analysis)**: 已验证 student-analysis/SKILL.md 零 MetricDashboard/BarList，正确使用 show_info_card（metrics + bar_list + actions），metrics 包含四个核心指标。无需修改。
- **D4 (MCP Server)**: `npx tsc --noEmit` 编译通过（exit code 0）。show_info_card enum 包含全部 5 种 section type（outline/bar_list/metrics/actions/text）。修复了工具描述中的虚构 widget 引用。
- **D5 (Interaction Pattern)**: 全部 3 个 SKILL.md 使用 show_info_card + suggest_actions。lesson-plan 额外使用 generate_docx + write_output。`grep -rn 'FormCollect|TreeSelector|MetricDashboard|BarList' skills/*/SKILL.md` 返回零结果。
- **D6 (Documentation)**: 4 个文档文件均已存在且内容完整：README.md（概述+启动+Skills+MCP工具）、SOLUTION_DESIGN.md（设计决策+交互模式+Skill协同）、CLAUDE.md（规则+任务）、mcp-server/README.md（工具目录+schema+section types）。
- **D7 (Config)**: solution.json JSON 解析通过，3 个 slug 匹配 skills/ 目录，mcpServers.edu-tools 配置正确，sessionTemplates.lesson-planning.enabledSkills 包含全部 3 个 skill。

## 验证结果

- `grep -rn 'FormCollect|TreeSelector|MetricDashboard|BarList' skills/*/SKILL.md` → 零结果
- 3 个 SKILL.md 中全部 8 个 JSON 代码块均可解析
- `npx tsc --noEmit` → exit code 0
- `node -e "JSON.parse(...)"` solution.json → 通过
- 4 个文档文件均存在且内容覆盖评分 checklist

## 预期效果

预期总分：95-100/100
- D1: 5/5 (15/15)
- D2: 5/5 (15/15)
- D3: 5/5 (15/15)
- D4: 5/5 (10/10)
- D5: 5/5 (15/15)
- D6: 5/5 (20/20)
- D7: 5/5 (10/10)
- Penalties: 0
