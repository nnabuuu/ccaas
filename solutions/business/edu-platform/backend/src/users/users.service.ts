import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_TOKEN } from '../database/database.module';
import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface EduUser {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  school: string;
  ccaas_user_id: string | null;
  ccaas_api_key: string | null;
  created_at: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database.Database) {}

  findByUsername(username: string): EduUser | undefined {
    return this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as EduUser | undefined;
  }

  findById(id: string): EduUser | undefined {
    return this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as EduUser | undefined;
  }

  create(data: {
    username: string;
    passwordHash: string;
    name: string;
    school?: string;
  }): EduUser {
    const id = randomUUID();
    this.db
      .prepare(
        'INSERT INTO users (id, username, password_hash, name, school) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, data.username, data.passwordHash, data.name, data.school || '树人中学');
    return this.findById(id)!;
  }

  updateCcaasInfo(
    id: string,
    ccaasUserId: string,
    ccaasApiKey: string,
  ): void {
    this.db
      .prepare('UPDATE users SET ccaas_user_id = ?, ccaas_api_key = ? WHERE id = ?')
      .run(ccaasUserId, ccaasApiKey, id);
  }
}
