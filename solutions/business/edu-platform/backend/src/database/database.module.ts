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
        const dbPath = configService.get<string>('DB_PATH')
          || path.resolve(__dirname, '../../data/edu.db');

        logger.log(`Database path: ${dbPath}`);

        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        // Create tables
        db.exec(`
          CREATE TABLE IF NOT EXISTS curriculum_nodes (
            id TEXT PRIMARY KEY,
            parent_id TEXT,
            name TEXT NOT NULL,
            level INTEGER NOT NULL,
            subject TEXT NOT NULL,
            grade_range TEXT,
            sort_order INTEGER DEFAULT 0,
            cognitive TEXT,
            difficulty_min REAL,
            difficulty_max REAL,
            question_types TEXT,
            exam_weight REAL,
            prerequisites TEXT,
            common_mistakes TEXT,
            exam_patterns TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_curriculum_subject ON curriculum_nodes(subject);
          CREATE INDEX IF NOT EXISTS idx_curriculum_parent ON curriculum_nodes(parent_id);
          CREATE INDEX IF NOT EXISTS idx_curriculum_level ON curriculum_nodes(level);

          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            school TEXT DEFAULT '树人中学',
            ccaas_user_id TEXT,
            ccaas_api_key TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          );
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
  constructor() {}

  onModuleDestroy() {
    // Database cleanup handled by process exit
  }
}
