-- Claude Code as a Service - Database Schema
-- PostgreSQL 14+
-- Phase 1: Core Platform

-- ============================================================================
-- SOLUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS solutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    -- Configuration
    config JSONB NOT NULL DEFAULT '{}',

    -- Quotas
    max_sessions INTEGER NOT NULL DEFAULT 10,
    max_skills INTEGER NOT NULL DEFAULT 50,
    max_mcp_servers INTEGER NOT NULL DEFAULT 10,

    -- Billing (placeholder for Phase 4)
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    billing_email VARCHAR(255),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solutions_slug ON solutions(slug);
CREATE INDEX idx_solutions_status ON solutions(status);

-- ============================================================================
-- API KEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solution_id UUID NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,

    -- Key details
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash of the key
    key_prefix VARCHAR(8) NOT NULL,        -- First 8 chars for identification (sk-xxxx)

    -- Permissions
    scopes JSONB NOT NULL DEFAULT '["skills:read", "skills:execute", "chat"]',

    -- Rate limiting
    rate_limit_rpm INTEGER NOT NULL DEFAULT 60,     -- Requests per minute
    rate_limit_rpd INTEGER NOT NULL DEFAULT 10000,  -- Requests per day

    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    usage_count BIGINT NOT NULL DEFAULT 0,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_tenant ON api_keys(solution_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_status ON api_keys(status);

-- ============================================================================
-- SKILLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solution_id UUID NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,

    -- Identity
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,

    -- Type: 'skill' (simple prompt) or 'sub-agent' (complex with tools)
    type VARCHAR(20) NOT NULL DEFAULT 'skill',

    -- Content stored in file system, this is the reference
    content_path VARCHAR(500),

    -- Configuration (from frontmatter)
    config JSONB NOT NULL DEFAULT '{}',

    -- Tool configuration
    allowed_tools JSONB DEFAULT '[]',

    -- Trigger configuration
    triggers JSONB DEFAULT '[]',

    -- Current published version
    current_version VARCHAR(20),

    -- Status lifecycle: draft -> review -> published -> deprecated -> archived
    status VARCHAR(20) NOT NULL DEFAULT 'draft',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,

    -- Unique constraint per solution
    UNIQUE(solution_id, slug)
);

CREATE INDEX idx_skills_tenant ON skills(solution_id);
CREATE INDEX idx_skills_status ON skills(status);
CREATE INDEX idx_skills_type ON skills(type);
CREATE INDEX idx_skills_slug ON skills(solution_id, slug);

-- ============================================================================
-- SKILL VERSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,

    -- Semantic version
    version VARCHAR(20) NOT NULL,

    -- Content snapshot
    content_hash VARCHAR(64) NOT NULL,  -- SHA-256 of content
    content_path VARCHAR(500) NOT NULL, -- Path to versioned content file

    -- Configuration snapshot
    config JSONB NOT NULL DEFAULT '{}',
    allowed_tools JSONB DEFAULT '[]',

    -- Changelog
    changelog TEXT,

    -- Deployment status: draft -> staging -> production -> deprecated
    deployment_status VARCHAR(20) NOT NULL DEFAULT 'draft',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deployed_at TIMESTAMPTZ,

    -- Unique version per skill
    UNIQUE(skill_id, version)
);

CREATE INDEX idx_skill_versions_skill ON skill_versions(skill_id);
CREATE INDEX idx_skill_versions_status ON skill_versions(deployment_status);

-- ============================================================================
-- MCP SERVERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solution_id UUID NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,

    -- Identity
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,

    -- Type: 'builtin', 'custom', 'rest-adapter'
    type VARCHAR(20) NOT NULL DEFAULT 'custom',

    -- Configuration
    -- For rest-adapter: { baseUrl, auth: { type, ... }, endpoints: [...] }
    -- For custom: { command, args, env }
    config JSONB NOT NULL DEFAULT '{}',

    -- Exposed tools (auto-detected or configured)
    tools JSONB DEFAULT '[]',

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',

    -- Health tracking
    last_health_check TIMESTAMPTZ,
    health_status VARCHAR(20) DEFAULT 'unknown',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique per solution
    UNIQUE(solution_id, slug)
);

CREATE INDEX idx_mcp_servers_tenant ON mcp_servers(solution_id);
CREATE INDEX idx_mcp_servers_type ON mcp_servers(type);
CREATE INDEX idx_mcp_servers_status ON mcp_servers(status);

-- ============================================================================
-- SKILL - MCP SERVER ASSOCIATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_mcp_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,

    -- Which tools from this MCP server are allowed
    allowed_tools JSONB DEFAULT '[]',  -- Empty = all tools

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(skill_id, mcp_server_id)
);

CREATE INDEX idx_skill_mcp_skill ON skill_mcp_servers(skill_id);
CREATE INDEX idx_skill_mcp_server ON skill_mcp_servers(mcp_server_id);

-- ============================================================================
-- SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solution_id UUID NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,

    -- Session identification
    external_id VARCHAR(100) NOT NULL UNIQUE,  -- session_xxx format
    client_id VARCHAR(100),

    -- Workspace path
    workspace_path VARCHAR(500),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',

    -- Metrics
    message_count INTEGER NOT NULL DEFAULT 0,
    input_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_tenant ON sessions(solution_id);
CREATE INDEX idx_sessions_skill ON sessions(skill_id);
CREATE INDEX idx_sessions_external ON sessions(external_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_activity ON sessions(last_activity_at);

-- ============================================================================
-- USAGE ANALYTICS (ClickHouse recommended for production)
-- PostgreSQL version for development
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solution_id UUID NOT NULL,

    -- Event type
    event_type VARCHAR(50) NOT NULL,  -- 'skill_execution', 'tool_call', 'error', etc.

    -- References
    session_id UUID,
    skill_id UUID,
    api_key_id UUID,

    -- Event data
    data JSONB NOT NULL DEFAULT '{}',

    -- Metrics
    duration_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for production (commented out for development)
-- CREATE TABLE usage_events_y2025m01 PARTITION OF usage_events
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE INDEX idx_usage_tenant_time ON usage_events(solution_id, created_at);
CREATE INDEX idx_usage_type ON usage_events(event_type);
CREATE INDEX idx_usage_session ON usage_events(session_id);
CREATE INDEX idx_usage_skill ON usage_events(skill_id);

-- ============================================================================
-- REST API ADAPTER CONFIGURATIONS
-- (Stored as MCP server with type='rest-adapter')
-- Example config structure:
-- ============================================================================
/*
{
  "baseUrl": "https://api.example.com/v1",
  "auth": {
    "type": "bearer",  -- or "api_key", "basic", "oauth2"
    "tokenPath": "$.access_token",
    "headerName": "Authorization",
    "headerPrefix": "Bearer "
  },
  "oauth2": {  -- Optional, for OAuth2 auth type
    "tokenUrl": "https://auth.example.com/oauth/token",
    "clientId": "...",
    "clientSecret": "...",  -- Stored encrypted
    "scopes": ["read", "write"]
  },
  "endpoints": [
    {
      "name": "list_users",
      "description": "List all users with pagination",
      "method": "GET",
      "path": "/users",
      "queryParams": {
        "page": { "type": "integer", "default": 1 },
        "limit": { "type": "integer", "default": 20 }
      },
      "responseMapping": {
        "users": "$.data",
        "total": "$.meta.total"
      }
    },
    {
      "name": "get_user",
      "description": "Get a single user by ID",
      "method": "GET",
      "path": "/users/{id}",
      "pathParams": {
        "id": { "type": "string", "required": true }
      }
    },
    {
      "name": "create_user",
      "description": "Create a new user",
      "method": "POST",
      "path": "/users",
      "body": {
        "type": "json",
        "schema": {
          "name": { "type": "string", "required": true },
          "email": { "type": "string", "required": true }
        }
      }
    }
  ],
  "rateLimiting": {
    "requestsPerMinute": 100,
    "retryAfterMs": 1000
  },
  "errorMapping": {
    "401": "Authentication failed",
    "403": "Permission denied",
    "404": "Resource not found"
  }
}
*/

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER trigger_tenants_updated
    BEFORE UPDATE ON solutions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_api_keys_updated
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_skills_updated
    BEFORE UPDATE ON skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_mcp_servers_updated
    BEFORE UPDATE ON mcp_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SEED DATA (Development)
-- ============================================================================

-- Default solution for development
INSERT INTO solutions (id, name, slug, description, plan)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Development Tenant',
    'dev',
    'Default solution for local development',
    'enterprise'
) ON CONFLICT (slug) DO NOTHING;

-- Default API key for development (key: sk-dev-0000000000000000)
-- Hash: SHA-256 of 'sk-dev-0000000000000000'
INSERT INTO api_keys (id, solution_id, name, key_hash, key_prefix, scopes)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Development Key',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',  -- Placeholder hash
    'sk-dev-0',
    '["skills:read", "skills:write", "skills:execute", "chat", "admin"]'::jsonb
) ON CONFLICT (key_hash) DO NOTHING;
