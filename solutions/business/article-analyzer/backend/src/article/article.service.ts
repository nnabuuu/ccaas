import { Injectable, Inject } from '@nestjs/common';
import { Orchestrator } from '@kedge-agentic/harness';
import type { HarnessRun } from '@kedge-agentic/harness';
import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { DATABASE_TOKEN } from '../database/database.module';
import type {
  CreateArticleDto,
  ArticleResponse,
  RunResponse,
  IterationResponse,
  DimensionScore,
} from './article.types';

@Injectable()
export class ArticleService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database.Database,
    private readonly orchestrator: Orchestrator,
  ) {}

  createArticle(dto: CreateArticleDto): ArticleResponse {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO articles (id, title, input_type, initial_input, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      )
      .run(id, dto.title, dto.inputType, dto.initialInput, now, now);

    return {
      id,
      title: dto.title,
      inputType: dto.inputType,
      initialInput: dto.initialInput,
      status: 'draft',
      latestRunId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  getArticle(id: string): ArticleResponse | null {
    const row = this.db
      .prepare('SELECT * FROM articles WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapArticleRow(row);
  }

  listArticles(status?: string): ArticleResponse[] {
    let sql = 'SELECT * FROM articles';
    const params: unknown[] = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const rows = this.db.prepare(sql).all(...params) as Record<
      string,
      unknown
    >[];
    return rows.map((r) => this.mapArticleRow(r));
  }

  deleteArticle(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM articles WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  async startRun(articleId: string): Promise<HarnessRun> {
    this.db
      .prepare(
        `UPDATE articles SET status = 'running', updated_at = datetime('now') WHERE id = ?`,
      )
      .run(articleId);

    const run = await this.orchestrator.startRun('article-logic-improvement', {
      entityContext: { entityType: 'article', entityId: articleId },
    });

    this.db
      .prepare(
        `UPDATE articles SET latest_run_id = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(run.id, articleId);

    return run;
  }

  listRuns(articleId: string): RunResponse[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM runs WHERE article_id = ? ORDER BY started_at DESC',
      )
      .all(articleId) as Record<string, unknown>[];
    return rows.map((r) => this.mapRunRow(r));
  }

  getIterations(runId: string): IterationResponse[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM iterations WHERE run_id = ? ORDER BY iteration ASC',
      )
      .all(runId) as Record<string, unknown>[];
    return rows.map((r) => this.mapIterationRow(r));
  }

  getIteration(runId: string, n: number): IterationResponse | null {
    const row = this.db
      .prepare(
        'SELECT * FROM iterations WHERE run_id = ? AND iteration = ?',
      )
      .get(runId, n) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapIterationRow(row);
  }

  private mapArticleRow(row: Record<string, unknown>): ArticleResponse {
    return {
      id: row.id as string,
      title: row.title as string,
      inputType: row.input_type as 'topic' | 'draft',
      initialInput: row.initial_input as string,
      status: row.status as ArticleResponse['status'],
      latestRunId: (row.latest_run_id as string) || null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapRunRow(row: Record<string, unknown>): RunResponse {
    return {
      id: row.id as string,
      articleId: row.article_id as string,
      taskId: row.task_id as string,
      status: row.status as string,
      finalScore: (row.final_score as number) ?? null,
      totalIterations: (row.total_iterations as number) || 0,
      exitReason: (row.exit_reason as string) || null,
      startedAt: row.started_at as string,
      completedAt: (row.completed_at as string) || null,
    };
  }

  private mapIterationRow(row: Record<string, unknown>): IterationResponse {
    let dimensionScores: DimensionScore[] | null = null;
    if (row.dimension_scores) {
      try {
        dimensionScores = JSON.parse(row.dimension_scores as string);
      } catch {
        dimensionScores = null;
      }
    }

    let analysisReport: unknown | null = null;
    if (row.analysis_report) {
      try {
        analysisReport = JSON.parse(row.analysis_report as string);
      } catch {
        analysisReport = row.analysis_report;
      }
    }

    let writerNotes: unknown | null = null;
    if (row.writer_notes) {
      try {
        writerNotes = JSON.parse(row.writer_notes as string);
      } catch {
        writerNotes = row.writer_notes;
      }
    }

    return {
      id: row.id as number,
      runId: row.run_id as string,
      iteration: row.iteration as number,
      score: (row.score as number) ?? null,
      articleText: (row.article_text as string) || null,
      analysisReport,
      writerNotes,
      dimensionScores,
      tokensUsed: (row.tokens_used as number) || 0,
      durationMs: (row.duration_ms as number) || 0,
      createdAt: row.created_at as string,
    };
  }
}
