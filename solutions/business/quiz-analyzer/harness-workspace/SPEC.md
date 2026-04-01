# Spec: Quiz-Analyzer complete-analysis Skill Prompt 优化

## Context

quiz-analyzer 的 `complete-analysis` skill 是主要分析路径，产出 10 个核心 SYNC_FIELD。当前存在三个核心问题：
1. **字段缺失**：某些 write_output 调用失败或被跳过，前端拿不到完整数据
2. **质量不稳定**：同一题目多次分析结果差异大（答案错误、步骤不清晰）
3. **特定类型处理差**：题型分类有误、几何配图 JSON 生成错误

## Artifact

- **文件**: `solutions/business/quiz-analyzer/skills/complete-analysis/SKILL.md`
- **类型**: LLM Skill Prompt（非代码）

## Target Audience

- **教师**：需要准确的知识点标注和解题策略
- **学生**：需要清晰的解题步骤

## Goal

让 complete-analysis 在 benchmark 题目集上稳定达到 **85+** 分（满分 100），字段填充率 100%。

## 10 Core Fields（评估目标）

| # | Field | Type |
|---|-------|------|
| 1 | `correctAnswer` | string |
| 2 | `parsedContent` | {stem, options[], correctAnswer?, quizType} |
| 3 | `quickSummary` | string |
| 4 | `difficultyAssessment` | {score, pitfalls[], reasoning} |
| 5 | `analysisStrategy` | {goal, goalDecomposition, approaches[], chosenApproach, keyInsight} |
| 6 | `solutionSteps` | SolutionStep[] |
| 7 | `knowledgePointTags` | KnowledgePointTag[] |
| 8 | `commonMistakes` | Mistake[] |
| 9 | `knowledgeGapAnalysis` | string (Markdown) |
| 10 | `thinkingProcess` | string (Markdown) |

## Frozen Constraints

1. **不修改 MCP 工具代码**：write_output、parse_quiz_content 等工具实现不变
2. **不修改 Zod schema**：FieldSchemas 验证规则不变，prompt 必须适配当前 schema
3. **不修改其他 skill**：unified-kp-search、geometry-problem-figure 等 skill 的 prompt 不在范围
4. **不修改前端渲染代码**：GeometryFigure.tsx、ParsedContentPanel.tsx 等组件不变
5. **保持 SKILL.md 结构**：必须保留 10 维度分析框架、Mode C/Mode B KP 搜索协议
6. **中文输出**：所有分析内容必须是中文
7. **每轮修改幅度**：不超过 SKILL.md 总行数的 30%（防止大改导致回退）

## Benchmark

- **数据文件**: `harness-workspace/benchmark.json`（12 题）
- **覆盖**: 选择题 3 + 填空题 2 + 解答题 5 + 计算题 2
- **含几何题**: 2 题（需 geometryFigure 输出）
- **难度分布**: 1-4（初中/高中）

## API Invocation

- **Endpoint**: `POST {CCAAS_URL}/api/v1/sessions/{sessionId}/messages`
- **Template**: `complete-analysis`
- **TenantId**: `quiz-analyzer`
- **Message Format**: `完整分析这道题：\n\n{题目内容}`

## 渲染引擎 Bug（不在范围，单独修复）

以下问题需代码修复而非 prompt 优化：
- GeometryFigure.tsx: parent ID 引用不存在时静默失败
- GeometryFigure.tsx: `new Function()` evalExpr 缺少 Math scope
- AnimationSpec: range[0] >= range[1] 时 slider 失效
