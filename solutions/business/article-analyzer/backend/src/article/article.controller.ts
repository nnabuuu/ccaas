import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Orchestrator } from '@kedge-agentic/harness';
import type { RunProgress, RunStore } from '@kedge-agentic/harness';
import { HARNESS_RUN_STORE } from '@kedge-agentic/harness';
import { ArticleService } from './article.service';
import type {
  CreateArticleDto,
  ArticleResponse,
  RunResponse,
  IterationResponse,
} from './article.types';

@ApiTags('articles')
@Controller('articles')
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly orchestrator: Orchestrator,
    @Inject(HARNESS_RUN_STORE) private readonly runStore: RunStore,
  ) {}

  @Get()
  listArticles(@Query('status') status?: string): ArticleResponse[] {
    return this.articleService.listArticles(status);
  }

  @Post()
  createArticle(@Body() dto: CreateArticleDto): ArticleResponse {
    return this.articleService.createArticle(dto);
  }

  @Get(':id')
  getArticle(@Param('id') id: string): ArticleResponse {
    const article = this.articleService.getArticle(id);
    if (!article) {
      throw new HttpException('Article not found', HttpStatus.NOT_FOUND);
    }
    return article;
  }

  @Delete(':id')
  deleteArticle(@Param('id') id: string): { ok: boolean } {
    const deleted = this.articleService.deleteArticle(id);
    if (!deleted) {
      throw new HttpException('Article not found', HttpStatus.NOT_FOUND);
    }
    return { ok: true };
  }

  @Post(':id/run')
  async startRun(@Param('id') id: string) {
    const article = this.articleService.getArticle(id);
    if (!article) {
      throw new HttpException('Article not found', HttpStatus.NOT_FOUND);
    }
    return this.articleService.startRun(id);
  }

  @Get(':id/runs')
  listRuns(@Param('id') id: string): RunResponse[] {
    return this.articleService.listRuns(id);
  }
}

@ApiTags('runs')
@Controller('runs')
export class RunController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly orchestrator: Orchestrator,
    @Inject(HARNESS_RUN_STORE) private readonly runStore: RunStore,
  ) {}

  @Get(':runId/progress')
  async getProgress(@Param('runId') runId: string): Promise<RunProgress> {
    const run = await this.runStore.getRun(runId);
    if (!run) {
      throw new HttpException('Run not found', HttpStatus.NOT_FOUND);
    }

    const scoredIterations = run.iterations.filter((i) => i.score != null);
    const scoreTrajectory = scoredIterations.map((i) => ({
      iteration: i.iteration,
      score: i.score!,
    }));

    return {
      runId: run.id,
      taskName: 'Article Logic Improvement',
      status: run.status,
      currentIteration: run.iterations.length,
      maxIterations: 10,
      scoreTrajectory,
      latestScore:
        scoreTrajectory.length > 0
          ? scoreTrajectory[scoreTrajectory.length - 1].score
          : undefined,
      exitReason: run.summary?.exitReason,
    };
  }

  @Get(':runId/iterations')
  getIterations(@Param('runId') runId: string): IterationResponse[] {
    return this.articleService.getIterations(runId);
  }

  @Get(':runId/iterations/:n')
  getIteration(
    @Param('runId') runId: string,
    @Param('n') n: string,
  ): IterationResponse {
    const iteration = this.articleService.getIteration(runId, Number(n));
    if (!iteration) {
      throw new HttpException('Iteration not found', HttpStatus.NOT_FOUND);
    }
    return iteration;
  }
}
