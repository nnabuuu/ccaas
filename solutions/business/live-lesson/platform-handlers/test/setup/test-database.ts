/**
 * Test database setup for the live-lesson platform-handlers package.
 *
 * Mirrors `packages/backend/test/setup/test-database.ts` but pulls
 * the entity classes from `@kedge-agentic/backend/*` subpaths (the
 * platform's npm exports map) instead of relative-path imports. The
 * entity list must stay in sync with the platform's — when a new
 * entity lands in backend's `TypeOrmModule.forRoot({ entities })`,
 * it must be added here too, or handler integration specs will fail
 * with "RepositoryNotFoundError".
 */

import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Message } from '@kedge-agentic/backend/messages/entities/message.entity';
import { ToolEvent } from '@kedge-agentic/backend/messages/entities/tool-event.entity';
import { ThinkingBlock } from '@kedge-agentic/backend/messages/entities/thinking-block.entity';
import { TokenUsageEvent } from '@kedge-agentic/backend/messages/entities/token-usage-event.entity';
import { ProcessLifecycleEvent } from '@kedge-agentic/backend/messages/entities/process-lifecycle-event.entity';
import { ApiErrorEvent } from '@kedge-agentic/backend/messages/entities/api-error-event.entity';
import { UserContextEvent } from '@kedge-agentic/backend/messages/entities/user-context-event.entity';
import { ConversationContext } from '@kedge-agentic/backend/messages/entities/conversation-context.entity';
import { LargeContent } from '@kedge-agentic/backend/storage/entities/large-content.entity';
import { SystemPromptVersion } from '@kedge-agentic/backend/storage/entities/system-prompt-version.entity';
import { AgentFile } from '@kedge-agentic/backend/files/entities/agent-file.entity';
import { FileVersion } from '@kedge-agentic/backend/files/entities/file-version.entity';
import { SessionAlert } from '@kedge-agentic/backend/admin/entities/session-alert.entity';
import { AdminAuditLog } from '@kedge-agentic/backend/admin/entities/admin-audit-log.entity';
import { Skill } from '@kedge-agentic/backend/skills/entities/skill.entity';
import { SkillVersion } from '@kedge-agentic/backend/skills/entities/skill-version.entity';
import { SkillFile } from '@kedge-agentic/backend/skills/entities/skill-file.entity';
import { SkillVersionFile } from '@kedge-agentic/backend/skills/entities/skill-version-file.entity';
import { SolutionQuota } from '@kedge-agentic/backend/admin/entities/solution-quota.entity';
import { Solution } from '@kedge-agentic/backend/solutions/entities/solution.entity';
import { ApiKey } from '@kedge-agentic/backend/auth/entities/api-key.entity';
import { McpServer } from '@kedge-agentic/backend/mcp/entities/mcp-server.entity';
import { JobEntity } from '@kedge-agentic/backend/jobs/entities/job.entity';
import { User } from '@kedge-agentic/backend/users/entities/user.entity';
import { UserSolution } from '@kedge-agentic/backend/users/entities/user-solution.entity';
import { Session } from '@kedge-agentic/backend/admin/entities/session.entity';
import { Turn } from '@kedge-agentic/backend/admin/entities/turn.entity';
import {
  ObservationRecord,
  ObserverEventRecord,
} from '@kedge-agentic/backend/workflow/entities';

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
  SkillFile,
  SkillVersionFile,
  Solution,
  SolutionQuota,
  ApiKey,
  McpServer,
  SessionAlert,
  AdminAuditLog,
  JobEntity,
  User,
  UserSolution,
  Session,
  Turn,
  ObservationRecord,
  ObserverEventRecord,
];

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

export function createTestDatabaseModule() {
  return TypeOrmModule.forRoot(getTestDatabaseOptions());
}

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
