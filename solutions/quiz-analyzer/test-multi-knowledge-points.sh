#!/bin/bash

# 多知识点题目匹配测试
# 演示如何使用层级导航识别涉及多个知识点的题目

BASE_URL="http://localhost:3006"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}=== 多知识点题目匹配测试 ===${NC}"
echo ""
echo "演示：如何识别一道涉及多个知识点的综合题"
echo ""

# 模拟题目
echo -e "${CYAN}【示例题目】${NC}"
echo "解方程 x² - 4 = 0，并说明这是哪种因式分解方法"
echo ""
echo -e "${YELLOW}分析：这道题涉及多个知识点${NC}"
echo "  1. 一元二次方程"
echo "  2. 因式分解"
echo "  3. 平方差公式"
echo ""

echo -e "${BLUE}━━━ 方法1: 扁平搜索（有遗漏）━━━${NC}"
echo ""

# 方法1: 只搜索"方程"
echo -e "搜索关键词: ${YELLOW}方程${NC}"
result=$(curl -s -X POST "$BASE_URL/tools/search_knowledge_points" \
    -H 'Content-Type: application/json' \
    -d '{"query":"方程","limit":3}')
echo "$result" | jq -r '.data.knowledgePoints[] | "  ✓ \(.name) (层级:\(.level))"'
echo ""
echo -e "${RED}问题：找到了'方程'相关知识点，但遗漏了'因式分解'和'平方差'！${NC}"
echo ""

echo -e "${BLUE}━━━ 方法2: 层级导航（完整覆盖）━━━${NC}"
echo ""

# 步骤1: 获取数学的根分类
echo -e "${CYAN}步骤1: 获取数学科目的一级分类${NC}"
subjects=$(curl -s -X POST "$BASE_URL/tools/get_root_categories" \
    -H 'Content-Type: application/json' \
    -d '{"limit":100}')

math_id=$(echo "$subjects" | jq -r '.data.categories[] | select(.name | contains("数学")) | .id' | head -1)
echo "找到数学科目 ID: $math_id"
echo ""

# 步骤2: 获取数学的二级分类
echo -e "${CYAN}步骤2: 获取数学的章节（二级分类）${NC}"
chapters=$(curl -s -X POST "$BASE_URL/tools/get_children_nodes" \
    -H 'Content-Type: application/json' \
    -d "{\"subjectId\":\"$math_id\",\"parentId\":null,\"limit\":100}")

echo "$chapters" | jq -r '.data.children[] | "  - \(.name) (子节点:\(.children_count)个)"' | head -10
echo ""

# 找到"数与代数"分支
algebra_id=$(echo "$chapters" | jq -r '.data.children[] | select(.name | contains("数与代数") or contains("代数")) | .id' | head -1)

if [ ! -z "$algebra_id" ]; then
    echo -e "${CYAN}步骤3: 展开'数与代数'章节${NC}"
    algebra_children=$(curl -s -X POST "$BASE_URL/tools/get_children_nodes" \
        -H 'Content-Type: application/json' \
        -d "{\"parentId\":\"$algebra_id\",\"limit\":50}")

    echo "$algebra_children" | jq -r '.data.children[] | "  - \(.name) (层级:\(.level), 子节点:\(.children_count)个)"'
    echo ""

    # 找到"方程"分支
    equation_id=$(echo "$algebra_children" | jq -r '.data.children[] | select(.name | contains("方程")) | .id' | head -1)

    if [ ! -z "$equation_id" ]; then
        echo -e "${CYAN}步骤4: 展开'方程'知识点${NC}"
        equation_children=$(curl -s -X POST "$BASE_URL/tools/get_children_nodes" \
            -H 'Content-Type: application/json' \
            -d "{\"parentId\":\"$equation_id\",\"limit\":50}")

        echo "$equation_children" | jq -r '.data.children[] | "  - \(.name) (层级:\(.level))"'
        echo ""

        echo -e "${GREEN}✓ 找到了'一元二次方程'相关的所有知识点${NC}"
    fi

    # 找到"整式"或"因式分解"分支
    echo -e "${CYAN}步骤5: 在'数与代数'中搜索'因式分解'${NC}"
    factorization=$(curl -s -X POST "$BASE_URL/tools/search_in_scope" \
        -H 'Content-Type: application/json' \
        -d "{\"parentId\":\"$algebra_id\",\"query\":\"因式分解\",\"limit\":10}")

    echo "$factorization" | jq -r '.data.results[] | "  - \(.name) (层级:\(.level))"'
    echo ""
    echo -e "${GREEN}✓ 找到了'因式分解'相关知识点${NC}"

    # 搜索"平方差"
    echo -e "${CYAN}步骤6: 搜索'平方差'公式${NC}"
    square_diff=$(curl -s -X POST "$BASE_URL/tools/search_knowledge_points" \
        -H 'Content-Type: application/json' \
        -d '{"query":"平方差","limit":5}')

    echo "$square_diff" | jq -r '.data.knowledgePoints[] | "  - \(.name) (层级:\(.level))"'
    echo ""
    echo -e "${GREEN}✓ 找到了'平方差'公式相关知识点${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}总结：${NC}"
echo ""
echo "方法1 (扁平搜索):"
echo "  ✗ 只能找到1个关键词的知识点"
echo "  ✗ 容易遗漏相关知识点"
echo ""
echo "方法2 (层级导航 + 范围搜索):"
echo "  ✓ 先定位章节，再展开查看所有子知识点"
echo "  ✓ 可以多选相关知识点"
echo "  ✓ 使用 search_in_scope 在特定范围内搜索"
echo "  ✓ 不会遗漏同层级的相关知识点"
echo ""
echo -e "${YELLOW}推荐策略：${NC}"
echo "1. 从题干提取主题 → 定位到章节（如'方程'）"
echo "2. 展开该章节，查看所有子知识点"
echo "3. 使用 AI 从子知识点中多选相关的"
echo "4. 使用 search_in_scope 补充搜索相关知识点"
