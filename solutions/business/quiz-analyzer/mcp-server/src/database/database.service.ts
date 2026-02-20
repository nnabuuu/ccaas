import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor() {
    // CommonJS: __dirname is available
    // From: mcp-server/dist/database/ → quiz-analyzer/data/
    this.dbPath = path.join(__dirname, '../../../data/quiz-analyzer.db');
  }

  onModuleInit() {
    // 模块初始化时测试数据库连接
    this.getConnection();
    console.log('✓ Database connection initialized');
  }

  /**
   * 获取数据库连接（只读）
   */
  getConnection(readonly = true): Database.Database {
    if (!this.db || !this.db.open) {
      this.db = new Database(this.dbPath, { readonly });
    }
    return this.db;
  }

  /**
   * 执行查询（返回所有结果）
   */
  query<T = any>(sql: string, params: any[] = []): T[] {
    const db = this.getConnection();
    return db.prepare(sql).all(...params) as T[];
  }

  /**
   * 执行查询（返回单个结果）
   */
  queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
    const db = this.getConnection();
    return db.prepare(sql).get(...params) as T | undefined;
  }

  /**
   * 执行写入操作
   */
  execute(sql: string, params: any[] = []): Database.RunResult {
    const db = this.getConnection(false);
    return db.prepare(sql).run(...params);
  }

  /**
   * 关闭连接
   */
  close() {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }
}
