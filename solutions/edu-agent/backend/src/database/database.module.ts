import { Module, Global, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export const DATABASE_TOKEN = 'DATABASE_CONNECTION';
export const DATABASE_CONNECTION = DATABASE_TOKEN;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const dbPath = configService.get<string>('database.path') || './data/edu-agent.db';

        // Ensure data directory exists
        const dbDir = dirname(dbPath);
        if (!existsSync(dbDir)) {
          mkdirSync(dbDir, { recursive: true });
        }

        // Create database connection
        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        // ===== Lesson Plans tables =====
        db.exec(`
          CREATE TABLE IF NOT EXISTS lesson_plans (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            title TEXT NOT NULL,
            subject TEXT DEFAULT '',
            grade_level TEXT DEFAULT '',
            duration TEXT DEFAULT '',
            publisher TEXT DEFAULT NULL,
            volume TEXT DEFAULT NULL,
            chapter_id INTEGER DEFAULT NULL,
            chapter_title TEXT DEFAULT NULL,
            objectives TEXT DEFAULT '[]',
            standards TEXT DEFAULT '[]',
            materials TEXT DEFAULT '[]',
            activities TEXT DEFAULT '[]',
            assessment TEXT DEFAULT '{"formative":[],"summative":[]}',
            differentiation TEXT DEFAULT '{"struggling":[],"onLevel":[],"advanced":[]}',
            status TEXT DEFAULT 'draft',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);

        // Add new columns if they don't exist (migration for existing databases)
        const tableInfo = db.prepare("PRAGMA table_info(lesson_plans)").all() as Array<{ name: string }>;
        const columnNames = tableInfo.map(col => col.name);

        if (!columnNames.includes('publisher')) {
          db.exec('ALTER TABLE lesson_plans ADD COLUMN publisher TEXT DEFAULT NULL');
        }
        if (!columnNames.includes('volume')) {
          db.exec('ALTER TABLE lesson_plans ADD COLUMN volume TEXT DEFAULT NULL');
        }
        if (!columnNames.includes('chapter_id')) {
          db.exec('ALTER TABLE lesson_plans ADD COLUMN chapter_id INTEGER DEFAULT NULL');
        }
        if (!columnNames.includes('chapter_title')) {
          db.exec('ALTER TABLE lesson_plans ADD COLUMN chapter_title TEXT DEFAULT NULL');
        }

        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_lesson_plans_tenant_id
          ON lesson_plans(tenant_id)
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            lesson_plan_id TEXT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT DEFAULT '{}',
            created_at TEXT NOT NULL,
            FOREIGN KEY (lesson_plan_id) REFERENCES lesson_plans(id) ON DELETE CASCADE
          )
        `);

        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
          ON chat_messages(session_id)
        `);

        // ===== Problem Explainer tables =====
        db.exec(`
          CREATE TABLE IF NOT EXISTS problems (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default',
            content TEXT NOT NULL,
            image_url TEXT,
            subject TEXT NOT NULL,
            grade_level TEXT,
            problem_type TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );

          CREATE TABLE IF NOT EXISTS explanations (
            id TEXT PRIMARY KEY,
            problem_id TEXT NOT NULL,
            problem_analysis TEXT,
            key_knowledge TEXT,
            solution_steps TEXT,
            answer TEXT,
            common_mistakes TEXT,
            related_problems TEXT,
            hints TEXT,
            difficulty INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_problems_tenant ON problems(tenant_id);
          CREATE INDEX IF NOT EXISTS idx_problems_subject ON problems(subject);
          CREATE INDEX IF NOT EXISTS idx_explanations_problem ON explanations(problem_id);
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

  constructor(private readonly configService: ConfigService) {}

  onModuleDestroy() {
    this.logger.log('Database connection closed');
  }
}
