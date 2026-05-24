/**
 * V2 sandbox boundary validation.
 *
 * Fix one standard task; run it under 4 tool/MCP configurations × 3 rounds;
 * record per-run tool usage so we can judge whether "just-bash 完全替代 claude
 * 原生 shell" (spec D1) is achievable in the strong reading.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SessionFsManager } from '../../src/session-fs-manager.js';
import {
  FILES_MCP_ENTRY, JUST_BASH_MCP_ENTRY, TSX_BIN, runClaude,
  type McpServerConfig, type RunClaudeOptions,
} from '../../src/claude-runner.js';
import { LOGS_DIR, RESULTS_DIR } from '../harness.js';

const BASE_DIR = '/tmp/vfs-poc-validation/base';
const DELTA_STORE = '/tmp/vfs-poc-validation/sessions';
const MOUNT_ROOT = '/tmp/vfs-poc-validation/mnt';
const V2_LOG_DIR = join(LOGS_DIR, 'V2');
mkdirSync(V2_LOG_DIR, { recursive: true });
mkdirSync(BASE_DIR, { recursive: true });

const NATIVE_FS_TOOLS = new Set(['Read', 'Write', 'Edit', 'Grep', 'Glob', 'MultiEdit']);
const NATIVE_BASH_TOOLS = new Set(['Bash', 'BashOutput', 'KillBash']);

const STANDARD_PROMPT = [
  'Perform these steps in the current working directory, then briefly confirm:',
  '',
  '1. Create `docs/spec.md` with exactly this content:',
  '   # Spec',
  '   ',
  '   - item 1',
  '   - item 2',
  '',
  '2. Create `src/main.ts` with exactly this content:',
  '   console.log("hello");',
  '',
  '3. Search under `src/` for files containing the text "hello" and write the',
  '   resulting file paths (one per line) into `report.txt` at the workspace root.',
  '',
  '4. Append a new line `- item 3` to the end of `docs/spec.md`.',
  '',
  'After completing all four steps, briefly confirm.',
].join('\n');

function mkBashMcp(mountPoint: string, sessionId: string, log?: string): McpServerConfig {
  return {
    command: TSX_BIN,
    args: [JUST_BASH_MCP_ENTRY],
    env: {
      PATH: process.env.PATH ?? '',
      VFS_POC_MOUNT_POINT: mountPoint,
      VFS_POC_SESSION_ID: sessionId,
      ...(log ? { VFS_POC_MCP_LOG: log } : {}),
    },
  };
}
function mkFilesMcp(mountPoint: string, sessionId: string, log?: string): McpServerConfig {
  return {
    command: TSX_BIN,
    args: [FILES_MCP_ENTRY],
    env: {
      PATH: process.env.PATH ?? '',
      VFS_POC_MOUNT_POINT: mountPoint,
      VFS_POC_SESSION_ID: sessionId,
      ...(log ? { VFS_POC_MCP_LOG: log } : {}),
    },
  };
}

interface Config {
  id: 'C2.1' | 'C2.2' | 'C2.3' | 'C2.4';
  description: string;
  /** Compose the per-session runClaude config. */
  build(mountPoint: string, sessionId: string, logFiles: { bash?: string; files?: string }):
    Pick<RunClaudeOptions, 'disallowedTools' | 'mcpServers' | 'appendSystemPrompt' | 'forceSandboxedBash'>;
}

const CONFIGS: Config[] = [
  {
    id: 'C2.1',
    description: 'baseline — no restrictions, no extra MCP',
    build: () => ({
      forceSandboxedBash: false,
      disallowedTools: [],
      mcpServers: {},
      appendSystemPrompt: null,
    }),
  },
  {
    id: 'C2.2',
    description: 'POC1 — deny Bash only, MCP provides bash',
    build: (mp, sid, logs) => ({
      forceSandboxedBash: false,
      disallowedTools: ['Bash'],
      mcpServers: { 'vfs-poc-bash': mkBashMcp(mp, sid, logs.bash) },
      appendSystemPrompt:
        'For ANY shell command, you MUST call the MCP tool ' +
        '`mcp__vfs-poc-bash__bash` instead of the built-in Bash tool. The ' +
        'built-in Bash tool is disabled in this session.',
    }),
  },
  {
    id: 'C2.3',
    description: 'deny Bash+Read+Write+Edit+Grep+Glob, MCP only provides bash',
    build: (mp, sid, logs) => ({
      forceSandboxedBash: false,
      disallowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob', 'MultiEdit'],
      mcpServers: { 'vfs-poc-bash': mkBashMcp(mp, sid, logs.bash) },
      appendSystemPrompt:
        'In this session, the built-in tools Bash, Read, Write, Edit, Grep, ' +
        'Glob, MultiEdit are ALL disabled. You MUST do every file and shell ' +
        'operation by calling `mcp__vfs-poc-bash__bash` with a bash command.',
    }),
  },
  {
    id: 'C2.4',
    description: 'deny all + MCP provides bash AND read/write/edit/grep/glob',
    build: (mp, sid, logs) => ({
      forceSandboxedBash: false,
      disallowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob', 'MultiEdit'],
      mcpServers: {
        'vfs-poc-bash': mkBashMcp(mp, sid, logs.bash),
        'vfs-poc-files': mkFilesMcp(mp, sid, logs.files),
      },
      appendSystemPrompt:
        'In this session, the built-in tools Bash, Read, Write, Edit, Grep, ' +
        'Glob, MultiEdit are ALL disabled. Replacements are provided as MCP ' +
        'tools: use `mcp__vfs-poc-files__{read,write,edit,grep,glob}` for file ' +
        'operations, and `mcp__vfs-poc-bash__bash` for shell commands. Never ' +
        'attempt to use the built-in tools.',
    }),
  },
];

interface RunStats {
  config: string;
  round: number;
  sessionId: string;
  durationMs: number;
  exitCode: number | null;
  assistantTextHead: string;
  toolUseCounts: Record<string, number>;
  nativeFsToolUses: number;
  nativeBashToolUses: number;
  mcpToolUses: number;
  taskCompleted: boolean;
  completionDetails: Record<string, boolean>;
  errorMessages: string[];
  logFile: string;
}

function summarize(toolUses: Array<{ name: string }>): {
  counts: Record<string, number>; nativeFs: number; nativeBash: number; mcp: number;
} {
  const counts: Record<string, number> = {};
  for (const t of toolUses) counts[t.name] = (counts[t.name] ?? 0) + 1;
  let nativeFs = 0, nativeBash = 0, mcp = 0;
  for (const [name, n] of Object.entries(counts)) {
    if (name.startsWith('mcp__')) mcp += n;
    else if (NATIVE_FS_TOOLS.has(name)) nativeFs += n;
    else if (NATIVE_BASH_TOOLS.has(name)) nativeBash += n;
  }
  return { counts, nativeFs, nativeBash, mcp };
}

function verifyTask(mountPoint: string): { ok: boolean; details: Record<string, boolean>; errors: string[] } {
  const errors: string[] = [];
  const details: Record<string, boolean> = {};
  const specPath = join(mountPoint, 'docs/spec.md');
  const mainPath = join(mountPoint, 'src/main.ts');
  const reportPath = join(mountPoint, 'report.txt');

  details.specExists = existsSync(specPath);
  details.mainExists = existsSync(mainPath);
  details.reportExists = existsSync(reportPath);

  const spec = details.specExists ? readFileSync(specPath, 'utf8') : '';
  const report = details.reportExists ? readFileSync(reportPath, 'utf8') : '';

  details.specHasItem3 = /-\s*item\s*3/.test(spec);
  details.reportMentionsMain = /src\/main\.ts/.test(report);

  for (const [k, v] of Object.entries(details)) {
    if (!v) errors.push(`fail:${k}`);
  }
  return { ok: errors.length === 0, details, errors };
}

async function runOne(config: Config, round: number): Promise<RunStats> {
  const sessionId = `v2-${config.id.replace(/\./g, '_')}-r${round}-${Date.now()}`;
  const mgr = new SessionFsManager({ baseDir: BASE_DIR, deltaStore: DELTA_STORE, mountRoot: MOUNT_ROOT });
  const handle = await mgr.create(sessionId);
  const bashLog = join(V2_LOG_DIR, `${config.id}-r${round}.bash-mcp.log`);
  const filesLog = join(V2_LOG_DIR, `${config.id}-r${round}.files-mcp.log`);
  const runLog = join(V2_LOG_DIR, `${config.id}-r${round}.run.log`);
  writeFileSync(runLog, `# ${config.id} round ${round}\n# session ${sessionId}\n# started ${new Date().toISOString()}\n\n`);

  process.stderr.write(`  ${config.id}/r${round} → spawn claude (${sessionId})\n`);
  const overrides = config.build(handle.mountPoint, sessionId, { bash: bashLog, files: filesLog });
  const t0 = Date.now();
  let result: Awaited<ReturnType<typeof runClaude>>;
  try {
    result = await runClaude({
      sessionId,
      mountPoint: handle.mountPoint,
      prompt: STANDARD_PROMPT,
      timeoutMs: 180_000,
      ...overrides,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeFileSync(runLog, `FAIL: ${msg}\n`, { flag: 'a' });
    const stats: RunStats = {
      config: config.id, round, sessionId,
      durationMs: Date.now() - t0, exitCode: null, assistantTextHead: '',
      toolUseCounts: {}, nativeFsToolUses: 0, nativeBashToolUses: 0, mcpToolUses: 0,
      taskCompleted: false, completionDetails: {}, errorMessages: [msg],
      logFile: runLog,
    };
    await handle.destroy();
    return stats;
  }
  const durationMs = Date.now() - t0;

  const sum = summarize(result.toolUses);
  const verdict = verifyTask(handle.mountPoint);

  writeFileSync(runLog, [
    `exitCode: ${result.exitCode}`,
    `durationMs: ${durationMs}`,
    `toolUseCounts: ${JSON.stringify(sum.counts)}`,
    `nativeFs: ${sum.nativeFs}, nativeBash: ${sum.nativeBash}, mcp: ${sum.mcp}`,
    `taskCompleted: ${verdict.ok}`,
    `completionDetails: ${JSON.stringify(verdict.details)}`,
    `errors: ${verdict.errors.join(', ')}`,
    '',
    '=== assistantText ===',
    result.assistantText,
  ].join('\n'), { flag: 'a' });

  await handle.destroy();
  return {
    config: config.id,
    round,
    sessionId,
    durationMs,
    exitCode: result.exitCode,
    assistantTextHead: result.assistantText.slice(0, 200),
    toolUseCounts: sum.counts,
    nativeFsToolUses: sum.nativeFs,
    nativeBashToolUses: sum.nativeBash,
    mcpToolUses: sum.mcp,
    taskCompleted: verdict.ok,
    completionDetails: verdict.details,
    errorMessages: verdict.errors,
    logFile: runLog,
  };
}

async function main(): Promise<void> {
  const versions = {
    claude: execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim().split('\n')[0]!,
    agentfs: execFileSync('agentfs', ['--version'], { encoding: 'utf8' }).trim(),
    node: process.version,
  };
  const allRuns: RunStats[] = [];
  for (const cfg of CONFIGS) {
    process.stderr.write(`\n▶ ${cfg.id} — ${cfg.description}\n`);
    for (let round = 1; round <= 3; round++) {
      const stats = await runOne(cfg, round);
      const status = stats.taskCompleted ? '✓' : '✗';
      process.stderr.write(
        `  ${status} ${cfg.id}/r${round} done in ${stats.durationMs}ms — ` +
        `native=${stats.nativeFsToolUses + stats.nativeBashToolUses} mcp=${stats.mcpToolUses} ` +
        `complete=${stats.taskCompleted}\n`,
      );
      allRuns.push(stats);
    }
  }
  const out = { suite: 'V2', startedAt: new Date().toISOString(), platform: `${process.platform} ${process.arch}`, versions, runs: allRuns };
  const outPath = join(RESULTS_DIR, `v2-${process.platform}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  process.stderr.write(`\nresults → ${outPath}\n`);
}

await main();
