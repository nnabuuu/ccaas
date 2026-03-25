import { Injectable, Inject } from '@nestjs/common';
import Database from 'better-sqlite3';
import { DATABASE_TOKEN } from '../database/database.module';

interface CurriculumNode {
  id: string;
  parent_id: string | null;
  name: string;
  level: number;
  subject: string;
  grade_range: string | null;
  sort_order: number;
  cognitive: string | null;
  difficulty_min: number | null;
  difficulty_max: number | null;
  question_types: string | null;
  exam_weight: number | null;
  prerequisites: string | null;
  common_mistakes: string | null;
  exam_patterns: string | null;
}

@Injectable()
export class CurriculumService {
  constructor(@Inject(DATABASE_TOKEN) private db: Database.Database) {}

  getSubjects(): { subject: string; count: number }[] {
    return this.db.prepare(
      'SELECT subject, COUNT(*) as count FROM curriculum_nodes GROUP BY subject ORDER BY subject'
    ).all() as { subject: string; count: number }[];
  }

  getTree(subject: string, grade?: string): CurriculumNode[] {
    let sql = 'SELECT * FROM curriculum_nodes WHERE subject = ?';
    const params: string[] = [subject];

    if (grade) {
      sql += ' AND (grade_range IS NULL OR grade_range LIKE ?)';
      params.push(`%${grade}%`);
    }

    sql += ' ORDER BY sort_order';
    return this.db.prepare(sql).all(...params) as CurriculumNode[];
  }

  getChildren(parentId: string): CurriculumNode[] {
    return this.db.prepare(
      'SELECT * FROM curriculum_nodes WHERE parent_id = ? ORDER BY sort_order'
    ).all(parentId) as CurriculumNode[];
  }

  search(query: string): CurriculumNode[] {
    return this.db.prepare(
      'SELECT * FROM curriculum_nodes WHERE name LIKE ? ORDER BY level, sort_order LIMIT 50'
    ).all(`%${query}%`) as CurriculumNode[];
  }
}
