/**
 * Application Configuration
 *
 * Centralized configuration loaded from environment variables.
 */

export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),

  workspace: {
    dir: process.env.WORKSPACE_DIR || '.agent-workspace',
    sessionTtlMs: parseInt(process.env.SESSION_TTL_MS || '1800000', 10), // 30 min
    maxSessions: parseInt(process.env.MAX_SESSIONS || '100', 10),
    cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '300000', 10), // 5 min
  },

  database: {
    type: 'better-sqlite3',
    database: process.env.DATABASE_PATH || '.agent-workspace/data.db',
    synchronize: process.env.NODE_ENV !== 'production',
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
  },

  debug: process.env.DEBUG === 'true',
});
