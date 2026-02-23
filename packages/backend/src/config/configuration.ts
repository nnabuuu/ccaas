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
