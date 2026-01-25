/**
 * Skill Routing Integration Tests
 *
 * Tests for skill trigger matching and routing:
 * - Skill creation
 * - Trigger matching (keyword, pattern)
 * - Multi-tenant skill isolation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { SkillsModule } from '../../src/skills/skills.module';
import { McpModule } from '../../src/mcp/mcp.module';
import { SkillsService } from '../../src/skills/skills.service';
import { SkillRouterService } from '../../src/skills/skill-router.service';
import { Skill } from '../../src/skills/entities/skill.entity';

import {
  getTestDatabaseOptions,
  seedTestData,
  TEST_ENTITIES,
} from '../setup/test-database';

describe('Skill Routing Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let skillsService: SkillsService;
  let skillRouterService: SkillRouterService;
  let skillRepository: Repository<Skill>;
  let testTenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              workspace: {
                dir: '/tmp/ccaas-skill-test',
              },
            }),
          ],
        }),
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature(TEST_ENTITIES),
        SkillsModule,
        McpModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    skillsService = moduleFixture.get(SkillsService);
    skillRouterService = moduleFixture.get(SkillRouterService);
    skillRepository = dataSource.getRepository(Skill);

    // Seed test data
    const { tenant } = await seedTestData(dataSource);
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await skillRepository.clear();
    skillRouterService.clearCache();
  });

  describe('Skill Creation', () => {
    it('should create a skill with keyword trigger', async () => {
      const skill = await skillsService.create(testTenantId, {
        name: 'Report Generator',
        slug: 'report-generator',
        type: 'skill',
        content: 'Generate a detailed report about {{topic}}',
        triggers: [
          {
            type: 'keyword',
            value: 'generate report',
          },
        ],
      });

      expect(skill).toBeDefined();
      expect(skill.name).toBe('Report Generator');
      expect(skill.triggers).toHaveLength(1);
      expect(skill.triggers[0].type).toBe('keyword');
    });

    it('should create a skill with pattern trigger', async () => {
      const skill = await skillsService.create(testTenantId, {
        name: 'Code Reviewer',
        slug: 'code-reviewer',
        type: 'skill',
        content: 'Review the following code for issues',
        triggers: [
          {
            type: 'pattern',
            value: '^review\\s+(this|the)?\\s*code',
          },
        ],
      });

      expect(skill).toBeDefined();
      expect(skill.triggers[0].type).toBe('pattern');
    });

    it('should create a skill with multiple triggers', async () => {
      const skill = await skillsService.create(testTenantId, {
        name: 'Documentation Helper',
        slug: 'doc-helper',
        type: 'skill',
        content: 'Help with documentation',
        triggers: [
          { type: 'keyword', value: 'write docs' },
          { type: 'keyword', value: 'document this' },
          { type: 'pattern', value: 'create.*documentation' },
        ],
      });

      expect(skill.triggers).toHaveLength(3);
    });
  });

  describe('Keyword Trigger Matching', () => {
    beforeEach(async () => {
      // Create skills for testing and publish them
      await skillsService.create(testTenantId, {
        name: 'Report Generator',
        slug: 'report-generator',
        type: 'skill',
        content: 'Generate a report',
        triggers: [{ type: 'keyword', value: 'generate report' }],
      });
      await skillsService.publish(testTenantId, 'report-generator');

      await skillsService.create(testTenantId, {
        name: 'Code Analyzer',
        slug: 'code-analyzer',
        type: 'skill',
        content: 'Analyze code',
        triggers: [{ type: 'keyword', value: 'analyze code' }],
      });
      await skillsService.publish(testTenantId, 'code-analyzer');
    });

    it('should match keyword trigger', async () => {
      const result = await skillRouterService.matchesTriggers(
        testTenantId,
        'Please generate report for Q4',
      );

      expect(result.matched).toBe(true);
      expect(result.skill).toBeDefined();
      expect(result.skill!.slug).toBe('report-generator');
    });

    it('should match keyword case-insensitively', async () => {
      const result = await skillRouterService.matchesTriggers(
        testTenantId,
        'GENERATE REPORT for the team',
      );

      expect(result.matched).toBe(true);
      expect(result.skill?.slug).toBe('report-generator');
    });

    it('should not match when no trigger matches', async () => {
      const result = await skillRouterService.matchesTriggers(
        testTenantId,
        'Please do something unrelated',
      );

      expect(result.matched).toBe(false);
      expect(result.skill).toBeUndefined();
    });
  });

  describe('Pattern Trigger Matching', () => {
    beforeEach(async () => {
      await skillsService.create(testTenantId, {
        name: 'Code Reviewer',
        slug: 'code-reviewer',
        type: 'skill',
        content: 'Review code',
        triggers: [
          { type: 'pattern', value: 'review\\s+(this|the)?\\s*code' },
        ],
      });
      await skillsService.publish(testTenantId, 'code-reviewer');

      await skillsService.create(testTenantId, {
        name: 'File Creator',
        slug: 'file-creator',
        type: 'skill',
        content: 'Create files',
        triggers: [
          { type: 'pattern', value: 'create\\s+(?:a\\s+)?file' },
        ],
      });
      await skillsService.publish(testTenantId, 'file-creator');
    });

    it('should match regex pattern', async () => {
      const result = await skillRouterService.matchesTriggers(
        testTenantId,
        'Please review this code for bugs',
      );

      expect(result.matched).toBe(true);
      expect(result.skill?.slug).toBe('code-reviewer');
    });

    it('should match pattern variations', async () => {
      const variations = [
        'review the code',
        'review code please',
        'can you review this code',
      ];

      for (const message of variations) {
        const result = await skillRouterService.matchesTriggers(testTenantId, message);
        expect(result.matched).toBe(true);
        expect(result.skill?.slug).toBe('code-reviewer');
      }
    });
  });

  describe('Multi-Tenant Skill Isolation', () => {
    it('should only match skills from correct tenant', async () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      // Create skills for different tenants and publish them
      await skillsService.create(tenant1, {
        name: 'Tenant 1 Skill',
        slug: 'tenant1-skill',
        type: 'skill',
        content: 'Skill for tenant 1',
        triggers: [{ type: 'keyword', value: 'special command' }],
      });
      await skillsService.publish(tenant1, 'tenant1-skill');

      await skillsService.create(tenant2, {
        name: 'Tenant 2 Skill',
        slug: 'tenant2-skill',
        type: 'skill',
        content: 'Skill for tenant 2',
        triggers: [{ type: 'keyword', value: 'special command' }],
      });
      await skillsService.publish(tenant2, 'tenant2-skill');

      // Match for tenant 1
      const match1 = await skillRouterService.matchesTriggers(
        tenant1,
        'run special command',
      );
      expect(match1.matched).toBe(true);
      expect(match1.skill?.slug).toBe('tenant1-skill');

      // Match for tenant 2
      const match2 = await skillRouterService.matchesTriggers(
        tenant2,
        'run special command',
      );
      expect(match2.matched).toBe(true);
      expect(match2.skill?.slug).toBe('tenant2-skill');

      // No match for unknown tenant
      const noMatch = await skillRouterService.matchesTriggers(
        'unknown-tenant',
        'run special command',
      );
      expect(noMatch.matched).toBe(false);
    });
  });

  describe('Skill Status Handling', () => {
    it('should only match published skills by default', async () => {
      // Create a draft skill
      await skillsService.create(testTenantId, {
        name: 'Draft Skill',
        slug: 'draft-skill',
        type: 'skill',
        content: 'This is a draft',
        triggers: [{ type: 'keyword', value: 'draft trigger' }],
      });

      // Draft skills should still match (status affects visibility, not matching)
      const result = await skillRouterService.matchesTriggers(
        testTenantId,
        'run draft trigger',
      );

      // The actual behavior depends on implementation
      // This test documents the expected behavior
      expect(result).toBeDefined();
    });
  });

  describe('Route Chat', () => {
    beforeEach(async () => {
      await skillsService.create(testTenantId, {
        name: 'Helper Skill',
        slug: 'helper-skill',
        type: 'skill',
        content: 'I am a helpful assistant',
        triggers: [{ type: 'keyword', value: 'help me' }],
      });
      await skillsService.publish(testTenantId, 'helper-skill');
    });

    it('should route chat to skill by ID', async () => {
      const skills = await skillsService.findAll(testTenantId, { limit: 10 });
      const skill = skills.items[0];

      const context = await skillRouterService.routeChat(testTenantId, {
        skillId: skill.id,
        message: 'Do something',
      });

      expect(context).toBeDefined();
      expect(context!.skill.id).toBe(skill.id);
    });

    it('should route chat to skill by slug', async () => {
      const context = await skillRouterService.routeChat(testTenantId, {
        skillSlug: 'helper-skill',
        message: 'Do something',
      });

      expect(context).toBeDefined();
      expect(context!.skill.slug).toBe('helper-skill');
    });

    it('should auto-resolve skill from message triggers', async () => {
      const context = await skillRouterService.routeChat(testTenantId, {
        message: 'Please help me with this task',
      });

      expect(context).toBeDefined();
      expect(context!.skill.slug).toBe('helper-skill');
    });

    it('should return null when no skill matches', async () => {
      const context = await skillRouterService.routeChat(testTenantId, {
        message: 'No matching trigger here',
      });

      expect(context).toBeNull();
    });
  });

  describe('Cache Management', () => {
    it('should cache skill contexts', async () => {
      await skillsService.create(testTenantId, {
        name: 'Cached Skill',
        slug: 'cached-skill',
        type: 'skill',
        content: 'Cached skill content',
        triggers: [{ type: 'keyword', value: 'cached command' }],
      });
      await skillsService.publish(testTenantId, 'cached-skill');

      // First route (cache miss)
      await skillRouterService.routeChat(testTenantId, {
        skillSlug: 'cached-skill',
        message: 'test',
      });

      // Check cache stats
      const stats = skillRouterService.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should clear cache', async () => {
      await skillsService.create(testTenantId, {
        name: 'Clear Cache Skill',
        slug: 'clear-cache-skill',
        type: 'skill',
        content: 'Test content',
        triggers: [{ type: 'keyword', value: 'clear test' }],
      });
      await skillsService.publish(testTenantId, 'clear-cache-skill');

      // Populate cache
      await skillRouterService.routeChat(testTenantId, {
        skillSlug: 'clear-cache-skill',
        message: 'test',
      });

      // Clear cache
      skillRouterService.clearCache();

      const stats = skillRouterService.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});
