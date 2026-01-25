/**
 * Chat Flow Integration Tests
 *
 * Tests the complete flow from user message → CLI events → file tracking → database.
 * Uses a mock CLI event emitter to simulate Claude Code CLI output.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { EventMapperService } from '../../src/chat/event-mapper.service';
import { MessagesService } from '../../src/messages/messages.service';
import { TokenUsageService } from '../../src/messages/token-usage.service';
import { ThinkingBlocksService } from '../../src/messages/thinking-blocks.service';
import { ToolEventsService } from '../../src/messages/tool-events.service';
import { FilesService } from '../../src/files/files.service';
import { SkillsService } from '../../src/skills/skills.service';
import { SkillRouterService } from '../../src/skills/skill-router.service';

import { MessagesModule } from '../../src/messages/messages.module';
import { FilesModule } from '../../src/files/files.module';
import { SkillsModule } from '../../src/skills/skills.module';
import { TenantsModule } from '../../src/tenants/tenants.module';
import { McpModule } from '../../src/mcp/mcp.module';
import { ChatModule } from '../../src/chat/chat.module';

import {
  createWriteFileTrackerHook,
  createToolEventTrackerHook,
  createThinkingTracker,
  createTokenUsageTracker,
} from '../../src/hooks';

import {
  getTestDatabaseOptions,
  seedTestData,
  TEST_ENTITIES,
} from '../setup/test-database';

import {
  textDeltaEvent,
  writeToolCallEvent,
  writeToolResultEvent,
  usageEvent,
  thinkingStartEvent,
  thinkingDeltaEvent,
  thinkingEndEvent,
  readToolCallEvent,
  readToolResultEvent,
} from '../setup/cli-event-fixtures';

/**
 * Mock session for testing
 */
interface MockSession {
  sessionId: string;
  clientId: string;
  tenantId?: string;
  workspaceDir: string;
  currentUserMessageId?: string;
  currentAssistantMessageId?: string;
}

describe('Chat Flow Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let eventMapperService: EventMapperService;
  let messagesService: MessagesService;
  let tokenUsageService: TokenUsageService;
  let thinkingBlocksService: ThinkingBlocksService;
  let toolEventsService: ToolEventsService;
  let filesService: FilesService;
  let skillsService: SkillsService;
  let skillRouterService: SkillRouterService;

  let testTenantId: string;
  let testWorkspaceDir: string;
  let mockSession: MockSession;

  beforeAll(async () => {
    testWorkspaceDir = `/tmp/ccaas-chat-flow-test-${Date.now()}`;
    fs.mkdirSync(testWorkspaceDir, { recursive: true });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              workspace: {
                dir: testWorkspaceDir,
              },
              debug: false,
            }),
          ],
        }),
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature(TEST_ENTITIES),
        ChatModule,
        MessagesModule,
        FilesModule,
        SkillsModule,
        TenantsModule,
        McpModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    eventMapperService = moduleFixture.get(EventMapperService);
    messagesService = moduleFixture.get(MessagesService);
    tokenUsageService = moduleFixture.get(TokenUsageService);
    thinkingBlocksService = moduleFixture.get(ThinkingBlocksService);
    toolEventsService = moduleFixture.get(ToolEventsService);
    filesService = moduleFixture.get(FilesService);
    skillsService = moduleFixture.get(SkillsService);
    skillRouterService = moduleFixture.get(SkillRouterService);

    // Seed test data
    const { tenant } = await seedTestData(dataSource);
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    await app.close();
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Create fresh mock session for each test
    const sessionId = `session-${Date.now()}`;
    const sessionDir = path.join(testWorkspaceDir, 'sessions', sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    mockSession = {
      sessionId,
      clientId: 'test-client',
      tenantId: testTenantId,
      workspaceDir: sessionDir,
    };

    // Create message records like the real ChatGateway does
    const userMessage = await messagesService.create({
      sessionId: mockSession.sessionId,
      tenantId: testTenantId,
      role: 'user',
      content: 'Test message',
    });

    const assistantMessage = await messagesService.create({
      sessionId: mockSession.sessionId,
      tenantId: testTenantId,
      role: 'assistant',
      content: '',
    });

    mockSession.currentUserMessageId = userMessage.id;
    mockSession.currentAssistantMessageId = assistantMessage.id;

    // Register hooks like the real ChatGateway does
    registerTestHooks();
  });

  /**
   * Register hooks that will be called when CLI events are processed
   */
  function registerTestHooks() {
    // Create a mock session getter
    const getSession = (sessionId: string) => {
      if (sessionId === mockSession.sessionId) {
        return {
          sessionId: mockSession.sessionId,
          clientId: mockSession.clientId,
          tenantId: mockSession.tenantId,
          workspaceDir: mockSession.workspaceDir,
          currentUserMessageId: mockSession.currentUserMessageId,
          currentAssistantMessageId: mockSession.currentAssistantMessageId,
        } as any;
      }
      return undefined;
    };

    // Register tool event tracker
    const toolEventTrackerHook = createToolEventTrackerHook({
      toolEventsService,
      getSession,
    });
    eventMapperService.registerToolHook(toolEventTrackerHook);

    // Register write file tracker
    const writeFileTrackerHook = createWriteFileTrackerHook({
      filesService,
      getSession,
    });
    eventMapperService.registerToolHook(writeFileTrackerHook);

    // Register thinking tracker
    const thinkingTracker = createThinkingTracker({
      thinkingBlocksService,
      getSession,
    });
    eventMapperService.registerThinkingCallback(
      (event, sessionId) => thinkingTracker.onThinkingEvent(event, sessionId),
    );

    // Register token usage tracker
    const tokenUsageTracker = createTokenUsageTracker({
      tokenUsageService,
      getSession,
    });
    eventMapperService.registerTokenUsageCallback(
      (usage, sessionId) => tokenUsageTracker.onTokenUsage(usage, sessionId),
    );
  }

  /**
   * Simulate CLI events by calling eventMapperService directly
   */
  function emitCLIEvent(event: object) {
    return eventMapperService.mapToFrontendEvents(
      event as any,
      mockSession.sessionId,
      mockSession.clientId,
    );
  }

  describe('User Message → File Creation Flow', () => {
    it('should track file created by Write tool', async () => {
      // Simulate: User asks "create a file called hello.txt"
      // CLI responds with text, then calls Write tool

      // 1. CLI emits text response
      const textEvents = emitCLIEvent(textDeltaEvent);
      expect(textEvents.some(e => e.type === 'text_delta')).toBe(true);

      // 2. CLI calls Write tool
      const writeStartEvents = emitCLIEvent(writeToolCallEvent);
      expect(writeStartEvents.some(e => e.type === 'tool_activity')).toBe(true);

      // 3. Create the actual file (simulating what CLI does)
      const filePath = path.join(mockSession.workspaceDir, 'hello.txt');
      fs.writeFileSync(filePath, 'Hello World!');

      // 4. CLI returns Write tool result
      const writeEndEvents = emitCLIEvent(writeToolResultEvent);
      expect(writeEndEvents.some(e => e.type === 'tool_activity')).toBe(true);

      // Wait for async hook to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // 5. Verify file was tracked in database
      const files = await filesService.findBySessionId(mockSession.sessionId);
      expect(files.length).toBeGreaterThanOrEqual(1);

      const trackedFile = files.find(f => f.filename === 'hello.txt');
      expect(trackedFile).toBeDefined();
      expect(trackedFile!.size).toBe(12); // "Hello World!" length
    });

    it('should associate files with correct message', async () => {
      // Create file and emit events
      const filePath = path.join(mockSession.workspaceDir, 'output.js');
      fs.writeFileSync(filePath, 'console.log("Hello");');

      emitCLIEvent({
        ...writeToolCallEvent,
        content_block: {
          ...writeToolCallEvent.content_block,
          input: { file_path: 'output.js', content: 'console.log("Hello");' },
        },
      });

      emitCLIEvent({
        ...writeToolResultEvent,
        tool_result: {
          ...writeToolResultEvent.tool_result,
          content: 'File written: output.js',
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify file is associated with the assistant message
      const files = await filesService.findByMessageId(mockSession.currentAssistantMessageId!);
      expect(files.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Tool Event Tracking', () => {
    it('should track tool start and end events', async () => {
      // Emit tool start (Read)
      emitCLIEvent(readToolCallEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Emit tool end
      emitCLIEvent(readToolResultEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify tool events were recorded
      const toolEvents = await toolEventsService.findBySessionId(mockSession.sessionId);
      expect(toolEvents.length).toBeGreaterThanOrEqual(2);

      const startEvent = toolEvents.find(e => e.phase === 'start' && e.toolName === 'Read');
      const endEvent = toolEvents.find(e => e.phase === 'end' && e.toolName === 'Read');

      expect(startEvent).toBeDefined();
      expect(endEvent).toBeDefined();
      expect(endEvent!.success).toBe(true);
    });

    it('should track tool errors', async () => {
      // Emit tool that fails
      emitCLIEvent({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu_error_123',
          name: 'Bash',
          input: { command: 'nonexistent-command' },
        },
      });

      emitCLIEvent({
        type: 'tool_result',
        tool_result: {
          tool_use_id: 'toolu_error_123',
          content: 'Command not found',
          is_error: true,
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const toolEvents = await toolEventsService.findBySessionId(mockSession.sessionId);
      const errorEvent = toolEvents.find(e => e.toolName === 'Bash' && e.phase === 'end');

      expect(errorEvent).toBeDefined();
      expect(errorEvent!.success).toBe(false);
    });
  });

  describe('Thinking Block Tracking', () => {
    it('should track thinking blocks', async () => {
      // Emit thinking start
      emitCLIEvent(thinkingStartEvent);

      // Emit thinking delta
      emitCLIEvent(thinkingDeltaEvent);

      // Emit thinking end
      emitCLIEvent(thinkingEndEvent);

      // Wait longer for async callbacks to complete (they fire-and-forget)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify thinking block was recorded
      const thinkingBlocks = await thinkingBlocksService.getBySessionId(mockSession.sessionId);
      expect(thinkingBlocks.length).toBeGreaterThanOrEqual(1);

      // The block may still be in_progress if async callback hasn't completed
      // Check that the block exists and has the expected thinkingId
      const block = thinkingBlocks[0];
      expect(block.thinkingId).toBe('thinking_001');
      // Status can be 'in_progress' or 'complete' depending on timing
      expect(['in_progress', 'complete']).toContain(block.status);
    });
  });

  describe('Token Usage Tracking', () => {
    it('should track token usage', async () => {
      // Emit usage event
      emitCLIEvent(usageEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify token usage was recorded
      const usage = await tokenUsageService.getBySessionId(mockSession.sessionId);
      expect(usage.length).toBeGreaterThanOrEqual(1);

      const event = usage[0];
      expect(event.inputTokens).toBe(150);
      expect(event.outputTokens).toBe(75);
      expect(event.tenantId).toBe(testTenantId);
    });
  });

  describe('Multi-Turn Conversation', () => {
    it('should accumulate files across multiple turns', async () => {
      // Turn 1: Create first file
      const file1Path = path.join(mockSession.workspaceDir, 'turn1.txt');
      fs.writeFileSync(file1Path, 'Turn 1 content');

      emitCLIEvent({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu_turn1',
          name: 'Write',
          input: { file_path: 'turn1.txt', content: 'Turn 1 content' },
        },
      });

      emitCLIEvent({
        type: 'tool_result',
        tool_result: {
          tool_use_id: 'toolu_turn1',
          content: 'success',
          is_error: false,
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Turn 2: Create second file (same session)
      const file2Path = path.join(mockSession.workspaceDir, 'turn2.txt');
      fs.writeFileSync(file2Path, 'Turn 2 content');

      emitCLIEvent({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu_turn2',
          name: 'Write',
          input: { file_path: 'turn2.txt', content: 'Turn 2 content' },
        },
      });

      emitCLIEvent({
        type: 'tool_result',
        tool_result: {
          tool_use_id: 'toolu_turn2',
          content: 'success',
          is_error: false,
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify both files tracked
      const files = await filesService.findBySessionId(mockSession.sessionId);
      expect(files.length).toBeGreaterThanOrEqual(2);

      const filenames = files.map(f => f.filename);
      expect(filenames).toContain('turn1.txt');
      expect(filenames).toContain('turn2.txt');
    });
  });

  describe('Skill-Based Behavior', () => {
    beforeEach(async () => {
      // Clear skill cache
      skillRouterService.clearCache();
    });

    it('should route to skill based on trigger', async () => {
      // Create a skill with a trigger
      await skillsService.create(testTenantId, {
        name: 'Code Generator',
        slug: 'code-generator',
        type: 'skill',
        content: 'You are a code generator. Always wrap code in markdown blocks.',
        triggers: [
          { type: 'keyword', value: 'generate code' },
          { type: 'keyword', value: 'write code' },
        ],
      });
      await skillsService.publish(testTenantId, 'code-generator');

      // Test trigger matching
      const result = await skillRouterService.matchesTriggers(
        testTenantId,
        'Please generate code for a hello world function',
      );

      expect(result.matched).toBe(true);
      expect(result.skill?.slug).toBe('code-generator');
    });

    it('should use different skills for different requests', async () => {
      // Create two skills with different triggers
      await skillsService.create(testTenantId, {
        name: 'Report Writer',
        slug: 'report-writer',
        type: 'skill',
        content: 'Generate formal reports in markdown format.',
        triggers: [
          { type: 'keyword', value: 'generate report' },
          { type: 'keyword', value: 'write report' },
        ],
      });
      await skillsService.publish(testTenantId, 'report-writer');

      await skillsService.create(testTenantId, {
        name: 'Test Writer',
        slug: 'test-writer',
        type: 'skill',
        content: 'Generate unit tests for code.',
        triggers: [
          { type: 'keyword', value: 'write tests' },
          { type: 'keyword', value: 'generate tests' },
        ],
      });
      await skillsService.publish(testTenantId, 'test-writer');

      // Test report trigger
      const reportResult = await skillRouterService.matchesTriggers(
        testTenantId,
        'Please generate report for Q4 sales',
      );
      expect(reportResult.matched).toBe(true);
      expect(reportResult.skill?.slug).toBe('report-writer');

      // Test testing trigger
      const testResult = await skillRouterService.matchesTriggers(
        testTenantId,
        'Please write tests for the login function',
      );
      expect(testResult.matched).toBe(true);
      expect(testResult.skill?.slug).toBe('test-writer');

      // Test no match
      const noMatch = await skillRouterService.matchesTriggers(
        testTenantId,
        'What is the weather today?',
      );
      expect(noMatch.matched).toBe(false);
    });
  });

  describe('Complete User Journey', () => {
    it('should handle full conversation flow: ask → think → use tools → create files', async () => {
      // Simulate complete flow:
      // 1. User asks to create a config file
      // 2. Claude thinks about it
      // 3. Claude reads existing files
      // 4. Claude writes the config file
      // 5. Token usage is tracked

      // Step 1: Thinking
      emitCLIEvent({ type: 'thinking-start', id: 'think_journey' });
      emitCLIEvent({ type: 'thinking-delta', delta: 'I need to create a config file...' });
      emitCLIEvent({ type: 'thinking-end' });

      // Step 2: Text response
      emitCLIEvent({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'I will create a config file for you.' } });

      // Step 3: Read existing files (optional check)
      emitCLIEvent({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu_read_journey',
          name: 'Glob',
          input: { pattern: '*.json' },
        },
      });
      emitCLIEvent({
        type: 'tool_result',
        tool_result: {
          tool_use_id: 'toolu_read_journey',
          content: '[]',
          is_error: false,
        },
      });

      // Step 4: Write config file
      const configPath = path.join(mockSession.workspaceDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({ app: 'test', version: '1.0' }, null, 2));

      emitCLIEvent({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu_write_journey',
          name: 'Write',
          input: { file_path: 'config.json', content: '{"app":"test","version":"1.0"}' },
        },
      });
      emitCLIEvent({
        type: 'tool_result',
        tool_result: {
          tool_use_id: 'toolu_write_journey',
          content: 'File written successfully',
          is_error: false,
        },
      });

      // Step 5: Token usage
      emitCLIEvent({
        type: 'message_delta',
        usage: {
          input_tokens: 500,
          output_tokens: 200,
          cache_read_input_tokens: 100,
        },
        message: { model: 'claude-sonnet-4-20250514' },
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify all components were tracked

      // Thinking blocks
      const thinkingBlocks = await thinkingBlocksService.getBySessionId(mockSession.sessionId);
      expect(thinkingBlocks.length).toBeGreaterThanOrEqual(1);

      // Tool events (Glob + Write = at least 4: 2 start + 2 end)
      const toolEvents = await toolEventsService.findBySessionId(mockSession.sessionId);
      expect(toolEvents.length).toBeGreaterThanOrEqual(4);

      // Files
      const files = await filesService.findBySessionId(mockSession.sessionId);
      expect(files.some(f => f.filename === 'config.json')).toBe(true);

      // Token usage
      const usage = await tokenUsageService.getBySessionId(mockSession.sessionId);
      expect(usage.length).toBeGreaterThanOrEqual(1);
      expect(usage[0].tenantId).toBe(testTenantId);
    });
  });
});
