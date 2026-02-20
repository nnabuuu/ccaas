#!/bin/bash

# Quiz Analyzer - 一键启动开发环境
# MCP 工具已集成到后端，无需单独启动

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "🚀 Quiz Analyzer 开发环境启动脚本"
echo "================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装"
    exit 1
fi

echo "📦 Node.js 版本: $(node -v)"

# 安装后端依赖
echo ""
echo "📦 安装后端依赖..."
cd "$BACKEND_DIR"
npm install

# 安装前端依赖
echo ""
echo "📦 安装前端依赖..."
cd "$FRONTEND_DIR"
npm install

# 验证 solution.json
echo ""
echo "🔍 验证 solution.json..."
if [ -f "$SCRIPT_DIR/solution.json" ]; then
    echo "✅ solution.json 已配置"
    echo "   MCP 工具已集成到后端 REST API"
else
    echo "⚠️  solution.json 未找到"
fi

# 验证数据库
echo ""
echo "🔍 检查数据库..."
if [ -f "$SCRIPT_DIR/data/quiz-analyzer.db" ]; then
    echo "✅ 数据库已准备"
    echo -n "   题目数量: "
    sqlite3 "$SCRIPT_DIR/data/quiz-analyzer.db" "SELECT COUNT(*) FROM quizzes;" 2>/dev/null || echo "0"
    echo -n "   知识点数量: "
    sqlite3 "$SCRIPT_DIR/data/quiz-analyzer.db" "SELECT COUNT(*) FROM knowledge_points;" 2>/dev/null || echo "0"
    echo -n "   学生答案数: "
    sqlite3 "$SCRIPT_DIR/data/quiz-analyzer.db" "SELECT COUNT(*) FROM student_answers;" 2>/dev/null || echo "0"
else
    echo "⚠️  数据库未找到，请先运行: ./setup.sh"
    read -p "是否继续启动？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 可选: 注入技能到 CCAAS (如果 CCAAS 正在运行)
echo ""
echo "🔍 检查 CCAAS 服务..."
if curl -s "http://localhost:3001/api/v1/health" > /dev/null 2>&1; then
    echo "✅ CCAAS 正在运行"
    if [ -f "$SCRIPT_DIR/inject-skills.sh" ]; then
        echo "📝 注入技能到 CCAAS..."
        "$SCRIPT_DIR/inject-skills.sh"
    fi
else
    echo "⚠️  CCAAS 未运行，跳过技能注入"
    echo "   如需注入技能，请先启动 CCAAS 后运行: ./inject-skills.sh"
fi

# 检查并清理端口冲突
echo ""
echo "🔍 检查端口占用..."

# 检查端口 3005 (后端)
if lsof -Pi :3005 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  端口 3005 已被占用，正在清理旧进程..."
    lsof -ti:3005 | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "✅ 端口 3005 已释放"
fi

# 检查端口 5282 (前端)
if lsof -Pi :5282 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  端口 5282 已被占用，正在清理旧进程..."
    lsof -ti:5282 | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "✅ 端口 5282 已释放"
fi

# 创建日志目录
mkdir -p "$SCRIPT_DIR/logs"

# 启动后端
echo ""
echo "🔧 启动后端服务 (端口 3005)..."
cd "$BACKEND_DIR"
npm run start:dev > "$SCRIPT_DIR/logs/backend-dev.log" 2>&1 &
BACKEND_PID=$!

# 等待后端启动并验证
echo "⏳ 等待后端启动..."

# 重试检查端口绑定 (最多等待10秒)
BACKEND_RETRY=0
BACKEND_MAX_RETRY=10
while [ $BACKEND_RETRY -lt $BACKEND_MAX_RETRY ]; do
    if lsof -Pi :3005 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ 后端启动成功 (端口 3005)"
        break
    fi
    BACKEND_RETRY=$((BACKEND_RETRY + 1))
    if [ $BACKEND_RETRY -eq $BACKEND_MAX_RETRY ]; then
        echo "❌ 错误: 后端未能成功启动在端口 3005"
        echo "   请检查日志: logs/backend-dev.log"
        echo "   或手动运行: cd backend && npm run start:dev"
        cleanup
        exit 1
    fi
    sleep 1
done

# 启动前端
echo ""
echo "🎨 启动前端服务 (端口 5282)..."
cd "$FRONTEND_DIR"
npm run dev > "$SCRIPT_DIR/logs/frontend-dev.log" 2>&1 &
FRONTEND_PID=$!

# 等待前端启动并验证
echo "⏳ 等待前端启动..."

# 重试检查端口绑定 (最多等待10秒)
FRONTEND_RETRY=0
FRONTEND_MAX_RETRY=10
while [ $FRONTEND_RETRY -lt $FRONTEND_MAX_RETRY ]; do
    if lsof -Pi :5282 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ 前端启动成功 (端口 5282)"
        break
    fi
    FRONTEND_RETRY=$((FRONTEND_RETRY + 1))
    if [ $FRONTEND_RETRY -eq $FRONTEND_MAX_RETRY ]; then
        echo "❌ 错误: 前端未能成功启动在端口 5282"
        echo "   请检查日志: logs/frontend-dev.log"
        echo "   或手动运行: cd frontend && npm run dev"
        cleanup
        exit 1
    fi
    sleep 1
done

echo ""
echo "✅ 所有服务启动完成!"
echo ""
echo "📍 访问地址:"
echo "   前端: http://localhost:5282"
echo "   后端: http://localhost:3005 (包含 MCP 工具)"
echo ""
echo "📊 数据库统计:"
sqlite3 "$SCRIPT_DIR/data/quiz-analyzer.db" "SELECT '   题目数量: ' || COUNT(*) FROM quizzes;" 2>/dev/null || true
sqlite3 "$SCRIPT_DIR/data/quiz-analyzer.db" "SELECT '   知识点数量: ' || COUNT(*) FROM knowledge_points;" 2>/dev/null || true
sqlite3 "$SCRIPT_DIR/data/quiz-analyzer.db" "SELECT '   学生答案数: ' || COUNT(*) FROM student_answers;" 2>/dev/null || true
echo ""
echo "⚠️  请确保 CCAAS 后端已在端口 3001 运行:"
echo "   cd packages/backend && npm run start:dev"
echo ""
echo "📝 开发日志:"
echo "   后端:       tail -f logs/backend-dev.log"
echo "   前端:       tail -f logs/frontend-dev.log"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获退出信号
cleanup() {
    echo ""
    echo "🛑 停止服务..."

    # 停止后台进程
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true

    # 确保端口被释放
    if lsof -Pi :3005 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   清理端口 3005 (后端)..."
        lsof -ti:3005 | xargs kill -9 2>/dev/null || true
    fi

    if lsof -Pi :5282 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   清理端口 5282 (前端)..."
        lsof -ti:5282 | xargs kill -9 2>/dev/null || true
    fi

    echo "✅ 服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 等待子进程
wait
