# 6.2 Backend Implementation

In this section, you will implement the Solution backend for the Lesson Plan Designer: a database layer with SQLite, a LessonPlans module with full CRUD and field-level patching, and a Textbook module for querying textbook metadata. By the end, you will have a working REST API that you can test with `curl`.

## Objective

Build a NestJS backend with:
- SQLite database with automatic schema initialization via a provider token
- Lesson Plan CRUD API (`GET`, `POST`, `PUT`, `DELETE /api/lesson-plans`)
- Field-level patch API (`PATCH /api/lesson-plans/:id/field`)
- Textbook cascading query API (`GET /api/textbook/subjects`, `grades`, `publishers`, `volumes`, `chapters`)

## Step 1: Database Module

The database module provides a shared SQLite connection to all other modules. We use `better-sqlite3` because it is synchronous (no async overhead for simple queries) and requires zero configuration -- no external database server needed.

### 1.1 Create the Database Module

The lesson-plan-designer uses a **provider token** pattern instead of a service class. This injects a raw `better-sqlite3` Database instance directly, avoiding an extra wrapper layer.

Create `backend/src/database/database.module.ts`:

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

        // Ensure data directory exists
        const dbDir = dirname(dbPath);
        if (!existsSync(dbDir)) {
          mkdirSync(dbDir, { recursive: true });
        }

        // Create database connection
        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        // Initialize schema
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

**Key design decisions:**

| Decision | Reasoning |
|----------|-----------|
| Provider token (`DATABASE_TOKEN`) | Injects a raw `Database` instance; no service wrapper needed |
| `better-sqlite3` over TypeORM | Simpler for a tutorial; no entity decorators, no migrations complexity |
| `journal_mode = WAL` | Write-Ahead Logging for better concurrent read performance |
| `foreign_keys = ON` | Enforces referential integrity |
| `TEXT` for IDs | UUIDs are strings; avoids auto-increment complications |
| `ConfigService` injection | Allows configuring `DB_PATH` via `.env` for different environments |
| Soft delete (`deleted INTEGER`) | Keeps records recoverable; queries filter with `WHERE deleted = 0` |

{% hint style="info" %}
**Provider token vs. service class.** The core CCAAS backend wraps the database in a `DatabaseService` class with methods like `getDb()`. For the Solution backend, we use a simpler pattern: inject the raw `Database` instance via `@Inject(DATABASE_TOKEN)`. Both approaches work -- the token pattern has less boilerplate, while the service pattern offers a place to add cross-cutting logic (e.g., query logging).
{% endhint %}

### 1.2 Understanding the Schema

The `lesson_plans` table has three groups of columns:

```
Identity & metadata:  id, title, subject, grade_level, duration_minutes, status
Textbook reference:   publisher, volume, chapter_id, chapter_title
Content fields:       objectives, student_analysis, materials_needed,
                      content, assessment_methods, teaching_methods
JSON fields:          curriculum_requirements, extra_properties, attachments
Audit fields:         create_by, create_time, update_by, update_time, remark, deleted
```

The **content fields** are plain text columns that the AI agent writes to via the `write_output` MCP tool. The **JSON fields** store structured data (curriculum standards, key-value pairs, file attachment metadata) serialized as JSON strings.

## Step 2: Type Definitions

Before writing the service, define the types. A separate types file keeps the service focused on logic.

### 2.1 Create the Types File

Create `backend/src/lesson-plans/lesson-plans.types.ts`:

```typescript
import {
  IsString, IsOptional, IsNumber, IsObject,
  IsUUID, IsIn
} from 'class-validator';

// Fields that can be synced via write_output
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

  // Textbook metadata
  publisher: string | null;
  volume: string | null;
  chapterId: number | null;
  chapterTitle: string | null;

  // Curriculum standards (structured array, stored as JSON)
  curriculumRequirements: CurriculumStandard[];

  // 6 content fields (all plain text)
  objectives: string | null;
  studentAnalysis: string | null;
  materialsNeeded: string | null;
  content: string | null;
  assessmentMethods: string | null;
  teachingMethods: string | null;

  // Extra properties (key-value pairs)
  extraProperties: Record<string, string>;

  // File attachments
  attachments: LessonPlanAttachment[];

  // Audit fields
  createBy: string | null;
  createTime: string;
  updateBy: string | null;
  updateTime: string;
  remark: string | null;
  deleted: number;
}

// Database row type (snake_case)
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

// DTOs
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

**Key patterns in the types:**

| Pattern | Purpose |
|---------|---------|
| `SYNC_FIELDS` as const | Defines exactly which fields the AI agent can write to via `write_output` |
| `LessonPlanRow` (snake_case) | Maps 1:1 to database columns; used when reading raw SQL results |
| `LessonPlan` (camelCase) | API response format; converted from `LessonPlanRow` by the service |
| `class` DTOs with decorators | Enables NestJS `ValidationPipe` to validate incoming request bodies |
| `PatchFieldDto` | Used by the field-level patch endpoint for single-field updates |

## Step 3: Lesson Plans Module

The Lesson Plans module implements CRUD operations plus a field-level patch endpoint. The patch endpoint is critical -- it is how the AI agent updates individual fields through the `write_output` protocol.

### 3.1 Create the Lesson Plans Service

Create `backend/src/lesson-plans/lesson-plans.service.ts`:

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

**Code walkthrough:**

**The `rowToLessonPlan` method**

```typescript
private rowToLessonPlan(row: LessonPlanRow): LessonPlan {
  let extraProperties: Record<string, string> = {};
  if (row.extra_properties) {
    try { extraProperties = JSON.parse(row.extra_properties); }
    catch { extraProperties = {}; }
  }
  // ... same for curriculumRequirements and attachments
}
```

This method converts database rows (snake_case) to API responses (camelCase). JSON fields (`extra_properties`, `curriculum_requirements`, `attachments`) are parsed from strings to objects, with `try/catch` to handle corrupted data gracefully.

**The `patchField` method**

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

This is the core of the `write_output` integration. The `fieldToColumn` map translates camelCase API field names to snake_case database columns. JSON fields are serialized before writing. The `SYNC_FIELDS` constant restricts which fields can be updated this way.

**The `update` method with explicit `undefined` checks**

Notice that the `update` method uses `dto.field !== undefined ? dto.field : existing.field` for nullable fields, and `dto.field ?? existing.field` for non-nullable fields. This distinction is important: `??` treats both `null` and `undefined` as "not provided", but for nullable fields like `publisher`, you want to be able to explicitly set them to `null`.

### 3.2 Create the Lesson Plans Controller

Create `backend/src/lesson-plans/lesson-plans.controller.ts`:

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

**Key endpoint details:**

- `@Controller('lesson-plans')` maps to `/api/lesson-plans` (with the global prefix from `main.ts`)
- `@Patch(':id/field')` is the field-level update endpoint. It validates that the field name is in `SYNC_FIELDS` before proceeding
- `@Delete` returns `204 No Content` on success, following REST conventions
- The `create` method adds explicit `title` validation beyond what the DTO decorator provides

### 3.3 Create the Lesson Plans Module

Create `backend/src/lesson-plans/lesson-plans.module.ts`:

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

We export `LessonPlansService` so other modules can use it (e.g., the Hooks module that intercepts file writes may need to add attachments to lesson plans).

## Step 4: Textbook Module

The Textbook module provides read-only APIs for querying textbook metadata: subjects, grades, publishers, volumes, and chapter trees. The frontend uses these cascading queries to let teachers select which textbook chapter their lesson plan covers.

### 4.1 Create the Textbook Service

Create `backend/src/textbook/textbook.service.ts`:

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

**Design notes:**

- The textbook data is loaded from **JSON files** on disk (`data/textbooks/`), not from the database. This is static reference data that does not change at runtime.
- Results are **cached** in memory after the first load for each combination.
- The cascading pattern (subjects -> grades -> publishers -> volumes -> chapters) mirrors the frontend's select dropdowns.

### 4.2 Create the Textbook Controller

Create `backend/src/textbook/textbook.controller.ts`:

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

Each endpoint adds one more query parameter in the cascade:
- `GET /api/textbook/subjects` -- no params
- `GET /api/textbook/grades?subject=math`
- `GET /api/textbook/publishers?subject=math&gradeId=3`
- `GET /api/textbook/volumes?subject=math&gradeId=3&publisher=pep`
- `GET /api/textbook/chapters?subject=math&gradeId=3&publisher=pep&volume=上册`

### 4.3 Create the Textbook Module

Create `backend/src/textbook/textbook.module.ts`:

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

## Step 5: Wire Everything Together

### 5.1 Application Module

Create `backend/src/app.module.ts`:

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

### 5.2 Application Entry Point

Create `backend/src/main.ts`:

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

**Key configuration:**

| Setting | Purpose |
|---------|---------|
| `ValidationPipe({ whitelist: true })` | Strips unknown properties from request bodies, preventing injection of unexpected fields |
| `transform: true` | Automatically converts query string values to their DTO types |
| Global prefix `api` | All routes are prefixed with `/api/` |
| Port `3002` | Solution backend runs on port 3002 (CCAAS core backend is on port 3001) |

## Final Backend Structure

Your backend `src/` directory should now look like this:

```
backend/src/
├── main.ts                              # Application entry point
├── app.module.ts                        # Root module
├── database/
│   └── database.module.ts               # Global database module (token provider)
├── lesson-plans/
│   ├── lesson-plans.module.ts           # Lesson plans feature module
│   ├── lesson-plans.controller.ts       # HTTP endpoints
│   ├── lesson-plans.service.ts          # Business logic
│   └── lesson-plans.types.ts            # Types, DTOs, constants
└── textbook/
    ├── textbook.module.ts               # Textbook feature module
    ├── textbook.controller.ts           # HTTP endpoints (read-only)
    └── textbook.service.ts              # JSON file data source
```

## Checkpoint

Start the backend and test the key endpoints:

```bash
cd lesson-plan-designer/backend
npm install
npm run start:dev
```

### Test 1: Create a lesson plan

```bash
curl -s -X POST http://localhost:3002/api/lesson-plans \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Understanding Fractions",
    "subject": "math",
    "gradeLevel": 3,
    "durationMinutes": 45
  }' | python3 -m json.tool
```

Expected response:
```json
{
    "id": "a1b2c3d4-...",
    "title": "Understanding Fractions",
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

### Test 2: Patch a single field

Replace `PLAN_ID` with the ID from Test 1:

```bash
curl -s -X PATCH http://localhost:3002/api/lesson-plans/PLAN_ID/field \
  -H "Content-Type: application/json" \
  -d '{
    "field": "objectives",
    "value": "Students will understand the concept of fractions as equal parts of a whole."
  }' | python3 -m json.tool
```

This is the same mechanism the AI agent uses via `write_output` -- updating one field at a time.

### Test 3: List all lesson plans

```bash
curl -s http://localhost:3002/api/lesson-plans | python3 -m json.tool
```

### Test 4: Query textbook subjects

```bash
curl -s http://localhost:3002/api/textbook/subjects | python3 -m json.tool
```

Expected response:
```json
[
    { "id": "math", "label": "..." },
    { "id": "physics", "label": "..." }
]
```

### Test 5: Query textbook chapters (cascading)

```bash
curl -s "http://localhost:3002/api/textbook/chapters?subject=math&gradeId=3&publisher=pep&volume=上册" \
  | python3 -m json.tool
```

### Test 6: Delete a lesson plan

```bash
curl -s -X DELETE http://localhost:3002/api/lesson-plans/PLAN_ID
# Returns 204 No Content on success
```

{% hint style="success" %}
If all six tests pass, your backend is working correctly. The database file is automatically created at `data/lesson-plans.db`.
{% endhint %}

## Understanding the NestJS Module Pattern

If you are new to NestJS, here is a summary of the pattern used throughout this backend:

```
Module (wiring)
  ├── Controller (HTTP layer)
  │     - Receives HTTP requests
  │     - Extracts params, query, body
  │     - Validates input (ValidationPipe + manual checks)
  │     - Delegates to service
  │     - Returns response
  │
  └── Service (business logic)
        - Implements CRUD operations
        - Talks to database via @Inject(DATABASE_TOKEN)
        - Converts rows to API objects (rowToLessonPlan)
        - Throws exceptions (NotFoundException)
```

Each feature (lesson-plans, textbook) is a self-contained module. The `AppModule` imports all feature modules. The `DatabaseModule` is global and shared via the `DATABASE_TOKEN` provider.

## API Summary

### Lesson Plans API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/lesson-plans` | List all lesson plans (excludes soft-deleted) |
| `GET` | `/api/lesson-plans/:id` | Get a single lesson plan |
| `POST` | `/api/lesson-plans` | Create a new lesson plan (requires `title`) |
| `PUT` | `/api/lesson-plans/:id` | Full update of a lesson plan |
| `PATCH` | `/api/lesson-plans/:id/field` | Update a single field (requires `field` and `value`) |
| `DELETE` | `/api/lesson-plans/:id` | Delete a lesson plan (returns 204) |

### Textbook API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/textbook/subjects` | List all subjects |
| `GET` | `/api/textbook/grades?subject=` | List grades for a subject |
| `GET` | `/api/textbook/publishers?subject=&gradeId=` | List publishers |
| `GET` | `/api/textbook/volumes?subject=&gradeId=&publisher=` | List volumes |
| `GET` | `/api/textbook/chapters?subject=&gradeId=&publisher=&volume=` | Get chapter tree |

## Common Pitfalls

{% hint style="danger" %}
**Pitfall: Using `snake_case` in API responses.** The database uses `snake_case` columns (e.g., `grade_level`), but the API returns `camelCase` (e.g., `gradeLevel`). The `rowToLessonPlan` method handles this conversion. If you skip it, your frontend will receive inconsistent field names and form synchronization will break.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Forgetting JSON serialization for structured fields.** The `curriculumRequirements`, `extraProperties`, and `attachments` fields are stored as JSON strings in SQLite. You must `JSON.stringify()` before writing and `JSON.parse()` after reading. The `patchField` method handles this automatically for the listed fields.
{% endhint %}

{% hint style="danger" %}
**Pitfall: Using `??` for nullable fields in `update`.** The nullish coalescing operator `??` treats `null` as "a valid value to keep". If you want to allow explicitly setting a field to `null` (e.g., clearing the `publisher`), use `dto.field !== undefined ? dto.field : existing.field` instead.
{% endhint %}

## Next Step

The backend REST API is complete. Next, we build the MCP Server that provides `write_output` and custom tools for the AI agent to call. Proceed to [6.3 MCP Server](03-mcp-server.md).
