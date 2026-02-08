-- Migration: Add User and UserTenant tables
-- Date: 2026-02-07

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'deleted')),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create user_tenants table (junction table with role)
CREATE TABLE IF NOT EXISTS user_tenants (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'developer', 'viewer')),
  canCreateSkills INTEGER DEFAULT 0 CHECK(canCreateSkills IN (0, 1)),
  isActive INTEGER DEFAULT 1 CHECK(isActive IN (0, 1)),
  joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(userId, tenantId)
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON user_tenants(userId);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants(tenantId);
CREATE INDEX IF NOT EXISTS idx_user_tenants_active ON user_tenants(isActive);

-- Create a system user for backward compatibility
INSERT OR IGNORE INTO users (id, email, name, status)
VALUES ('system-user', 'system@ccaas.local', 'System User', 'active');

-- Add userId column to api_keys table (for backward compatibility, nullable)
ALTER TABLE api_keys ADD COLUMN userId TEXT REFERENCES users(id) ON DELETE SET NULL;
