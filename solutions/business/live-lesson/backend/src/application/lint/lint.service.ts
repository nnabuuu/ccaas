import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { jsonrepair } from 'jsonrepair';

import { ProjectService } from '../../project/project.service';
import { TeachingRequirementsService } from '../../teaching-requirements/teaching-requirements.service';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import {
  LintCategory,
  LintIssue,
  LintResult,
  LintSeverity,
  idleResult,
} from './lint.schema';
import { LintPromptBuilder, RefencedLibItem } from './lint-prompt-builder';

/**
 * AI lint service — cross-checks plan/lesson-plan.md vs
 * execution/manifest.json for the four design dimensions (req coverage,
 * goal alignment, step grounding, subject/grade fit).
 *
 * Cache is in-memory + per-process (Map<projectId, LintResult>). Restart
 * loses results — acceptable for MVP since the frontend re-triggers a
 * run on next visit. Auto-trigger is debounced (default 5s) + dedupes
 * via content-hash, so a burst of saves only spends one LLM call.
 *
 * See lesson-plan-format-design.md §4.3 + the AI-lint plan
 * (kind-exploring-mango.md) for the architectural context.
 */

const DEBOUNCE_MS = 5_000;
const PLAN_PATH = 'plan/lesson-plan.md';
const MANIFEST_PATH = 'execution/manifest.json';
const REQ_URI_REGEX = /req:\/\/([\w.\-]+)/g;
const VALID_SEVERITIES: ReadonlySet<LintSeverity> = new Set([
  'error',
  'warning',
  'info',
]);
const VALID_CATEGORIES: ReadonlySet<LintCategory> = new Set([
  'req-coverage',
  'goal-alignment',
  'step-grounding',
  'subject-grade-fit',
]);

@Injectable()
export class LintService {
  private readonly logger = new Logger(LintService.name);

  /** Latest cached result per project. */
  private readonly cache = new Map<string, LintResult>();

  /** Pending debounce timers; key = projectId. */
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Single-flight in-flight runs. Concurrent callers (e.g. the manual
   * Run button + the debounce timer firing at the same moment) share
   * one promise, so we never end up with two parallel LLM calls for
   * the same project.
   */
  private readonly inFlight = new Map<string, Promise<LintResult>>();

  /**
   * "Dirty during run" set. When `enqueue` is called while a run is
   * already in flight for that project, we tag it; the finally block of
   * the in-flight compute re-enqueues so the new content gets its own
   * lint. Without this, a save mid-run is silently dropped (the in-flight
   * promise resolves with the OLD content's analysis).
   */
  private readonly dirtyDuringRun = new Set<string>();

  constructor(
    @Inject(forwardRef(() => ProjectService))
    private readonly projects: ProjectService,
    private readonly teachingRequirements: TeachingRequirementsService,
    private readonly ai: AiPromptBuilder,
    private readonly promptBuilder: LintPromptBuilder,
  ) {}

  /**
   * Read the current lint state. If the cache is fresh (hash matches
   * current files), return it as-is. If the cache is missing, return
   * 'idle'. If the cache is stale (content changed), return the cached
   * result with status flipped to 'stale' AND enqueue an auto-rerun so
   * the next poll sees fresh.
   *
   * Intentionally does NOT block on a fresh run — the frontend polls
   * for completion. This keeps the GET endpoint cheap.
   */
  async getOrInit(projectId: string): Promise<LintResult> {
    const cached = this.cache.get(projectId);
    if (!cached) {
      return idleResult(projectId);
    }
    if (cached.status === 'pending') {
      // A run is in flight; reflect the current shape so the frontend
      // shows a spinner. The shared promise will populate the cache
      // on completion.
      return cached;
    }
    // For terminal states (fresh / stale / error), recompute the
    // hash against current files to detect drift since the last run.
    try {
      const { plan, manifest } = await this.loadFiles(projectId);
      const currentHash = hashContent(plan, manifest);
      if (currentHash !== cached.contentHash) {
        const stale: LintResult = { ...cached, status: 'stale' };
        this.cache.set(projectId, stale);
        // Auto-trigger a re-run so the next poll sees fresh; no await.
        this.enqueue(projectId);
        return stale;
      }
      return cached;
    } catch (err) {
      // Project missing / files missing: surface the cache as-is rather
      // than throwing. The next manual run will produce a clean error.
      this.logger.warn(
        `getOrInit hash check failed for ${projectId}: ${errMsg(err)}`,
      );
      return cached;
    }
  }

  /**
   * Debounced auto-trigger. Called from ProjectService write hooks.
   * Bursts of saves collapse to one run after `delayMs` of quiet.
   *
   * Safe to call from any path; we never await the resulting LLM call.
   */
  enqueue(projectId: string, delayMs: number = DEBOUNCE_MS): void {
    // If a run is already in flight, mark dirty so the finally block
    // re-enqueues after completion. Otherwise we'd drop this save's
    // content on the floor — the in-flight promise resolves with the
    // pre-save snapshot, the cache locks to that result, and a follow-up
    // GET returns "fresh" with stale analysis.
    if (this.inFlight.has(projectId)) {
      this.dirtyDuringRun.add(projectId);
      return;
    }

    const existing = this.debounceTimers.get(projectId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(projectId);
      // Fire-and-forget; errors land in the cached LintResult.
      this.run(projectId).catch((err) => {
        this.logger.warn(
          `debounced lint run failed for ${projectId}: ${errMsg(err)}`,
        );
      });
    }, delayMs);

    // Don't let a queued lint timer keep the Node process alive on
    // shutdown — tests + clean Ctrl-C both depend on this.
    timer.unref?.();
    this.debounceTimers.set(projectId, timer);
  }

  /**
   * Run lint synchronously (caller awaits). The manual "Run" button
   * goes through here. Concurrent callers share the same in-flight
   * promise so the LLM is only invoked once per concurrent burst.
   */
  async run(projectId: string): Promise<LintResult> {
    const existing = this.inFlight.get(projectId);
    if (existing) return existing;

    // Reset the dirty flag before starting; any enqueue between now and
    // finally re-sets it, signalling "ran on stale content, must re-run".
    this.dirtyDuringRun.delete(projectId);

    const promise = this.compute(projectId).finally(() => {
      this.inFlight.delete(projectId);
      if (this.dirtyDuringRun.delete(projectId)) {
        // Saves happened during this run; their content is unseen by
        // the result we just cached. Trigger another debounced run so
        // the new content gets analyzed.
        this.enqueue(projectId);
      }
    });
    this.inFlight.set(projectId, promise);
    return promise;
  }

  /**
   * Discard cache for a project. Exposed for tests + future admin
   * tooling (e.g. "force rerun after library upgrade").
   */
  invalidate(projectId: string): void {
    this.cache.delete(projectId);
    this.dirtyDuringRun.delete(projectId);
    const timer = this.debounceTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(projectId);
    }
  }

  // ── internals ──

  private async compute(projectId: string): Promise<LintResult> {
    // Mark pending so callers polling `getOrInit` see the spinner state.
    this.cache.set(projectId, {
      projectId,
      status: 'pending',
      contentHash: this.cache.get(projectId)?.contentHash ?? '',
      issues: this.cache.get(projectId)?.issues ?? [],
      generatedAt: new Date().toISOString(),
    });

    let plan = '';
    let manifest = '';
    try {
      ({ plan, manifest } = await this.loadFiles(projectId));
    } catch (err) {
      return this.persistError(projectId, '', `读取项目文件失败: ${errMsg(err)}`);
    }

    const contentHash = hashContent(plan, manifest);
    const refIds = extractRefIds(plan);
    const libItems = this.resolveLibItems(refIds);
    const { systemPrompt, userMessage } = this.promptBuilder.build({
      plan,
      manifest,
      libItems,
    });

    let raw: string;
    try {
      raw = await this.ai.callLlm(systemPrompt, userMessage, {
        responseFormat: { type: 'json_object' },
        // Temperature low — lint should be deterministic-ish; high
        // creativity makes the same input produce inconsistent issue
        // lists across runs, which looks broken to users.
        temperature: 0.2,
        maxTokens: 1500,
      });
    } catch (err) {
      return this.persistError(projectId, contentHash, `LLM 调用失败: ${errMsg(err)}`);
    }

    let issues: LintIssue[];
    try {
      issues = parseLintResponse(raw);
    } catch (err) {
      this.logger.warn(
        `lint parse failed for ${projectId}: ${errMsg(err)} — raw: ${raw.slice(0, 200)}`,
      );
      return this.persistError(projectId, contentHash, `解析 LLM 响应失败: ${errMsg(err)}`);
    }

    const result: LintResult = {
      projectId,
      status: 'fresh',
      contentHash,
      issues,
      generatedAt: new Date().toISOString(),
    };
    this.cache.set(projectId, result);
    this.logger.log(
      `lint completed for ${projectId}: ${issues.length} issue(s)`,
    );
    return result;
  }

  private persistError(
    projectId: string,
    contentHash: string,
    errorMessage: string,
  ): LintResult {
    const result: LintResult = {
      projectId,
      status: 'error',
      contentHash,
      issues: [],
      generatedAt: new Date().toISOString(),
      errorMessage,
    };
    this.cache.set(projectId, result);
    return result;
  }

  /**
   * Load the two source files. Missing files are coerced to empty
   * strings — a project where the user deleted plan/lesson-plan.md
   * still gets a lint result (likely all "missing plan" issues from
   * the LLM) rather than a 5xx.
   */
  private async loadFiles(
    projectId: string,
  ): Promise<{ plan: string; manifest: string }> {
    const plan = await this.readSafe(projectId, PLAN_PATH);
    const manifest = await this.readSafe(projectId, MANIFEST_PATH);
    return { plan, manifest };
  }

  private async readSafe(projectId: string, path: string): Promise<string> {
    try {
      const file = await this.projects.readFile(projectId, path);
      return file.content;
    } catch (err) {
      if (err instanceof NotFoundException) return '';
      throw err;
    }
  }

  private resolveLibItems(refIds: readonly string[]): RefencedLibItem[] {
    const out: RefencedLibItem[] = [];
    const seen = new Set<string>();
    for (const id of refIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const item = this.teachingRequirements.tryFindItemById(id);
      if (!item) continue; // stale ref; LLM will flag via req-coverage
      out.push({
        id: item.id,
        text: item.text,
        subject: item.subject,
        categoryLabel: item.categoryLabel,
      });
    }
    return out;
  }
}

/** Stable, short content key. SHA-256 truncated — collision-resistance
 * isn't load-bearing (just cache invalidation), so 16 hex chars is plenty. */
export function hashContent(plan: string, manifest: string): string {
  return createHash('sha256')
    .update(`${plan}\0${manifest}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Best-effort regex extraction of `req://<id>` substrings from the
 * plan markdown. Using a regex (not the full parser) keeps this
 * service free of the creator-side lesson-plan-md lib; accuracy is
 * fine — the LLM tolerates a slightly noisy lib-items section.
 */
export function extractRefIds(plan: string): string[] {
  const out: string[] = [];
  for (const match of plan.matchAll(REQ_URI_REGEX)) {
    // Trim a trailing dot picked up at sentence-end (e.g. "see req://r-1.2.3.")
    // — the regex permits `.` inside the id, but a final dot is almost
    // always punctuation, not part of the id.
    out.push(match[1].replace(/\.$/, ''));
  }
  return out;
}

/**
 * Parse the LLM's JSON response. Strips an optional ```json fence,
 * runs jsonrepair as a safety net (LLMs occasionally emit trailing
 * commas / unquoted keys), then narrows each item defensively.
 *
 * Items with invalid severity / category are dropped (logged
 * upstream). A completely unparseable response throws so the caller
 * persists status='error'.
 */
export function parseLintResponse(raw: string): LintIssue[] {
  const cleaned = raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim();
  if (!cleaned) {
    throw new Error('empty response');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = JSON.parse(jsonrepair(cleaned));
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).issues)) {
    throw new Error('response missing issues[]');
  }
  const issues: LintIssue[] = [];
  for (const item of (parsed as { issues: unknown[] }).issues) {
    const issue = narrowIssue(item);
    if (issue) issues.push(issue);
  }
  return issues;
}

function narrowIssue(raw: unknown): LintIssue | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.severity !== 'string' ||
    !VALID_SEVERITIES.has(obj.severity as LintSeverity)
  ) {
    return null;
  }
  if (
    typeof obj.category !== 'string' ||
    !VALID_CATEGORIES.has(obj.category as LintCategory)
  ) {
    return null;
  }
  if (typeof obj.message !== 'string' || !obj.message.trim()) {
    return null;
  }
  const out: LintIssue = {
    severity: obj.severity as LintSeverity,
    category: obj.category as LintCategory,
    message: obj.message,
  };
  if (typeof obj.suggestion === 'string' && obj.suggestion.trim()) {
    out.suggestion = obj.suggestion;
  }
  if (obj.location && typeof obj.location === 'object') {
    const loc = obj.location as Record<string, unknown>;
    if (loc.file === 'plan' || loc.file === 'manifest') {
      out.location = { file: loc.file };
      if (typeof loc.refId === 'string' && loc.refId.trim()) {
        out.location.refId = loc.refId;
      }
      if (typeof loc.stepIdx === 'number' && Number.isFinite(loc.stepIdx)) {
        out.location.stepIdx = loc.stepIdx;
      }
    }
  }
  return out;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
