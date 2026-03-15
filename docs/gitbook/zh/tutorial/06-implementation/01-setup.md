# 6.1 项目初始化

在本节中，你将创建 Lesson Plan Designer Solution 的目录结构、配置文件和启动脚本。完成后，你将拥有一个可以通过单个命令启动的项目骨架。

## 目标

创建一个可运行的项目骨架，包含：
- 标准 Solution 目录布局
- `solution.json` 配置（v3.0 schema）
- NestJS 后端项目
- React + Vite 前端项目
- `setup.sh` 启动脚本

## 步骤 1：创建目录结构

导航到 monorepo 的 `solutions/business/` 目录，创建 Lesson Plan Designer 文件夹：

```bash
cd solutions/business
mkdir -p lesson-plan-designer/{backend/src,frontend/src,mcp-server/src,skills}
```

目录结构应该如下：

```
solutions/business/lesson-plan-designer/
├── backend/
│   └── src/
├── frontend/
│   └── src/
├── mcp-server/
│   └── src/
└── skills/
```

{% hint style="info" %}
**为什么是 `solutions/business/`？** monorepo 按类别组织 Solution。业务 Solution 放在 `solutions/business/` 下，与核心平台包分开管理。
{% endhint %}

## 步骤 2：创建 solution.json

`solution.json` 是 Solution 的中央配置文件。它定义了租户身份、MCP 工具服务、会话模板和 Skill 引用。

创建 `lesson-plan-designer/solution.json`：

```json
{
  "schemaVersion": "3.0",

  "tenant": {
    "name": "Lesson Plan Designer",
    "slug": "lesson-plan-designer",
    "description": "AI-powered lesson plan design assistant"
  },

  "mcpServers": {
    "lesson-plan-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Lesson Plan Designer MCP tools including write_output",
      "type": "stdio",
      "env": {}
    }
  },

  "sessionTemplates": {
    "lesson-planning": {
      "description": "Lesson planning mode",
      "enabledSkills": ["lesson-plan-designer"],
      "bundles": ["structured-output"]
    }
  },

  "skills": [
    { "slug": "lesson-plan-designer", "name": "lesson-plan-designer" }
  ]
}
```

**关键配置说明：**

| 字段 | 用途 |
|------|------|
| `schemaVersion` | 配置格式版本（始终为 `"3.0"`） |
| `tenant` | 租户身份 — 名称、slug（唯一标识符）和描述 |
| `mcpServers` | AI Agent 可以调用的 MCP 工具服务 |
| `sessionTemplates` | 会话预设，定义哪些 Skill 和 bundle 处于活跃状态 |
| `skills` | Skill 引用列表 — 每个条目是一个 `{slug, name}` 对 |

{% hint style="warning" %}
**`solution.json` 不包含端口或 URL 配置。** 端口、CCAAS URL 和其他运行时设置通过各服务目录中的环境变量（`.env`）配置。这种分离让 `solution.json` 专注于描述 Solution _提供什么_，而 `.env` 处理 _在哪里运行_。
{% endhint %}

{% hint style="info" %}
**什么是会话模板？** 会话模板为会话预配置特定的 Skill 和 bundle。当用户使用 `lesson-planning` 模板启动会话时，平台会自动激活 `lesson-plan-designer` Skill 和 `structured-output` bundle。
{% endhint %}

## 步骤 3：初始化后端

后端使用 NestJS 配合 better-sqlite3，实现轻量级、零配置的数据库存储。

### 3.1 创建 package.json

创建 `backend/package.json`：

```json
{
  "name": "lesson-plan-designer-backend",
  "version": "1.0.0",
  "description": "Lesson Plan Designer Backend - NestJS + SQLite",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "dev": "nest start --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.15",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-express": "^10.4.22",
    "better-sqlite3": "^11.7.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "uuid": "^11.0.5"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.9",
    "@nestjs/schematics": "^10.2.3",
    "@nestjs/testing": "^10.4.15",
    "@types/better-sqlite3": "^7.6.12",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.5",
    "@types/uuid": "^10.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "testEnvironment": "node"
  }
}
```

### 3.2 创建 tsconfig.json

创建 `backend/tsconfig.json`：

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

**关键设置说明：**

- `emitDecoratorMetadata` 和 `experimentalDecorators`：NestJS 依赖注入所需
- `strictNullChecks`：在编译时捕获空引用错误
- `esModuleInterop`：允许使用 `import Database from 'better-sqlite3'` 语法

### 3.3 创建 nest-cli.json

创建 `backend/nest-cli.json`：

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

### 3.4 创建环境文件

创建 `backend/.env.example`：

```bash
# Server Configuration
PORT=3002
HOST=0.0.0.0

# Database
DB_PATH=./data/lesson-plans.db

# CORS
CORS_ORIGIN=http://localhost:5280

# CCAAS Backend
# 本地开发: http://localhost:3001
# 线上环境: https://ccaas.zhushou.one/
CCAAS_URL=http://localhost:3001

# Environment
NODE_ENV=development
```

复制为 `.env`：

```bash
cp backend/.env.example backend/.env
```

{% hint style="info" %}
**CCAAS_URL** 告诉 Solution 后端核心平台在哪里运行。本地开发时，这是 `http://localhost:3001`（CCAAS 后端开发服务器）。生产环境使用托管实例 `https://ccaas.zhushou.one/`。
{% endhint %}

### 3.5 创建入口文件

创建 `backend/src/main.ts`：

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // 启用 CORS（开发环境允许所有来源）
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // API 前缀
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3002;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);

  logger.log('');
  logger.log('Lesson Plan Designer Backend (NestJS)');
  logger.log('=====================================');
  logger.log(`HTTP:   http://${host}:${port}`);
  logger.log('');
}

bootstrap();
```

**说明：**

- `enableCors({ origin: true })`：开发环境接受来自任何来源的请求。与硬编码单个端口不同，这避免了前端端口变更时的 CORS 错误。
- `ValidationPipe` 配合 `whitelist: true`：剥离 DTO 中未定义的属性，防止意外数据到达服务层
- `setGlobalPrefix('api')`：所有路由都带 `/api` 前缀（如 `/api/lesson-plans`）

### 3.6 创建 AppModule

创建 `backend/src/app.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { LessonPlansModule } from './lesson-plans/lesson-plans.module';
import { TextbookModule } from './textbook/textbook.module';
import { CurriculumStandardsModule } from './curriculum-standards/curriculum-standards.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    LessonPlansModule,
    TextbookModule,
    CurriculumStandardsModule,
  ],
})
export class AppModule {}
```

这是将所有内容连接在一起的根模块。注意四个功能模块：`DatabaseModule` 用于数据访问，`LessonPlansModule` 用于教案 CRUD，`TextbookModule` 用于教材章节查询，`CurriculumStandardsModule` 用于课程标准查询。

## 步骤 4：初始化前端

前端使用 React 18 + Vite + Tailwind CSS。我们现在只做最小化脚手架，在第 6.5 章完整构建。

### 4.1 创建 package.json

创建 `frontend/package.json`：

```json
{
  "name": "lesson-plan-designer-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "@kedge-agentic/common": "^0.2.0",
    "@kedge-agentic/react-sdk": "^0.2.0",
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io-client": "^4.8.1",
    "uuid": "^11.0.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

**关键依赖：**

- `@kedge-agentic/react-sdk`：提供 SSE 连接、聊天和 output\_update 处理的 Hooks
- `@kedge-agentic/common`：平台中使用的共享类型
- `socket.io-client`：WebSocket 客户端，用于实时 AI 会话通信
- `lucide-react`：图标库

### 4.2 创建环境文件

创建 `frontend/.env.example`：

```bash
# Solution 后端 URL
VITE_API_URL=http://localhost:3002

# 核心 CCAAS 后端 URL
# 本地开发: http://localhost:3001
# 线上环境: https://ccaas.zhushou.one/
VITE_CCAAS_URL=http://localhost:3001

# 默认租户 ID（setup.sh 创建租户后设置）
VITE_DEFAULT_TENANT_ID=default-tenant
```

复制为 `.env`：

```bash
cp frontend/.env.example frontend/.env
```

{% hint style="warning" %}
**`VITE_CCAAS_URL` 必须是绝对 URL。** 永远不要使用空字符串（`''`）或相对路径（`'/'`）— SDK 使用 `fetch()` 和 `Socket.IO` 构造完整 URL，这会绕过 Vite 开发代理。使用空字符串会导致所有请求发送到前端端口而不是 CCAAS 后端，造成连接完全失败。
{% endhint %}

### 4.3 创建 vite.config.ts

创建 `frontend/vite.config.ts`：

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5280,
    proxy: {
      // CCAAS sessions API（必须在 /api 之前以获得优先匹配）
      '/api/v1/sessions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // CCAAS health API
      '/api/v1/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // CCAAS skills API
      '/api/v1/skills': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Solution 后端 API
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
```

**代理路由说明：**

Vite 代理将相对 URL 请求（`/api/...`）路由到正确的后端。更具体的路由（如 `/api/v1/sessions`）排在前面，以便在通用的 `/api` 兜底规则之前匹配。

{% hint style="info" %}
**代理 vs SDK URL：** Vite 代理只拦截浏览器发出的相对 URL 请求（如 `fetch('/api/...')`）。`@kedge-agentic/react-sdk` 使用 `VITE_CCAAS_URL` 构造完整 URL，因此完全绕过代理。两种机制都需要：代理用于简单的 `fetch()` 调用，`VITE_CCAAS_URL` 用于 SDK。
{% endhint %}

## 步骤 5：创建启动脚本

`setup.sh` 脚本自动化整个启动过程。它使用共享的 `solution-lib.sh` 库来处理租户创建、API Key 管理和 Skill 注入。

创建 `lesson-plan-designer/setup.sh`：

```bash
#!/bin/bash
# Lesson Plan Designer - Setup Script
# Uses: tools/solution-lib.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR/../../tools"

# Source shared library
if [ ! -f "$TOOLS_DIR/solution-lib.sh" ]; then
    echo "Error: solution-lib.sh not found at $TOOLS_DIR"
    echo "   Please run from solutions/business/ directory"
    exit 1
fi

source "$TOOLS_DIR/solution-lib.sh"

# Load solution configuration
load_solution_config "$SCRIPT_DIR"

# Custom initialization
custom_init() {
    # Build MCP server
    log_step "3.5" "Building MCP server"
    local mcp_dir="$SCRIPT_DIR/mcp-server"

    if [ -d "$mcp_dir" ]; then
        cd "$mcp_dir"
        npm install > /dev/null 2>&1
        npm run build > /dev/null 2>&1
        log_success "MCP server built"
    else
        log_warn "MCP server directory not found, skipping build"
    fi

    return 0
}

# Main workflow
main() {
    log_header "$SOLUTION_NAME Setup"

    # Step 1: Check dependencies
    log_step "1" "Checking dependencies"
    check_dependencies
    log_info "Node.js version: $(node -v)"

    # Step 2: Check CCAAS backend
    log_step "2" "Verifying CCAAS backend"
    check_ccaas_backend

    # Step 3: Install npm dependencies
    log_step "3" "Installing dependencies"
    run_hook "preInstall"
    install_npm_dependencies "$SCRIPT_DIR/frontend"
    install_npm_dependencies "$SCRIPT_DIR/backend"

    # Step 3.5: Custom initialization (MCP build)
    custom_init

    # Step 4: Setup tenant and API key
    log_step "4" "Setting up tenant and API key"
    eval "$(create_or_get_tenant "$CCAAS_URL" "$SOLUTION_SLUG" "$SOLUTION_NAME" "$SOLUTION_DESCRIPTION")"
    log_info "Tenant ID: $TENANT_ID"

    BOOTSTRAP_KEY=$(get_or_create_bootstrap_key "$CCAAS_URL")
    eval "$(create_solution_api_key "$CCAAS_URL" "$TENANT_ID" "$BOOTSTRAP_KEY" "$SOLUTION_NAME")"
    CCAAS_API_KEY="$API_KEY"
    export CCAAS_API_KEY

    # Step 5: Inject skills and MCP servers
    log_step "5" "Injecting skills and MCP servers"
    inject_skills "$SCRIPT_DIR/skills" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"
    inject_mcp_servers "$SCRIPT_DIR" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"

    run_hook "postInstall"

    # Step 6: Clear ports
    log_step "6" "Preparing ports"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"

    # Step 7: Start services
    log_step "7" "Starting services"
    BACKEND_PID=$(start_service "backend" "$SCRIPT_DIR/backend" "$BACKEND_PORT" "npm run start:dev")
    wait_for_port "$BACKEND_PORT" 30

    FRONTEND_PID=$(start_service "frontend" "$SCRIPT_DIR/frontend" "$FRONTEND_PORT" "npm run dev")
    wait_for_port "$FRONTEND_PORT" 30

    # Step 8: Display summary
    display_summary

    echo ""
    echo "Press Ctrl+C to stop all services"

    # Wait for Ctrl+C
    trap cleanup SIGINT SIGTERM
    wait
}

# Cleanup function
cleanup() {
    echo ""
    log_info "Stopping services..."
    stop_service "$BACKEND_PID"
    stop_service "$FRONTEND_PID"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"
    log_success "Services stopped"
    exit 0
}

# Run main
main "$@"
```

设置为可执行：

```bash
chmod +x lesson-plan-designer/setup.sh
```

**脚本做了什么：**

1. 引入共享的 `solution-lib.sh` 库用于通用操作
2. 从 `solution.json` 读取租户 slug 和 MCP 服务配置
3. 验证 CCAAS 后端可达（默认：`http://localhost:3001`）
4. 为前端和后端安装 npm 依赖
5. 构建 MCP 服务器（`npm install && npm run build`）
6. 通过 CCAAS Admin API 创建租户和 API Key
7. 向 CCAAS 后端注册 Skills 和 MCP Servers
8. 启动后端（端口 3002）和前端（端口 5280）

{% hint style="info" %}
**`CCAAS_URL` 环境变量：** 启动脚本读取 `CCAAS_URL` 来确定平台端点。本地开发默认为 `http://localhost:3001`。要对接线上平台，在运行前设置：`CCAAS_URL=https://ccaas.zhushou.one/ ./setup.sh`
{% endhint %}

{% hint style="info" %}
**替代方案：Builder API。** 除了 `setup.sh`，你也可以使用 Builder API 以编程方式注册你的 Solution。详见 [Builder Flow 指南](../../guide/builder-flow.md)。
{% endhint %}

## 步骤 6：添加 .gitignore

创建 `lesson-plan-designer/.gitignore`：

```
node_modules/
dist/
data/
.env
*.db
*.db-shm
*.db-wal
```

## 最终目录结构

完成本节后，你的项目应该如下：

```
solutions/business/lesson-plan-designer/
├── .gitignore
├── solution.json
├── setup.sh                    (可执行)
│
├── backend/
│   ├── .env
│   ├── .env.example
│   ├── nest-cli.json
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       └── app.module.ts
│
├── frontend/
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
│
├── mcp-server/
│   └── src/                    (空，在 6.3 中构建)
│
└── skills/                     (空，在 6.4 中构建)
```

## 检查点

通过安装依赖并启动后端来验证你的设置：

```bash
# 安装后端依赖
cd solutions/business/lesson-plan-designer/backend
npm install

# 启动后端
npm run start:dev
```

你应该看到如下输出：

```
[Nest] LOG [Bootstrap] Lesson Plan Designer Backend (NestJS)
[Nest] LOG [Bootstrap] =====================================
[Nest] LOG [Bootstrap] HTTP:   http://0.0.0.0:3002
```

{% hint style="warning" %}
在我们在下一节中创建 `DatabaseModule`、`LessonPlansModule`、`TextbookModule` 和 `CurriculumStandardsModule` 之前，后端会启动失败。这是预期的 -- `AppModule` 导入了它们但它们还不存在。如果你想立即验证设置是否正常，可以暂时在 `app.module.ts` 中注释掉这些导入。
{% endhint %}

## 常见陷阱

{% hint style="danger" %}
**陷阱：端口号搞混。** Solution 后端运行在端口 3002，不是 3001。端口 3001 是 CCAAS 后端的。搞混它们会导致连接失败。
{% endhint %}

{% hint style="danger" %}
**陷阱：`VITE_CCAAS_URL` 或 `CCAAS_URL` 为空。** 永远不要留空或设置为 `''`。SDK 使用 `fetch()` 构造完整 URL，这会绕过 Vite 代理。空值会导致请求发送到前端端口而不是 CCAAS 后端。始终使用绝对 URL 如 `http://localhost:3001`。
{% endhint %}

{% hint style="danger" %}
**陷阱：在 `solution.json` 中配置端口。** v3.0 schema 不支持 `backend.port` 或 `frontend.port` 字段。端口配置属于 `.env` 文件。如果你在 `solution.json` 中添加端口字段，它们会被静默忽略。
{% endhint %}

{% hint style="danger" %}
**陷阱：tsconfig.json 中缺少 `emitDecoratorMetadata`。** 没有这个标志，NestJS 依赖注入会静默失败，产生关于未定义依赖的难以理解的运行时错误。
{% endhint %}

{% hint style="danger" %}
**陷阱：`solution.json` 中缺少 `sessionTemplates`。** 没有至少一个会话模板，平台无法为你的 Solution 创建预配置会话。用户每次启动会话时都需要手动选择 Skill。
{% endhint %}

{% hint style="danger" %}
**陷阱：忘记 `setGlobalPrefix('api')`。** 没有这个，你的路由会在 `/lesson-plans` 而不是 `/api/lesson-plans`。前端和 MCP Server 都期望 `/api` 前缀。
{% endhint %}

## 下一步

骨架已经准备好了。现在让我们实现后端的数据库、教案 CRUD 和教材查询。继续前往 [6.2 后端实现](02-backend.md)。
