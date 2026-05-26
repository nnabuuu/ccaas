# 6.1 Project Setup

In this section, you will create the directory structure, configuration files, and startup script for the Lesson Plan Designer Solution. By the end, you will have a project skeleton that can be started with a single command.

## Objective

Create a working project skeleton with:
- Standard Solution directory layout
- `solution.json` configuration (v3.0 schema)
- Backend project with NestJS
- Frontend project with React + Vite
- `setup.sh` startup script

## Step 1: Create the Directory Structure

Navigate to the `solutions/business/` directory in the monorepo and create the Lesson Plan Designer folder:

```bash
cd solutions/business
mkdir -p lesson-plan-designer/{backend/src,frontend/src,mcp-server/src,skills}
```

Your directory should look like this:

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
**Why `solutions/business/`?** The monorepo organizes Solutions by category. Business Solutions live under `solutions/business/`, keeping them separate from core platform packages.
{% endhint %}

## Step 2: Create solution.json

The `solution.json` file is the central configuration for your Solution. It defines your tenant identity, MCP tool servers, session templates, and Skill references.

Create `lesson-plan-designer/solution.json`:

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

**Key configuration explained:**

| Field | Purpose |
|-------|---------|
| `schemaVersion` | Configuration format version (always `"3.0"`) |
| `tenant` | Solution identity — name, slug (unique identifier), and description |
| `mcpServers` | MCP tool services the AI Agent can invoke |
| `sessionTemplates` | Session presets that define which Skills and bundles are active |
| `skills` | Skill reference list — each entry is a `{slug, name}` pair |

{% hint style="warning" %}
**`solution.json` does NOT contain port or URL configuration.** Ports, CCAAS URLs, and other runtime settings are configured via environment variables (`.env`) in each service directory. This separation keeps `solution.json` focused on _what_ the Solution provides, while `.env` handles _where_ it runs.
{% endhint %}

{% hint style="info" %}
**What is a session template?** A session template pre-configures a session with specific Skills and bundles. When a user starts a session with the `lesson-planning` template, the platform automatically activates the `lesson-plan-designer` Skill and the `structured-output` bundle.
{% endhint %}

## Step 3: Initialize the Backend

The backend uses NestJS with better-sqlite3 for lightweight, zero-configuration database storage.

### 3.1 Create package.json

Create `backend/package.json`:

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

### 3.2 Create tsconfig.json

Create `backend/tsconfig.json`:

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

**Key settings explained:**

- `emitDecoratorMetadata` and `experimentalDecorators`: Required for NestJS dependency injection
- `strictNullChecks`: Catches null reference errors at compile time
- `esModuleInterop`: Allows `import Database from 'better-sqlite3'` syntax

### 3.3 Create nest-cli.json

Create `backend/nest-cli.json`:

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

### 3.4 Create the environment file

Create `backend/.env.example`:

```bash
# Server Configuration
PORT=3002
HOST=0.0.0.0

# Database
DB_PATH=./data/lesson-plans.db

# CORS
CORS_ORIGIN=http://localhost:5280

# CCAAS Backend
# Local development: http://localhost:3001
# Production:        https://ccaas.zhushou.one/
CCAAS_URL=http://localhost:3001

# Environment
NODE_ENV=development
```

Copy it to `.env`:

```bash
cp backend/.env.example backend/.env
```

{% hint style="info" %}
**CCAAS_URL** tells the Solution backend where the core platform is running. During local development, this is `http://localhost:3001` (the CCAAS backend dev server). In production, use the hosted instance at `https://ccaas.zhushou.one/`.
{% endhint %}

### 3.5 Create the entry point

Create `backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Enable CORS (allow all origins in development)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // API prefix
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

**Explanation:**

- `enableCors({ origin: true })`: Accepts requests from any origin during development. Unlike hardcoding a single port, this avoids CORS errors when the frontend port changes.
- `ValidationPipe` with `whitelist: true`: Strips any properties not defined in the DTO, preventing unexpected data from reaching your service
- `setGlobalPrefix('api')`: All routes are prefixed with `/api` (e.g., `/api/lesson-plans`)

### 3.6 Create the AppModule

Create `backend/src/app.module.ts`:

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

This is the root module that ties everything together. Notice the four feature modules: `DatabaseModule` for data access, `LessonPlansModule` for lesson plan CRUD, `TextbookModule` for textbook chapter lookups, and `CurriculumStandardsModule` for curriculum standard queries.

## Step 4: Initialize the Frontend

The frontend uses React 18 with Vite and Tailwind CSS. We will scaffold it minimally now and build it out fully in Chapter 6.5.

### 4.1 Create package.json

Create `frontend/package.json`:

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

**Key dependencies:**

- `@kedge-agentic/react-sdk`: Provides hooks for SSE connection, chat, and output\_update handling
- `@kedge-agentic/common`: Shared types used across the platform
- `socket.io-client`: WebSocket client for real-time AI session communication
- `lucide-react`: Icons library

### 4.2 Create the environment file

Create `frontend/.env.example`:

```bash
# Solution backend URL
VITE_API_URL=http://localhost:3002

# Core CCAAS backend URL
# Local development: http://localhost:3001
# Production:        https://ccaas.zhushou.one/
VITE_CCAAS_URL=http://localhost:3001

# Default tenant ID (set by setup.sh after tenant creation)
VITE_DEFAULT_TENANT_ID=default-tenant
```

Copy it to `.env`:

```bash
cp frontend/.env.example frontend/.env
```

{% hint style="warning" %}
**`VITE_CCAAS_URL` must be an absolute URL.** Never use an empty string (`''`) or relative path (`'/'`) — the SDK constructs full URLs with `fetch()` and `Socket.IO`, which bypass the Vite dev proxy. Using an empty string causes all requests to go to the frontend port instead of the CCAAS backend, resulting in total connection failure.
{% endhint %}

### 4.3 Create vite.config.ts

Create `frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5280,
    proxy: {
      // CCAAS sessions API (must be before /api to take precedence)
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
      // Solution backend API
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
```

**Proxy routing explained:**

The Vite proxy routes relative URL requests (`/api/...`) to the correct backend. More specific routes (e.g., `/api/v1/sessions`) are listed first so they match before the generic `/api` catch-all.

{% hint style="info" %}
**Proxy vs SDK URLs:** The Vite proxy only intercepts relative URLs from the browser (e.g., `fetch('/api/...')`). The `@kedge-agentic/react-sdk` constructs full URLs using `VITE_CCAAS_URL`, so it bypasses the proxy entirely. Both mechanisms are needed: the proxy for simple `fetch()` calls, and `VITE_CCAAS_URL` for the SDK.
{% endhint %}

## Step 5: Create the Startup Script

The `setup.sh` script automates the entire startup process. It uses the shared `solution-lib.sh` library that handles tenant creation, API key management, and Skill injection.

Create `lesson-plan-designer/setup.sh`:

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
    log_info "Solution ID: $TENANT_ID"

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

Make it executable:

```bash
chmod +x lesson-plan-designer/setup.sh
```

**What the script does:**

1. Sources the shared `solution-lib.sh` library for common operations
2. Reads `solution.json` for solution slug and MCP server configuration
3. Verifies the CCAAS backend is reachable (default: `http://localhost:3001`)
4. Installs npm dependencies for frontend and backend
5. Builds the MCP server (`npm install && npm run build`)
6. Creates a tenant and API key via the CCAAS Admin API
7. Registers Skills and MCP Servers with the CCAAS backend
8. Starts the backend (port 3002) and frontend (port 5280)

{% hint style="info" %}
**`CCAAS_URL` environment variable:** The setup script reads `CCAAS_URL` to determine the platform endpoint. It defaults to `http://localhost:3001` for local development. To run against the hosted platform, set it before running: `CCAAS_URL=https://ccaas.zhushou.one/ ./setup.sh`
{% endhint %}

{% hint style="info" %}
**Alternative: Builder API.** Instead of `setup.sh`, you can also use the Builder API to register your Solution programmatically. See the [Builder Flow Guide](../../guide/builder-flow.md) for details.
{% endhint %}

## Step 6: Add .gitignore

Create `lesson-plan-designer/.gitignore`:

```
node_modules/
dist/
data/
.env
*.db
*.db-shm
*.db-wal
```

## Final Directory Structure

After completing this section, your project should look like this:

```
solutions/business/lesson-plan-designer/
├── .gitignore
├── solution.json
├── setup.sh                    (executable)
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
│   └── src/                    (empty, built in 6.3)
│
└── skills/                     (empty, built in 6.4)
```

## Checkpoint

Verify your setup by installing dependencies and starting the backend:

```bash
# Install backend dependencies
cd solutions/business/lesson-plan-designer/backend
npm install

# Start the backend
npm run start:dev
```

You should see output like:

```
[Nest] LOG [Bootstrap] Lesson Plan Designer Backend (NestJS)
[Nest] LOG [Bootstrap] =====================================
[Nest] LOG [Bootstrap] HTTP:   http://0.0.0.0:3002
```

{% hint style="warning" %}
The backend will fail to start until we create the `DatabaseModule`, `LessonPlansModule`, `TextbookModule`, and `CurriculumStandardsModule` in the next section. That is expected -- the `AppModule` imports them but they do not exist yet. If you want to verify the setup works right now, temporarily comment out those imports in `app.module.ts`.
{% endhint %}

## Common Pitfalls

{% hint style="danger" %}
**Pitfall: Wrong port numbers.** The Solution backend runs on port 3002, not 3001. Port 3001 is reserved for the CCAAS backend. Mixing them up causes connection failures.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Empty `VITE_CCAAS_URL` or `CCAAS_URL`.** Never leave these empty or set them to `''`. The SDK uses `fetch()` with full URLs, which bypasses the Vite proxy. An empty value causes requests to hit the frontend port, not the CCAAS backend. Always use an absolute URL like `http://localhost:3001`.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Putting ports in `solution.json`.** The v3.0 schema does not support `backend.port` or `frontend.port` fields. Port configuration belongs in `.env` files. If you add port fields to `solution.json`, they will be silently ignored.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Missing `emitDecoratorMetadata` in tsconfig.json.** Without this flag, NestJS dependency injection silently fails, producing cryptic runtime errors about undefined dependencies.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Missing `sessionTemplates` in solution.json.** Without at least one session template, the platform cannot create pre-configured sessions for your Solution. Users would need to manually select Skills each time they start a session.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Forgetting `setGlobalPrefix('api')`.** Without this, your routes will be at `/lesson-plans` instead of `/api/lesson-plans`. The frontend and MCP Server both expect the `/api` prefix.
{% endhint %}

## Next Step

The skeleton is ready. Now let us implement the backend with the database, Lesson Plan CRUD, and Textbook lookups. Proceed to [6.2 Backend Implementation](02-backend.md).
