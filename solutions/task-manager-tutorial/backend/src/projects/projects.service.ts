import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateProjectDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  color?: string;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly db: DatabaseService) {}

  findAll() {
    const rows = this.db.getDb().prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map(this.mapRow);
  }

  findOne(id: string) {
    const row = this.db.getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return this.mapRow(row);
  }

  create(dto: CreateProjectDto) {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.getDb().prepare(`
      INSERT INTO projects (id, name, description, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.name,
      dto.description || null,
      dto.color || '#3b82f6',
      now,
      now,
    );

    return this.findOne(id);
  }

  update(id: string, dto: UpdateProjectDto) {
    const existing = this.findOne(id);
    const now = new Date().toISOString();

    this.db.getDb().prepare(`
      UPDATE projects SET name = ?, description = ?, color = ?, updated_at = ?
      WHERE id = ?
    `).run(
      dto.name ?? existing.name,
      dto.description ?? existing.description,
      dto.color ?? existing.color,
      now,
      id,
    );

    return this.findOne(id);
  }

  remove(id: string) {
    this.findOne(id); // throws if not found
    this.db.getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
    return { deleted: true };
  }

  private mapRow(row: Record<string, unknown>) {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | null,
      color: row.color as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
