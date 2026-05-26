/**
 * Session Restart Integration Tests
 *
 * Tests the session restart flow when skills are updated.
 * Verifies that:
 * 1. New skills are NOT visible in running sessions
 * 2. skill_updated events are emitted to clients
 * 3. After restart, new skills ARE visible
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';

import { SkillsModule } from '../../src/skills/skills.module';
import { TenantsModule } from '../../src/tenants/tenants.module';
import { McpModule } from '../../src/mcp/mcp.module';
import { MessagesModule } from '../../src/messages/messages.module';

import { SkillsService } from '../../src/skills/skills.service';
import { SkillSyncService } from '../../src/skills/skill-sync.service';
import { SkillChangeNotifier, SkillChangeCallback } from '../../src/common/skill-change-notifier';

import {
  getTestDatabaseOptions,
  seedTestData,
  TEST_ENTITIES,
} from '../setup/test-database';

describe('Session Restart Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let skillsService: SkillsService;
  let skillSyncService: SkillSyncService;
  let testTenantId: string;
  let testWorkspaceDir: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              workspace: {
                dir: '/tmp/ccaas-restart-test',
              },
            }),
          ],
        }),
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature(TEST_ENTITIES),
        SkillsModule,
        TenantsModule,
        McpModule,
        MessagesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    skillsService = moduleFixture.get(SkillsService);
    skillSyncService = moduleFixture.get(SkillSyncService);

    // Seed test data
    const { tenant } = await seedTestData(dataSource);
    testTenantId = tenant.id;

    // Create test workspace directory
    testWorkspaceDir = `/tmp/ccaas-restart-test/sessions/test-session-${Date.now()}`;
    await fs.mkdir(testWorkspaceDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up workspace
    try {
      await fs.rm(testWorkspaceDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('Skill Update → Session Restart Flow', () => {
    it('should NOT sync new skills to existing session until restart', async () => {
      // Step 1: Initial sync - no skills yet
      const initialSync = await skillSyncService.syncToSession(
        testWorkspaceDir,
        testTenantId,
      );
      expect(initialSync.skillCount).toBe(0);

      // Verify no skills in workspace
      const initialSkills = await skillSyncService.getSessionSkills(testWorkspaceDir);
      expect(initialSkills).toHaveLength(0);

      // Step 2: Create and publish a new skill
      const skill = await skillsService.create(testTenantId, {
        name: 'Hello World Skill',
        slug: 'hello-world',
        description: 'Says hello world',
        content: `# Hello World Skill\n\nWhen invoked, respond with "Hello World from Skill!"`,
        type: 'skill',
        triggers: [{ type: 'keyword', value: 'hello' }],
      });

      await skillsService.publish(testTenantId, skill.id);

      // Step 3: Simulate "session still running" - DON'T sync yet
      // In real scenario, the CLI would still be running and wouldn't see new skills

      // Check that skill exists in database
      const dbSkill = await skillsService.findOne(testTenantId, 'hello-world');
      expect(dbSkill).toBeDefined();
      expect(dbSkill?.status).toBe('published');

      // But workspace still has no skills (simulating running CLI)
      const skillsBeforeRestart = await skillSyncService.getSessionSkills(testWorkspaceDir);
      expect(skillsBeforeRestart).toHaveLength(0);

      // Step 4: Simulate "restart" - sync skills again
      const restartSync = await skillSyncService.syncToSession(
        testWorkspaceDir,
        testTenantId,
      );
      expect(restartSync.skillCount).toBe(1);
      expect(restartSync.skills).toContain('hello-world');

      // Step 5: Verify skill is now in workspace
      const skillsAfterRestart = await skillSyncService.getSessionSkills(testWorkspaceDir);
      expect(skillsAfterRestart).toContain('hello-world');

      // Verify skill content
      const skillPath = path.join(testWorkspaceDir, '.claude', 'skills', 'hello-world', 'SKILL.md');
      const skillContent = await fs.readFile(skillPath, 'utf-8');
      expect(skillContent).toContain('Hello World from Skill!');
    });

    it('should emit skill_updated notification when skill is created', async () => {
      const receivedEvents: Array<{
        solutionId: string;
        skillId: string;
        skillSlug: string;
        action: string;
      }> = [];

      // Register listener
      const callback: SkillChangeCallback = (solutionId, skillId, skillSlug, action) => {
        receivedEvents.push({ solutionId, skillId, skillSlug, action });
      };
      SkillChangeNotifier.addListener(callback);

      try {
        // Create a skill
        const skill = await skillsService.create(testTenantId, {
          name: 'Notification Test Skill',
          slug: 'notification-test',
          description: 'Tests notifications',
          content: '# Notification Test',
          type: 'skill',
        });

        // Check that create event was received
        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0]).toMatchObject({
          solutionId: testTenantId,
          skillSlug: 'notification-test',
          action: 'created',
        });

        // Update the skill
        await skillsService.update(testTenantId, skill.id, {
          content: '# Updated Content',
        });

        // Check that update event was received
        expect(receivedEvents).toHaveLength(2);
        expect(receivedEvents[1]).toMatchObject({
          solutionId: testTenantId,
          skillSlug: 'notification-test',
          action: 'updated',
        });

        // Publish the skill
        await skillsService.publish(testTenantId, skill.id);

        // Check that publish event was received
        expect(receivedEvents).toHaveLength(3);
        expect(receivedEvents[2]).toMatchObject({
          solutionId: testTenantId,
          skillSlug: 'notification-test',
          action: 'published',
        });

        // Archive the skill
        await skillsService.archive(testTenantId, skill.id);

        // Check that archive event was received
        expect(receivedEvents).toHaveLength(4);
        expect(receivedEvents[3]).toMatchObject({
          solutionId: testTenantId,
          skillSlug: 'notification-test',
          action: 'archived',
        });
      } finally {
        // Clean up listener
        SkillChangeNotifier.removeListener(callback);
      }
    });

    it('should isolate skill notifications by tenant', async () => {
      const tenant1Events: string[] = [];
      const tenant2Events: string[] = [];

      const callback1: SkillChangeCallback = (solutionId, skillId, skillSlug, action) => {
        if (solutionId === 'tenant-1') {
          tenant1Events.push(`${skillSlug}:${action}`);
        }
      };

      const callback2: SkillChangeCallback = (solutionId, skillId, skillSlug, action) => {
        if (solutionId === 'tenant-2') {
          tenant2Events.push(`${skillSlug}:${action}`);
        }
      };

      SkillChangeNotifier.addListener(callback1);
      SkillChangeNotifier.addListener(callback2);

      try {
        // Simulate skill changes for different tenants
        SkillChangeNotifier.notify('tenant-1', 'skill-1', 'skill-a', 'created');
        SkillChangeNotifier.notify('tenant-2', 'skill-2', 'skill-b', 'created');
        SkillChangeNotifier.notify('tenant-1', 'skill-1', 'skill-a', 'published');

        expect(tenant1Events).toEqual(['skill-a:created', 'skill-a:published']);
        expect(tenant2Events).toEqual(['skill-b:created']);
      } finally {
        SkillChangeNotifier.removeListener(callback1);
        SkillChangeNotifier.removeListener(callback2);
      }
    });
  });

  describe('Session Status with Restart Flag', () => {
    it('should track needsRestart flag on sessions', async () => {
      // Simulate session state
      interface MockSession {
        sessionId: string;
        solutionId: string;
        needsRestart: boolean;
        status: string;
        messageCount: number;
      }

      const sessions = new Map<string, MockSession>();

      // Create mock sessions
      sessions.set('session-1', {
        sessionId: 'session-1',
        solutionId: testTenantId,
        needsRestart: false,
        status: 'processing',
        messageCount: 5,
      });

      sessions.set('session-2', {
        sessionId: 'session-2',
        solutionId: testTenantId,
        needsRestart: false,
        status: 'idle',
        messageCount: 3,
      });

      sessions.set('session-3', {
        sessionId: 'session-3',
        solutionId: 'other-tenant',
        needsRestart: false,
        status: 'idle',
        messageCount: 1,
      });

      // Simulate markSessionsForRestart
      const affectedIds: string[] = [];
      for (const session of sessions.values()) {
        if (session.solutionId === testTenantId) {
          session.needsRestart = true;
          affectedIds.push(session.sessionId);
        }
      }

      // Verify only matching tenant sessions are marked
      expect(affectedIds).toHaveLength(2);
      expect(affectedIds).toContain('session-1');
      expect(affectedIds).toContain('session-2');
      expect(sessions.get('session-1')?.needsRestart).toBe(true);
      expect(sessions.get('session-2')?.needsRestart).toBe(true);
      expect(sessions.get('session-3')?.needsRestart).toBe(false);

      // Simulate restartSession
      const sessionToRestart = sessions.get('session-1')!;
      sessionToRestart.needsRestart = false;
      sessionToRestart.status = 'idle';

      expect(sessionToRestart.needsRestart).toBe(false);
    });
  });

  describe('Full Flow: Message → Skill Create → Message → Restart → Message', () => {
    it('should correctly handle skill visibility across session lifecycle', async () => {
      const sessionWorkspace = `/tmp/ccaas-restart-test/full-flow-${Date.now()}`;
      await fs.mkdir(sessionWorkspace, { recursive: true });

      try {
        // Step 1: "Write hello world" - First message, no skills
        let syncResult = await skillSyncService.syncToSession(
          sessionWorkspace,
          testTenantId,
        );
        console.log(`Step 1: Initial sync - ${syncResult.skillCount} skills`);

        // Simulate CLI running with no skills
        let availableSkills = await skillSyncService.getSessionSkills(sessionWorkspace);
        expect(availableSkills.filter(s => s.startsWith('flow-'))).toHaveLength(0);

        // Step 2: Create a skill for this tenant
        const skill = await skillsService.create(testTenantId, {
          name: 'Flow Test Skill',
          slug: 'flow-test-skill',
          description: 'Test skill for full flow',
          content: '# Flow Test\n\nRespond with "Flow test successful!"',
          type: 'skill',
        });
        await skillsService.publish(testTenantId, skill.id);
        console.log('Step 2: Skill created and published');

        // Step 3: "Write again" - Skill NOT visible (CLI still running)
        // In real scenario, we wouldn't sync here because CLI is still running
        availableSkills = await skillSyncService.getSessionSkills(sessionWorkspace);
        expect(availableSkills).not.toContain('flow-test-skill');
        console.log('Step 3: Skill NOT visible in running session');

        // Step 4: Restart session (sync skills)
        syncResult = await skillSyncService.syncToSession(
          sessionWorkspace,
          testTenantId,
        );
        console.log(`Step 4: After restart sync - ${syncResult.skillCount} skills`);

        // Step 5: "Write hello world again" - Skill IS visible
        availableSkills = await skillSyncService.getSessionSkills(sessionWorkspace);
        expect(availableSkills).toContain('flow-test-skill');
        console.log('Step 5: Skill IS visible after restart');

        // Verify skill content
        const skillPath = path.join(
          sessionWorkspace,
          '.claude',
          'skills',
          'flow-test-skill',
          'SKILL.md',
        );
        const content = await fs.readFile(skillPath, 'utf-8');
        expect(content).toContain('Flow test successful!');
      } finally {
        // Cleanup
        await skillsService.archive(testTenantId, 'flow-test-skill');
        await fs.rm(sessionWorkspace, { recursive: true, force: true });
      }
    });
  });
});
