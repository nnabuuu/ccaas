import { Module, Global, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as path from 'path';

export const DATABASE_TOKEN = 'DATABASE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const dbPath =
          configService.get<string>('DB_PATH') ||
          path.resolve(__dirname, '../../data/ideal-beauty.db');

        logger.log(`Database path: ${dbPath}`);

        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        db.exec(`
          CREATE TABLE IF NOT EXISTS class_sessions (
            id TEXT PRIMARY KEY,
            course_id TEXT NOT NULL DEFAULT 'ideal-beauty-v1',
            teacher_id TEXT NOT NULL,
            session_code TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'active', 'ended')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            ended_at TEXT
          );

          CREATE TABLE IF NOT EXISTS student_sessions (
            id TEXT PRIMARY KEY,
            class_session_id TEXT NOT NULL REFERENCES class_sessions(id),
            student_id TEXT NOT NULL,
            student_name TEXT NOT NULL,
            current_scene_idx INTEGER NOT NULL DEFAULT 0,
            joined_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(class_session_id, student_id)
          );

          CREATE TABLE IF NOT EXISTS t1_artifacts (
            student_session_id TEXT NOT NULL UNIQUE REFERENCES student_sessions(id),
            highlights TEXT,
            evaluation TEXT,
            submitted_at TEXT
          );

          CREATE TABLE IF NOT EXISTS t2_artifacts (
            student_session_id TEXT NOT NULL UNIQUE REFERENCES student_sessions(id),
            picked_transitions TEXT,
            evaluation TEXT,
            submitted_at TEXT
          );

          CREATE TABLE IF NOT EXISTS writing_versions (
            id TEXT PRIMARY KEY,
            student_session_id TEXT NOT NULL REFERENCES student_sessions(id),
            version_number INTEGER NOT NULL,
            text TEXT NOT NULL,
            word_count INTEGER NOT NULL DEFAULT 0,
            evaluation TEXT,
            scene_id TEXT NOT NULL DEFAULT 'T3' CHECK(scene_id IN ('T3', 'T4')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          CREATE TABLE IF NOT EXISTS help_messages (
            id TEXT PRIMARY KEY,
            student_session_id TEXT NOT NULL REFERENCES student_sessions(id),
            scene_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            is_dummy_reply INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          CREATE INDEX IF NOT EXISTS idx_student_sessions_class
            ON student_sessions(class_session_id);
          CREATE INDEX IF NOT EXISTS idx_writing_versions_student
            ON writing_versions(student_session_id);
          CREATE INDEX IF NOT EXISTS idx_help_messages_student
            ON help_messages(student_session_id);
        `);

        logger.log('Database initialized');
        return db;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule implements OnModuleDestroy {
  onModuleDestroy() {
    // Database cleanup handled by process exit
  }
}
