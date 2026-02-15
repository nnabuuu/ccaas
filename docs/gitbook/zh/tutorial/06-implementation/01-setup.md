# 6.1 项目初始化

在本节中，你将创建 Lesson Plan Designer Solution 的目录结构、配置文件和启动脚本。完成后，你将拥有一个可以通过单个命令启动的项目骨架。

## 目标

创建一个可运行的项目骨架，包含：
- 标准 Solution 目录布局
- `solution.json` 配置
- NestJS 后端项目
- React + Vite 前端项目
- `setup.sh` 启动脚本

## 步骤 1：创建目录结构

导航到 CCAAS monorepo 的 `solutions/` 目录，创建 Lesson Plan Designer 文件夹：

```bash
cd solutions
mkdir -p lesson-plan-designer/{backend/src,frontend/src,mcp-server/src,skills}
```

目录结构应该如下：

```
lesson-plan-designer/
├── backend/
│   └── src/
├── frontend/
│   └── src/
├── mcp-server/
│   └── src/
└── skills/
```

## 步骤 2：创建 solution.json

`solution.json` 是 Solution 的中央配置文件。它告诉平台你的 MCP 服务器、Skills、端口和数据库设置的信息。

创建 `lesson-plan-designer/solution.json`：

```json
{
  "$schema": "https://ccaas.dev/schemas/solution.v1.json",

  "name": "Lesson Plan Designer",
  "slug": "lesson-plan-designer",
  "version": "1.0.0",
  "description": "AI-powered lesson plan design assistant",

  "backend": {
    "port": 3002,
    "ccaasUrl": "http://localhost:3001",
    "database": {
      "type": "sqlite",
      "path": "data/lesson-plans.db"
    }
  },

  "frontend": {
    "port": 5280
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

  "skills": [
    {
      "name": "Lesson Plan Designer",
      "slug": "lesson-plan-designer",
      "description": "Design lesson plans with AI assistance",
      "skillFile": "skills/lesson-plan-designer/SKILL.md",
      "scope": "tenant",
      "triggers": [
        { "type": "keyword", "value": "lesson plan", "priority": 10 },
        { "type": "keyword", "value": "teaching objectives", "priority": 8 },
        { "type": "keyword", "value": "teaching activities", "priority": 8 },
        { "type": "keyword", "value": "assessment", "priority": 7 }
      ],
      "allowedTools": ["write_output", "Read", "Write"]
    }
  ]
}
```

**关键配置说明：**

| 字段 | 用途 |
|------|------|
| `slug` | 唯一标识符，用于租户创建和 URL 路由 |
| `backend.port` | Solution 后端端口（3002，与 CCAAS 的 3001 分开） |
| `backend.ccaasUrl` | 此 Solution 连接的 CCAAS 后端 URL |
| `frontend.port` | Vite 开发服务器端口 |
| `mcpServers` | AI Agent 可以调用的 MCP 工具服务 |
| `skills` | AI Skill 定义及触发器配置 |

{% hint style="info" %}
**为什么要分开端口？** Solution 后端（3002）处理业务数据（教案、教材、课程标准）。CCAAS 后端（3001）处理 AI 会话和消息中继。它们是职责分离的独立服务。
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

```
# Lesson Plan Designer Backend
PORT=3002
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5280
DB_PATH=./data/lesson-plans.db
CCAAS_URL=http://localhost:3001
NODE_ENV=development
```

复制为 `.env`：

```bash
cp backend/.env.example backend/.env
```

### 3.5 创建入口文件

创建 `backend/src/main.ts`：

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // 为前端启用 CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5280',
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

- `enableCors`：允许前端（端口 5280）调用后端 API
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
    "@ccaas/common": "file:../../../packages/common",
    "@ccaas/react-sdk": "file:../../../packages/react-sdk",
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

- `@ccaas/react-sdk`：提供 WebSocket 连接、聊天和 output\_update 处理的 Hooks
- `@ccaas/common`：平台中使用的共享类型
- `socket.io-client`：用于实时通信的 WebSocket 客户端
- `lucide-react`：图标库

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
    echo "   Please run from solutions/ directory"
    exit 1
fi

source "$TOOLS_DIR/solution-lib.sh"

# Load solution configuration
load_solution_config "$SCRIPT_DIR"

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
    install_npm_dependencies "$SCRIPT_DIR/frontend"
    install_npm_dependencies "$SCRIPT_DIR/backend"

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
2. 从 `solution.json` 读取端口、slug 和服务配置
3. 验证 CCAAS 后端在端口 3001 上运行
4. 为前端和后端安装 npm 依赖
5. 在 CCAAS 平台中创建租户和 API Key
6. 向 CCAAS 后端注册 Skills 和 MCP Servers
7. 启动后端（端口 3002）和前端（端口 5280）

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
lesson-plan-designer/
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
│   └── package.json
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
cd lesson-plan-designer/backend
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
**陷阱：tsconfig.json 中缺少 `emitDecoratorMetadata`。** 没有这个标志，NestJS 依赖注入会静默失败，产生关于未定义依赖的难以理解的运行时错误。
{% endhint %}

{% hint style="danger" %}
**陷阱：忘记 `setGlobalPrefix('api')`。** 没有这个，你的路由会在 `/lesson-plans` 而不是 `/api/lesson-plans`。前端和 MCP Server 都期望 `/api` 前缀。
{% endhint %}

## 下一步

骨架已经准备好了。现在让我们实现后端的数据库、教案 CRUD 和教材查询。继续前往 [6.2 后端实现](02-backend.md)。
