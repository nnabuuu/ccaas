import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface SolutionStep {
  stepNumber: number;
  description: string;
  formula?: string;
  explanation: string;
}

export interface Explanation {
  id: string;
  problemId: string;
  problemAnalysis?: string;
  keyKnowledge: string[];
  solutionSteps: SolutionStep[];
  answer?: string;
  commonMistakes: string[];
  relatedProblems: string[];
  hints?: string;
  difficulty?: number;
  createdAt: string;
}

export interface CreateExplanationDto {
  problemId: string;
  problemAnalysis?: string;
  keyKnowledge?: string[];
  solutionSteps?: SolutionStep[];
  answer?: string;
  commonMistakes?: string[];
  relatedProblems?: string[];
  hints?: string;
  difficulty?: number;
}

export interface UpdateExplanationDto {
  problemAnalysis?: string;
  keyKnowledge?: string[];
  solutionSteps?: SolutionStep[];
  answer?: string;
  commonMistakes?: string[];
  relatedProblems?: string[];
  hints?: string;
  difficulty?: number;
}

@Injectable()
export class ExplanationsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database.Database,
  ) {}

  create(dto: CreateExplanationDto): Explanation {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO explanations (id, problem_id, problem_analysis, key_knowledge, solution_steps, answer, common_mistakes, related_problems, hints, difficulty, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      dto.problemId,
      dto.problemAnalysis || null,
      JSON.stringify(dto.keyKnowledge || []),
      JSON.stringify(dto.solutionSteps || []),
      dto.answer || null,
      JSON.stringify(dto.commonMistakes || []),
      JSON.stringify(dto.relatedProblems || []),
      dto.hints || null,
      dto.difficulty || null,
      now,
    );

    return this.findOne(id);
  }

  findByProblemId(problemId: string): Explanation | null {
    const stmt = this.db.prepare('SELECT * FROM explanations WHERE problem_id = ? ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get(problemId) as any;

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }

  findOne(id: string): Explanation {
    const stmt = this.db.prepare('SELECT * FROM explanations WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) {
      throw new NotFoundException(`Explanation ${id} not found`);
    }

    return this.mapRow(row);
  }

  update(id: string, dto: UpdateExplanationDto): Explanation {
    // Verify exists
    this.findOne(id);

    const updates: string[] = [];
    const params: any[] = [];

    if (dto.problemAnalysis !== undefined) {
      updates.push('problem_analysis = ?');
      params.push(dto.problemAnalysis);
    }
    if (dto.keyKnowledge !== undefined) {
      updates.push('key_knowledge = ?');
      params.push(JSON.stringify(dto.keyKnowledge));
    }
    if (dto.solutionSteps !== undefined) {
      updates.push('solution_steps = ?');
      params.push(JSON.stringify(dto.solutionSteps));
    }
    if (dto.answer !== undefined) {
      updates.push('answer = ?');
      params.push(dto.answer);
    }
    if (dto.commonMistakes !== undefined) {
      updates.push('common_mistakes = ?');
      params.push(JSON.stringify(dto.commonMistakes));
    }
    if (dto.relatedProblems !== undefined) {
      updates.push('related_problems = ?');
      params.push(JSON.stringify(dto.relatedProblems));
    }
    if (dto.hints !== undefined) {
      updates.push('hints = ?');
      params.push(dto.hints);
    }
    if (dto.difficulty !== undefined) {
      updates.push('difficulty = ?');
      params.push(dto.difficulty);
    }

    if (updates.length > 0) {
      params.push(id);
      const sql = `UPDATE explanations SET ${updates.join(', ')} WHERE id = ?`;
      this.db.prepare(sql).run(...params);
    }

    return this.findOne(id);
  }

  private mapRow(row: any): Explanation {
    return {
      id: row.id,
      problemId: row.problem_id,
      problemAnalysis: row.problem_analysis || undefined,
      keyKnowledge: JSON.parse(row.key_knowledge || '[]'),
      solutionSteps: JSON.parse(row.solution_steps || '[]'),
      answer: row.answer || undefined,
      commonMistakes: JSON.parse(row.common_mistakes || '[]'),
      relatedProblems: JSON.parse(row.related_problems || '[]'),
      hints: row.hints || undefined,
      difficulty: row.difficulty || undefined,
      createdAt: row.created_at,
    };
  }
}
