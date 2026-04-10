import type {
  RunStore,
  HarnessRun,
  RunFilters,
  IterationRecord,
} from '@kedge-agentic/harness';
import type Database from 'better-sqlite3';

export class SqliteRunStore implements RunStore {
  constructor(private readonly db: Database.Database) {}

  async createRun(run: HarnessRun): Promise<HarnessRun> {
    this.db
      .prepare(
        `INSERT INTO runs (id, article_id, task_id, status, started_at)
       VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        run.id,
        run.trigger?.entityContext?.entityId ?? '',
        run.taskId,
        run.status,
        run.startedAt,
      );
    return run;
  }

  async updateRun(runId: string, updates: Partial<HarnessRun>): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      sets.push('status = ?');
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      sets.push('completed_at = ?');
      values.push(updates.completedAt);
    }
    if (updates.summary?.finalScore !== undefined) {
      sets.push('final_score = ?');
      values.push(updates.summary.finalScore);
    }
    if (updates.summary?.totalIterations !== undefined) {
      sets.push('total_iterations = ?');
      values.push(updates.summary.totalIterations);
    }
    if (updates.summary?.exitReason !== undefined) {
      sets.push('exit_reason = ?');
      values.push(updates.summary.exitReason);
    }

    if (sets.length > 0) {
      values.push(runId);
      this.db
        .prepare(`UPDATE runs SET ${sets.join(', ')} WHERE id = ?`)
        .run(...values);
    }
  }

  async getRun(runId: string): Promise<HarnessRun | null> {
    const row = this.db
      .prepare('SELECT * FROM runs WHERE id = ?')
      .get(runId) as Record<string, unknown> | undefined;
    if (!row) return null;

    const iterationRows = this.db
      .prepare(
        'SELECT * FROM iterations WHERE run_id = ? ORDER BY iteration ASC',
      )
      .all(runId) as Record<string, unknown>[];

    const iterations: IterationRecord[] = iterationRows.map((r) =>
      this.mapIterationRow(r),
    );

    return {
      id: row.id as string,
      taskId: row.task_id as string,
      status: row.status as HarnessRun['status'],
      trigger: {
        entityContext: {
          entityType: 'article',
          entityId: row.article_id as string,
        },
      },
      iterations,
      totalTokens: 0,
      totalCostEstimate: 0,
      startedAt: row.started_at as string,
      completedAt: (row.completed_at as string) || undefined,
      summary:
        row.final_score != null
          ? {
              finalScore: row.final_score as number,
              totalIterations: (row.total_iterations as number) || 0,
              exitReason: (row.exit_reason as string) || '',
              scoreTrajectory: iterations
                .filter((i) => i.score != null)
                .map((i) => ({ iteration: i.iteration, score: i.score! })),
              bestIteration: 0,
            }
          : undefined,
    };
  }

  async listRuns(filters?: RunFilters): Promise<HarnessRun[]> {
    let sql = 'SELECT id FROM runs WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.taskId) {
      sql += ' AND task_id = ?';
      params.push(filters.taskId);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY started_at DESC';

    const rows = this.db.prepare(sql).all(...params) as { id: string }[];
    const runs: HarnessRun[] = [];
    for (const row of rows) {
      const run = await this.getRun(row.id);
      if (run) runs.push(run);
    }
    return runs;
  }

  async appendIteration(
    runId: string,
    iteration: IterationRecord,
  ): Promise<void> {
    const score = iteration.score ?? null;
    const articleText =
      (iteration.steps?.[0]?.outputs?.draft as { content?: string })
        ?.content ?? null;
    const analysisReport = iteration.steps?.[1]?.outputs?.analysis_report
      ? JSON.stringify(iteration.steps[1].outputs.analysis_report)
      : null;
    const dimensionScores =
      (
        iteration.steps?.[1]?.outputs?.analysis_report as {
          dimensions?: unknown;
        }
      )?.dimensions != null
        ? JSON.stringify(
            (
              iteration.steps[1].outputs.analysis_report as {
                dimensions: unknown;
              }
            ).dimensions,
          )
        : null;

    const tokensUsed = iteration.steps.reduce(
      (sum, s) => sum + (s.tokensUsed || 0),
      0,
    );
    const durationMs = iteration.steps.reduce(
      (sum, s) => sum + (s.durationMs || 0),
      0,
    );

    this.db
      .prepare(
        `INSERT OR REPLACE INTO iterations
       (run_id, iteration, score, article_text, analysis_report, dimension_scores, tokens_used, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        runId,
        iteration.iteration,
        score,
        articleText,
        analysisReport,
        dimensionScores,
        tokensUsed,
        durationMs,
      );
  }

  async saveStepOutput(
    runId: string,
    iteration: number,
    stepId: string,
    outputKey: string,
    data: unknown,
  ): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO step_outputs (run_id, iteration, step_id, output_key, data)
       VALUES (?, ?, ?, ?, ?)`,
      )
      .run(runId, iteration, stepId, outputKey, JSON.stringify(data));
  }

  async getStepOutput(
    runId: string,
    iteration: number,
    stepId: string,
    outputKey: string,
  ): Promise<unknown | null> {
    const row = this.db
      .prepare(
        `SELECT data FROM step_outputs
       WHERE run_id = ? AND iteration = ? AND step_id = ? AND output_key = ?`,
      )
      .get(runId, iteration, stepId, outputKey) as
      | { data: string }
      | undefined;
    if (!row) return null;
    return JSON.parse(row.data);
  }

  async saveArtifact(
    runId: string,
    iteration: number,
    artifact: unknown,
  ): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO artifacts (run_id, iteration, data) VALUES (?, ?, ?)`,
      )
      .run(runId, iteration, JSON.stringify(artifact));
  }

  async getLatestArtifact(runId: string): Promise<unknown | null> {
    const row = this.db
      .prepare(
        `SELECT data FROM artifacts WHERE run_id = ? ORDER BY iteration DESC LIMIT 1`,
      )
      .get(runId) as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data);
  }

  private mapIterationRow(row: Record<string, unknown>): IterationRecord {
    return {
      iteration: row.iteration as number,
      status: 'completed',
      steps: [],
      score: row.score as number | undefined,
      keyChanges: '',
      topIssue: '',
      timestamp: row.created_at as string,
    };
  }
}
