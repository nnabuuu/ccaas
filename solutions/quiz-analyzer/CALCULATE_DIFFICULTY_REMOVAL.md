# calculate_difficulty 工具清理完成

**清理日期**: 2026-02-06
**状态**: ✅ 完全清理完成

## 背景

在难度字段重构中，我们已经从数值难度（1-5）转向富文本 `DifficultyAnalysis` 结构。`calculate_difficulty` 工具基于公式计算数值难度，不再符合新的设计理念，因此需要完全移除。

## 清理范围

### 1. ✅ solution.json 配置
**文件**: `solution.json`

**修改**: 从 `knowledge-point-matching` skill 的 `allowedTools` 中移除

```diff
"allowedTools": [
  "write_output",
  "get_knowledge_points_tree",
  "verify_knowledge_point_tags",
- "calculate_difficulty",
  "generate_thinking_process_template",
  ...
]
```

**说明**:
- `complete-analysis` skill 已在之前的重构中移除
- `analyze-student-answer` skill 从未引用过此工具

### 2. ✅ Backend 实现清理

**文件**: `backend/src/tools/tools.controller.ts`

**移除内容**:
- Line 20-29: `@Post('calculate_difficulty')` 端点及其实现

**文件**: `backend/src/tools/tools.service.ts`

**移除内容**:
- Line 75-117: `calculateDifficulty()` 方法及其完整实现

**实现细节**:
```typescript
// ❌ 已移除
calculateDifficulty(params: {
  knowledgePointCount: number;
  stepCount: number;
  quizType: string;
}) {
  // Formula: min(5, ceil((kpCount × 0.5 + stepCount × 0.3) × typeWeight))
  // ...
}
```

### 3. ✅ MCP Server 实现清理

**文件**: `mcp-server/src/tools/tools.controller.ts`

**移除内容**:
- Line 67-77: `@Post('tools/calculate_difficulty')` 端点及其实现

**文件**: `mcp-server/src/tools/tools.service.ts`

**移除内容**:
- Line 59-101: `calculateDifficulty()` 方法及其完整实现

**类型定义更新**:
- Line 738-751: `saveCompleteAnalysis` 参数类型更新

```diff
analysis: {
  quizAnalysis?: string;
  knowledgePointTags?: any[];
  thinkingProcess?: string;
  solutionSteps?: any[];
  commonMistakes?: any[];
  knowledgeGapAnalysis?: string;
- difficulty?: number;
- difficultyRationale?: string;
- timeEstimate?: string;
+ difficultyAnalysis?: any;
  relatedQuizzes?: any[];
}
```

## 验证结果

### ✅ 代码引用检查
```bash
grep -r "calculate_difficulty" . --include="*.ts" --include="*.json"
# 结果: 无匹配（文档除外）
```

### ✅ 编译验证
```bash
# Backend
cd backend && npm run build
# ✅ Success

# MCP Server
cd mcp-server && npm run build
# ✅ Success
```

### ✅ Skills 状态

| Skill | 之前引用 | 现在引用 | 状态 |
|-------|----------|----------|------|
| knowledge-point-matching | ✅ | ❌ | 已移除 |
| complete-analysis | ✅ | ❌ | 已移除 |
| analyze-student-answer | ❌ | ❌ | 从未引用 |

## 工具对比

### 旧工具: calculate_difficulty

**功能**: 基于公式计算数值难度（1-5）

**输入**:
```typescript
{
  knowledgePointCount: number;  // 知识点数量
  stepCount: number;             // 解题步骤数
  quizType: string;              // 题型（选择题、填空题等）
}
```

**输出**:
```typescript
{
  difficulty: number;         // 1-5
  label: string;             // "简单"、"较易"、"中等"、"较难"、"困难"
  timeEstimate: string;      // "3-5分钟"、"8-12分钟"等
  formula: string;           // 计算公式
}
```

**公式**:
```
difficulty = min(5, ceil((knowledgePointCount × 0.5 + stepCount × 0.3) × typeWeight))

typeWeight:
- 选择题: 0.8
- 填空题: 1.0
- 解答题: 1.2
- 证明题: 1.5
```

### 新方案: DifficultyAnalysis

**功能**: 富文本难度分析，包含 8 个子维度

**结构**:
```typescript
{
  overview: string;                      // 总体难度概述
  challengingAspects: Array<{            // 挑战性方面
    aspect: string;
    description: string;
    difficulty: "低" | "中" | "高";
    affectedStudents: string;
  }>;
  prerequisiteKnowledge: Array<{         // 前置知识
    topic: string;
    importance: "必需" | "重要" | "有帮助";
    lackImpact: string;
  }>;
  commonDifficulties: string[];          // 常见困难
  timeEstimate: {                        // 分层时间估算
    fastLearner: string;
    averageLearner: string;
    slowLearner: string;
    rationale: string;
  };
  suitableFor: {                         // 适用性
    gradeLevel: string;
    priorKnowledge: string;
    recommendedUse: string;
  };
  teacherNotes?: string;
  studentNotes?: string;
}
```

## 优势对比

| 维度 | 旧工具 (calculate_difficulty) | 新方案 (DifficultyAnalysis) |
|------|-------------------------------|----------------------------|
| **难度表达** | 单一数值 (1-5) | 富文本描述 |
| **时间估算** | 单一时间范围 | 分层估算（快/中/慢学习者） |
| **个性化** | 无 | 按学习者水平分层 |
| **错误预测** | 无 | 包含常见困难和挑战性方面 |
| **前置知识** | 无 | 明确列出前置知识要求 |
| **适用性** | 无 | 包含年级、场景建议 |
| **可解释性** | 公式计算 | 详细文本分析 |

## 相关文档

- `DIFFICULTY_REFACTOR_COMPLETE.md` - 难度字段重构完整文档
- `skills/complete-analysis/SKILL.md` - 包含深度难度分析的 skill prompt
- `backend/src/quizzes/dto/difficulty-analysis.dto.ts` - DifficultyAnalysis 类型定义

## 下一步

1. ✅ **代码清理完成**
2. ⏭️ **数据库迁移** - 添加 `difficulty_analysis` 列，移除旧字段
3. ⏭️ **文档更新** - 更新所有提到 calculate_difficulty 的文档
4. ⏭️ **前端实现** - 实现 DifficultyAnalysis 的展示组件

---

**结论**: `calculate_difficulty` 工具已完全从代码库中移除。新的 `DifficultyAnalysis` 结构提供了更丰富、更个性化的难度分析能力。
