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
        const dbPath = configService.get<string>('DB_PATH') || './data/lesson-plans.db';

        // Ensure data directory exists
        const dbDir = dirname(dbPath);
        if (!existsSync(dbDir)) {
          mkdirSync(dbDir, { recursive: true });
        }

        // Create database connection
        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        // Migration: if old schema detected (tenant_id column exists), drop and recreate
        const tableExists = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='lesson_plans'"
        ).get();

        if (tableExists) {
          const tableInfo = db.prepare("PRAGMA table_info(lesson_plans)").all() as Array<{ name: string }>;
          const columnNames = tableInfo.map(col => col.name);

          if (columnNames.includes('tenant_id') || !columnNames.includes('publisher')) {
            logger.warn('Detected old schema. Dropping and recreating lesson_plans table.');
            db.exec('DROP TABLE IF EXISTS lesson_plans');
          }
        }

        // Initialize schema (new plain-text model)
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

        // Migration: Add attachments column if it doesn't exist
        const tableInfo = db.prepare("PRAGMA table_info(lesson_plans)").all() as Array<{ name: string }>;
        const columnNames = tableInfo.map(col => col.name);

        if (!columnNames.includes('attachments')) {
          logger.log('Adding attachments column to lesson_plans table');
          db.exec('ALTER TABLE lesson_plans ADD COLUMN attachments TEXT DEFAULT NULL');
        }

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
