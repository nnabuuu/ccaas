# Student Answer Analysis Skill

**Version**: 1.0.0
**Status**: Production Ready ✅
**Last Updated**: 2026-02-06

---

## Overview

An AI-powered agent skill that automatically analyzes student answers, identifies error types and error steps, and generates detailed error analysis reports. This skill is a core component of the error-based quiz recommendation system.

## Quick Start

### Trigger the Skill

Use any of these trigger phrases:
- "分析学生答案"
- "检查这道题"
- "学生错在哪里"
- "错误分析"
- "学生做错了"
- "分析错题"

### Example Usage

```
分析学生答案：
题目：解方程 x² - 4 = 0（用因式分解法）
学生答案：x² - 4 = 0
         (x-2)² = 0
         x = 2
```

### Expected Output

The AI will:
1. Fetch quiz details and standard solution
2. Compare student answer step-by-step
3. Identify errors (type, step, severity)
4. Provide correct approach
5. Save analysis to database
6. Optionally recommend similar practice quizzes

## Files in This Directory

| File | Purpose |
|------|---------|
| `SKILL.md` | Comprehensive skill documentation (15KB) |
| `skill.json` | Skill configuration (triggers, allowed tools) |
| `test-cases.json` | 10 test cases covering all error types |
| `README.md` | This file (quick reference) |

## Error Types Supported

12 predefined error types:

1. **concept_misunderstanding** - 概念理解错误
2. **calculation_error** - 计算错误
3. **formula_misuse** - 公式应用错误
4. **step_omission** - 步骤遗漏
5. **step_order_wrong** - 步骤顺序错误
6. **condition_neglect** - 条件遗漏
7. **reasoning_error** - 推理错误
8. **symbol_confusion** - 符号混淆
9. **unit_conversion_error** - 单位换算错误
10. **range_error** - 取值范围错误
11. **special_case_neglect** - 特殊情况遗漏
12. **other** - 其他（需详细描述）

## MCP Tools Used

Primary tools:
- `analyze_student_answer` - Get quiz info and save analysis
- `get_quiz_details` - Fetch quiz details
- `search_knowledge_points` - Find knowledge point IDs

Supporting tools:
- `get_knowledge_points_tree` - Browse knowledge hierarchy
- `get_node_path` - Get knowledge point path
- `recommend_by_error_pattern` - Get similar quiz recommendations
- `get_error_statistics` - View error statistics

## Output Format

Follows `StudentAnswer` TypeScript interface:

```typescript
{
  id: string,              // UUID
  quizId: string,
  sessionId: string,
  answerContent: string,
  stepsAttempted: string[],
  submittedAt: string,     // ISO timestamp
  isCorrect: boolean,
  errorSteps: [
    {
      stepNumber: number,
      errorType: ErrorType,
      errorDescription: string,
      affectedKnowledgePoints: string[],
      severity: "critical" | "major" | "minor",
      correctApproach: string
    }
  ]
}
```

## Testing

### Test Cases Included

10 comprehensive test cases in `test-cases.json`:
- Formula misuse (critical)
- Step omission (minor)
- Condition neglect (major)
- Calculation error (critical)
- Concept misunderstanding (critical)
- Step order wrong (major)
- Reasoning error (critical)
- Special case neglect (major)
- Correct answer (no error)
- Unit conversion error (critical)

### Run Tests

```bash
# Manual testing
# 1. Start MCP server: cd mcp-server && npm start
# 2. Trigger skill with test case input
# 3. Verify output matches expected analysis

# Automated testing (future)
# npm test skills/analyze-student-answer
```

## Performance

### Response Time Targets

| Complexity | Target |
|------------|--------|
| Simple (1 error) | < 2 seconds |
| Moderate (2-3 errors) | < 5 seconds |
| Complex (4+ errors) | < 10 seconds |

### Accuracy Targets

| Metric | Target |
|--------|--------|
| Error Type Classification | > 85% |
| Step Number Identification | > 90% |
| Severity Judgment | > 80% |

## Integration

### Error Pattern Aggregation

Analysis results are automatically aggregated into `error_patterns` table:
- Tracks total occurrences per error type
- Counts unique students who made same error
- Stores example error descriptions
- Updates statistics in real-time

### Recommendation Engine

After analysis, use `recommend_by_error_pattern` to:
- Find quizzes with similar error patterns
- Calculate 3-factor similarity (error type + step + knowledge point)
- Get natural language recommendation reasons
- Prioritize high-frequency errors for targeted practice

### Teacher Dashboard (Future)

Error statistics displayed in teacher dashboard:
- Most common errors per quiz
- Error distribution by type
- Error trend over time
- Student segmentation by error pattern

## Troubleshooting

### Skill Not Triggering

**Problem**: AI doesn't recognize the trigger phrase

**Solution**:
- Use exact trigger phrases listed above
- Check `solution.json` has `analyze-student-answer` skill registered
- Verify skill priority (should be 8-10)

### Incorrect Error Classification

**Problem**: AI misclassifies error type

**Solution**:
- Check student answer format is clear
- Verify standard answer exists in database
- Review error description in `SKILL.md`
- Provide more context in prompt

### Missing Standard Answer

**Problem**: Quiz doesn't have standard solution

**Solution**:
- AI will note "standard answer missing"
- Analysis continues based on quiz content
- Accuracy may be lower
- Recommended to add standard answer to database

## Contributing

### Adding New Error Types

1. Update `ErrorType` enum in `mcp-server/src/types.ts`
2. Add error type to `SKILL.md` error type table
3. Update prompt template with examples
4. Add test case to `test-cases.json`
5. Update validation schemas

### Improving Prompt

1. Collect real failure cases
2. Analyze why AI misclassified
3. Update prompt in `SKILL.md`
4. Add clarifying examples
5. Test with historical cases

### Adding Test Cases

1. Add new test case to `test-cases.json`
2. Include quiz, student answer, expected analysis
3. Add tags for categorization
4. Document in test scenarios

## Resources

- **Skill Documentation**: `SKILL.md` (15KB, 600+ lines)
- **Configuration**: `skill.json`
- **Test Cases**: `test-cases.json` (10 cases, 3 scenarios)
- **Phase 5 Complete**: `../../PHASE_5_AGENT_SKILL_COMPLETE.md`
- **Implementation Summary**: `../../ERROR_BASED_RECOMMENDATION_IMPLEMENTATION_SUMMARY.md`

## Version History

### v1.0.0 (2026-02-06)
- ✅ Initial release
- ✅ 12 error types supported
- ✅ 7-step analysis workflow
- ✅ 10 comprehensive test cases
- ✅ Integration with error pattern aggregation
- ✅ MCP tools configured
- ✅ Quality checklist implemented

---

**Maintainer**: Quiz Analyzer Team
**Contact**: See main project README
**License**: Same as Quiz Analyzer project
