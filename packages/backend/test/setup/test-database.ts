/**
 * Test Database Setup
 *
 * Creates an in-memory SQLite database for integration tests.
 */

import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Import all entities
import { Message } from '../../src/messages/entities/message.entity';
import { ToolEvent } from '../../src/messages/entities/tool-event.entity';
import { ThinkingBlock } from '../../src/messages/entities/thinking-block.entity';
import { TokenUsageEvent } from '../../src/messages/entities/token-usage-event.entity';
import { ProcessLifecycleEvent } from '../../src/messages/entities/process-lifecycle-event.entity';
import { ApiErrorEvent } from '../../src/messages/entities/api-error-event.entity';
import { UserContextEvent } from '../../src/messages/entities/user-context-event.entity';
import { ConversationContext } from '../../src/messages/entities/conversation-context.entity';
import { LargeContent } from '../../src/storage/entities/large-content.entity';
import { SystemPromptVersion } from '../../src/storage/entities/system-prompt-version.entity';
import { AgentFile } from '../../src/files/entities/agent-file.entity';
import { FileVersion } from '../../src/files/entities/file-version.entity';
import { SessionAlert } from '../../src/admin/entities/session-alert.entity';
import { AdminAuditLog } from '../../src/admin/entities/admin-audit-log.entity';
import { Skill } from '../../src/skills/entities/skill.entity';
import { SkillVersion } from '../../src/skills/entities/skill-version.entity';
import { Tenant } from '../../src/tenants/entities/tenant.entity';
import { ApiKey } from '../../src/auth/entities/api-key.entity';
import { McpServer } from '../../src/mcp/entities/mcp-server.entity';
import { JobEntity } from '../../src/jobs/entities/job.entity';
import { User } from '../../src/users/entities/user.entity';
import { UserTenant } from '../../src/users/entities/user-tenant.entity';

export const TEST_ENTITIES = [
  Message,
  ToolEvent,
  ThinkingBlock,
  TokenUsageEvent,
  ProcessLifecycleEvent,
  ApiErrorEvent,
  UserContextEvent,
  ConversationContext,
  LargeContent,
  SystemPromptVersion,
  AgentFile,
  FileVersion,
  Skill,
  SkillVersion,
  Tenant,
  ApiKey,
  McpServer,
  SessionAlert,
  AdminAuditLog,
  JobEntity,
  User,
  UserTenant,
];

/**
 * Get TypeORM options for in-memory SQLite test database
 */
export function getTestDatabaseOptions(): TypeOrmModuleOptions {
  return {
    type: 'better-sqlite3',
    database: ':memory:',
    entities: TEST_ENTITIES,
    synchronize: true,
    dropSchema: true,
    logging: false,
  };
}

/**
 * Create a TypeORM module for testing
 */
export function createTestDatabaseModule() {
  return TypeOrmModule.forRoot(getTestDatabaseOptions());
}

/**
 * Create a test data source for direct database access in tests
 */
export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: TEST_ENTITIES,
    synchronize: true,
    dropSchema: true,
    logging: false,
  });

  await dataSource.initialize();
  return dataSource;
}

/**
 * Clear all tables in the test database
 */
export async function clearTestDatabase(dataSource: DataSource): Promise<void> {
  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.clear();
  }
}

/**
 * Seed test data for common scenarios
 */
export async function seedTestData(dataSource: DataSource): Promise<{
  tenant: Tenant;
  apiKey: ApiKey;
}> {
  const tenantRepo = dataSource.getRepository(Tenant);
  const apiKeyRepo = dataSource.getRepository(ApiKey);

  // Create test tenant
  const tenant = tenantRepo.create({
    name: 'Test Tenant',
    slug: 'test-tenant',
    config: {},
    status: 'active',
  });
  await tenantRepo.save(tenant);

  // Create test API key
  const apiKey = apiKeyRepo.create({
    tenantId: tenant.id,
    name: 'Test API Key',
    keyHash: 'test-key-hash-' + Date.now(),
    keyPrefix: 'sk-test',
    scopes: ['chat', 'skills:read', 'analytics:read'],
    status: 'active',
  });
  await apiKeyRepo.save(apiKey);

  return { tenant, apiKey };
}
