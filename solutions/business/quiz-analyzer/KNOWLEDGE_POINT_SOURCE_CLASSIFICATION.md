# 知识点来源分类：题干 vs 解题过程

## 核心概念

将知识点分为三类来源：

| 来源类型 | 说明 | 教学意义 |
|---------|------|---------|
| **question** | 从题干文本直接识别的知识点 | 学生看到题目就应该能识别的 → "这是什么类型的题" |
| **solution** | 从答案/解题过程识别的知识点 | 解题时需要用到的方法 → "需要用什么方法做" |
| **both** | 题干暗示 + 答案确认的知识点 | 既是题目类型，又是解题方法 |

## 为什么这样分类？

### 教学价值

**引导学生解题思路**：

```
第一步：读题 → 识别 question 知识点
  ↓ "哦，这是一元二次方程题"

第二步：思考方法 → question 知识点提示可能的方向
  ↓ "题目说用因式分解，但具体用哪种方法？"

第三步：解题 → solution 知识点揭示具体方法
  ↓ "答案是 (x+2)(x+3)，原来要用十字相乘法"
```

### 实际示例

**题目**："用因式分解法解方程 x² + 5x + 6 = 0"
**答案**："(x+2)(x+3) = 0, 所以 x = -2 或 x = -3"

#### 传统标注（无来源区分）
```json
[
  "一元二次方程",
  "因式分解"  // ← 太笼统！不知道具体方法
]
```
**问题**：学生不知道该用哪种因式分解方法

#### 改进标注（有来源区分）
```json
[
  {
    "name": "一元二次方程",
    "source": "question",  // ← 从题干识别
    "confidence": 0.95,
    "level": 5
  },
  {
    "name": "因式分解",
    "source": "question",  // ← 从题干"用因式分解法"识别
    "confidence": 0.85,
    "level": 5
  },
  {
    "name": "十字相乘法因式分解",
    "source": "solution",  // ← 从答案 (x+2)(x+3) 识别！
    "confidence": 0.95,
    "level": 6
  }
]
```
**价值**：
- 学生看题 → 知道是"一元二次方程 + 因式分解"
- 学生解题 → 知道具体要用"十字相乘法"

## 如何结合答案确定子知识点

### 策略：答案是精确化的关键

**原则**：
> 题干告诉我们"做什么"，答案告诉我们"怎么做"

### 流程

```
1. 分析题干
   → 提取 question 知识点（通常是父节点或大类）

2. 分析答案格式/特征
   → 推断 solution 知识点（通常是精确的子节点）

3. 结合两者
   → 给出完整的知识点标注
```

### 示例1：因式分解方法识别

**题目**："用因式分解法解方程"

#### 答案形式 → 精确方法

| 答案形式 | 识别出的方法 | source |
|---------|------------|--------|
| `(x+2)(x+3) = 0` | 十字相乘法 | solution |
| `(x-2)(x+2) = 0` | 平方差公式 | solution |
| `(x+3)² = 0` | 完全平方公式 | solution |
| `x(x+5) = 0` | 提公因式法 | solution |

#### 完整标注示例

**题目**："解方程 x² - 4 = 0"
**答案**："(x-2)(x+2) = 0, x = ±2"

```json
{
  "knowledgePointTags": [
    {
      "name": "一元二次方程",
      "source": "question",  // 从题干识别
      "confidence": 0.95,
      "level": 5,
      "path": ["初中-数学", "数与代数", "方程与方程组", "一元二次方程"]
    },
    {
      "name": "因式分解",
      "source": "question",  // 从解题方向识别
      "confidence": 0.85,
      "level": 5,
      "path": ["初中-数学", "数与代数", "代数式", "因式分解"]
    },
    {
      "name": "平方差公式法因式分解",
      "source": "solution",  // ← 从答案 (x-2)(x+2) 识别！
      "confidence": 0.98,
      "level": 7,
      "path": ["初中-数学", "数与代数", "代数式", "因式分解", "公式法因式分解", "平方差公式法因式分解"]
    }
  ]
}
```

### 示例2：几何定理识别

**题目**："在三角形ABC中，求边AB的长度"
**答案**："由勾股定理：AB² = AC² + BC² = 9 + 16 = 25, 所以 AB = 5"

```json
{
  "knowledgePointTags": [
    {
      "name": "三角形",
      "source": "question",  // 从题干识别
      "confidence": 0.90,
      "level": 4
    },
    {
      "name": "直角三角形",
      "source": "solution",  // 从答案"勾股定理"推断
      "confidence": 0.85,
      "level": 5
    },
    {
      "name": "勾股定理",
      "source": "solution",  // 从答案明确识别
      "confidence": 0.98,
      "level": 6
    }
  ]
}
```

### 示例3：函数问题

**题目**："已知函数 f(x)，求..."
**答案**："这是二次函数，顶点坐标为..."

```json
{
  "knowledgePointTags": [
    {
      "name": "函数",
      "source": "question",
      "confidence": 0.85,
      "level": 3
    },
    {
      "name": "二次函数",
      "source": "solution",  // 从答案识别具体类型
      "confidence": 0.95,
      "level": 5
    },
    {
      "name": "二次函数的顶点",
      "source": "solution",  // 从答案中"顶点坐标"识别
      "confidence": 0.92,
      "level": 6
    }
  ]
}
```

## 答案分析指南

### 答案特征 → 知识点映射

#### 数学

| 答案特征 | 可识别的知识点 | 示例 |
|---------|--------------|------|
| `(a+b)(a-b)` | 平方差公式 | x² - 4 = (x+2)(x-2) |
| `(a+b)²` | 完全平方公式 | x² + 6x + 9 = (x+3)² |
| `a(...)` | 提公因式法 | 3x² + 6x = 3x(x+2) |
| `(x+a)(x+b)` | 十字相乘法 | x² + 5x + 6 = (x+2)(x+3) |
| `sin/cos/tan` | 三角函数 | sinθ = 3/5 |
| `x = (-b±√...)/2a` | 求根公式 | 一元二次方程求根公式 |
| `对称轴 x = ...` | 二次函数对称轴 | 对称轴 x = -b/2a |

#### 物理

| 答案特征 | 可识别的知识点 |
|---------|--------------|
| `F = ma` | 牛顿第二定律 |
| `W = Fs` | 功的计算 |
| `P = W/t` | 功率 |
| `ρ = m/V` | 密度 |

#### 化学

| 答案特征 | 可识别的知识点 |
|---------|--------------|
| `H₂O → H₂ + O₂` | 化学方程式配平 |
| `氧化还原反应` | 氧化还原 |
| `质量守恒` | 质量守恒定律 |

## 更新 Skill 工作流

### 原工作流（7步）
```
1. 分析题目
2. 全局搜索
3. 展开节点
4. 构建候选池
5. 从候选池多选
6. 验证输出
```

### 新工作流（8步）

```
1. 分析题干
   → 提取 question 知识点

2. 分析答案/解题过程
   → 识别 solution 知识点
   ← ⭐ 新增步骤！

3. 全局搜索
   → 对 question + solution 关键词都搜索

4. 展开节点
   → 特别关注 solution 关键词对应的子节点

5. 构建候选池

6. 从候选池多选
   → 标注每个知识点的 source

7. 验证输出
   → 检查是否有 solution 知识点

8. 输出结果
```

## 实战案例

### 案例1：完整流程演示

**题目**："用因式分解法解方程 x² + 5x + 6 = 0"
**答案**："原方程化为 (x+2)(x+3) = 0，解得 x₁ = -2, x₂ = -3"

#### 步骤1：分析题干
```
关键词：
- "方程" → 一元二次方程 (question)
- "因式分解法" → 因式分解 (question)
```

#### 步骤2：分析答案 ⭐ 关键！
```
答案形式：(x+2)(x+3)
特征：两个一次因式相乘，系数为 2 和 3，和为 5，积为 6
识别：十字相乘法因式分解 (solution)
```

#### 步骤3-4：搜索 + 展开
```bash
# 搜索 "一元二次方程"
search("一元二次方程")
→ 找到节点 (level 5)

# 搜索 "因式分解"
search("因式分解")
→ 找到节点 (level 5, children_count = 10)

# ⭐ 展开 "因式分解"
get_children_nodes("因式分解ID")
→ 返回 10 个子节点：
  - 十字相乘法因式分解 ← 匹配答案特征！
  - 公式法因式分解
  - 提公因式法因式分解
  - ...
```

#### 步骤5-6：多选 + 标注来源
```json
{
  "knowledgePointTags": [
    {
      "name": "一元二次方程",
      "source": "question",  // ← 从题干
      "confidence": 0.95,
      "level": 5
    },
    {
      "name": "因式分解",
      "source": "question",  // ← 从题干
      "confidence": 0.85,
      "level": 5
    },
    {
      "name": "十字相乘法因式分解",
      "source": "solution",  // ← 从答案！
      "confidence": 0.95,
      "level": 6
    }
  ]
}
```

### 案例2：无答案时的处理

**题目**："用因式分解法解方程 x² + 5x + 6 = 0"
**答案**：未提供

#### 标注结果（Fallback）
```json
{
  "knowledgePointTags": [
    {
      "name": "一元二次方程",
      "source": "question",
      "confidence": 0.95,
      "level": 5
    },
    {
      "name": "因式分解",
      "source": "question",
      "confidence": 0.70,  // ← 降低置信度
      "level": 5,
      "note": "题目未明确具体方法，且无答案可供分析。可能涉及：十字相乘法、公式法。建议提供答案以确定精确方法。"
      //      ↑ 说明无法从答案分析
    }
  ]
}
```

## 教学应用场景

### 场景1：自动生成解题提示

```typescript
function generateHint(quiz, knowledgePoints) {
  const questionKPs = knowledgePoints.filter(kp => kp.source === 'question');
  const solutionKPs = knowledgePoints.filter(kp => kp.source === 'solution');

  return {
    step1: `识别题型：这是关于 ${questionKPs.map(k => k.name).join('、')} 的题目`,
    step2: `解题方法：需要用到 ${solutionKPs.map(k => k.name).join('、')}`,
    step3: `具体步骤：[基于 solution 知识点生成详细步骤]`
  };
}

// 输出：
// step1: "识别题型：这是关于一元二次方程、因式分解的题目"
// step2: "解题方法：需要用到十字相乘法因式分解"
// step3: "具体步骤：1. 找两个数，和为5，积为6..."
```

### 场景2：智能题目推荐

```typescript
// 推荐同类型题目（相同 question 知识点）
function recommendSimilarQuiz(knowledgePoints) {
  const questionKPs = knowledgePoints.filter(kp => kp.source === 'question');
  return searchQuizzes({ knowledgePoints: questionKPs.map(k => k.id) });
}

// 推荐练习方法（相同 solution 知识点）
function recommendMethodPractice(knowledgePoints) {
  const solutionKPs = knowledgePoints.filter(kp => kp.source === 'solution');
  return searchQuizzes({ knowledgePoints: solutionKPs.map(k => k.id) });
}
```

### 场景3：错题分析

```typescript
function analyzeWrongAnswer(quiz, studentAnswer, correctAnswer, knowledgePoints) {
  const solutionKPs = knowledgePoints.filter(kp => kp.source === 'solution');

  if (studentAnswer !== correctAnswer) {
    return {
      problem: `学生未能正确应用 ${solutionKPs[0].name}`,
      suggestion: `建议复习 ${solutionKPs[0].name} 的相关知识和练习`,
      relatedTopics: solutionKPs.map(k => k.path.join(' > '))
    };
  }
}
```

## 总结

### 核心价值

1. **答案是精确化的关键**
   - 题干可能模糊（"因式分解法"）
   - 答案揭示精确方法（"(x+2)(x+3)" → 十字相乘法）

2. **来源分类有教学意义**
   - `question` → 学生看题时识别的（题目类型）
   - `solution` → 解题时需要的（具体方法）
   - 帮助构建完整的解题思路

3. **避免笼统标注**
   - 旧：只标注"因式分解"（太笼统）
   - 新：标注"因式分解"(question) + "十字相乘法"(solution)

### 更新清单

✅ **类型定义**：
- `KnowledgePointTag` 添加 `source` 字段

✅ **Schema 验证**：
- 验证 `source: 'question' | 'solution' | 'both'`

✅ **文档**：
- `KNOWLEDGE_POINT_SOURCE_CLASSIFICATION.md` - 完整说明

### 下一步

需要更新：
- [ ] `SKILL_KNOWLEDGE_POINT_MATCHING.md` - 添加答案分析步骤
- [ ] 输出示例 - 所有示例添加 `source` 字段
- [ ] 检查清单 - 添加"是否分析了答案"

### 金句

> **"题干告诉我们'做什么'，答案告诉我们'怎么做'"**
> —— 结合答案，精确化知识点标注
