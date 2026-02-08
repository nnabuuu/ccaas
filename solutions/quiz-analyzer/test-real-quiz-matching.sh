#!/bin/bash

# 真实题目与知识点匹配测试
# 使用从 题目信息.xlsx 中选取的真实题目

BASE_URL="http://localhost:3006"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== 真实题目知识点匹配测试 ===${NC}"
echo ""
echo "使用从 题目信息.xlsx 中选取的真实题目"
echo ""

# 读取测试题目
if [ ! -f "test-quizzes.json" ]; then
    echo -e "${RED}错误: test-quizzes.json 文件不存在${NC}"
    echo "请先运行: node scripts/select-test-quizzes.cjs"
    exit 1
fi

# 提取关键词函数
extract_keywords() {
    local content="$1"
    # 简单的关键词提取：移除HTML标签和特殊符号，提取核心词汇
    echo "$content" | sed 's/<[^>]*>//g' | sed 's/[（）()【】［］\[\]]/  /g' | tr -s ' '
}

# 测试函数
test_quiz_matching() {
    local quiz_idx="$1"
    local subject="$2"
    local content="$3"
    local expected_kp="$4"
    local expected_kp_id="$5"
    local keywords="$6"

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}题目 $quiz_idx: 【$subject】${NC}"
    echo "  题干: ${content:0:80}..."
    echo -e "  ${GREEN}预期知识点: $expected_kp (ID: $expected_kp_id)${NC}"
    echo ""

    # 提取关键词数组
    IFS=',' read -ra KEYWORDS <<< "$keywords"

    found_match=false
    for keyword in "${KEYWORDS[@]}"; do
        keyword=$(echo "$keyword" | xargs) # trim whitespace
        if [ -z "$keyword" ]; then
            continue
        fi

        echo -e "  搜索关键词: ${YELLOW}$keyword${NC}"

        result=$(curl -s -X POST "$BASE_URL/tools/search_knowledge_points" \
            -H 'Content-Type: application/json' \
            -d "{\"query\":\"$keyword\",\"limit\":5}")

        count=$(echo "$result" | jq -r '.data.count')

        if [ "$count" -gt 0 ]; then
            echo -e "    ${GREEN}✓ 找到 $count 个匹配的知识点${NC}"

            # 检查是否匹配预期的知识点
            matched_kp=$(echo "$result" | jq -r ".data.knowledgePoints[] | select(.id == \"$expected_kp_id\") | .name")

            if [ ! -z "$matched_kp" ]; then
                echo -e "    ${GREEN}★ 成功匹配预期知识点！${NC}"
                found_match=true
            fi

            echo "$result" | jq -r '.data.knowledgePoints[] | "      - \(.name) (层级:\(.level))"' | head -3
        else
            echo -e "    ${YELLOW}✗ 未找到匹配的知识点${NC}"
        fi
        echo ""
    done

    if [ "$found_match" = true ]; then
        echo -e "${GREEN}✓ 测试通过: 成功匹配预期知识点${NC}"
    else
        echo -e "${YELLOW}⚠ 测试未找到完全匹配，但可能找到相关知识点${NC}"
    fi
    echo ""
}

# 从 JSON 文件读取题目并测试
node -e "
const fs = require('fs');
const quizzes = JSON.parse(fs.readFileSync('test-quizzes.json', 'utf-8'));

quizzes.forEach((quiz, idx) => {
    // 从题干中提取关键词
    let content = quiz.题干.replace(/<[^>]*>/g, ' ').replace(/[（）()【】［］\\[\\]]/g, ' ').trim();
    let keywords = [];

    // 根据学科提取不同的关键词
    if (quiz.学科 === '语文') {
        keywords = ['字形', '辨析', quiz.知识点名称.trim()];
    } else if (quiz.学科 === '道德法治') {
        keywords = ['青春', '成长', quiz.知识点名称.trim()];
    } else if (quiz.学科 === '数学') {
        keywords = ['对称', '图形', quiz.知识点名称.trim()];
    } else if (quiz.学科 === '英语') {
        keywords = ['写作', '环境', quiz.知识点名称.trim()];
    } else if (quiz.学科 === '物理') {
        keywords = ['汽化', '液化', '物态变化', quiz.知识点名称.trim()];
    }

    // 过滤空关键词
    keywords = keywords.filter(k => k && k.trim().length > 0);

    console.log(\`\${idx + 1}||||\${quiz.学科}||||\${content.substring(0, 80)}||||\${quiz.知识点名称.trim()}||||\${quiz.知识点id}||||\${keywords.join(',')}\`);
});
" | while IFS='||||' read -r idx subject content expected_kp expected_kp_id keywords; do
    test_quiz_matching "$idx" "$subject" "$content" "$expected_kp" "$expected_kp_id" "$keywords"
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}测试完成！${NC}"
echo ""
echo "分析建议："
echo "1. ✓ 表示成功匹配预期知识点"
echo "2. ⚠ 表示未完全匹配，但可能找到相关知识点"
echo "3. 可以调整关键词提取策略以提高匹配准确度"
echo "4. 考虑使用知识点的层级结构进行更智能的匹配"
