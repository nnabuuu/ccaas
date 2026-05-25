/**
 * Application Configuration
 *
 * Centralized configuration loaded from environment variables.
 */

export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),

  workspace: {
    dir: process.env.WORKSPACE_DIR || '.agent-workspace',
    sessionTtlMs: parseInt(process.env.SESSION_TTL_MS || '300000', 10), // 5 min (free tier default; overridden per-tenant)
    maxSessions: parseInt(process.env.MAX_SESSIONS || '100', 10),
    cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '300000', 10), // 5 min
    maxProcessingMs: parseInt(process.env.MAX_PROCESSING_MS || '1800000', 10), // 30 min hard cap for stuck sessions
    cleanupPressureHighThreshold: parseInt(process.env.CLEANUP_PRESSURE_HIGH || '80', 10),     // % → start aggressive eviction
    cleanupPressureCriticalThreshold: parseInt(process.env.CLEANUP_PRESSURE_CRITICAL || '90', 10), // % → evict all idle immediately
    // WorkspaceProvider selector. 'local' (default) = today's behavior (mkdir + symlink).
    // 'agentfs' = virtual fs per session via the agentfs binary. See
    // packages/vfs-poc/docs/WORKSPACE_PROVIDER.md for the full design.
    provider: process.env.WORKSPACE_PROVIDER || 'local',
    agentfs: {
      // Path to the agentfs CLI binary. Default assumes it's on PATH.
      binPath: process.env.WORKSPACE_AGENTFS_BIN || 'agentfs',
      // Where the materialized read-only base lives. Defaults under workspace.dir.
      baseDir: process.env.WORKSPACE_AGENTFS_BASE_DIR || '', // '' = use ${workspace.dir}/_agentfs_base
      // Where per-session SQLite delta dbs live. Defaults under workspace.dir.
      deltaStore: process.env.WORKSPACE_AGENTFS_DELTA_STORE || '', // '' = use ${workspace.dir}/_agentfs_deltas
    },
    // Bash sandbox for claude session spawns. When 'just-bash', backend
    // appends `--disallowed-tools Bash` and injects an MCP server backed by
    // just-bash (rooted at the session workspace path). 'none' = native Bash
    // tool stays enabled (today's behavior).
    // Resolved default: 'just-bash' iff WORKSPACE_PROVIDER=agentfs (so a stage-1
    // local self-host with WORKSPACE_PROVIDER=agentfs gets fs+bash both sandboxed
    // out of the box). Explicit value always wins.
    bashSandbox: (process.env.WORKSPACE_BASH_SANDBOX
      ?? (process.env.WORKSPACE_PROVIDER === 'agentfs' ? 'just-bash' : 'none')) as
      'just-bash' | 'none',
    // Map of tenant-slug → absolute solution directory. Used by
    // SessionAssetMaterializer to copy entities/ + resources/ into each
    // new session's workspace at create time. Format:
    //   SOLUTION_DIRS=demo-sandbox:/abs/path,article-analyzer:/abs/path2
    // The colon-after-slug splits slug from path; subsequent colons
    // (drive letters on Windows, etc.) are preserved in the path.
    solutionDirs: parseSolutionDirs(process.env.SOLUTION_DIRS),
  },

  database: {
    type: 'better-sqlite3',
    database: process.env.DATABASE_PATH || '.agent-workspace/data.db',
    synchronize: process.env.NODE_ENV !== 'production',
  },

  solutions: {
    dir: process.env.SOLUTIONS_DIR || undefined, // Auto-detected from monorepo root if unset
  },

  skills: {
    registryDir: process.env.SKILL_REGISTRY_DIR || '.skill-packages',
    defaultTenantId: process.env.DEFAULT_TENANT_ID || 'default',
  },

  claude: {
    command: process.env.CLAUDE_COMMAND || 'claude',
    flags: ['--output-format', 'stream-json', '--input-format', 'stream-json', '--verbose'],
  },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    apiKeyName: process.env.ADMIN_API_KEY_NAME || 'Default Admin Key',
    // If set, use this as the fixed bootstrap admin key instead of auto-generating.
    // Must start with 'sk-'. Useful for CI/CD and reproducible dev environments.
    // Example: INITIAL_ADMIN_KEY=sk-myteam-bootstrap123
    initialAdminKey: process.env.INITIAL_ADMIN_KEY?.trim() || undefined,
  },

  messageQueue: {
    enabled: process.env.MESSAGE_QUEUE_ENABLED === 'true',
    pollIntervalMs: parseInt(process.env.MESSAGE_QUEUE_POLL_INTERVAL_MS || '1000', 10),
    concurrency: parseInt(process.env.MESSAGE_QUEUE_CONCURRENCY || '5', 10),
    maxRetries: parseInt(process.env.MESSAGE_QUEUE_MAX_RETRIES || '2', 10),
  },

  debug: process.env.DEBUG === 'true',
});

/**
 * Slug must match this grammar before we'll register a SOLUTION_DIRS
 * entry. Defense in depth: even though the value is looked up by
 * `tenant.slug` (DB-sourced) at runtime, refusing path-traversal-shaped
 * keys (`../etc`) here means we can't accidentally route them anywhere.
 */
const SOLUTION_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function parseSolutionDirs(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
    const idx = pair.indexOf(':');
    if (idx <= 0 || idx === pair.length - 1) continue;
    const slug = pair.slice(0, idx).trim();
    const dir = pair.slice(idx + 1).trim();
    if (!slug || !dir) continue;
    if (!SOLUTION_SLUG_RE.test(slug)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[configuration] SOLUTION_DIRS: ignoring entry with invalid slug "${slug}" ` +
        `(must match ${SOLUTION_SLUG_RE})`,
      );
      continue;
    }
    out[slug] = dir;
  }
  return out;
}
