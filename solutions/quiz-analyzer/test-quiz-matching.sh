#!/bin/bash

# 题目与知识点匹配测试

BASE_URL="http://localhost:3006"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== 题目与知识点匹配测试 ===${NC}"
echo ""

# 测试函数
test_quiz_matching() {
    local quiz_id="$1"
    local quiz_content="$2"
    local keywords="$3"

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}题目 $quiz_id:${NC}"
    echo "  内容: $quiz_content"
    echo "  关键词: $keywords"
    echo ""

    # 为每个关键词搜索知识点
    IFS=',' read -ra KEYWORDS <<< "$keywords"
    for keyword in "${KEYWORDS[@]}"; do
        keyword=$(echo "$keyword" | xargs) # trim whitespace
        echo -e "  搜索关键词: ${YELLOW}$keyword${NC}"

        result=$(curl -s -X POST "$BASE_URL/tools/search_knowledge_points" \
            -H 'Content-Type: application/json' \
            -d "{\"query\":\"$keyword\",\"limit\":5}")

        count=$(echo "$result" | jq -r '.data.count')

        if [ "$count" -gt 0 ]; then
            echo -e "    ${GREEN}✓ 找到 $count 个匹配的知识点${NC}"
            echo "$result" | jq -r '.data.knowledgePoints[] | "      - \(.name) (层级:\(.level))"' | head -3
        else
            echo -e "    ${YELLOW}✗ 未找到匹配的知识点${NC}"
        fi
        echo ""
    done
}

# 测试1: 一元二次方程
test_quiz_matching \
    "test-quiz-001" \
    "解方程：x² - 5x + 6 = 0" \
    "方程,二次方程,解方程"

# 测试2: 勾股定理
test_quiz_matching \
    "test-quiz-002" \
    "直角三角形中求斜边" \
    "三角形,勾股定理,直角三角形"

# 测试3: 英语时态
test_quiz_matching \
    "test-quiz-003" \
    "She _____ to school every day" \
    "时态,现在时,动词"

# 测试4: 因式分解
test_quiz_matching \
    "test-quiz-004" \
    "因式分解：x² - 4" \
    "因式分解,平方差,代数"

# 测试5: 自由落体
test_quiz_matching \
    "test-quiz-005" \
    "自由落体运动" \
    "自由落体,运动,力学,速度"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}测试完成！${NC}"
echo ""
echo "建议："
echo "1. 如果找不到匹配的知识点，可以尝试使用更通用的关键词"
echo "2. 可以结合分层导航功能，先定位学科，再搜索具体知识点"
echo "3. 对于专业术语，可以搜索上位概念（如：二次方程 → 方程 → 代数）"
