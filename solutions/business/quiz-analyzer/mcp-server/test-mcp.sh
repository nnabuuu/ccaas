#!/bin/bash

# MCP Server 完整测试套件
# 测试所有 13 个 API 端点

# 注释掉 set -e 以便所有测试都能运行
# set -e

BASE_URL="http://localhost:3006"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
test_api() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected="$5"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -ne "${BLUE}[TEST $TOTAL_TESTS]${NC} $name ... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s "$BASE_URL$endpoint")
    else
        response=$(curl -s -X POST "$BASE_URL$endpoint" \
            -H 'Content-Type: application/json' \
            -d "$data")
    fi

    if echo "$response" | grep -q "$expected"; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected: $expected"
        echo "  Response: $response"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 显示分隔线
section() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  $1${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 显示汇总
show_summary() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  测试汇总${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  总计:  $TOTAL_TESTS"
    echo -e "  ${GREEN}通过: $PASSED_TESTS${NC}"
    if [ $FAILED_TESTS -gt 0 ]; then
        echo -e "  ${RED}失败: $FAILED_TESTS${NC}"
    else
        echo -e "  ${GREEN}失败: $FAILED_TESTS${NC}"
    fi
    echo ""

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ 所有测试通过！${NC}"
        return 0
    else
        echo -e "${RED}✗ 部分测试失败${NC}"
        return 1
    fi
}

echo -e "${GREEN}MCP Server 测试套件${NC}"
echo "测试服务器: $BASE_URL"

# ===== 测试 1: 健康检查 =====
section "Phase 1: 健康检查"

test_api "健康检查" \
    "GET" \
    "/health" \
    "" \
    "healthy"

# ===== 测试 2: 核心工具 API =====
section "Phase 2: 核心工具 API"

test_api "写入输出 - 有效字段" \
    "POST" \
    "/tools/write_output" \
    '{"field":"difficulty","value":3,"preview":"test"}' \
    "success"

test_api "写入输出 - 无效字段" \
    "POST" \
    "/tools/write_output" \
    '{"field":"invalid_field","value":"test"}' \
    "error"

test_api "获取知识点树" \
    "POST" \
    "/tools/get_knowledge_points_tree" \
    '{"limit":1}' \
    "success"

test_api "验证知识点标签" \
    "POST" \
    "/tools/verify_knowledge_point_tags" \
    '{"quizContent":"测试题目","proposedTags":[]}' \
    "success"

test_api "计算难度" \
    "POST" \
    "/tools/calculate_difficulty" \
    '{"knowledgePointCount":3,"stepCount":5,"quizType":"解答题"}' \
    "difficulty"

test_api "生成解题思路模板" \
    "POST" \
    "/tools/generate_thinking_process_template" \
    '{"quizContent":"test","quizType":"选择题","knowledgePoints":["方程"]}' \
    "template"

# ===== 测试 3: 搜索 API =====
section "Phase 3: 搜索 API"

test_api "搜索题目" \
    "POST" \
    "/tools/search_quizzes" \
    '{"limit":5}' \
    "success"

test_api "搜索知识点 - 关键词" \
    "POST" \
    "/tools/search_knowledge_points" \
    '{"query":"方程","limit":5}' \
    "success"

test_api "搜索知识点 - 按年级" \
    "POST" \
    "/tools/search_knowledge_points" \
    '{"gradeLevel":"小学","limit":5}' \
    "success"

# ===== 测试 4: 分层导航 API =====
section "Phase 4: 分层导航 API"

test_api "获取根分类列表" \
    "POST" \
    "/tools/get_root_categories" \
    '{"limit":5}' \
    "categories"

# 获取一个科目ID用于后续测试
SUBJECT_ID=$(curl -s -X POST "$BASE_URL/tools/get_root_categories" \
    -H 'Content-Type: application/json' \
    -d '{"limit":1}' | jq -r '.data.categories[0].id')

test_api "获取子节点 - 根节点" \
    "POST" \
    "/tools/get_children_nodes" \
    "{\"subjectId\":\"$SUBJECT_ID\",\"parentId\":null,\"limit\":5}" \
    "children"

# 获取一个根节点ID用于后续测试
ROOT_ID=$(curl -s -X POST "$BASE_URL/tools/get_children_nodes" \
    -H 'Content-Type: application/json' \
    -d "{\"subjectId\":\"$SUBJECT_ID\",\"parentId\":null}" | jq -r '.data.children[0].id')

test_api "获取子节点 - 指定父节点" \
    "POST" \
    "/tools/get_children_nodes" \
    "{\"parentId\":\"$ROOT_ID\",\"limit\":5}" \
    "children"

test_api "获取节点路径" \
    "POST" \
    "/tools/get_node_path" \
    "{\"nodeId\":\"$ROOT_ID\"}" \
    "path"

test_api "范围搜索 - 全局" \
    "POST" \
    "/tools/search_in_scope" \
    '{"query":"词","limit":5}' \
    "results"

test_api "范围搜索 - 子树" \
    "POST" \
    "/tools/search_in_scope" \
    "{\"parentId\":\"$ROOT_ID\",\"query\":\"语\",\"limit\":5}" \
    "results"

test_api "范围搜索 - 按科目" \
    "POST" \
    "/tools/search_in_scope" \
    "{\"subjectId\":\"$SUBJECT_ID\",\"query\":\"语\",\"limit\":5}" \
    "results"

# ===== 测试 5: 错误处理 =====
section "Phase 5: 错误处理"

test_api "空查询参数" \
    "POST" \
    "/tools/search_in_scope" \
    '{}' \
    "message"

test_api "无效节点ID" \
    "POST" \
    "/tools/get_node_path" \
    '{"nodeId":"invalid-id"}' \
    "path"

# 显示汇总
show_summary
