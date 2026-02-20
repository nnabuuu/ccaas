#!/bin/bash

# 测试知识点来源分类（source classification）
# 使用真实题目和答案

BASE_URL="http://localhost:3006"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${GREEN}=== 知识点来源分类测试 ===${NC}"
echo ""
echo "测试原则：区分从题干识别的知识点(question) vs 从答案识别的知识点(solution)"
echo ""

# 测试用例1：数学 - 因式分解（最能体现区别）
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}测试用例1: 因式分解题目${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

QUIZ1_CONTENT="解方程 x² + 5x + 6 = 0，用因式分解法"
QUIZ1_ANSWER="原方程化为 (x+2)(x+3) = 0，解得 x₁ = -2, x₂ = -3"

echo -e "${BLUE}题目：${NC}$QUIZ1_CONTENT"
echo -e "${BLUE}答案：${NC}$QUIZ1_ANSWER"
echo ""

echo -e "${MAGENTA}步骤1: 分析题干 → 提取 question 知识点${NC}"
echo "  关键词："
echo "    - '解方程' → 一元二次方程"
echo "    - '因式分解法' → 因式分解"
echo ""

echo -e "${MAGENTA}步骤2: 分析答案 → 识别 solution 知识点${NC}"
echo "  答案特征："
echo "    - 形式: (x+2)(x+3)"
echo "    - 分析: 两个一次因式，系数 2 和 3，和为 5，积为 6"
echo "    - 识别: 十字相乘法因式分解 ✓"
echo ""

echo -e "${MAGENTA}步骤3: 搜索 question 关键词 '方程'${NC}"
result1=$(curl -s -X POST "$BASE_URL/tools/search_knowledge_points" \
    -H 'Content-Type: application/json' \
    -d '{"query":"一元二次方程","limit":3}')
count1=$(echo "$result1" | jq -r '.data.count')
echo "  找到 $count1 个结果："
echo "$result1" | jq -r '.data.knowledgePoints[] | "    - \(.name) (层级:\(.level), ID:\(.id))"'
EQUATION_ID=$(echo "$result1" | jq -r '.data.knowledgePoints[0].id')
echo ""

echo -e "${MAGENTA}步骤4: 搜索 question 关键词 '因式分解'${NC}"
result2=$(curl -s -X POST "$BASE_URL/tools/search_knowledge_points" \
    -H 'Content-Type: application/json' \
    -d '{"query":"因式分解","limit":1}')
echo "$result2" | jq -r '.data.knowledgePoints[] | "    - \(.name) (层级:\(.level), 子节点:\(.children_count)个, ID:\(.id))"'
FACTORIZATION_ID=$(echo "$result2" | jq -r '.data.knowledgePoints[0].id')
CHILDREN_COUNT=$(echo "$result2" | jq -r '.data.knowledgePoints[0].children_count')
echo ""

echo -e "${MAGENTA}步骤5: 展开 '因式分解' (children_count=$CHILDREN_COUNT)${NC}"
result3=$(curl -s -X POST "$BASE_URL/tools/get_children_nodes" \
    -H 'Content-Type: application/json' \
    -d "{\"parentId\":\"$FACTORIZATION_ID\",\"limit\":20}")
echo "  展开后的子节点："
echo "$result3" | jq -r '.data.children[] | "    - \(.name) (层级:\(.level), ID:\(.id))"'
echo ""

echo -e "${MAGENTA}步骤6: 搜索 solution 关键词 '十字相乘'${NC}"
result4=$(curl -s -X POST "$BASE_URL/tools/search_knowledge_points" \
    -H 'Content-Type: application/json' \
    -d '{"query":"十字相乘","limit":3}')
count4=$(echo "$result4" | jq -r '.data.count')
echo "  找到 $count4 个结果："
echo "$result4" | jq -r '.data.knowledgePoints[] | "    - \(.name) (层级:\(.level), ID:\(.id))"'
CROSS_MULTIPLY_ID=$(echo "$result4" | jq -r '.data.knowledgePoints[0].id')
echo ""

echo -e "${MAGENTA}步骤7: 最终标注（带 source 字段）${NC}"
echo ""
echo -e "${GREEN}✓ 标注结果：${NC}"
echo ""

cat << EOF | jq '.'
{
  "quizAnalysis": "本题综合考察一元二次方程和因式分解（十字相乘法）",
  "knowledgePointTags": [
    {
      "id": "$EQUATION_ID",
      "name": "一元二次方程",
      "source": "question",
      "confidence": 0.95,
      "verified": true,
      "level": 5,
      "path": ["初中-数学", "数与代数", "方程与方程组", "一元二次方程"],
      "note": "从题干'解方程'直接识别"
    },
    {
      "id": "$FACTORIZATION_ID",
      "name": "因式分解",
      "source": "question",
      "confidence": 0.85,
      "verified": true,
      "level": 5,
      "path": ["初中-数学", "数与代数", "代数式", "因式分解"],
      "note": "从题干'用因式分解法'识别，但不够具体"
    },
    {
      "id": "$CROSS_MULTIPLY_ID",
      "name": "十字相乘法因式分解",
      "source": "solution",
      "confidence": 0.95,
      "verified": true,
      "level": 6,
      "path": ["初中-数学", "数与代数", "代数式", "因式分解", "十字相乘法因式分解"],
      "note": "从答案形式 (x+2)(x+3) 精确识别！"
    }
  ]
}
EOF

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 测试用例2：物理 - 汽化
echo -e "${YELLOW}测试用例2: 物理题目${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

QUIZ2_CONTENT="物质从液态变为气态的过程叫作汽化。汽化的两种方式是什么？"
QUIZ2_ANSWER="汽化的两种方式是：蒸发和沸腾"

echo -e "${BLUE}题目：${NC}$QUIZ2_CONTENT"
echo -e "${BLUE}答案：${NC}$QUIZ2_ANSWER"
echo ""

echo -e "${MAGENTA}步骤1: 分析题干 → 提取 question 知识点${NC}"
echo "  关键词："
echo "    - '汽化' → 汽化和液化（大类）"
echo ""

echo -e "${MAGENTA}步骤2: 分析答案 → 识别 solution 知识点${NC}"
echo "  答案内容："
echo "    - 明确提到：蒸发、沸腾"
echo "    - 识别: 这是汽化的两种具体方式 ✓"
echo ""

echo -e "${MAGENTA}步骤3: 搜索并展开 '汽化'${NC}"
result5=$(curl -s -X POST "$BASE_URL/tools/search_knowledge_points" \
    -H 'Content-Type: application/json' \
    -d '{"query":"汽化和液化","limit":3}')
echo "$result5" | jq -r '.data.knowledgePoints[] | "    - \(.name) (层级:\(.level), 子节点:\(.children_count)个, ID:\(.id))"'
VAPORIZATION_ID=$(echo "$result5" | jq -r '.data.knowledgePoints[0].id')
echo ""

# 获取子节点
if [ ! -z "$VAPORIZATION_ID" ]; then
    result6=$(curl -s -X POST "$BASE_URL/tools/get_children_nodes" \
        -H 'Content-Type: application/json' \
        -d "{\"parentId\":\"$VAPORIZATION_ID\",\"limit\":10}")
    children_count=$(echo "$result6" | jq -r '.data.children | length')

    if [ "$children_count" -gt 0 ]; then
        echo -e "${MAGENTA}步骤4: 展开后的子节点：${NC}"
        echo "$result6" | jq -r '.data.children[] | "    - \(.name) (层级:\(.level))"'
        echo ""

        EVAPORATION_ID=$(echo "$result6" | jq -r '.data.children[] | select(.name | contains("蒸发")) | .id' | head -1)
        BOILING_ID=$(echo "$result6" | jq -r '.data.children[] | select(.name | contains("沸腾")) | .id' | head -1)
    fi
fi

echo -e "${MAGENTA}步骤5: 最终标注（带 source 字段）${NC}"
echo ""
echo -e "${GREEN}✓ 标注结果：${NC}"
echo ""

cat << EOF | jq '.'
{
  "quizAnalysis": "本题考察汽化的概念和两种具体方式",
  "knowledgePointTags": [
    {
      "id": "$VAPORIZATION_ID",
      "name": "汽化和液化",
      "source": "question",
      "confidence": 0.90,
      "verified": true,
      "level": 3,
      "path": ["初中-物理", "物态变化", "汽化和液化"],
      "note": "从题干'汽化'直接识别"
    },
    {
      "id": "$EVAPORATION_ID",
      "name": "蒸发",
      "source": "solution",
      "confidence": 0.95,
      "verified": true,
      "level": 4,
      "path": ["初中-物理", "物态变化", "汽化和液化", "蒸发"],
      "note": "从答案'蒸发'明确识别"
    },
    {
      "id": "$BOILING_ID",
      "name": "沸腾",
      "source": "solution",
      "confidence": 0.95,
      "verified": true,
      "level": 4,
      "path": ["初中-物理", "物态变化", "汽化和液化", "沸腾"],
      "note": "从答案'沸腾'明确识别"
    }
  ]
}
EOF

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}测试总结${NC}"
echo ""
echo "核心发现："
echo "  1. ${YELLOW}question 知识点${NC} - 从题干识别，通常是大类/父节点"
echo "     • 示例: '一元二次方程', '因式分解', '汽化和液化'"
echo "     • 特点: 学生看题时就能识别"
echo ""
echo "  2. ${YELLOW}solution 知识点${NC} - 从答案识别，通常是精确的子节点"
echo "     • 示例: '十字相乘法因式分解', '蒸发', '沸腾'"
echo "     • 特点: 解题过程中具体使用的方法/概念"
echo ""
echo "  3. ${YELLOW}答案是精确化的关键${NC}"
echo "     • 题干说'因式分解法' → 模糊（10种方法）"
echo "     • 答案 (x+2)(x+3) → 精确识别'十字相乘法' ✓"
echo ""
echo "教学价值："
echo "  • question → 告诉学生'这是什么类型的题'"
echo "  • solution → 告诉学生'需要用什么方法做'"
echo "  • 完整的解题思路引导 🎓"
echo ""
