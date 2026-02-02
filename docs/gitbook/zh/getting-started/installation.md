# 安装与启动

## 1. 克隆项目

```bash
git clone <repository-url>
cd ccaas
```

## 2. 安装依赖

```bash
npm install
```

## 3. 构建共享包

共享包（`@ccaas/common`）必须最先构建，其他包依赖它的类型定义：

```bash
npm run build:shared
```

## 4. 启动后端服务

```bash
npm run dev:backend
```

后端服务启动在 `http://localhost:3001`。

## 5. 启动管理后台（可选）

```bash
npm run dev:admin
```

管理后台启动在 `http://localhost:5174`。

## 构建全部包

如果需要构建所有包，请按正确的依赖顺序执行：

```bash
npm run build:shared    # 1. 共享类型（必须最先）
npm run build:backend   # 2. 后端服务
npm run build:admin     # 3. 管理后台
npm run build:vue-sdk   # 4. Vue SDK
```

或一次性构建所有包：

```bash
npm run build
```

## 运行测试

```bash
# 运行全部测试
npm run test

# 运行特定包的测试
npm run test -w @ccaas/backend
npm run test -w @ccaas/vue-sdk
npm run test -w @ccaas/common
```

## 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Backend API | 3001 | NestJS 后端服务 |
| Admin UI | 5174 | Vue 管理后台 |
| Solution Backend | 3002-3003 | Solution 业务后端 |
| MCP Server | 3004+ | MCP 工具服务 |
| Solution Frontend | 5279-5281 | Solution 前端 |

## 环境变量

后端服务支持以下环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3001 | 服务监听端口 |
| `NODE_ENV` | development | 运行环境 |
| `DATABASE_PATH` | ./data/ccaas.db | SQLite 数据库路径 |
| `WORKSPACE_DIR` | .agent-workspace | AI Agent 工作空间目录 |
| `AUTH_ALLOW_ANONYMOUS` | true | 是否允许匿名访问 |
| `AUTH_ENABLE_RATE_LIMITING` | false | 是否启用限流 |
| `MCP_HEALTH_CHECK_INTERVAL_MS` | 30000 | MCP 健康检查间隔 |

## 启动 Solution 示例

每个 Solution 都提供了一键启动脚本：

```bash
# CCAAS Demo
cd solutions/ccaas-demo
./setup.sh

# 教案设计助手
cd solutions/lesson-plan-designer
./setup.sh

# 题目讲解助手
cd solutions/problem-explainer
./setup.sh
```

{% hint style="info" %}
启动 Solution 前，请确保 CCAAS 后端服务已在 3001 端口运行。
{% endhint %}
