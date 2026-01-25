/**
 * File Tracking Integration Tests
 *
 * Tests for the FilesService and file persistence:
 * - File creation from Write tool
 * - File retrieval
 * - Multi-tenant file isolation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { FilesModule } from '../../src/files/files.module';
import { MessagesModule } from '../../src/messages/messages.module';
import { FilesService } from '../../src/files/files.service';
import { AgentFile } from '../../src/files/entities/agent-file.entity';
import { Message } from '../../src/messages/entities/message.entity';

import {
  getTestDatabaseOptions,
  seedTestData,
  TEST_ENTITIES,
} from '../setup/test-database';

describe('File Tracking Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let filesService: FilesService;
  let fileRepository: Repository<AgentFile>;
  let messageRepository: Repository<Message>;
  let testTenantId: string;
  let testWorkspaceDir: string;

  beforeAll(async () => {
    testWorkspaceDir = `/tmp/ccaas-file-test-${Date.now()}`;
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
            }),
          ],
        }),
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature(TEST_ENTITIES),
        FilesModule,
        MessagesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    filesService = moduleFixture.get(FilesService);
    fileRepository = dataSource.getRepository(AgentFile);
    messageRepository = dataSource.getRepository(Message);

    // Seed test data
    const { tenant } = await seedTestData(dataSource);
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    await app.close();

    // Cleanup test workspace
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Clear file records before each test
    await fileRepository.clear();
    await messageRepository.clear();
  });

  describe('FilesService - createFromWriteTool', () => {
    it('should create file record from Write tool result', async () => {
      const sessionId = `session-${Date.now()}`;
      const messageId = 'msg-123';

      // Create a test message first
      const message = messageRepository.create({
        sessionId,
        tenantId: testTenantId,
        role: 'assistant',
        content: 'Test message',
      });
      await messageRepository.save(message);

      // Create a source file in the workspace
      const sessionDir = path.join(testWorkspaceDir, 'sessions', sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });
      const filePath = path.join(sessionDir, 'test-file.txt');
      fs.writeFileSync(filePath, 'Test content');

      // Track the file
      const agentFile = await filesService.createFromWriteTool({
        sessionId,
        messageId: message.id,
        tenantId: testTenantId,
        originalPath: 'test-file.txt',
        workspaceDir: sessionDir,
      });

      expect(agentFile).toBeDefined();
      expect(agentFile.filename).toBe('test-file.txt');
      expect(agentFile.sessionId).toBe(sessionId);
      expect(agentFile.tenantId).toBe(testTenantId);
      expect(agentFile.size).toBe(12); // 'Test content' length
    });

    it('should throw NotFoundException for non-existent file', async () => {
      const sessionId = `session-${Date.now()}`;

      const message = messageRepository.create({
        sessionId,
        tenantId: testTenantId,
        role: 'assistant',
        content: 'Test message',
      });
      await messageRepository.save(message);

      const sessionDir = path.join(testWorkspaceDir, 'sessions', sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });

      await expect(
        filesService.createFromWriteTool({
          sessionId,
          messageId: message.id,
          tenantId: testTenantId,
          originalPath: 'non-existent.txt',
          workspaceDir: sessionDir,
        }),
      ).rejects.toThrow('File not found');
    });
  });

  describe('FilesService - findBySessionId', () => {
    it('should retrieve files by session', async () => {
      const sessionId = `session-${Date.now()}`;

      // Create test message
      const message = messageRepository.create({
        sessionId,
        tenantId: testTenantId,
        role: 'assistant',
        content: 'Test message',
      });
      await messageRepository.save(message);

      // Create session directory and files
      const sessionDir = path.join(testWorkspaceDir, 'sessions', sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });

      const files = ['file1.txt', 'file2.js', 'file3.md'];
      for (const filename of files) {
        const filePath = path.join(sessionDir, filename);
        fs.writeFileSync(filePath, `Content of ${filename}`);

        await filesService.createFromWriteTool({
          sessionId,
          messageId: message.id,
          tenantId: testTenantId,
          originalPath: filename,
          workspaceDir: sessionDir,
        });
      }

      // Retrieve files by session
      const sessionFiles = await filesService.findBySessionId(sessionId);

      expect(sessionFiles.length).toBe(3);
      expect(sessionFiles.map((f: AgentFile) => f.filename).sort()).toEqual(files.sort());
    });
  });

  describe('FilesService - findByMessageId', () => {
    it('should retrieve files by message', async () => {
      const sessionId = `session-${Date.now()}`;

      // Create two messages
      const message1 = messageRepository.create({
        sessionId,
        tenantId: testTenantId,
        role: 'assistant',
        content: 'First message',
      });
      await messageRepository.save(message1);

      const message2 = messageRepository.create({
        sessionId,
        tenantId: testTenantId,
        role: 'assistant',
        content: 'Second message',
      });
      await messageRepository.save(message2);

      // Create session directory
      const sessionDir = path.join(testWorkspaceDir, 'sessions', sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });

      // Track files for each message
      const file1 = path.join(sessionDir, 'msg1-file.txt');
      fs.writeFileSync(file1, 'From message 1');
      await filesService.createFromWriteTool({
        sessionId,
        messageId: message1.id,
        tenantId: testTenantId,
        originalPath: 'msg1-file.txt',
        workspaceDir: sessionDir,
      });

      const file2 = path.join(sessionDir, 'msg2-file.txt');
      fs.writeFileSync(file2, 'From message 2');
      await filesService.createFromWriteTool({
        sessionId,
        messageId: message2.id,
        tenantId: testTenantId,
        originalPath: 'msg2-file.txt',
        workspaceDir: sessionDir,
      });

      // Retrieve files by message
      const msg1Files = await filesService.findByMessageId(message1.id);
      const msg2Files = await filesService.findByMessageId(message2.id);

      expect(msg1Files.length).toBe(1);
      expect(msg1Files[0].filename).toBe('msg1-file.txt');

      expect(msg2Files.length).toBe(1);
      expect(msg2Files[0].filename).toBe('msg2-file.txt');
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate files by tenant', async () => {
      const sessionId1 = `session-tenant1-${Date.now()}`;
      const sessionId2 = `session-tenant2-${Date.now()}`;
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      // Create messages for each tenant
      const message1 = messageRepository.create({
        sessionId: sessionId1,
        tenantId: tenant1,
        role: 'assistant',
        content: 'Tenant 1 message',
      });
      await messageRepository.save(message1);

      const message2 = messageRepository.create({
        sessionId: sessionId2,
        tenantId: tenant2,
        role: 'assistant',
        content: 'Tenant 2 message',
      });
      await messageRepository.save(message2);

      // Create session directories
      const sessionDir1 = path.join(testWorkspaceDir, 'sessions', sessionId1);
      const sessionDir2 = path.join(testWorkspaceDir, 'sessions', sessionId2);
      fs.mkdirSync(sessionDir1, { recursive: true });
      fs.mkdirSync(sessionDir2, { recursive: true });

      // Track files for each tenant
      const file1 = path.join(sessionDir1, 'tenant1-file.txt');
      fs.writeFileSync(file1, 'Tenant 1 content');
      await filesService.createFromWriteTool({
        sessionId: sessionId1,
        messageId: message1.id,
        tenantId: tenant1,
        originalPath: 'tenant1-file.txt',
        workspaceDir: sessionDir1,
      });

      const file2 = path.join(sessionDir2, 'tenant2-file.txt');
      fs.writeFileSync(file2, 'Tenant 2 content');
      await filesService.createFromWriteTool({
        sessionId: sessionId2,
        messageId: message2.id,
        tenantId: tenant2,
        originalPath: 'tenant2-file.txt',
        workspaceDir: sessionDir2,
      });

      // Query files by tenant
      const tenant1Files = await fileRepository.find({
        where: { tenantId: tenant1 },
      });
      const tenant2Files = await fileRepository.find({
        where: { tenantId: tenant2 },
      });

      expect(tenant1Files.length).toBe(1);
      expect(tenant1Files[0].filename).toBe('tenant1-file.txt');

      expect(tenant2Files.length).toBe(1);
      expect(tenant2Files[0].filename).toBe('tenant2-file.txt');
    });
  });

  describe('File Content Retrieval', () => {
    it('should retrieve file content for download', async () => {
      const sessionId = `session-${Date.now()}`;

      const message = messageRepository.create({
        sessionId,
        tenantId: testTenantId,
        role: 'assistant',
        content: 'Test message',
      });
      await messageRepository.save(message);

      const sessionDir = path.join(testWorkspaceDir, 'sessions', sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });

      const content = 'Hello, World!';
      const filePath = path.join(sessionDir, 'download-test.txt');
      fs.writeFileSync(filePath, content);

      const record = await filesService.createFromWriteTool({
        sessionId,
        messageId: message.id,
        tenantId: testTenantId,
        originalPath: 'download-test.txt',
        workspaceDir: sessionDir,
      });

      // Retrieve content
      const fileContent = await filesService.getFileContent(record.id);

      expect(fileContent.content.toString()).toBe(content);
      expect(fileContent.filename).toBe('download-test.txt');
      expect(fileContent.size).toBe(content.length);
    });
  });

  describe('File MIME Type Detection', () => {
    it('should detect MIME type from extension', async () => {
      const sessionId = `session-${Date.now()}`;

      const message = messageRepository.create({
        sessionId,
        tenantId: testTenantId,
        role: 'assistant',
        content: 'Test message',
      });
      await messageRepository.save(message);

      const sessionDir = path.join(testWorkspaceDir, 'sessions', sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });

      const testCases = [
        { filename: 'styles.css', expectedMime: 'text/css' },
        { filename: 'data.json', expectedMime: 'application/json' },
      ];

      for (const { filename, expectedMime } of testCases) {
        const filePath = path.join(sessionDir, filename);
        fs.writeFileSync(filePath, 'content');

        const record = await filesService.createFromWriteTool({
          sessionId,
          messageId: message.id,
          tenantId: testTenantId,
          originalPath: filename,
          workspaceDir: sessionDir,
        });

        expect(record.mimeType).toBe(expectedMime);
      }
    });
  });

  describe('File Deletion', () => {
    it('should delete files by session', async () => {
      const sessionId = `session-${Date.now()}`;

      const message = messageRepository.create({
        sessionId,
        tenantId: testTenantId,
        role: 'assistant',
        content: 'Test message',
      });
      await messageRepository.save(message);

      const sessionDir = path.join(testWorkspaceDir, 'sessions', sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });

      // Create files
      for (let i = 0; i < 3; i++) {
        const filename = `file${i}.txt`;
        fs.writeFileSync(path.join(sessionDir, filename), `Content ${i}`);
        await filesService.createFromWriteTool({
          sessionId,
          messageId: message.id,
          tenantId: testTenantId,
          originalPath: filename,
          workspaceDir: sessionDir,
        });
      }

      // Verify files exist
      const before = await filesService.findBySessionId(sessionId);
      expect(before.length).toBe(3);

      // Delete all files for session
      const deleted = await filesService.deleteBySessionId(sessionId);
      expect(deleted).toBe(3);

      // Verify deletion
      const after = await filesService.findBySessionId(sessionId);
      expect(after.length).toBe(0);
    });
  });
});
