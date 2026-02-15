# 6.2 Backend Implementation

In this section, you will implement the Solution backend: a database layer with SQLite, a Tasks module with full CRUD, and a Projects module. By the end, you will have a working REST API that you can test with `curl`.

## Objective

Build a NestJS backend with:
- SQLite database with automatic schema initialization
- Task CRUD API (`GET`, `POST`, `PUT`, `DELETE /api/tasks`)
- Project CRUD API (`GET`, `POST`, `PUT`, `DELETE /api/projects`)
- Filtering and query support

## Step 1: Database Module

The database module provides a shared SQLite connection to all other modules. We use `better-sqlite3` because it is synchronous (no async overhead for simple queries) and requires zero configuration -- no external database server needed.

### 1.1 Create the Database Service

Create `backend/src/database/database.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database;
  private readonly logger = new Logger(DatabaseService.name);

  onModuleInit() {
    const dbPath = process.env.DATABASE_PATH
      || path.join(__dirname, '../../data/task-manager.db');
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initSchema();
    this.logger.log(`Database initialized at ${dbPath}`);
  }

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
    }
  }

  getDb(): Database.Database {
    return this.db;
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3b82f6',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo'
          CHECK(status IN ('todo', 'in_progress', 'done', 'cancelled')),
        priority TEXT NOT NULL DEFAULT 'medium'
          CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        due_date TEXT,
        tags TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    `);
  }
}
```

**Key design decisions:**

| Decision | Reasoning |
|----------|-----------|
| `better-sqlite3` over TypeORM | Simpler for a tutorial; no entity decorators, no migrations complexity |
| `journal_mode = WAL` | Write-Ahead Logging for better concurrent read performance |
| `foreign_keys = ON` | Enforces referential integrity between tasks and projects |
| `TEXT` for IDs | UUIDs are strings; avoids auto-increment complications |
| `CHECK` constraints | Database-level validation for status and priority values |
| `tags` as JSON string | SQLite stores JSON as text; parsed in the service layer |

{% hint style="info" %}
**Why not TypeORM?** TypeORM is the standard ORM for NestJS, but it adds significant complexity (entity decorators, migrations, repository patterns). For this tutorial, raw SQL with `better-sqlite3` is more transparent -- you can see exactly what SQL runs. In a production Solution, you might prefer TypeORM or Prisma for migration management.
{% endhint %}

### 1.2 Create the Database Module

Create `backend/src/database/database.module.ts`:

```typescript
import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
```

The `@Global()` decorator makes `DatabaseService` available to all modules without explicit imports. This is appropriate for a database connection that every module needs.

## Step 2: Tasks Module

The Tasks module implements CRUD operations for tasks. It consists of three files: the service (business logic), the controller (HTTP endpoints), and the module (wiring).

### 2.1 Create the Tasks Service

Create `backend/src/tasks/tasks.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  projectId?: string;
  dueDate?: string;
  tags?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  projectId?: string;
  dueDate?: string;
  tags?: string[];
}

export interface TaskFilter {
  status?: string;
  projectId?: string;
  priority?: string;
}

@Injectable()
export class TasksService {
  constructor(private readonly db: DatabaseService) {}

  findAll(filter: TaskFilter = {}) {
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: unknown[] = [];

    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter.projectId) {
      sql += ' AND project_id = ?';
      params.push(filter.projectId);
    }
    if (filter.priority) {
      sql += ' AND priority = ?';
      params.push(filter.priority);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.db.getDb()
      .prepare(sql)
      .all(...params) as Record<string, unknown>[];
    return rows.map(this.mapRow);
  }

  findOne(id: string) {
    const row = this.db.getDb()
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return this.mapRow(row);
  }

  create(dto: CreateTaskDto) {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.getDb().prepare(`
      INSERT INTO tasks (id, title, description, status, priority,
                         project_id, due_date, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.title,
      dto.description || null,
      dto.status || 'todo',
      dto.priority || 'medium',
      dto.projectId || null,
      dto.dueDate || null,
      JSON.stringify(dto.tags || []),
      now,
      now,
    );

    return this.findOne(id);
  }

  update(id: string, dto: UpdateTaskDto) {
    const existing = this.findOne(id);
    const now = new Date().toISOString();

    this.db.getDb().prepare(`
      UPDATE tasks SET
        title = ?, description = ?, status = ?, priority = ?,
        project_id = ?, due_date = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(
      dto.title ?? existing.title,
      dto.description ?? existing.description,
      dto.status ?? existing.status,
      dto.priority ?? existing.priority,
      dto.projectId ?? existing.projectId,
      dto.dueDate ?? existing.dueDate,
      JSON.stringify(dto.tags ?? existing.tags),
      now,
      id,
    );

    return this.findOne(id);
  }

  remove(id: string) {
    this.findOne(id); // throws NotFoundException if not found
    this.db.getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return { deleted: true };
  }

  private mapRow(row: Record<string, unknown>) {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | null,
      status: row.status as string,
      priority: row.priority as string,
      projectId: row.project_id as string | null,
      dueDate: row.due_date as string | null,
      tags: JSON.parse((row.tags as string) || '[]'),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
```

**Code walkthrough:**

**DTOs (Data Transfer Objects)**

The `CreateTaskDto` and `UpdateTaskDto` interfaces define what data the API accepts. In `CreateTaskDto`, only `title` is required -- everything else has sensible defaults. In `UpdateTaskDto`, all fields are optional since you might only update one field at a time.

**The `findAll` method with filtering**

```typescript
findAll(filter: TaskFilter = {}) {
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params: unknown[] = [];

  if (filter.status) {
    sql += ' AND status = ?';
    params.push(filter.status);
  }
  // ...
}
```

The `WHERE 1=1` pattern allows us to append `AND` conditions without worrying about whether it is the first condition. Each filter is optional -- if no filters are provided, all tasks are returned.

**The `mapRow` method**

SQLite stores column names in `snake_case` (e.g., `project_id`), but our API returns `camelCase` (e.g., `projectId`). The `mapRow` method handles this conversion, and also parses the `tags` JSON string back into an array.

**The `create` method**

```typescript
create(dto: CreateTaskDto) {
  const id = uuidv4();
  const now = new Date().toISOString();
  // INSERT...
  return this.findOne(id);
}
```

We generate UUIDs on the server side (not in SQLite) for portability. After inserting, we call `findOne` to return the complete record with all defaults applied.

### 2.2 Create the Tasks Controller

Create `backend/src/tasks/tasks.controller.ts`:

```typescript
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query
} from '@nestjs/common';
import { TasksService, CreateTaskDto, UpdateTaskDto } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('priority') priority?: string,
  ) {
    return this.tasksService.findAll({ status, projectId, priority });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
```

**Explanation:**

- `@Controller('tasks')` maps to `/api/tasks` (with the global prefix from `main.ts`)
- `@Query('status')` extracts query parameters: `GET /api/tasks?status=todo`
- `@Param('id')` extracts URL parameters: `GET /api/tasks/abc-123`
- `@Body()` parses the JSON request body

The controller is intentionally thin -- it only handles HTTP concerns (extracting parameters, returning responses). All business logic lives in the service.

### 2.3 Create the Tasks Module

Create `backend/src/tasks/tasks.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
```

We export `TasksService` so other modules can use it if needed (e.g., the MCP module might need to look up tasks).

## Step 3: Projects Module

The Projects module follows the same pattern as Tasks. Projects are simpler -- they only have a name, description, and color.

### 3.1 Create the Projects Service

Create `backend/src/projects/projects.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateProjectDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  color?: string;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly db: DatabaseService) {}

  findAll() {
    const rows = this.db.getDb()
      .prepare('SELECT * FROM projects ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];
    return rows.map(this.mapRow);
  }

  findOne(id: string) {
    const row = this.db.getDb()
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return this.mapRow(row);
  }

  create(dto: CreateProjectDto) {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.getDb().prepare(`
      INSERT INTO projects (id, name, description, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.name,
      dto.description || null,
      dto.color || '#3b82f6',
      now,
      now,
    );

    return this.findOne(id);
  }

  update(id: string, dto: UpdateProjectDto) {
    const existing = this.findOne(id);
    const now = new Date().toISOString();

    this.db.getDb().prepare(`
      UPDATE projects SET name = ?, description = ?, color = ?, updated_at = ?
      WHERE id = ?
    `).run(
      dto.name ?? existing.name,
      dto.description ?? existing.description,
      dto.color ?? existing.color,
      now,
      id,
    );

    return this.findOne(id);
  }

  remove(id: string) {
    this.findOne(id); // throws if not found
    this.db.getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
    return { deleted: true };
  }

  private mapRow(row: Record<string, unknown>) {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | null,
      color: row.color as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
```

### 3.2 Create the Projects Controller

Create `backend/src/projects/projects.controller.ts`:

```typescript
import {
  Controller, Get, Post, Put, Delete, Body, Param
} from '@nestjs/common';
import { ProjectsService, CreateProjectDto, UpdateProjectDto } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
```

### 3.3 Create the Projects Module

Create `backend/src/projects/projects.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
```

## Final Backend Structure

Your backend `src/` directory should now look like this:

```
backend/src/
├── main.ts                          # Application entry point
├── app.module.ts                    # Root module
├── database/
│   ├── database.module.ts           # Global database module
│   └── database.service.ts          # SQLite connection + schema
├── tasks/
│   ├── tasks.module.ts              # Tasks feature module
│   ├── tasks.controller.ts          # HTTP endpoints
│   └── tasks.service.ts             # Business logic + DTOs
└── projects/
    ├── projects.module.ts           # Projects feature module
    ├── projects.controller.ts       # HTTP endpoints
    └── projects.service.ts          # Business logic + DTOs
```

## Checkpoint

Start the backend and test all endpoints:

```bash
cd task-manager-tutorial/backend
npm install
npm run start:dev
```

### Test 1: Create a project

```bash
curl -s -X POST http://localhost:3003/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Q1 Sprint", "description": "First quarter deliverables"}' \
  | python3 -m json.tool
```

Expected response:
```json
{
    "id": "a1b2c3d4-...",
    "name": "Q1 Sprint",
    "description": "First quarter deliverables",
    "color": "#3b82f6",
    "createdAt": "2026-02-15T...",
    "updatedAt": "2026-02-15T..."
}
```

### Test 2: Create a task

```bash
curl -s -X POST http://localhost:3003/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Review Q3 metrics", "priority": "high"}' \
  | python3 -m json.tool
```

Expected response:
```json
{
    "id": "e5f6g7h8-...",
    "title": "Review Q3 metrics",
    "description": null,
    "status": "todo",
    "priority": "high",
    "projectId": null,
    "dueDate": null,
    "tags": [],
    "createdAt": "2026-02-15T...",
    "updatedAt": "2026-02-15T..."
}
```

### Test 3: List all tasks

```bash
curl -s http://localhost:3003/api/tasks | python3 -m json.tool
```

### Test 4: Filter tasks by status

```bash
curl -s "http://localhost:3003/api/tasks?status=todo" | python3 -m json.tool
```

### Test 5: Update a task

Replace `TASK_ID` with the ID from Test 2:

```bash
curl -s -X PUT http://localhost:3003/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "description": "Analyze Q3 revenue and growth metrics"}' \
  | python3 -m json.tool
```

### Test 6: Delete a task

```bash
curl -s -X DELETE http://localhost:3003/api/tasks/TASK_ID
```

Expected response:
```json
{"deleted": true}
```

{% hint style="success" %}
If all six tests pass, your backend is working correctly. The database file is automatically created at `data/task-manager.db`.
{% endhint %}

## Understanding the NestJS Module Pattern

If you are new to NestJS, here is a summary of the pattern used throughout this backend:

```
Module (wiring)
  ├── Controller (HTTP layer)
  │     - Receives HTTP requests
  │     - Extracts params, query, body
  │     - Delegates to service
  │     - Returns response
  │
  └── Service (business logic)
        - Implements CRUD operations
        - Talks to database
        - Throws exceptions (NotFoundException)
        - Defines DTOs
```

Each feature (tasks, projects) is a self-contained module. The `AppModule` imports all feature modules. The `DatabaseModule` is global and shared.

## API Summary

### Tasks API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List all tasks (supports `?status=`, `?priority=`, `?projectId=` filters) |
| `GET` | `/api/tasks/:id` | Get a single task |
| `POST` | `/api/tasks` | Create a new task (requires `title`) |
| `PUT` | `/api/tasks/:id` | Update a task (partial update) |
| `DELETE` | `/api/tasks/:id` | Delete a task |

### Projects API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all projects |
| `GET` | `/api/projects/:id` | Get a single project |
| `POST` | `/api/projects` | Create a new project (requires `name`) |
| `PUT` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Delete a project |

## Common Pitfalls

{% hint style="danger" %}
**Pitfall: Forgetting to create the `database/` directory.** The `DatabaseService` creates the `data/` directory automatically, but if `DATABASE_PATH` points to a deeply nested path, ensure parent directories exist.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Using `project_id` in API responses instead of `projectId`.** The database uses `snake_case` columns, but the API should return `camelCase`. The `mapRow` method handles this conversion. If you skip it, your frontend will receive inconsistent field names.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Not enabling foreign keys in SQLite.** By default, SQLite does not enforce foreign key constraints. The `this.db.pragma('foreign_keys = ON')` line in `DatabaseService` is essential -- without it, you can create tasks referencing non-existent projects.
{% endhint %}

## Exercise

Extend the Tasks API with a `PATCH` endpoint that only updates the fields provided (instead of `PUT` which requires all fields):

<details>
<summary>Hint</summary>

Add a `@Patch(':id')` method to `TasksController` that calls the same `update` method. The existing `update` logic already handles partial updates via the `??` (nullish coalescing) operator.

```typescript
@Patch(':id')
patch(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
  return this.tasksService.update(id, dto);
}
```

Do not forget to import `Patch` from `@nestjs/common`.
</details>

## Next Step

The backend REST API is complete. Next, we build the MCP Server that provides `write_output` and custom tools for the AI Agent to call. Proceed to [6.3 MCP Server](03-mcp-server.md).
