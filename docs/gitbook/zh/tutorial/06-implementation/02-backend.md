# 6.2 后端实现

在本节中，你将实现 Solution 后端：基于 SQLite 的数据库层、具有完整 CRUD 的任务模块和项目模块。完成后，你将拥有一个可以用 `curl` 测试的 REST API。

## 目标

构建一个 NestJS 后端，包含：
- 自动初始化 schema 的 SQLite 数据库
- 任务 CRUD API（`GET`、`POST`、`PUT`、`DELETE /api/tasks`）
- 项目 CRUD API（`GET`、`POST`、`PUT`、`DELETE /api/projects`）
- 过滤和查询支持

## 步骤 1：数据库模块

数据库模块为所有其他模块提供共享的 SQLite 连接。我们使用 `better-sqlite3`，因为它是同步的（简单查询无需异步开销），且零配置 -- 不需要外部数据库服务器。

### 1.1 创建数据库服务

创建 `backend/src/database/database.service.ts`：

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

**关键设计决策：**

| 决策 | 原因 |
|------|------|
| 选择 `better-sqlite3` 而非 TypeORM | 教程中更简单；无需实体装饰器和迁移复杂性 |
| `journal_mode = WAL` | Write-Ahead Logging，提供更好的并发读取性能 |
| `foreign_keys = ON` | 在任务和项目之间强制引用完整性 |
| `TEXT` 类型的 ID | UUID 是字符串；避免自增主键的复杂性 |
| `CHECK` 约束 | 数据库级别的 status 和 priority 值验证 |
| `tags` 作为 JSON 字符串 | SQLite 将 JSON 存储为文本；在服务层解析 |

{% hint style="info" %}
**为什么不用 TypeORM？** TypeORM 是 NestJS 的标准 ORM，但它增加了显著的复杂性（实体装饰器、迁移、仓库模式）。在本教程中，使用 `better-sqlite3` 的原始 SQL 更加透明 -- 你可以看到确切运行了什么 SQL。在生产 Solution 中，你可能更倾向于使用 TypeORM 或 Prisma 来管理迁移。
{% endhint %}

### 1.2 创建数据库模块

创建 `backend/src/database/database.module.ts`：

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

`@Global()` 装饰器使 `DatabaseService` 对所有模块可用，无需显式导入。这对于每个模块都需要的数据库连接是合适的。

## 步骤 2：任务模块

任务模块实现任务的 CRUD 操作。它由三个文件组成：服务（业务逻辑）、控制器（HTTP 端点）和模块（组装）。

### 2.1 创建任务服务

创建 `backend/src/tasks/tasks.service.ts`：

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
    this.findOne(id); // 如果未找到则抛出 NotFoundException
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

**代码详解：**

**DTO（数据传输对象）**

`CreateTaskDto` 和 `UpdateTaskDto` 接口定义 API 接受的数据。在 `CreateTaskDto` 中，只有 `title` 是必需的 -- 其他一切都有合理的默认值。在 `UpdateTaskDto` 中，所有字段都是可选的，因为你可能一次只更新一个字段。

**带过滤的 `findAll` 方法**

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

`WHERE 1=1` 模式允许我们追加 `AND` 条件，而不用担心是否是第一个条件。每个过滤器都是可选的 -- 如果没有提供过滤器，则返回所有任务。

**`mapRow` 方法**

SQLite 使用 `snake_case` 存储列名（如 `project_id`），但我们的 API 返回 `camelCase`（如 `projectId`）。`mapRow` 方法处理这种转换，同时将 `tags` JSON 字符串解析回数组。

**`create` 方法**

```typescript
create(dto: CreateTaskDto) {
  const id = uuidv4();
  const now = new Date().toISOString();
  // INSERT...
  return this.findOne(id);
}
```

我们在服务端生成 UUID（而不是在 SQLite 中），以保证可移植性。插入后，我们调用 `findOne` 返回应用了所有默认值的完整记录。

### 2.2 创建任务控制器

创建 `backend/src/tasks/tasks.controller.ts`：

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

**说明：**

- `@Controller('tasks')` 映射到 `/api/tasks`（加上 `main.ts` 中的全局前缀）
- `@Query('status')` 提取查询参数：`GET /api/tasks?status=todo`
- `@Param('id')` 提取 URL 参数：`GET /api/tasks/abc-123`
- `@Body()` 解析 JSON 请求体

控制器故意保持精简 -- 它只处理 HTTP 相关的事务（提取参数、返回响应）。所有业务逻辑都在服务中。

### 2.3 创建任务模块

创建 `backend/src/tasks/tasks.module.ts`：

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

我们导出 `TasksService`，以便其他模块可以使用它（例如，MCP 模块可能需要查找任务）。

## 步骤 3：项目模块

项目模块遵循与任务相同的模式。项目更简单 -- 它们只有名称、描述和颜色。

### 3.1 创建项目服务

创建 `backend/src/projects/projects.service.ts`：

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
    this.findOne(id); // 如果未找到则抛出异常
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

### 3.2 创建项目控制器

创建 `backend/src/projects/projects.controller.ts`：

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

### 3.3 创建项目模块

创建 `backend/src/projects/projects.module.ts`：

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

## 最终后端结构

你的后端 `src/` 目录现在应该如下：

```
backend/src/
├── main.ts                          # 应用入口
├── app.module.ts                    # 根模块
├── database/
│   ├── database.module.ts           # 全局数据库模块
│   └── database.service.ts          # SQLite 连接 + schema
├── tasks/
│   ├── tasks.module.ts              # 任务功能模块
│   ├── tasks.controller.ts          # HTTP 端点
│   └── tasks.service.ts             # 业务逻辑 + DTO
└── projects/
    ├── projects.module.ts           # 项目功能模块
    ├── projects.controller.ts       # HTTP 端点
    └── projects.service.ts          # 业务逻辑 + DTO
```

## 检查点

启动后端并测试所有端点：

```bash
cd task-manager-tutorial/backend
npm install
npm run start:dev
```

### 测试 1：创建项目

```bash
curl -s -X POST http://localhost:3003/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Q1 Sprint", "description": "第一季度交付物"}' \
  | python3 -m json.tool
```

预期响应：
```json
{
    "id": "a1b2c3d4-...",
    "name": "Q1 Sprint",
    "description": "第一季度交付物",
    "color": "#3b82f6",
    "createdAt": "2026-02-15T...",
    "updatedAt": "2026-02-15T..."
}
```

### 测试 2：创建任务

```bash
curl -s -X POST http://localhost:3003/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "审查 Q3 指标", "priority": "high"}' \
  | python3 -m json.tool
```

预期响应：
```json
{
    "id": "e5f6g7h8-...",
    "title": "审查 Q3 指标",
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

### 测试 3：列出所有任务

```bash
curl -s http://localhost:3003/api/tasks | python3 -m json.tool
```

### 测试 4：按状态过滤任务

```bash
curl -s "http://localhost:3003/api/tasks?status=todo" | python3 -m json.tool
```

### 测试 5：更新任务

将 `TASK_ID` 替换为测试 2 中获得的 ID：

```bash
curl -s -X PUT http://localhost:3003/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "description": "分析 Q3 收入和增长指标"}' \
  | python3 -m json.tool
```

### 测试 6：删除任务

```bash
curl -s -X DELETE http://localhost:3003/api/tasks/TASK_ID
```

预期响应：
```json
{"deleted": true}
```

{% hint style="success" %}
如果六个测试全部通过，你的后端就正常工作了。数据库文件会自动创建在 `data/task-manager.db`。
{% endhint %}

## 理解 NestJS 模块模式

如果你是 NestJS 新手，这里是本后端中使用的模式总结：

```
Module（组装）
  ├── Controller（HTTP 层）
  │     - 接收 HTTP 请求
  │     - 提取 params、query、body
  │     - 委托给 service
  │     - 返回响应
  │
  └── Service（业务逻辑）
        - 实现 CRUD 操作
        - 与数据库通信
        - 抛出异常（NotFoundException）
        - 定义 DTO
```

每个功能（任务、项目）都是一个自包含的模块。`AppModule` 导入所有功能模块。`DatabaseModule` 是全局共享的。

## API 总结

### 任务 API

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/tasks` | 列出所有任务（支持 `?status=`、`?priority=`、`?projectId=` 过滤） |
| `GET` | `/api/tasks/:id` | 获取单个任务 |
| `POST` | `/api/tasks` | 创建新任务（需要 `title`） |
| `PUT` | `/api/tasks/:id` | 更新任务（部分更新） |
| `DELETE` | `/api/tasks/:id` | 删除任务 |

### 项目 API

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/projects` | 列出所有项目 |
| `GET` | `/api/projects/:id` | 获取单个项目 |
| `POST` | `/api/projects` | 创建新项目（需要 `name`） |
| `PUT` | `/api/projects/:id` | 更新项目 |
| `DELETE` | `/api/projects/:id` | 删除项目 |

## 常见陷阱

{% hint style="danger" %}
**陷阱：忘记创建 `database/` 目录。** `DatabaseService` 会自动创建 `data/` 目录，但如果 `DATABASE_PATH` 指向深层嵌套路径，请确保父目录存在。
{% endhint %}

{% hint style="danger" %}
**陷阱：在 API 响应中使用 `project_id` 而不是 `projectId`。** 数据库使用 `snake_case` 列名，但 API 应返回 `camelCase`。`mapRow` 方法处理这种转换。如果跳过它，你的前端将收到不一致的字段名。
{% endhint %}

{% hint style="danger" %}
**陷阱：没有在 SQLite 中启用外键。** 默认情况下，SQLite 不强制执行外键约束。`DatabaseService` 中的 `this.db.pragma('foreign_keys = ON')` 行是必需的 -- 没有它，你可以创建引用不存在项目的任务。
{% endhint %}

## 练习

为任务 API 扩展一个 `PATCH` 端点，只更新提供的字段（而不是 `PUT` 需要所有字段）：

<details>
<summary>提示</summary>

在 `TasksController` 中添加一个 `@Patch(':id')` 方法，调用相同的 `update` 方法。现有的 `update` 逻辑已经通过 `??`（空值合并）运算符处理了部分更新。

```typescript
@Patch(':id')
patch(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
  return this.tasksService.update(id, dto);
}
```

不要忘记从 `@nestjs/common` 导入 `Patch`。
</details>

## 下一步

后端 REST API 已经完成。接下来，我们构建 MCP Server，提供 `write_output` 和自定义工具供 AI Agent 调用。继续前往 [6.3 MCP Server](03-mcp-server.md)。
