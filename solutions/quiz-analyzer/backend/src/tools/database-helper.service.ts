import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';

/**
 * Helper service for raw SQL queries using better-sqlite3
 * Used alongside TypeORM for complex queries that are already optimized
 */
@Injectable()
export class DatabaseHelperService {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor() {
    this.dbPath = path.join(__dirname, '../../../data/quiz-analyzer.db');
  }

  /**
   * Get database connection
   */
  private getConnection(readonly = true): Database.Database {
    if (!this.db || !this.db.open) {
      this.db = new Database(this.dbPath, { readonly });
    }
    return this.db;
  }

  /**
   * Execute query (returns all results)
   */
  query<T = any>(sql: string, params: any[] = []): T[] {
    const db = this.getConnection();
    return db.prepare(sql).all(...params) as T[];
  }

  /**
   * Execute query (returns single result)
   */
  queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
    const db = this.getConnection();
    return db.prepare(sql).get(...params) as T | undefined;
  }

  /**
   * Execute write operation
   */
  execute(sql: string, params: any[] = []): Database.RunResult {
    const db = this.getConnection(false);
    return db.prepare(sql).run(...params);
  }

  /**
   * Close connection
   */
  close() {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }
}
