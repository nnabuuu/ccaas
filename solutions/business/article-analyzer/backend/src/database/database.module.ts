import { Module, Global, DynamicModule, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export const DATABASE_TOKEN = 'DATABASE_CONNECTION';

@Global()
@Module({})
export class DatabaseModule {
  private static dbInstance: Database.Database;

  static forRoot(): DynamicModule {
    const logger = new Logger('DatabaseModule');
    const dbPath =
      process.env.DB_PATH ||
      path.resolve(__dirname, '../../data/article-analyzer.db');

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        input_type TEXT NOT NULL DEFAULT 'topic' CHECK(input_type IN ('topic','draft')),
        initial_input TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','running','completed','failed')),
        latest_run_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        article_id TEXT NOT NULL REFERENCES articles(id),
        task_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        final_score REAL,
        total_iterations INTEGER DEFAULT 0,
        exit_reason TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS iterations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES runs(id),
        iteration INTEGER NOT NULL,
        score REAL,
        article_text TEXT,
        analysis_report TEXT,
        writer_notes TEXT,
        dimension_scores TEXT,
        tokens_used INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(run_id, iteration)
      );

      CREATE TABLE IF NOT EXISTS step_outputs (
        run_id TEXT NOT NULL,
        iteration INTEGER NOT NULL,
        step_id TEXT NOT NULL,
        output_key TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (run_id, iteration, step_id, output_key)
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        iteration INTEGER NOT NULL,
        data TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_runs_article ON runs(article_id);
      CREATE INDEX IF NOT EXISTS idx_iterations_run ON iterations(run_id);
      CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id);
    `);

    DatabaseModule.dbInstance = db;
    logger.log(`Database initialized at ${dbPath}`);

    return {
      module: DatabaseModule,
      providers: [{ provide: DATABASE_TOKEN, useValue: db }],
      exports: [DATABASE_TOKEN],
    };
  }

  static getDatabase(): Database.Database {
    return DatabaseModule.dbInstance;
  }
}
