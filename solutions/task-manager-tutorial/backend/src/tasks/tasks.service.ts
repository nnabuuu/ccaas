import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  projectId?: string;
  dueDate?: string;
  tags?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  projectId?: string;
  dueDate?: string;
  tags?: string[];
}

export interface TaskFilter {
  status?: string;
  projectId?: string;
  priority?: string;
}

@Injectable()
export class TasksService {
  constructor(private readonly db: DatabaseService) {}

  findAll(filter: TaskFilter = {}) {
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: unknown[] = [];

    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter.projectId) {
      sql += ' AND project_id = ?';
      params.push(filter.projectId);
    }
    if (filter.priority) {
      sql += ' AND priority = ?';
      params.push(filter.priority);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.db.getDb().prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(this.mapRow);
  }

  findOne(id: string) {
    const row = this.db.getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return this.mapRow(row);
  }

  create(dto: CreateTaskDto) {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.getDb().prepare(`
      INSERT INTO tasks (id, title, description, status, priority, project_id, due_date, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.title,
      dto.description || null,
      dto.status || 'todo',
      dto.priority || 'medium',
      dto.projectId || null,
      dto.dueDate || null,
      JSON.stringify(dto.tags || []),
      now,
      now,
    );

    return this.findOne(id);
  }

  update(id: string, dto: UpdateTaskDto) {
    const existing = this.findOne(id);
    const now = new Date().toISOString();

    this.db.getDb().prepare(`
      UPDATE tasks SET
        title = ?, description = ?, status = ?, priority = ?,
        project_id = ?, due_date = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(
      dto.title ?? existing.title,
      dto.description ?? existing.description,
      dto.status ?? existing.status,
      dto.priority ?? existing.priority,
      dto.projectId ?? existing.projectId,
      dto.dueDate ?? existing.dueDate,
      JSON.stringify(dto.tags ?? existing.tags),
      now,
      id,
    );

    return this.findOne(id);
  }

  remove(id: string) {
    this.findOne(id); // throws if not found
    this.db.getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return { deleted: true };
  }

  private mapRow(row: Record<string, unknown>) {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | null,
      status: row.status as string,
      priority: row.priority as string,
      projectId: row.project_id as string | null,
      dueDate: row.due_date as string | null,
      tags: JSON.parse((row.tags as string) || '[]'),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
