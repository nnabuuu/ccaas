# 6.2 后端实现

在本节中，你将实现备课方案设计器的 Solution 后端：基于 SQLite 的数据库层、具有完整 CRUD 和字段级更新的备课方案模块，以及用于查询教材元数据的教材模块。完成后，你将拥有一个可以用 `curl` 测试的 REST API。

## 目标

构建一个 NestJS 后端，包含：
- 通过 provider token 自动初始化 schema 的 SQLite 数据库
- 备课方案 CRUD API（`GET`、`POST`、`PUT`、`DELETE /api/lesson-plans`）
- 字段级更新 API（`PATCH /api/lesson-plans/:id/field`）
- 教材级联查询 API（`GET /api/textbook/subjects`、`grades`、`publishers`、`volumes`、`chapters`）

## 步骤 1：数据库模块

数据库模块为所有其他模块提供共享的 SQLite 连接。我们使用 `better-sqlite3`，因为它是同步的（简单查询无需异步开销），且零配置 -- 不需要外部数据库服务器。

### 1.1 创建数据库模块

备课方案设计器使用 **provider token** 模式，而非服务类。这直接注入原始的 `better-sqlite3` Database 实例，避免额外的包装层。

创建 `backend/src/database/database.module.ts`：

```typescript
import { Module, Global, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export const DATABASE_TOKEN = 'DATABASE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const dbPath = configService.get<string>('DB_PATH')
          || './data/lesson-plans.db';

        // 确保数据目录存在
        const dbDir = dirname(dbPath);
        if (!existsSync(dbDir)) {
          mkdirSync(dbDir, { recursive: true });
        }

        // 创建数据库连接
        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        // 初始化 schema
        db.exec(`
          CREATE TABLE IF NOT EXISTS lesson_plans (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            subject TEXT DEFAULT '',
            grade_level INTEGER DEFAULT 1,
            duration_minutes INTEGER DEFAULT 45,
            lesson_plan_code TEXT DEFAULT NULL,
            status TEXT DEFAULT 'DRAFT',

            publisher TEXT DEFAULT NULL,
            volume TEXT DEFAULT NULL,
            chapter_id INTEGER DEFAULT NULL,
            chapter_title TEXT DEFAULT NULL,

            curriculum_requirements TEXT DEFAULT NULL,
            objectives TEXT DEFAULT NULL,
            student_analysis TEXT DEFAULT NULL,
            materials_needed TEXT DEFAULT NULL,
            content TEXT DEFAULT NULL,
            assessment_methods TEXT DEFAULT NULL,
            teaching_methods TEXT DEFAULT NULL,

            extra_properties TEXT DEFAULT NULL,
            attachments TEXT DEFAULT NULL,

            create_by TEXT DEFAULT NULL,
            create_time TEXT NOT NULL,
            update_by TEXT DEFAULT NULL,
            update_time TEXT NOT NULL,
            remark TEXT DEFAULT NULL,
            deleted INTEGER DEFAULT 0
          )
        `);

        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_lesson_plans_status
          ON lesson_plans(status)
        `);

        logger.log(`Database initialized at ${dbPath}`);
        return db;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  onModuleDestroy() {
    this.logger.log('Database connection closed');
  }
}
```

**关键设计决策：**

| 决策 | 原因 |
|------|------|
| Provider token（`DATABASE_TOKEN`） | 注入原始 `Database` 实例，无需服务包装器 |
| 选择 `better-sqlite3` 而非 TypeORM | 教程中更简单；无需实体装饰器和迁移复杂性 |
| `journal_mode = WAL` | Write-Ahead Logging，提供更好的并发读取性能 |
| `foreign_keys = ON` | 强制引用完整性 |
| `TEXT` 类型的 ID | UUID 是字符串；避免自增主键的复杂性 |
| `ConfigService` 注入 | 允许通过 `.env` 配置 `DB_PATH`，适应不同环境 |
| 软删除（`deleted INTEGER`） | 保持记录可恢复；查询时用 `WHERE deleted = 0` 过滤 |

{% hint style="info" %}
**Provider token vs. 服务类。** CCAAS 核心后端将数据库包装在 `DatabaseService` 类中，提供 `getDb()` 等方法。对于 Solution 后端，我们使用更简单的模式：通过 `@Inject(DATABASE_TOKEN)` 注入原始 `Database` 实例。两种方式都可以 -- token 模式更少样板代码，服务模式则提供添加横切逻辑的位置（如查询日志）。
{% endhint %}

### 1.2 理解 Schema

`lesson_plans` 表有三组列：

```
身份和元数据：    id, title, subject, grade_level, duration_minutes, status
教材引用：        publisher, volume, chapter_id, chapter_title
内容字段：        objectives, student_analysis, materials_needed,
                  content, assessment_methods, teaching_methods
JSON 字段：       curriculum_requirements, extra_properties, attachments
审计字段：        create_by, create_time, update_by, update_time, remark, deleted
```

**内容字段**是纯文本列，AI agent 通过 `write_output` MCP 工具写入。**JSON 字段**存储结构化数据（课程标准、键值对、文件附件元数据），序列化为 JSON 字符串。

## 步骤 2：类型定义

在编写服务之前，先定义类型。独立的类型文件让服务专注于逻辑。

### 2.1 创建类型文件

创建 `backend/src/lesson-plans/lesson-plans.types.ts`：

```typescript
import {
  IsString, IsOptional, IsNumber, IsObject,
  IsUUID, IsIn
} from 'class-validator';

// 可通过 write_output 同步的字段
export const SYNC_FIELDS = [
  'title',
  'subject',
  'gradeLevel',
  'durationMinutes',
  'lessonPlanCode',
  'objectives',
  'content',
  'teachingMethods',
  'materialsNeeded',
  'assessmentMethods',
  'curriculumRequirements',
  'studentAnalysis',
  'extraProperties',
  'status',
  'attachments',
] as const;

export type SyncField = typeof SYNC_FIELDS[number];

export type LessonPlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface CurriculumStandard {
  id: number;
  standardCode: string;
  title: string;
  stage: string;
  standardType: string;
  contentDomain: string;
}

export interface LessonPlanAttachment {
  id: string;
  fileId: string;
  fileName: string;
  fileType: 'script' | 'audio' | 'ppt' | 'pdf' | 'other';
  mimeType: string;
  size: number;
  downloadUrl: string;
  uploadedAt: string;
  description?: string;
}

export interface LessonPlan {
  id: string;
  title: string;
  subject: string;
  gradeLevel: number;
  durationMinutes: number;
  lessonPlanCode: string | null;
  status: LessonPlanStatus;

  // 教材元数据
  publisher: string | null;
  volume: string | null;
  chapterId: number | null;
  chapterTitle: string | null;

  // 课程标准（结构化数组，存储为 JSON）
  curriculumRequirements: CurriculumStandard[];

  // 6 个内容字段（全部为纯文本）
  objectives: string | null;
  studentAnalysis: string | null;
  materialsNeeded: string | null;
  content: string | null;
  assessmentMethods: string | null;
  teachingMethods: string | null;

  // 扩展属性（键值对）
  extraProperties: Record<string, string>;

  // 文件附件
  attachments: LessonPlanAttachment[];

  // 审计字段
  createBy: string | null;
  createTime: string;
  updateBy: string | null;
  updateTime: string;
  remark: string | null;
  deleted: number;
}

// 数据库行类型（snake_case）
export interface LessonPlanRow {
  id: string;
  title: string;
  subject: string;
  grade_level: number;
  duration_minutes: number;
  lesson_plan_code: string | null;
  status: string;

  publisher: string | null;
  volume: string | null;
  chapter_id: number | null;
  chapter_title: string | null;

  curriculum_requirements: string | null;
  objectives: string | null;
  student_analysis: string | null;
  materials_needed: string | null;
  content: string | null;
  assessment_methods: string | null;
  teaching_methods: string | null;

  extra_properties: string | null;
  attachments: string | null;

  create_by: string | null;
  create_time: string;
  update_by: string | null;
  update_time: string;
  remark: string | null;
  deleted: number;
}

// DTO
export class CreateLessonPlanDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsNumber()
  gradeLevel?: number;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  lessonPlanCode?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  volume?: string;

  @IsOptional()
  @IsNumber()
  chapterId?: number;

  @IsOptional()
  @IsString()
  chapterTitle?: string;
}

export class UpdateLessonPlanDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsNumber()
  gradeLevel?: number;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  lessonPlanCode?: string | null;

  @IsOptional()
  @IsString()
  status?: LessonPlanStatus;

  @IsOptional()
  @IsString()
  publisher?: string | null;

  @IsOptional()
  @IsString()
  volume?: string | null;

  @IsOptional()
  @IsNumber()
  chapterId?: number | null;

  @IsOptional()
  @IsString()
  chapterTitle?: string | null;

  @IsOptional()
  curriculumRequirements?: CurriculumStandard[];

  @IsOptional()
  @IsString()
  objectives?: string | null;

  @IsOptional()
  @IsString()
  studentAnalysis?: string | null;

  @IsOptional()
  @IsString()
  materialsNeeded?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  assessmentMethods?: string | null;

  @IsOptional()
  @IsString()
  teachingMethods?: string | null;

  @IsOptional()
  @IsObject()
  extraProperties?: Record<string, string>;

  @IsOptional()
  @IsString()
  remark?: string | null;
}

export class PatchFieldDto {
  @IsString()
  field: SyncField;

  value: unknown;
}
```

**类型中的关键模式：**

| 模式 | 用途 |
|------|------|
| `SYNC_FIELDS` as const | 精确定义 AI agent 可以通过 `write_output` 写入的字段 |
| `LessonPlanRow`（snake_case） | 与数据库列 1:1 映射；读取原始 SQL 结果时使用 |
| `LessonPlan`（camelCase） | API 响应格式；由服务从 `LessonPlanRow` 转换而来 |
| `class` DTO 配合装饰器 | 启用 NestJS `ValidationPipe` 验证传入的请求体 |
| `PatchFieldDto` | 用于字段级更新端点的单字段更新 |

## 步骤 3：备课方案模块

备课方案模块实现 CRUD 操作以及字段级更新端点。字段级更新端点至关重要 -- 它是 AI agent 通过 `write_output` 协议更新各个字段的方式。

### 3.1 创建备课方案服务

创建 `backend/src/lesson-plans/lesson-plans.service.ts`：

```typescript
import {
  Injectable, Inject, NotFoundException
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { DATABASE_TOKEN } from '../database/database.module';
import {
  LessonPlan,
  LessonPlanRow,
  CreateLessonPlanDto,
  UpdateLessonPlanDto,
  SyncField,
  LessonPlanStatus,
} from './lesson-plans.types';

@Injectable()
export class LessonPlansService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database.Database,
  ) {}

  private rowToLessonPlan(row: LessonPlanRow): LessonPlan {
    let extraProperties: Record<string, string> = {};
    if (row.extra_properties) {
      try { extraProperties = JSON.parse(row.extra_properties); }
      catch { extraProperties = {}; }
    }

    let curriculumRequirements = [];
    if (row.curriculum_requirements) {
      try { curriculumRequirements = JSON.parse(row.curriculum_requirements); }
      catch { curriculumRequirements = []; }
    }

    let attachments = [];
    if (row.attachments) {
      try { attachments = JSON.parse(row.attachments); }
      catch { attachments = []; }
    }

    return {
      id: row.id,
      title: row.title,
      subject: row.subject,
      gradeLevel: row.grade_level,
      durationMinutes: row.duration_minutes,
      lessonPlanCode: row.lesson_plan_code,
      status: row.status as LessonPlanStatus,

      publisher: row.publisher,
      volume: row.volume,
      chapterId: row.chapter_id,
      chapterTitle: row.chapter_title,

      curriculumRequirements,
      objectives: row.objectives,
      studentAnalysis: row.student_analysis,
      materialsNeeded: row.materials_needed,
      content: row.content,
      assessmentMethods: row.assessment_methods,
      teachingMethods: row.teaching_methods,

      extraProperties,
      attachments,

      createBy: row.create_by,
      createTime: row.create_time,
      updateBy: row.update_by,
      updateTime: row.update_time,
      remark: row.remark,
      deleted: row.deleted,
    };
  }

  findAll(): LessonPlan[] {
    const rows = this.db
      .prepare('SELECT * FROM lesson_plans WHERE deleted = 0 ORDER BY update_time DESC')
      .all() as LessonPlanRow[];
    return rows.map((row) => this.rowToLessonPlan(row));
  }

  findById(id: string): LessonPlan | null {
    const row = this.db
      .prepare('SELECT * FROM lesson_plans WHERE id = ? AND deleted = 0')
      .get(id) as LessonPlanRow | undefined;
    return row ? this.rowToLessonPlan(row) : null;
  }

  findByIdOrFail(id: string): LessonPlan {
    const plan = this.findById(id);
    if (!plan) {
      throw new NotFoundException(`Lesson plan ${id} not found`);
    }
    return plan;
  }

  create(dto: CreateLessonPlanDto): LessonPlan {
    const now = new Date().toISOString();
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO lesson_plans (
        id, title, subject, grade_level, duration_minutes,
        lesson_plan_code, publisher, volume, chapter_id, chapter_title,
        status, create_time, update_time
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        'DRAFT', ?, ?
      )
    `).run(
      id,
      dto.title,
      dto.subject || '',
      dto.gradeLevel || 1,
      dto.durationMinutes || 45,
      dto.lessonPlanCode || null,
      dto.publisher || null,
      dto.volume || null,
      dto.chapterId || null,
      dto.chapterTitle || null,
      now,
      now,
    );

    return this.findByIdOrFail(id);
  }

  update(id: string, dto: UpdateLessonPlanDto): LessonPlan {
    const existing = this.findByIdOrFail(id);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE lesson_plans SET
        title = ?, subject = ?, grade_level = ?, duration_minutes = ?,
        lesson_plan_code = ?, status = ?,
        publisher = ?, volume = ?, chapter_id = ?, chapter_title = ?,
        curriculum_requirements = ?, objectives = ?, student_analysis = ?,
        materials_needed = ?, content = ?, assessment_methods = ?,
        teaching_methods = ?, extra_properties = ?, attachments = ?,
        remark = ?, update_time = ?
      WHERE id = ?
    `).run(
      dto.title ?? existing.title,
      dto.subject ?? existing.subject,
      dto.gradeLevel ?? existing.gradeLevel,
      dto.durationMinutes ?? existing.durationMinutes,
      dto.lessonPlanCode !== undefined ? dto.lessonPlanCode : existing.lessonPlanCode,
      dto.status ?? existing.status,
      dto.publisher !== undefined ? dto.publisher : existing.publisher,
      dto.volume !== undefined ? dto.volume : existing.volume,
      dto.chapterId !== undefined ? dto.chapterId : existing.chapterId,
      dto.chapterTitle !== undefined ? dto.chapterTitle : existing.chapterTitle,
      JSON.stringify(dto.curriculumRequirements !== undefined
        ? dto.curriculumRequirements : existing.curriculumRequirements),
      dto.objectives !== undefined ? dto.objectives : existing.objectives,
      dto.studentAnalysis !== undefined ? dto.studentAnalysis : existing.studentAnalysis,
      dto.materialsNeeded !== undefined ? dto.materialsNeeded : existing.materialsNeeded,
      dto.content !== undefined ? dto.content : existing.content,
      dto.assessmentMethods !== undefined ? dto.assessmentMethods : existing.assessmentMethods,
      dto.teachingMethods !== undefined ? dto.teachingMethods : existing.teachingMethods,
      JSON.stringify(dto.extraProperties ?? existing.extraProperties),
      JSON.stringify(existing.attachments),
      dto.remark !== undefined ? dto.remark : existing.remark,
      now,
      id,
    );

    return this.findByIdOrFail(id);
  }

  patchField(id: string, field: SyncField, value: unknown): LessonPlan {
    this.findByIdOrFail(id);
    const now = new Date().toISOString();

    const fieldToColumn: Record<SyncField, string> = {
      title: 'title',
      subject: 'subject',
      gradeLevel: 'grade_level',
      durationMinutes: 'duration_minutes',
      lessonPlanCode: 'lesson_plan_code',
      objectives: 'objectives',
      content: 'content',
      teachingMethods: 'teaching_methods',
      materialsNeeded: 'materials_needed',
      assessmentMethods: 'assessment_methods',
      curriculumRequirements: 'curriculum_requirements',
      studentAnalysis: 'student_analysis',
      extraProperties: 'extra_properties',
      status: 'status',
      attachments: 'attachments',
    };

    const column = fieldToColumn[field];
    const dbValue =
      (field === 'extraProperties'
        || field === 'curriculumRequirements'
        || field === 'attachments')
        ? JSON.stringify(value)
        : value;

    this.db.prepare(
      `UPDATE lesson_plans SET ${column} = ?, update_time = ? WHERE id = ?`
    ).run(dbValue, now, id);

    return this.findByIdOrFail(id);
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM lesson_plans WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }
}
```

**代码详解：**

**`rowToLessonPlan` 方法**

```typescript
private rowToLessonPlan(row: LessonPlanRow): LessonPlan {
  let extraProperties: Record<string, string> = {};
  if (row.extra_properties) {
    try { extraProperties = JSON.parse(row.extra_properties); }
    catch { extraProperties = {}; }
  }
  // ... curriculumRequirements 和 attachments 同理
}
```

此方法将数据库行（snake_case）转换为 API 响应（camelCase）。JSON 字段（`extra_properties`、`curriculum_requirements`、`attachments`）从字符串解析为对象，使用 `try/catch` 优雅处理损坏数据。

**`patchField` 方法**

```typescript
patchField(id: string, field: SyncField, value: unknown): LessonPlan {
  const fieldToColumn: Record<SyncField, string> = {
    title: 'title',
    gradeLevel: 'grade_level',
    // ...
  };

  const column = fieldToColumn[field];
  const dbValue = (field === 'extraProperties' || ...)
    ? JSON.stringify(value)
    : value;

  this.db.prepare(
    `UPDATE lesson_plans SET ${column} = ?, update_time = ? WHERE id = ?`
  ).run(dbValue, now, id);
}
```

这是 `write_output` 集成的核心。`fieldToColumn` 映射将 camelCase API 字段名转换为 snake_case 数据库列名。JSON 字段在写入前序列化。`SYNC_FIELDS` 常量限制了哪些字段可以通过此方式更新。

**`update` 方法中的显式 `undefined` 检查**

注意 `update` 方法对可空字段使用 `dto.field !== undefined ? dto.field : existing.field`，对非可空字段使用 `dto.field ?? existing.field`。这个区别很重要：`??` 将 `null` 和 `undefined` 都视为"未提供"，但对于 `publisher` 这样的可空字段，你需要能够显式将其设置为 `null`。

### 3.2 创建备课方案控制器

创建 `backend/src/lesson-plans/lesson-plans.controller.ts`：

```typescript
import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, HttpCode, HttpStatus,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { LessonPlansService } from './lesson-plans.service';
import {
  CreateLessonPlanDto,
  UpdateLessonPlanDto,
  PatchFieldDto,
  SYNC_FIELDS,
} from './lesson-plans.types';

@Controller('lesson-plans')
export class LessonPlansController {
  constructor(private readonly lessonPlansService: LessonPlansService) {}

  @Get()
  findAll() {
    return this.lessonPlansService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const plan = this.lessonPlansService.findById(id);
    if (!plan) {
      throw new NotFoundException('Lesson plan not found');
    }
    return plan;
  }

  @Post()
  create(@Body() dto: CreateLessonPlanDto) {
    if (!dto.title) {
      throw new BadRequestException('title is required');
    }
    return this.lessonPlansService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLessonPlanDto) {
    return this.lessonPlansService.update(id, dto);
  }

  @Patch(':id/field')
  patchField(@Param('id') id: string, @Body() dto: PatchFieldDto) {
    const validFields: readonly string[] = SYNC_FIELDS;
    if (!validFields.includes(dto.field)) {
      throw new BadRequestException(`Invalid field: ${dto.field}`);
    }
    return this.lessonPlansService.patchField(id, dto.field, dto.value);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    const deleted = this.lessonPlansService.delete(id);
    if (!deleted) {
      throw new NotFoundException('Lesson plan not found');
    }
  }
}
```

**关键端点细节：**

- `@Controller('lesson-plans')` 映射到 `/api/lesson-plans`（加上 `main.ts` 中的全局前缀）
- `@Patch(':id/field')` 是字段级更新端点。它在处理前验证字段名是否在 `SYNC_FIELDS` 中
- `@Delete` 成功时返回 `204 No Content`，遵循 REST 规范
- `create` 方法在 DTO 装饰器之外添加了显式的 `title` 验证

### 3.3 创建备课方案模块

创建 `backend/src/lesson-plans/lesson-plans.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { LessonPlansController } from './lesson-plans.controller';
import { LessonPlansService } from './lesson-plans.service';

@Module({
  controllers: [LessonPlansController],
  providers: [LessonPlansService],
  exports: [LessonPlansService],
})
export class LessonPlansModule {}
```

我们导出 `LessonPlansService`，以便其他模块可以使用它（例如，拦截文件写入的 Hooks 模块可能需要向备课方案添加附件）。

## 步骤 4：教材模块

教材模块提供只读 API，用于查询教材元数据：科目、年级、出版社、册别和章节树。前端使用这些级联查询让教师选择备课方案涵盖的教材章节。

### 4.1 创建教材服务

创建 `backend/src/textbook/textbook.service.ts`：

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface TextbookSubject { id: string; label: string; }
export interface TextbookGrade { id: number; label: string; stage: string; }
export interface TextbookPublisher { id: string; label: string; }
export interface TextbookVolume { id: string; label: string; }
export interface TextbookChapter {
  id: number;
  title: string;
  children?: TextbookChapter[];
}

interface TextbookIndex {
  subjects: string[];
  editions: {
    subject: string;
    grade: number;
    volume: string;
    file: string;
  }[];
}

@Injectable()
export class TextbookService implements OnModuleInit {
  private index: TextbookIndex | null = null;
  private dataPath: string;
  private chaptersCache: Map<string, TextbookChapter[]> = new Map();

  constructor() {
    this.dataPath = path.join(__dirname, '../../../data/textbooks');
  }

  onModuleInit() {
    this.loadIndex();
  }

  private loadIndex(): void {
    try {
      const indexPath = path.join(this.dataPath, '_index.json');
      const content = fs.readFileSync(indexPath, 'utf-8');
      this.index = JSON.parse(content);
    } catch (error) {
      console.error('Failed to load textbook index:', error);
      this.index = null;
    }
  }

  getSubjects(): TextbookSubject[] {
    if (!this.index) return [];
    return this.index.subjects.map((name) => ({
      id: this.subjectToId(name),
      label: name,
    }));
  }

  getGrades(subject: string): TextbookGrade[] {
    if (!this.index) return [];
    const subjectName = this.normalizeSubject(subject);
    const grades = this.index.editions
      .filter((e) => e.subject === subjectName)
      .map((e) => e.grade);
    return [...new Set(grades)].sort((a, b) => a - b)
      .map((g) => ({ id: g, label: `${g}`, stage: '' }));
  }

  getPublishers(subject: string, gradeId: number): TextbookPublisher[] {
    if (!this.index) return [];
    const subjectName = this.normalizeSubject(subject);
    const hasData = this.index.editions.some(
      (e) => e.subject === subjectName && e.grade === gradeId,
    );
    if (!hasData) return [];
    return [{ id: 'pep', label: '人教版' }];
  }

  getVolumes(
    subject: string, gradeId: number, publisher: string,
  ): TextbookVolume[] {
    if (!this.index) return [];
    const subjectName = this.normalizeSubject(subject);
    const volumes = this.index.editions
      .filter((e) => e.subject === subjectName && e.grade === gradeId)
      .map((e) => e.volume);
    return [...new Set(volumes)].map((v) => ({ id: v, label: v }));
  }

  getChapters(
    subject: string, gradeId: number,
    publisher: string, volume: string,
  ): TextbookChapter[] {
    if (!this.index) return [];
    const subjectName = this.normalizeSubject(subject);
    const cacheKey = `${subjectName}-${gradeId}-${volume}`;
    if (this.chaptersCache.has(cacheKey)) {
      return this.chaptersCache.get(cacheKey)!;
    }

    const edition = this.index.editions.find(
      (e) => e.subject === subjectName
        && e.grade === gradeId && e.volume === volume,
    );
    if (!edition) return [];

    try {
      const chapterPath = path.join(
        this.dataPath, 'chapters', edition.file,
      );
      const content = fs.readFileSync(chapterPath, 'utf-8');
      const data = JSON.parse(content);
      this.chaptersCache.set(cacheKey, data.chapters);
      return data.chapters;
    } catch {
      return [];
    }
  }

  private normalizeSubject(subject: string): string { /* ... */ }
  private subjectToId(name: string): string { /* ... */ }
}
```

**设计说明：**

- 教材数据从磁盘上的 **JSON 文件**（`data/textbooks/`）加载，而非从数据库。这是运行时不会变化的静态参考数据。
- 每种组合首次加载后，结果会在内存中**缓存**。
- 级联模式（科目 -> 年级 -> 出版社 -> 册别 -> 章节）与前端的下拉选择框相对应。

### 4.2 创建教材控制器

创建 `backend/src/textbook/textbook.controller.ts`：

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { TextbookService } from './textbook.service';

@Controller('textbook')
export class TextbookController {
  constructor(private readonly textbookService: TextbookService) {}

  @Get('subjects')
  getSubjects() {
    return this.textbookService.getSubjects();
  }

  @Get('grades')
  getGrades(@Query('subject') subject: string) {
    return this.textbookService.getGrades(subject);
  }

  @Get('publishers')
  getPublishers(
    @Query('subject') subject: string,
    @Query('gradeId') gradeId: string,
  ) {
    return this.textbookService.getPublishers(subject, parseInt(gradeId, 10));
  }

  @Get('volumes')
  getVolumes(
    @Query('subject') subject: string,
    @Query('gradeId') gradeId: string,
    @Query('publisher') publisher: string,
  ) {
    return this.textbookService.getVolumes(
      subject, parseInt(gradeId, 10), publisher,
    );
  }

  @Get('chapters')
  getChapters(
    @Query('subject') subject: string,
    @Query('gradeId') gradeId: string,
    @Query('publisher') publisher: string,
    @Query('volume') volume: string,
  ) {
    return this.textbookService.getChapters(
      subject, parseInt(gradeId, 10), publisher, volume,
    );
  }
}
```

每个端点在级联中添加一个查询参数：
- `GET /api/textbook/subjects` -- 无参数
- `GET /api/textbook/grades?subject=math`
- `GET /api/textbook/publishers?subject=math&gradeId=3`
- `GET /api/textbook/volumes?subject=math&gradeId=3&publisher=pep`
- `GET /api/textbook/chapters?subject=math&gradeId=3&publisher=pep&volume=上册`

### 4.3 创建教材模块

创建 `backend/src/textbook/textbook.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { TextbookController } from './textbook.controller';
import { TextbookService } from './textbook.service';

@Module({
  controllers: [TextbookController],
  providers: [TextbookService],
  exports: [TextbookService],
})
export class TextbookModule {}
```

## 步骤 5：组装所有模块

### 5.1 应用模块

创建 `backend/src/app.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { LessonPlansModule } from './lesson-plans/lesson-plans.module';
import { TextbookModule } from './textbook/textbook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    LessonPlansModule,
    TextbookModule,
  ],
})
export class AppModule {}
```

### 5.2 应用入口

创建 `backend/src/main.ts`：

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Allow all origins in development; configure specific origins in production
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3002;
  await app.listen(port);
  logger.log(`Lesson Plan Designer Backend running on port ${port}`);
}

bootstrap();
```

**关键配置：**

| 设置 | 用途 |
|------|------|
| `ValidationPipe({ whitelist: true })` | 从请求体中剥离未知属性，防止注入意外字段 |
| `transform: true` | 自动将查询字符串值转换为 DTO 类型 |
| 全局前缀 `api` | 所有路由都以 `/api/` 为前缀 |
| 端口 `3002` | Solution 后端运行在 3002 端口（CCAAS 核心后端在 3001 端口） |

## 最终后端结构

你的后端 `src/` 目录现在应该如下：

```
backend/src/
├── main.ts                              # 应用入口
├── app.module.ts                        # 根模块
├── database/
│   └── database.module.ts               # 全局数据库模块（token provider）
├── lesson-plans/
│   ├── lesson-plans.module.ts           # 备课方案功能模块
│   ├── lesson-plans.controller.ts       # HTTP 端点
│   ├── lesson-plans.service.ts          # 业务逻辑
│   └── lesson-plans.types.ts            # 类型、DTO、常量
└── textbook/
    ├── textbook.module.ts               # 教材功能模块
    ├── textbook.controller.ts           # HTTP 端点（只读）
    └── textbook.service.ts              # JSON 文件数据源
```

## 检查点

启动后端并测试关键端点：

```bash
cd lesson-plan-designer/backend
npm install
npm run start:dev
```

### 测试 1：创建备课方案

```bash
curl -s -X POST http://localhost:3002/api/lesson-plans \
  -H "Content-Type: application/json" \
  -d '{
    "title": "认识分数",
    "subject": "math",
    "gradeLevel": 3,
    "durationMinutes": 45
  }' | python3 -m json.tool
```

预期响应：
```json
{
    "id": "a1b2c3d4-...",
    "title": "认识分数",
    "subject": "math",
    "gradeLevel": 3,
    "durationMinutes": 45,
    "lessonPlanCode": null,
    "status": "DRAFT",
    "publisher": null,
    "volume": null,
    "chapterId": null,
    "chapterTitle": null,
    "curriculumRequirements": [],
    "objectives": null,
    "studentAnalysis": null,
    "materialsNeeded": null,
    "content": null,
    "assessmentMethods": null,
    "teachingMethods": null,
    "extraProperties": {},
    "attachments": [],
    "createBy": null,
    "createTime": "2026-02-15T...",
    "updateBy": null,
    "updateTime": "2026-02-15T...",
    "remark": null,
    "deleted": 0
}
```

### 测试 2：更新单个字段

将 `PLAN_ID` 替换为测试 1 中获得的 ID：

```bash
curl -s -X PATCH http://localhost:3002/api/lesson-plans/PLAN_ID/field \
  -H "Content-Type: application/json" \
  -d '{
    "field": "objectives",
    "value": "学生将理解分数作为整体等分部分的概念。"
  }' | python3 -m json.tool
```

这与 AI agent 通过 `write_output` 使用的机制相同 -- 一次更新一个字段。

### 测试 3：列出所有备课方案

```bash
curl -s http://localhost:3002/api/lesson-plans | python3 -m json.tool
```

### 测试 4：查询教材科目

```bash
curl -s http://localhost:3002/api/textbook/subjects | python3 -m json.tool
```

预期响应：
```json
[
    { "id": "math", "label": "数学" },
    { "id": "physics", "label": "物理" }
]
```

### 测试 5：查询教材章节（级联）

```bash
curl -s "http://localhost:3002/api/textbook/chapters?subject=math&gradeId=3&publisher=pep&volume=上册" \
  | python3 -m json.tool
```

### 测试 6：删除备课方案

```bash
curl -s -X DELETE http://localhost:3002/api/lesson-plans/PLAN_ID
# 成功时返回 204 No Content
```

{% hint style="success" %}
如果六个测试全部通过，你的后端就正常工作了。数据库文件会自动创建在 `data/lesson-plans.db`。
{% endhint %}

## 理解 NestJS 模块模式

如果你是 NestJS 新手，这里是本后端中使用的模式总结：

```
Module（组装）
  ├── Controller（HTTP 层）
  │     - 接收 HTTP 请求
  │     - 提取 params、query、body
  │     - 验证输入（ValidationPipe + 手动检查）
  │     - 委托给 service
  │     - 返回响应
  │
  └── Service（业务逻辑）
        - 实现 CRUD 操作
        - 通过 @Inject(DATABASE_TOKEN) 与数据库通信
        - 转换行到 API 对象（rowToLessonPlan）
        - 抛出异常（NotFoundException）
```

每个功能（备课方案、教材）都是一个自包含的模块。`AppModule` 导入所有功能模块。`DatabaseModule` 通过 `DATABASE_TOKEN` provider 全局共享。

## API 总结

### 备课方案 API

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/lesson-plans` | 列出所有备课方案（排除软删除的） |
| `GET` | `/api/lesson-plans/:id` | 获取单个备课方案 |
| `POST` | `/api/lesson-plans` | 创建新备课方案（需要 `title`） |
| `PUT` | `/api/lesson-plans/:id` | 完整更新备课方案 |
| `PATCH` | `/api/lesson-plans/:id/field` | 更新单个字段（需要 `field` 和 `value`） |
| `DELETE` | `/api/lesson-plans/:id` | 删除备课方案（返回 204） |

### 教材 API

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/textbook/subjects` | 列出所有科目 |
| `GET` | `/api/textbook/grades?subject=` | 列出某科目的年级 |
| `GET` | `/api/textbook/publishers?subject=&gradeId=` | 列出出版社 |
| `GET` | `/api/textbook/volumes?subject=&gradeId=&publisher=` | 列出册别 |
| `GET` | `/api/textbook/chapters?subject=&gradeId=&publisher=&volume=` | 获取章节树 |

## 常见陷阱

{% hint style="danger" %}
**陷阱：在 API 响应中使用 `snake_case`。** 数据库使用 `snake_case` 列名（如 `grade_level`），但 API 应返回 `camelCase`（如 `gradeLevel`）。`rowToLessonPlan` 方法处理这种转换。如果跳过它，你的前端将收到不一致的字段名，表单同步将中断。
{% endhint %}

{% hint style="danger" %}
**陷阱：忘记结构化字段的 JSON 序列化。** `curriculumRequirements`、`extraProperties` 和 `attachments` 字段在 SQLite 中存储为 JSON 字符串。写入前必须 `JSON.stringify()`，读取后必须 `JSON.parse()`。`patchField` 方法为这些字段自动处理序列化。
{% endhint %}

{% hint style="danger" %}
**陷阱：对可空字段使用 `??`。** 空值合并运算符 `??` 将 `null` 视为"保留的有效值"。如果你想允许显式将字段设置为 `null`（例如清除 `publisher`），请使用 `dto.field !== undefined ? dto.field : existing.field`。
{% endhint %}

## 下一步

后端 REST API 已经完成。接下来，我们构建 MCP Server，提供 `write_output` 和自定义工具供 AI agent 调用。继续前往 [6.3 MCP Server](03-mcp-server.md)。
