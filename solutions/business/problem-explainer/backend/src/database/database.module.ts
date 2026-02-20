import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: (configService: ConfigService) => {
        const dbPath = configService.get<string>('database.path') || './data/problem-explainer.db';
        const dir = path.dirname(dbPath);

        // Ensure directory exists
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const db = new Database(dbPath);

        // Enable foreign keys
        db.pragma('foreign_keys = ON');

        // Initialize tables
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
            key_knowledge TEXT, -- JSON array
            solution_steps TEXT, -- JSON array
            answer TEXT,
            common_mistakes TEXT, -- JSON array
            related_problems TEXT, -- JSON array
            hints TEXT,
            difficulty INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_problems_tenant ON problems(tenant_id);
          CREATE INDEX IF NOT EXISTS idx_problems_subject ON problems(subject);
          CREATE INDEX IF NOT EXISTS idx_explanations_problem ON explanations(problem_id);
        `);

        return db;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule implements OnModuleInit {
  onModuleInit() {
    console.log('Database module initialized');
  }
}
