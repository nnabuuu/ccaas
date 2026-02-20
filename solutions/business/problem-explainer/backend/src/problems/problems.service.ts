import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import { CreateProblemDto, UpdateProblemDto, ProblemStatus } from './dto/create-problem.dto';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface Problem {
  id: string;
  tenantId: string;
  content: string;
  imageUrl?: string;
  subject: string;
  gradeLevel?: string;
  problemType?: string;
  status: ProblemStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ProblemsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database.Database,
  ) {}

  create(dto: CreateProblemDto): Problem {
    const id = uuidv4();
    const tenantId = dto.tenantId || 'default';
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO problems (id, tenant_id, content, image_url, subject, grade_level, problem_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      tenantId,
      dto.content,
      dto.imageUrl || null,
      dto.subject,
      dto.gradeLevel || null,
      dto.problemType || null,
      ProblemStatus.PENDING,
      now,
      now,
    );

    return this.findOne(id);
  }

  findAll(tenantId?: string, subject?: string, limit = 50): Problem[] {
    let sql = 'SELECT * FROM problems WHERE 1=1';
    const params: any[] = [];

    if (tenantId) {
      sql += ' AND tenant_id = ?';
      params.push(tenantId);
    }

    if (subject) {
      sql += ' AND subject = ?';
      params.push(subject);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(this.mapRow);
  }

  findOne(id: string): Problem {
    const stmt = this.db.prepare('SELECT * FROM problems WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) {
      throw new NotFoundException(`Problem ${id} not found`);
    }

    return this.mapRow(row);
  }

  update(id: string, dto: UpdateProblemDto): Problem {
    // Verify exists
    this.findOne(id);

    const updates: string[] = [];
    const params: any[] = [];

    if (dto.content !== undefined) {
      updates.push('content = ?');
      params.push(dto.content);
    }
    if (dto.imageUrl !== undefined) {
      updates.push('image_url = ?');
      params.push(dto.imageUrl);
    }
    if (dto.subject !== undefined) {
      updates.push('subject = ?');
      params.push(dto.subject);
    }
    if (dto.gradeLevel !== undefined) {
      updates.push('grade_level = ?');
      params.push(dto.gradeLevel);
    }
    if (dto.problemType !== undefined) {
      updates.push('problem_type = ?');
      params.push(dto.problemType);
    }
    if (dto.status !== undefined) {
      updates.push('status = ?');
      params.push(dto.status);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      const sql = `UPDATE problems SET ${updates.join(', ')} WHERE id = ?`;
      this.db.prepare(sql).run(...params);
    }

    return this.findOne(id);
  }

  remove(id: string): void {
    // Verify exists
    this.findOne(id);

    const stmt = this.db.prepare('DELETE FROM problems WHERE id = ?');
    stmt.run(id);
  }

  private mapRow(row: any): Problem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      content: row.content,
      imageUrl: row.image_url || undefined,
      subject: row.subject,
      gradeLevel: row.grade_level || undefined,
      problemType: row.problem_type || undefined,
      status: row.status as ProblemStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
