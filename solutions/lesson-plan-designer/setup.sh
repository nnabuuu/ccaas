#!/bin/bash

# Lesson Plan Designer - 一键启动脚本
# MCP 服务器配置通过 solution.json 自动注入，无需手动注册

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend"
MCP_DIR="$SCRIPT_DIR/mcp-server"

echo "🚀 Lesson Plan Designer 启动脚本"
echo "================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装"
    exit 1
fi

echo "📦 Node.js 版本: $(node -v)"

# 构建 MCP 服务器
echo ""
echo "📦 构建 MCP 服务器..."
cd "$MCP_DIR"
npm install
npm run build
echo "✅ MCP 服务器构建完成"

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
    echo "   MCP 服务器将在会话启动时自动注入"
else
    echo "⚠️  solution.json 未找到"
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

# 启动后端
echo ""
echo "🔧 启动后端服务 (端口 3002)..."
cd "$BACKEND_DIR"
npm run dev &
BACKEND_PID=$!

# 等待后端启动
sleep 2

# 启动前端
echo ""
echo "🎨 启动前端服务 (端口 5280)..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

# 等待前端启动
sleep 3

echo ""
echo "✅ 启动完成!"
echo ""
echo "📍 访问地址:"
echo "   前端: http://localhost:5280"
echo "   后端: http://localhost:3002"
echo ""
echo "⚠️  请确保 CCAAS 后端已在端口 3001 运行:"
echo "   cd packages/backend && npm run start:dev"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获退出信号
cleanup() {
    echo ""
    echo "🛑 停止服务..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ 服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 等待子进程
wait
