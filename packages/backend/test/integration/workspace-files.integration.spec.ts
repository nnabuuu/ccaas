/**
 * Workspace Files E2E Integration Tests
 *
 * Tests the REST API endpoints for workspace file access
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../../src/app.module';

describe('Workspace Files API (E2E)', () => {
  let app: INestApplication;
  let testSessionId: string;
  let testWorkspaceDir: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Setup test workspace
    testSessionId = 'e2e-test-session';
    testWorkspaceDir = path.join(process.cwd(), '.agent-workspace', 'sessions', testSessionId);

    // Create test directory structure
    fs.mkdirSync(testWorkspaceDir, { recursive: true });
    fs.mkdirSync(path.join(testWorkspaceDir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(testWorkspaceDir, 'uploads'), { recursive: true });

    // Create test files
    fs.writeFileSync(
      path.join(testWorkspaceDir, 'test.txt'),
      'This is a test file',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(testWorkspaceDir, 'scripts', 'intro.md'),
      '# Introduction\n\nWelcome to the lesson!',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(testWorkspaceDir, 'data.json'),
      JSON.stringify({ test: true, value: 42 }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(testWorkspaceDir, 'uploads', 'image.png'),
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    );
  });

  afterAll(async () => {
    // Cleanup test workspace
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
    await app.close();
  });

  describe('GET /api/v1/sessions/:sessionId/workspace', () => {
    it('should return directory tree structure', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace`)
        .expect(200);

      expect(response.body).toHaveProperty('tree');
      expect(Array.isArray(response.body.tree)).toBe(true);
      expect(response.body.tree.length).toBeGreaterThan(0);
    });

    it('should include both files and folders', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace`)
        .expect(200);

      const hasFile = response.body.tree.some((node: any) => node.type === 'file');
      const hasFolder = response.body.tree.some((node: any) => node.type === 'folder');

      expect(hasFile).toBe(true);
      expect(hasFolder).toBe(true);
    });

    it('should include nested children in folder nodes', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace`)
        .expect(200);

      const scriptsFolder = response.body.tree.find(
        (node: any) => node.name === 'scripts' && node.type === 'folder'
      );

      expect(scriptsFolder).toBeDefined();
      expect(scriptsFolder.children).toBeInstanceOf(Array);
      expect(scriptsFolder.children.length).toBeGreaterThan(0);
      expect(scriptsFolder.children[0].name).toBe('intro.md');
    });

    it('should include file metadata', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace`)
        .expect(200);

      const fileNode = response.body.tree.find(
        (node: any) => node.type === 'file' && node.name === 'test.txt'
      );

      expect(fileNode).toBeDefined();
      expect(fileNode.size).toBeGreaterThan(0);
      expect(fileNode.mimeType).toBe('text/plain');
      expect(fileNode.path).toBe('test.txt');
    });

    it('should return 404 for non-existent session', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/sessions/non-existent-session/workspace')
        .expect(404);
    });
  });

  describe('GET /api/v1/sessions/:sessionId/workspace/*', () => {
    it('should download file with correct content', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace/test.txt`)
        .expect(200);

      expect(response.text).toBe('This is a test file');
      expect(response.headers['content-type']).toBe('text/plain');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('test.txt');
    });

    it('should download nested file with correct content', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace/scripts/intro.md`)
        .expect(200);

      expect(response.text).toContain('# Introduction');
      expect(response.text).toContain('Welcome to the lesson!');
      expect(response.headers['content-type']).toBe('text/markdown');
      expect(response.headers['content-disposition']).toContain('intro.md');
    });

    it('should return correct MIME type for JSON files', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace/data.json`)
        .expect(200);

      const data = JSON.parse(response.text);
      expect(data.test).toBe(true);
      expect(data.value).toBe(42);
      expect(response.headers['content-type']).toBe('application/json');
    });

    it('should return correct MIME type for images', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace/uploads/image.png`)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/png');
      expect(Buffer.isBuffer(response.body)).toBe(true);
    });

    it('should return 400 for path traversal attempts', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace/../../../etc/passwd`)
        .expect(400);
    });

    it('should return 400 for absolute paths', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace//etc/passwd`)
        .expect(400);
    });

    it('should return 400 for URL-encoded traversal', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace/..%2F..%2Fetc%2Fpasswd`)
        .expect(400);
    });

    it('should return 400 for directory access', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace/scripts`)
        .expect(400);
    });

    it('should return 404 for non-existent files', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace/missing.txt`)
        .expect(404);
    });

    it('should return 404 for non-existent session', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/sessions/non-existent/workspace/test.txt')
        .expect(404);
    });

    it('should include Content-Length header', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace/test.txt`)
        .expect(200);

      expect(response.headers['content-length']).toBeDefined();
      expect(parseInt(response.headers['content-length'])).toBeGreaterThan(0);
    });

    it('should properly encode filenames in Content-Disposition', async () => {
      // Create file with special characters
      const specialFilename = 'test file with spaces & special (chars).txt';
      fs.writeFileSync(
        path.join(testWorkspaceDir, specialFilename),
        'content',
        'utf-8'
      );

      const response = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${testSessionId}/workspace/${encodeURIComponent(specialFilename)}`)
        .expect(200);

      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain(encodeURIComponent(specialFilename));

      // Cleanup
      fs.unlinkSync(path.join(testWorkspaceDir, specialFilename));
    });
  });

  describe('Security - Real-world Attack Scenarios', () => {
    const attackVectors = [
      {
        name: 'Directory traversal with encoded slashes',
        path: '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        expectedStatus: 400,
      },
      {
        name: 'Null byte injection',
        path: 'test.txt%00.png',
        expectedStatus: 400,
      },
      {
        name: 'Windows path separator',
        path: 'scripts\\..\\..\\windows\\system32',
        expectedStatus: 400,
      },
      {
        name: 'Double URL encoding',
        path: '%252e%252e%252f',
        expectedStatus: 400,
      },
      {
        name: 'Mixed encodings',
        path: '..%5c..%5c..%5c',
        expectedStatus: 400,
      },
    ];

    attackVectors.forEach(({ name, path: attackPath, expectedStatus }) => {
      it(`should block: ${name}`, async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/sessions/${testSessionId}/workspace/${attackPath}`)
          .expect(expectedStatus);
      });
    });
  });
});
