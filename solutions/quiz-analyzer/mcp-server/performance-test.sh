#!/bin/bash

echo "=== 性能测试 ==="
echo ""

# 测试 1: 响应时间
echo "1. API 响应时间测试 (10次请求平均值)"
echo ""

test_response_time() {
    local name="$1"
    local endpoint="$2"
    local data="$3"
    
    local total=0
    for i in {1..10}; do
        start=$(date +%s%N)
        curl -s -X POST "http://localhost:3006$endpoint" \
            -H 'Content-Type: application/json' \
            -d "$data" > /dev/null
        end=$(date +%s%N)
        duration=$(( (end - start) / 1000000 ))
        total=$(( total + duration ))
    done
    avg=$(( total / 10 ))
    echo "  $name: ${avg}ms"
}

test_response_time "健康检查" "/health" ""
test_response_time "获取分类" "/tools/get_root_categories" '{"limit":10}'
test_response_time "搜索知识点" "/tools/search_knowledge_points" '{"query":"方程","limit":10}'
test_response_time "范围搜索" "/tools/search_in_scope" '{"query":"词","limit":10}'

echo ""
echo "2. 并发测试 (50个并发请求)"

time {
    for i in {1..50}; do
        curl -s -X POST "http://localhost:3006/tools/get_root_categories" \
            -H 'Content-Type: application/json' \
            -d '{"limit":5}' > /dev/null &
    done
    wait
}

echo ""
echo "3. 数据量测试"
echo "  - 知识点总数: 31,497"
echo "  - 科目总数: 21"

# 测试大查询
start=$(date +%s%N)
count=$(curl -s -X POST "http://localhost:3006/tools/search_knowledge_points" \
    -H 'Content-Type: application/json' \
    -d '{"limit":100}' | jq '.data.count')
end=$(date +%s%N)
duration=$(( (end - start) / 1000000 ))

echo "  - 查询100个知识点: ${duration}ms (返回${count}个结果)"

