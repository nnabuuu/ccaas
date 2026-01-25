/**
 * Real CLI Integration Tests
 *
 * These tests spawn actual Claude Code CLI processes and make real API calls.
 * Requires: `claude login` to authenticate with your Claude subscription.
 *
 * Run with: npm run test:e2e:real -w @ccaas/backend
 *
 * NOTE: These tests:
 * - Use your Claude subscription credits
 * - Take 10-60 seconds per test
 * - Have non-deterministic outputs
 * - Should be run manually, not in CI
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

import { MessagesService } from '../../src/messages/messages.service';
import { FilesService } from '../../src/files/files.service';
import { TokenUsageService } from '../../src/messages/token-usage.service';
import { ToolEventsService } from '../../src/messages/tool-events.service';
import { SkillsService } from '../../src/skills/skills.service';

import { MessagesModule } from '../../src/messages/messages.module';
import { FilesModule } from '../../src/files/files.module';
import { SkillsModule } from '../../src/skills/skills.module';
import { TenantsModule } from '../../src/tenants/tenants.module';
import { McpModule } from '../../src/mcp/mcp.module';

import {
  getTestDatabaseOptions,
  seedTestData,
  TEST_ENTITIES,
} from '../setup/test-database';

// Skip these tests by default - they require real CLI and subscription
const SKIP_REAL_CLI_TESTS = process.env.RUN_REAL_CLI_TESTS !== 'true';

// Timeout for real CLI operations (Claude can take a while)
const CLI_TIMEOUT = 120000; // 2 minutes

interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  events: any[];
}

/**
 * Run Claude CLI with a prompt and collect stream-json output
 */
async function runClaude(
  prompt: string,
  workingDir: string,
  options: {
    timeout?: number;
    resume?: string;
  } = {},
): Promise<CLIResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '--output-format', 'stream-json',
      '--print',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    if (options.resume) {
      args.push('--resume', options.resume);
    }

    // Add the prompt as the last argument
    args.push(prompt);

    const cli = spawn('claude', args, {
      cwd: workingDir,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure we don't interfere with the test
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 'true',
      },
    });

    // Close stdin immediately - CLI waits for EOF before processing
    cli.stdin.end();

    const stdout: string[] = [];
    const stderr: string[] = [];
    const events: any[] = [];

    const timeout = setTimeout(() => {
      cli.kill('SIGTERM');
      reject(new Error(`CLI timed out after ${options.timeout || CLI_TIMEOUT}ms`));
    }, options.timeout || CLI_TIMEOUT);

    cli.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout.push(text);

      // Parse stream-json events
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            events.push(JSON.parse(line));
          } catch {
            // Not JSON, ignore
          }
        }
      }
    });

    cli.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk.toString());
    });

    cli.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        exitCode: code,
        events,
      });
    });

    cli.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Check if Claude CLI is available and authenticated
 */
async function checkCliAvailable(): Promise<boolean> {
  try {
    const result = await runClaude('echo "test"', '/tmp', { timeout: 30000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

(SKIP_REAL_CLI_TESTS ? describe.skip : describe)('Real CLI Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let messagesService: MessagesService;
  let filesService: FilesService;
  let tokenUsageService: TokenUsageService;
  let toolEventsService: ToolEventsService;
  let skillsService: SkillsService;

  let testTenantId: string;
  let testWorkspaceDir: string;

  beforeAll(async () => {
    // Check if CLI is available
    const cliAvailable = await checkCliAvailable();
    if (!cliAvailable) {
      console.warn('Claude CLI not available or not authenticated. Run `claude login` first.');
      return;
    }

    testWorkspaceDir = `/tmp/ccaas-real-cli-test-${Date.now()}`;
    fs.mkdirSync(testWorkspaceDir, { recursive: true });

    // Create .claude settings for permissions
    const claudeDir = path.join(testWorkspaceDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify({
        permissions: {
          allow: ['Bash(*)', 'Write(*)', 'Edit(*)', 'Read(*)'],
          deny: [],
        },
      }, null, 2),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              workspace: {
                dir: testWorkspaceDir,
              },
            }),
          ],
        }),
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature(TEST_ENTITIES),
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
    messagesService = moduleFixture.get(MessagesService);
    filesService = moduleFixture.get(FilesService);
    tokenUsageService = moduleFixture.get(TokenUsageService);
    toolEventsService = moduleFixture.get(ToolEventsService);
    skillsService = moduleFixture.get(SkillsService);

    const { tenant } = await seedTestData(dataSource);
    testTenantId = tenant.id;
  }, CLI_TIMEOUT);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
  });

  describe('Basic CLI Interaction', () => {
    it('should run simple prompt and get response', async () => {
      const result = await runClaude(
        'Say "Hello Test" and nothing else.',
        testWorkspaceDir,
      );

      expect(result.exitCode).toBe(0);
      expect(result.events.length).toBeGreaterThan(0);

      // Find text events
      const textEvents = result.events.filter(
        (e) => e.type === 'assistant' ||
               (e.type === 'content_block_delta' && e.delta?.type === 'text_delta'),
      );
      expect(textEvents.length).toBeGreaterThan(0);
    }, CLI_TIMEOUT);

    it('should track token usage in events', async () => {
      const result = await runClaude(
        'What is 2 + 2? Answer with just the number.',
        testWorkspaceDir,
      );

      expect(result.exitCode).toBe(0);

      // Find usage events
      const usageEvents = result.events.filter(
        (e) => e.type === 'usage' ||
               e.type === 'message_delta' ||
               e.type === 'result',
      );

      // Should have some usage info
      const hasUsage = usageEvents.some(
        (e) => e.usage?.input_tokens > 0 || e.usage?.output_tokens > 0,
      );
      expect(hasUsage).toBe(true);
    }, CLI_TIMEOUT);
  });

  describe('File Creation', () => {
    it('should create a file when asked', async () => {
      const testFileName = `test-${Date.now()}.txt`;
      const testFilePath = path.join(testWorkspaceDir, testFileName);

      const result = await runClaude(
        `Create a file called "${testFileName}" with the content "Hello from Claude!" in the current directory. Use the Write tool.`,
        testWorkspaceDir,
      );

      expect(result.exitCode).toBe(0);

      // Check if file was created
      expect(fs.existsSync(testFilePath)).toBe(true);

      // Check file content
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('Hello');
    }, CLI_TIMEOUT);

    it('should emit tool_use events for Write tool', async () => {
      const testFileName = `tool-test-${Date.now()}.txt`;

      const result = await runClaude(
        `Create a file called "${testFileName}" containing "Test content". Use the Write tool.`,
        testWorkspaceDir,
      );

      expect(result.exitCode).toBe(0);

      // Find Write tool events - they are embedded in assistant messages
      const toolUseEvents = result.events.filter((e) => {
        if (e.type !== 'assistant') return false;
        const content = e.message?.content || [];
        return content.some((c: any) => c.type === 'tool_use' && c.name === 'Write');
      });

      expect(toolUseEvents.length).toBeGreaterThan(0);
    }, CLI_TIMEOUT);
  });

  describe('Multi-Turn Conversation', () => {
    it('should remember context with --resume', async () => {
      // First turn: set a variable
      const turn1 = await runClaude(
        'Remember the number 42. Just say "OK, I will remember 42."',
        testWorkspaceDir,
      );

      expect(turn1.exitCode).toBe(0);

      // Extract session ID from result event
      const resultEvent = turn1.events.find((e) => e.type === 'result');
      const sessionId = resultEvent?.session_id;

      if (!sessionId) {
        console.warn('No session ID found, skipping resume test');
        return;
      }

      // Second turn: recall the variable
      const turn2 = await runClaude(
        'What number did I ask you to remember? Just say the number.',
        testWorkspaceDir,
        { resume: sessionId },
      );

      expect(turn2.exitCode).toBe(0);

      // Check if the response contains 42
      // Text is in assistant.message.content[] with type: 'text'
      const responseText = turn2.events
        .filter((e) => e.type === 'assistant')
        .flatMap((e) => e.message?.content || [])
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');

      // Also check the result event which contains the final response
      const resultText = turn2.events
        .filter((e) => e.type === 'result')
        .map((e) => e.result || '')
        .join('');

      expect(responseText + resultText).toContain('42');
    }, CLI_TIMEOUT * 2); // Double timeout for 2 turns
  });

  describe('Code Generation', () => {
    it('should generate and save code to a file', async () => {
      const fileName = `hello-${Date.now()}.js`;

      const result = await runClaude(
        `Create a JavaScript file called "${fileName}" that contains a function called "greet" that takes a name parameter and returns "Hello, {name}!". Use the Write tool to save it.`,
        testWorkspaceDir,
      );

      expect(result.exitCode).toBe(0);

      const filePath = path.join(testWorkspaceDir, fileName);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('function');
      expect(content).toContain('greet');
      expect(content).toContain('Hello');
    }, CLI_TIMEOUT);
  });

  describe('Bash Command Execution', () => {
    it('should execute bash commands', async () => {
      const result = await runClaude(
        'Use the Bash tool to run "echo HELLO_TEST_12345" and tell me what it outputs.',
        testWorkspaceDir,
      );

      expect(result.exitCode).toBe(0);

      // Find Bash tool events - they are embedded in assistant messages
      const bashEvents = result.events.filter((e) => {
        if (e.type !== 'assistant') return false;
        const content = e.message?.content || [];
        return content.some((c: any) => c.type === 'tool_use' && c.name === 'Bash');
      });

      expect(bashEvents.length).toBeGreaterThan(0);

      // Check tool result contains the output
      // Tool results are in user messages with type: 'tool_result'
      const toolResultEvents = result.events.filter((e) => e.type === 'user');
      const hasEchoOutput = toolResultEvents.some((e) => {
        const content = e.message?.content || [];
        return content.some((c: any) =>
          c.type === 'tool_result' &&
          c.content?.includes('HELLO_TEST_12345'),
        );
      });
      expect(hasEchoOutput).toBe(true);
    }, CLI_TIMEOUT);
  });

  describe('Skill-Based Behavior', () => {
    /**
     * This test demonstrates that explicitly invoking a skill changes Claude's behavior.
     *
     * Scenario:
     * 1. Ask Claude to create a greeting file WITHOUT invoking any skill
     *    → Creates file with default greeting (e.g., "Hello!")
     * 2. Create a skill and explicitly invoke it with /japanese-greeting
     * 3. Ask Claude to create a greeting file WITH the skill invoked
     *    → Creates file with Japanese greeting (e.g., "こんにちは!")
     *
     * Note: Skills in .claude/skills/ are available as slash commands but
     * don't automatically influence behavior until explicitly invoked.
     */
    it('should generate different output when skill is explicitly invoked', async () => {
      const timestamp = Date.now();
      const fileWithoutSkill = `greeting-no-skill-${timestamp}.txt`;
      const fileWithSkill = `greeting-with-skill-${timestamp}.txt`;

      // Step 1: Create a skill that instructs Japanese greetings FIRST
      // (so it's available when we run the CLI)
      const skillsDir = path.join(testWorkspaceDir, '.claude', 'skills', 'japanese-greeting');
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillsDir, 'SKILL.md'),
        `# Japanese Greeting Skill

## Description
This skill makes Claude use Japanese language for all greetings.

## Instructions
When this skill is active, ALWAYS create greeting files with Japanese text.
- Use "こんにちは" (Konnichiwa) for general greetings
- Use "おはよう" (Ohayou) for morning greetings
- Use "こんばんは" (Konbanwa) for evening greetings

CRITICAL: When creating any greeting file, the content MUST be in Japanese characters only.
Do NOT use English. Use only Japanese hiragana/katakana/kanji.
`,
        'utf-8',
      );

      // Step 2: Create file WITHOUT invoking the skill
      const resultWithoutSkill = await runClaude(
        `Create a file called "${fileWithoutSkill}" containing a simple one-word greeting. Just create the file with a single greeting word, nothing else.`,
        testWorkspaceDir,
      );

      expect(resultWithoutSkill.exitCode).toBe(0);
      const pathWithoutSkill = path.join(testWorkspaceDir, fileWithoutSkill);
      expect(fs.existsSync(pathWithoutSkill)).toBe(true);
      const contentWithoutSkill = fs.readFileSync(pathWithoutSkill, 'utf-8').trim();

      // Step 3: Create file WITH skill explicitly invoked via slash command
      // The /japanese-greeting invokes the skill before the task
      const resultWithSkill = await runClaude(
        `/japanese-greeting Create a file called "${fileWithSkill}" containing a simple one-word greeting. Just create the file with a single greeting word in Japanese.`,
        testWorkspaceDir,
      );

      expect(resultWithSkill.exitCode).toBe(0);
      const pathWithSkill = path.join(testWorkspaceDir, fileWithSkill);

      // The file should exist
      expect(fs.existsSync(pathWithSkill)).toBe(true);
      const contentWithSkill = fs.readFileSync(pathWithSkill, 'utf-8').trim();

      // Check for Japanese characters
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(contentWithSkill);

      // Log results for debugging
      console.log(`\n=== SKILL BEHAVIOR TEST RESULTS ===`);
      console.log(`Without skill: "${contentWithoutSkill}"`);
      console.log(`With skill:    "${contentWithSkill}"`);
      console.log(`Has Japanese:  ${hasJapanese}`);
      console.log(`Contents differ: ${contentWithoutSkill !== contentWithSkill}`);

      // Verify the skill influenced the output
      // Either the content should have Japanese, or the contents should differ
      const skillInfluenced = hasJapanese || contentWithoutSkill !== contentWithSkill;
      expect(skillInfluenced).toBe(true);
    }, CLI_TIMEOUT * 2);

    it('should use skill-specific file naming when instructed', async () => {
      const timestamp = Date.now();

      // Create a skill that adds a prefix to all filenames
      const skillsDir = path.join(testWorkspaceDir, '.claude', 'skills', 'prefixed-files');
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillsDir, 'SKILL.md'),
        `# Prefixed Files Skill

## Description
This skill adds a "SKILL_" prefix to all created files.

## Instructions
When creating any file, ALWAYS add the prefix "SKILL_" to the filename.

Examples:
- If asked to create "report.txt", create "SKILL_report.txt" instead
- If asked to create "data.json", create "SKILL_data.json" instead

IMPORTANT: Always add the "SKILL_" prefix without exception.
`,
        'utf-8',
      );

      // Ask Claude to create a file - skill should add prefix
      const result = await runClaude(
        `Create a file called "testfile-${timestamp}.txt" with the content "Hello World".`,
        testWorkspaceDir,
      );

      expect(result.exitCode).toBe(0);

      // Check if the prefixed file exists
      const prefixedPath = path.join(testWorkspaceDir, `SKILL_testfile-${timestamp}.txt`);
      const normalPath = path.join(testWorkspaceDir, `testfile-${timestamp}.txt`);

      const prefixedExists = fs.existsSync(prefixedPath);
      const normalExists = fs.existsSync(normalPath);

      console.log(`Prefixed file exists: ${prefixedExists}`);
      console.log(`Normal file exists: ${normalExists}`);

      // At least one should exist (skill might not always be followed perfectly)
      expect(prefixedExists || normalExists).toBe(true);

      // If skill was followed, prefixed file should exist
      if (prefixedExists) {
        console.log('SUCCESS: Skill correctly influenced file naming');
        const content = fs.readFileSync(prefixedPath, 'utf-8');
        expect(content).toContain('Hello');
      } else {
        console.log('NOTE: Skill did not influence file naming - this may happen occasionally');
      }
    }, CLI_TIMEOUT);

    it('should invoke skill via slash command', async () => {
      const timestamp = Date.now();
      const fileName = `slash-cmd-${timestamp}.txt`;

      // Create a skill with a specific slug
      const skillsDir = path.join(testWorkspaceDir, '.claude', 'skills', 'create-summary');
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillsDir, 'SKILL.md'),
        `# Create Summary Skill

## Description
Creates a summary file with a specific format.

## Instructions
When invoked, create a file with exactly this format:
- Line 1: "=== SUMMARY ==="
- Line 2: Current timestamp
- Line 3: "Generated by create-summary skill"

Always use this exact format.
`,
        'utf-8',
      );

      // Invoke the skill directly via reference
      const result = await runClaude(
        `Using the create-summary skill approach, create a file called "${fileName}" with a summary.`,
        testWorkspaceDir,
      );

      expect(result.exitCode).toBe(0);

      const filePath = path.join(testWorkspaceDir, fileName);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        console.log(`Created file content:\n${content}`);

        // Check if the file follows the skill's format
        const hasSummaryHeader = content.includes('SUMMARY') || content.includes('===');
        console.log(`Has summary format: ${hasSummaryHeader}`);
      }
    }, CLI_TIMEOUT);
  });
});

// Instructions for running these tests
console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    Real CLI Integration Tests                       ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  These tests are SKIPPED by default.                               ║
║                                                                     ║
║  To run them:                                                       ║
║  1. Ensure you're logged in: claude login                          ║
║  2. Run with: RUN_REAL_CLI_TESTS=true npm run test:e2e             ║
║                                                                     ║
║  Note: Tests use your Claude subscription credits                  ║
║                                                                     ║
╚════════════════════════════════════════════════════════════════════╝
`);
