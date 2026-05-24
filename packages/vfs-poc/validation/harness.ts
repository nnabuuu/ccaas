/**
 * Validation test harness — shared by V1 (git) and V2 (sandbox).
 *
 * - Each test gets a unique id, runs in isolation, writes its own log file.
 * - Results aggregated into a single JSON per validation suite for the report.
 * - Skips (e.g. macOS-only tests on Linux) are first-class — not failures.
 */
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type TestStatus = 'pass' | 'fail' | 'skip';

export interface TestResult {
  id: string;
  description: string;
  status: TestStatus;
  durationMs: number;
  /** Free-form notes — e.g. failure mode, important observation. */
  notes?: string;
  /** Structured metrics (timings, counts) that downstream report wants. */
  metrics?: Record<string, unknown>;
  /** Path to the captured log file, relative to validation/. */
  logFile?: string;
}

export interface SuiteResult {
  suite: string;
  startedAt: string;
  finishedAt: string;
  platform: string;
  versions: Record<string, string>;
  tests: TestResult[];
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));
export const VALIDATION_ROOT = resolve(__dirname);
export const LOGS_DIR = join(VALIDATION_ROOT, 'logs');
export const RESULTS_DIR = join(VALIDATION_ROOT, 'results');

mkdirSync(LOGS_DIR, { recursive: true });
mkdirSync(RESULTS_DIR, { recursive: true });

export interface TestContext {
  /** Append a line to this test's log file. */
  log(line: string): void;
  /** Absolute path of the log file for stream targets (child_process stdio). */
  logPath: string;
  /** Attach a structured metric the report will surface. */
  metric(key: string, value: unknown): void;
  /** Attach a free-form note (string only — keep terse). */
  note(text: string): void;
}

export interface DefineTestOpts {
  id: string;
  description: string;
  suite: 'V1' | 'V2';
  /** Return true to skip with a reason. */
  skipIf?: () => string | false;
  body: (ctx: TestContext) => Promise<void>;
}

/**
 * Run a single test, capturing duration, status, log, metrics, notes.
 * Throws inside `body` ⇒ status=fail; throw message recorded in notes.
 */
export async function runTest(opts: DefineTestOpts): Promise<TestResult> {
  const logFile = join(LOGS_DIR, opts.suite, `${opts.id}.log`);
  mkdirSync(join(LOGS_DIR, opts.suite), { recursive: true });
  writeFileSync(logFile, `# ${opts.id} ${opts.description}\n# started ${new Date().toISOString()}\n\n`);

  const skipReason = opts.skipIf?.();
  if (skipReason) {
    appendFileSync(logFile, `SKIP: ${skipReason}\n`);
    return {
      id: opts.id,
      description: opts.description,
      status: 'skip',
      durationMs: 0,
      notes: skipReason,
      logFile: relLog(logFile),
    };
  }

  const metrics: Record<string, unknown> = {};
  const notes: string[] = [];
  const ctx: TestContext = {
    log: (line) => appendFileSync(logFile, `${line}\n`),
    logPath: logFile,
    metric: (k, v) => { metrics[k] = v; },
    note: (t) => { notes.push(t); },
  };

  const t0 = Date.now();
  let status: TestStatus = 'pass';
  try {
    await opts.body(ctx);
    appendFileSync(logFile, `\nPASS in ${Date.now() - t0}ms\n`);
  } catch (err) {
    status = 'fail';
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    notes.unshift(msg.split('\n')[0]!);
    appendFileSync(logFile, `\nFAIL after ${Date.now() - t0}ms: ${msg}\n`);
  }

  return {
    id: opts.id,
    description: opts.description,
    status,
    durationMs: Date.now() - t0,
    notes: notes.length ? notes.join(' | ') : undefined,
    metrics: Object.keys(metrics).length ? metrics : undefined,
    logFile: relLog(logFile),
  };
}

export async function runSuite(
  suite: 'V1' | 'V2',
  tests: DefineTestOpts[],
  versions: Record<string, string>,
): Promise<SuiteResult> {
  const startedAt = new Date().toISOString();
  const results: TestResult[] = [];
  for (const t of tests) {
    process.stderr.write(`▶ ${t.id} — ${t.description}\n`);
    const r = await runTest(t);
    const emoji = r.status === 'pass' ? '✓' : r.status === 'skip' ? '↷' : '✗';
    process.stderr.write(`  ${emoji} ${r.status} in ${r.durationMs}ms${r.notes ? ` — ${truncate(r.notes, 100)}` : ''}\n`);
    results.push(r);
  }
  const finishedAt = new Date().toISOString();
  const summary: SuiteResult = {
    suite,
    startedAt,
    finishedAt,
    platform: `${process.platform} ${process.arch}`,
    versions,
    tests: results,
  };
  const outPath = join(RESULTS_DIR, `${suite.toLowerCase()}-${process.platform}.json`);
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  process.stderr.write(`\nresults → ${outPath}\n`);
  return summary;
}

function relLog(absLogPath: string): string {
  return absLogPath.replace(`${VALIDATION_ROOT}/`, '');
}
function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
