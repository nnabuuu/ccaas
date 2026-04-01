# Evaluation Criteria — complete-analysis Skill

> 你是一个独立的教育质量审查员。你没有参与 prompt 编写，只评估最终输出。
> 按照以下标准严格评分。

## Scoring Dimensions

### 1. Field Completion (Weight: 25/100)

**What to evaluate**: 10 个核心字段是否全部通过 write_output 且 Zod 验证成功。

| Score | Description |
|-------|-------------|
| 5/5 | 所有 10 个核心字段全部 write_output 成功且 Zod 验证通过 |
| 4/5 | 8-9 个字段成功 |
| 3/5 | 7 个字段成功 |
| 2/5 | 5-6 个字段成功 |
| 1/5 | <5 个字段成功 |

**核心字段清单**: correctAnswer, parsedContent, quickSummary, difficultyAssessment, analysisStrategy, solutionSteps, knowledgePointTags, commonMistakes, knowledgeGapAnalysis, thinkingProcess

**Detection method**: 统计 results JSON 中每题的 `fields` 对象，计算 unique field count。

---

### 2. Answer Correctness (Weight: 20/100)

**What to evaluate**: correctAnswer 与标准答案的一致性，以及 solutionSteps 最终结论与 correctAnswer 的吻合度。

| Score | Description |
|-------|-------------|
| 5/5 | correctAnswer 与标准答案完全一致，solutionSteps 结论与 correctAnswer 吻合 |
| 4/5 | correctAnswer 正确但格式略有差异（如 "A" vs "A. 两个相等的实数根"） |
| 3/5 | correctAnswer 正确但 solutionSteps 结论不完全吻合 |
| 2/5 | correctAnswer 部分正确（如多步骤题目答对一半） |
| 1/5 | correctAnswer 错误，或与 solutionSteps 矛盾 |

**Detection method**:
1. 精确匹配 correctAnswer 与 benchmark expectedAnswer
2. AI 评估 solutionSteps 最后一步的结论是否与 correctAnswer 一致
3. 对选择题，接受答案字母（A/B/C/D）或完整选项文本

---

### 3. Quiz Type Classification (Weight: 15/100)

**What to evaluate**: parsedContent.quizType 是否正确，options 是否完整解析，stem 是否干净。

| Score | Description |
|-------|-------------|
| 5/5 | quizType 正确，options 完整解析，stem 干净（无选项混入题干） |
| 4/5 | quizType 正确，options 基本完整但有轻微格式问题 |
| 3/5 | quizType 正确但 options 解析不完整（如选项顺序错乱或缺失） |
| 2/5 | quizType 正确但 stem 中混入了选项文本 |
| 1/5 | quizType 分错（把选择题分成填空题等） |

**Detection method**:
1. 对比 parsedContent.quizType 与 benchmark 标注的 quizType
2. 对选择题：检查 options 数组长度是否匹配
3. 检查 stem 中是否包含 "A." "B." "C." "D." 等选项标记

---

### 4. Solution Step Quality (Weight: 15/100)

**What to evaluate**: 解题步骤的逻辑性、数学正确性、公式完整性。

| Score | Description |
|-------|-------------|
| 5/5 | 2-5 个步骤，逻辑递进清晰，关键公式完整，每步 description 具体 |
| 4/5 | 步骤完整但某个步骤的 description 可以更详细 |
| 3/5 | 步骤存在但某些步骤过于笼统，或缺少关键公式 |
| 2/5 | 步骤有数学错误或逻辑跳跃 |
| 1/5 | 步骤数学错误，或只有 1 步（过度简化） |

**Detection method**:
1. 检查 solutionSteps 数组长度 (≥2)
2. AI 评估逻辑链完整性
3. 检查 formula 字段是否覆盖关键公式
4. 验证最后一步结论与 correctAnswer 一致

---

### 5. KP Tag Accuracy (Weight: 15/100)

**What to evaluate**: 知识点标签的精准性 — 是否叶节点、confidence 是否合理、覆盖度是否充分。

| Score | Description |
|-------|-------------|
| 5/5 | 1-3 个 KP，全部叶节点，confidence ∈ [0.7, 1.0]，覆盖题目核心知识点 |
| 4/5 | KP 标签准确但多了 1 个无关标签或少了 1 个次要知识点 |
| 3/5 | KP 标签存在但包含非叶子节点，或遗漏一个核心知识点 |
| 2/5 | KP 标签部分相关但不精准（父节点当叶子、覆盖不足） |
| 1/5 | KP 标签全是父节点，或完全不相关 |

**Detection method**:
1. 检查 knowledgePointTags 数组中每个 tag 的 verified 字段
2. 检查 path 数组非空
3. 检查 confidence ∈ [0.7, 1.0]
4. 对比 tag name 与 benchmark expectedKpNames 的相似度
5. 检查 source 字段是否有值（question/solution/both）

---

### 6. Geometry Figure Validity (Weight: 10/100)

**What to evaluate**: 对几何题，geometryFigure JSON 是否有效。

| Score | Description |
|-------|-------------|
| 5/5 | JXG JSON 有效，element ID 引用正确，bbox 合理，与题目几何关系匹配 |
| 4/5 | JSON 有效但 bbox 略大或略小 |
| 3/5 | JSON 有效但某些 element 引用了不存在的 ID |
| 2/5 | JSON 结构有效但与题目描述不匹配 |
| 1/5 | JSON 无效（Zod 验证失败），或对几何题完全不生成 |

**Detection method**:
1. 对非几何题：此维度自动 5/5
2. 对几何题：Zod schema 验证 JXGConstructionSchema
3. 检查 elements 数组中的 parent ID 引用是否指向已定义的 element
4. 检查 bbox 范围是否合理（不过大/过小）

---

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 答案与步骤矛盾 | -10 | correctAnswer 与 solutionSteps 最终结论不一致 |
| 父节点当叶子 | -5/个 | knowledgePointTags 中非叶子节点的标签 |
| 重复字段写入 | -3 | 同一 field 被 write_output 多次 |
| 英文输出 | -5 | 核心分析内容（thinkingProcess、solutionSteps.description）包含大段英文 |

## Score Calculation

1. 每个维度: `(score / 5) × weight`
   - 例: Field Completion 得 4/5 → (4/5) × 25 = 20
   - 例: Answer Correctness 得 5/5 → (5/5) × 20 = 20
2. 基础分: 六个维度加权分之和
3. 扣分: Penalty 扣分
4. **总分 = 基础分 - Penalty 扣分**（满分 100）
5. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Thresholds

- **Pass**: 70/100
- **Target**: 85/100
- **Estimated baseline**: ~55/100
