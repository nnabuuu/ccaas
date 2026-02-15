# 6.1 Project Setup

In this section, you will create the directory structure, configuration files, and startup script for the Task Manager Solution. By the end, you will have a project skeleton that can be started with a single command.

## Objective

Create a working project skeleton with:
- Standard Solution directory layout
- `solution.json` configuration
- Backend project with NestJS
- Frontend project with React + Vite
- `setup.sh` startup script

## Step 1: Create the Directory Structure

Navigate to the `solutions/` directory in the CCAAS monorepo and create the Task Manager folder:

```bash
cd solutions
mkdir -p task-manager-tutorial/{backend/src,frontend/src,mcp-server/src,skills}
```

Your directory should look like this:

```
task-manager-tutorial/
├── backend/
│   └── src/
├── frontend/
│   └── src/
├── mcp-server/
│   └── src/
└── skills/
```

## Step 2: Create solution.json

The `solution.json` file is the central configuration for your Solution. It tells the platform about your MCP servers, Skills, ports, and sync fields.

Create `task-manager-tutorial/solution.json`:

```json
{
  "$schema": "https://ccaas.dev/schemas/solution.v1.json",

  "name": "Task Manager Tutorial",
  "slug": "task-manager-tutorial",
  "version": "1.0.0",
  "description": "Tutorial reference solution - AI-powered task management with projects, priorities, and bulk import",

  "backend": {
    "port": 3003,
    "ccaasUrl": "http://localhost:3001",
    "database": {
      "type": "sqlite",
      "path": "data/task-manager.db"
    }
  },

  "frontend": {
    "port": 5281
  },

  "mcpServers": {
    "task-manager-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Task Manager MCP tools including write_output",
      "type": "stdio",
      "env": {}
    }
  },

  "skills": [
    {
      "name": "Task Creator",
      "slug": "task-creator",
      "description": "Create and manage tasks with AI assistance",
      "skillFile": "skills/task-creator/SKILL.md",
      "scope": "tenant",
      "triggers": [
        { "type": "keyword", "value": "create task", "priority": 10 },
        { "type": "keyword", "value": "add task", "priority": 10 },
        { "type": "keyword", "value": "new task", "priority": 9 }
      ],
      "allowedTools": ["write_output", "Read", "Write"]
    },
    {
      "name": "Bulk Import",
      "slug": "bulk-import",
      "description": "Import multiple tasks from text, CSV, or structured input",
      "skillFile": "skills/bulk-import/SKILL.md",
      "scope": "tenant",
      "triggers": [
        { "type": "keyword", "value": "bulk import", "priority": 10 },
        { "type": "keyword", "value": "import tasks", "priority": 10 },
        { "type": "keyword", "value": "batch create", "priority": 9 }
      ],
      "allowedTools": ["write_output", "Read", "Write"]
    }
  ],

  "syncFields": [
    "taskTitle",
    "taskDescription",
    "priority",
    "status",
    "projectId",
    "dueDate",
    "tags"
  ]
}
```

**Key configuration explained:**

| Field | Purpose |
|-------|---------|
| `slug` | Unique identifier used for tenant creation and URL routing |
| `backend.port` | Port for the Solution backend (3003, separate from CCAAS on 3001) |
| `backend.ccaasUrl` | URL of the CCAAS backend this Solution connects to |
| `frontend.port` | Port for the Vite dev server |
| `mcpServers` | MCP tool services the AI Agent can call |
| `skills` | AI Skill definitions with trigger configuration |
| `syncFields` | Form fields that can receive AI-generated data via `output_update` |

{% hint style="info" %}
**Why separate ports?** The Solution backend (3003) handles business data (tasks, projects). The CCAAS backend (3001) handles AI sessions and message relay. They are separate services with separate responsibilities.
{% endhint %}

## Step 3: Initialize the Backend

The backend uses NestJS with better-sqlite3 for lightweight, zero-configuration database storage.

### 3.1 Create package.json

Create `backend/package.json`:

```json
{
  "name": "task-manager-tutorial-backend",
  "version": "1.0.0",
  "description": "Task Manager Tutorial Backend - NestJS + SQLite",
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

```
# Task Manager Tutorial Backend
PORT=3003
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5281
DATABASE_PATH=data/task-manager.db
```

Copy it to `.env`:

```bash
cp backend/.env.example backend/.env
```

### 3.5 Create the entry point

Create `backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5281',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3003;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);

  logger.log('');
  logger.log('Task Manager Tutorial Backend (NestJS)');
  logger.log('=======================================');
  logger.log(`HTTP:   http://${host}:${port}`);
  logger.log('');
}

bootstrap();
```

**Explanation:**

- `enableCors`: Allows the frontend (port 5281) to call the backend API
- `ValidationPipe` with `whitelist: true`: Strips any properties not defined in the DTO, preventing unexpected data from reaching your service
- `setGlobalPrefix('api')`: All routes are prefixed with `/api` (e.g., `/api/tasks`)

### 3.6 Create the AppModule

Create `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    TasksModule,
    ProjectsModule,
  ],
})
export class AppModule {}
```

This is the root module that ties everything together. Notice the three feature modules: `DatabaseModule` for data access, `TasksModule` for task CRUD, and `ProjectsModule` for project CRUD.

## Step 4: Initialize the Frontend

The frontend uses React 18 with Vite and Tailwind CSS. We will scaffold it minimally now and build it out fully in Chapter 6.5.

Create `frontend/package.json`:

```json
{
  "name": "task-manager-tutorial-frontend",
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

**Key dependencies:**

- `@ccaas/react-sdk`: Provides hooks for WebSocket connection, chat, and output\_update handling
- `@ccaas/common`: Shared types used across the platform
- `socket.io-client`: WebSocket client for real-time communication
- `lucide-react`: Icons library

## Step 5: Create the Startup Script

The `setup.sh` script automates the entire startup process. It uses the shared `solution-lib.sh` library that handles tenant creation, API key management, and Skill injection.

Create `task-manager-tutorial/setup.sh`:

```bash
#!/bin/bash
# Task Manager Tutorial - Setup Script
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

Make it executable:

```bash
chmod +x task-manager-tutorial/setup.sh
```

**What the script does:**

1. Sources the shared `solution-lib.sh` library for common operations
2. Reads `solution.json` for ports, slugs, and service configuration
3. Verifies the CCAAS backend is running on port 3001
4. Installs npm dependencies for frontend and backend
5. Creates a tenant and API key in the CCAAS platform
6. Registers Skills and MCP Servers with the CCAAS backend
7. Starts the backend (port 3003) and frontend (port 5281)

## Step 6: Add .gitignore

Create `task-manager-tutorial/.gitignore`:

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
task-manager-tutorial/
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
│   └── package.json
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
cd task-manager-tutorial/backend
npm install

# Start the backend
npm run start:dev
```

You should see output like:

```
[Nest] LOG [Bootstrap] Task Manager Tutorial Backend (NestJS)
[Nest] LOG [Bootstrap] =======================================
[Nest] LOG [Bootstrap] HTTP:   http://0.0.0.0:3003
```

{% hint style="warning" %}
The backend will fail to start until we create the `DatabaseModule`, `TasksModule`, and `ProjectsModule` in the next section. That is expected -- the `AppModule` imports them but they do not exist yet. If you want to verify the setup works right now, temporarily comment out those imports in `app.module.ts`.
{% endhint %}

## Common Pitfalls

{% hint style="danger" %}
**Pitfall: Wrong port numbers.** The Solution backend runs on port 3003, not 3001. Port 3001 is reserved for the CCAAS backend. Mixing them up causes connection failures.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Missing `emitDecoratorMetadata` in tsconfig.json.** Without this flag, NestJS dependency injection silently fails, producing cryptic runtime errors about undefined dependencies.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Forgetting `setGlobalPrefix('api')`.** Without this, your routes will be at `/tasks` instead of `/api/tasks`. The frontend and MCP Server both expect the `/api` prefix.
{% endhint %}

## Next Step

The skeleton is ready. Now let us implement the backend with the database, Task CRUD, and Project CRUD. Proceed to [6.2 Backend Implementation](02-backend.md).
