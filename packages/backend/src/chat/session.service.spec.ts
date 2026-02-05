/**
 * SessionService Unit Tests
 *
 * Testing workspace file access with security validation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { EventMapperService } from './event-mapper.service';
import * as fs from 'fs';
import * as path from 'path';

describe('SessionService - Workspace File Access', () => {
  let service: SessionService;
  let testWorkspaceDir: string;
  let testSessionId: string;

  beforeEach(async () => {
    // Setup test workspace
    testWorkspaceDir = path.join(__dirname, '..', '..', 'test-workspace');
    testSessionId = 'test-session-123';
    const sessionDir = path.join(testWorkspaceDir, 'sessions', testSessionId);

    // Create test directory structure
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.mkdirSync(path.join(sessionDir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(sessionDir, '.context'), { recursive: true });

    // Create test files
    fs.writeFileSync(path.join(sessionDir, 'test.txt'), 'test content', 'utf-8');
    fs.writeFileSync(path.join(sessionDir, 'scripts', 'intro.md'), '# Introduction', 'utf-8');
    fs.writeFileSync(path.join(sessionDir, '.context', 'data.json'), '{}', 'utf-8');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'workspace.dir': testWorkspaceDir,
                'workspace.sessionTtlMs': 1800000,
                'workspace.maxSessions': 100,
                'workspace.cleanupIntervalMs': 300000,
                'CLAUDE_CLI_PATH': 'claude',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: EventMapperService,
          useValue: {
            mapToFrontendEvents: jest.fn(),
            clearSessionState: jest.fn(),
            registerBackgroundTaskCallback: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    // Cleanup test workspace
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
  });

  describe('getWorkspaceFile', () => {
    it('should return file info for valid path', async () => {
      const result = await service.getWorkspaceFile(testSessionId, 'test.txt');

      expect(result.filename).toBe('test.txt');
      expect(result.mimeType).toBe('text/plain');
      expect(result.size).toBeGreaterThan(0);
      expect(result.absolutePath).toContain('test.txt');
    });

    it('should handle nested paths correctly', async () => {
      const result = await service.getWorkspaceFile(testSessionId, 'scripts/intro.md');

      expect(result.filename).toBe('intro.md');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.absolutePath).toContain(path.join('scripts', 'intro.md'));
    });

    it('should block path traversal with ../', async () => {
      await expect(
        service.getWorkspaceFile(testSessionId, '../../../etc/passwd')
      ).rejects.toThrow(BadRequestException);
    });

    it('should block path traversal with encoded ../', async () => {
      await expect(
        service.getWorkspaceFile(testSessionId, '..%2F..%2F..%2Fetc%2Fpasswd')
      ).rejects.toThrow(BadRequestException);
    });

    it('should block null byte injection', async () => {
      await expect(
        service.getWorkspaceFile(testSessionId, 'file.txt\0.png')
      ).rejects.toThrow(BadRequestException);
    });

    it('should block absolute paths', async () => {
      await expect(
        service.getWorkspaceFile(testSessionId, '/etc/passwd')
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject symlinks', async () => {
      const sessionDir = path.join(testWorkspaceDir, 'sessions', testSessionId);
      const linkPath = path.join(sessionDir, 'malicious-link');

      // Create symlink to /etc/passwd
      try {
        fs.symlinkSync('/etc/passwd', linkPath);
      } catch (err) {
        // Skip test if symlink creation fails (permissions)
        return;
      }

      await expect(
        service.getWorkspaceFile(testSessionId, 'malicious-link')
      ).rejects.toThrow(BadRequestException);

      // Cleanup
      fs.unlinkSync(linkPath);
    });

    it('should reject directories', async () => {
      await expect(
        service.getWorkspaceFile(testSessionId, 'scripts')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent files', async () => {
      await expect(
        service.getWorkspaceFile(testSessionId, 'missing.txt')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent session', async () => {
      await expect(
        service.getWorkspaceFile('non-existent-session', 'test.txt')
      ).rejects.toThrow(NotFoundException);
    });

    it('should detect MIME types correctly', async () => {
      const sessionDir = path.join(testWorkspaceDir, 'sessions', testSessionId);

      // Create files with different extensions
      fs.writeFileSync(path.join(sessionDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4E, 0x47]));
      fs.writeFileSync(path.join(sessionDir, 'data.json'), '{"test":true}');
      fs.writeFileSync(path.join(sessionDir, 'script.js'), 'console.log("test")');

      const pngFile = await service.getWorkspaceFile(testSessionId, 'image.png');
      expect(pngFile.mimeType).toBe('image/png');

      const jsonFile = await service.getWorkspaceFile(testSessionId, 'data.json');
      expect(jsonFile.mimeType).toBe('application/json');

      const jsFile = await service.getWorkspaceFile(testSessionId, 'script.js');
      expect(jsFile.mimeType).toBe('application/javascript');
    });
  });

  describe('getWorkspaceTree', () => {
    it('should return directory tree structure', async () => {
      const result = await service.getWorkspaceTree(testSessionId);

      expect(result.tree).toBeInstanceOf(Array);
      expect(result.tree.length).toBeGreaterThan(0);
    });

    it('should include folders and files', async () => {
      const result = await service.getWorkspaceTree(testSessionId);

      const folderNode = result.tree.find(n => n.type === 'folder');
      const fileNode = result.tree.find(n => n.type === 'file');

      expect(folderNode).toBeDefined();
      expect(fileNode).toBeDefined();
    });

    it('should sort folders before files', async () => {
      const result = await service.getWorkspaceTree(testSessionId);

      // Find first file and last folder index
      const types = result.tree.map(n => n.type);
      const firstFileIndex = types.indexOf('file');
      const lastFolderIndex = types.lastIndexOf('folder');

      // All folders should come before all files
      if (firstFileIndex !== -1 && lastFolderIndex !== -1) {
        expect(lastFolderIndex).toBeLessThan(firstFileIndex);
      }
    });

    it('should include nested children in folders', async () => {
      const result = await service.getWorkspaceTree(testSessionId);

      const scriptsFolder = result.tree.find(n => n.name === 'scripts' && n.type === 'folder');

      expect(scriptsFolder).toBeDefined();
      expect(scriptsFolder?.children).toBeInstanceOf(Array);
      expect(scriptsFolder?.children?.length).toBeGreaterThan(0);
    });

    it('should include file metadata (size, mimeType)', async () => {
      const result = await service.getWorkspaceTree(testSessionId);

      const fileNode = result.tree.find(n => n.type === 'file' && n.name === 'test.txt');

      expect(fileNode).toBeDefined();
      expect(fileNode?.size).toBeGreaterThan(0);
      expect(fileNode?.mimeType).toBe('text/plain');
    });

    it('should generate unique IDs for each node', async () => {
      const result = await service.getWorkspaceTree(testSessionId);

      const ids = new Set<string>();

      function collectIds(nodes: any[]) {
        for (const node of nodes) {
          ids.add(node.id);
          if (node.children) {
            collectIds(node.children);
          }
        }
      }

      collectIds(result.tree);

      // Count total nodes
      let nodeCount = 0;
      function countNodes(nodes: any[]) {
        nodeCount += nodes.length;
        for (const node of nodes) {
          if (node.children) countNodes(node.children);
        }
      }
      countNodes(result.tree);

      expect(ids.size).toBe(nodeCount);
    });

    it('should throw NotFoundException for non-existent session', async () => {
      await expect(
        service.getWorkspaceTree('non-existent-session')
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty directories', async () => {
      const emptySessionId = 'empty-session';
      const emptyDir = path.join(testWorkspaceDir, 'sessions', emptySessionId);
      fs.mkdirSync(emptyDir, { recursive: true });

      const result = await service.getWorkspaceTree(emptySessionId);

      expect(result.tree).toBeInstanceOf(Array);
      expect(result.tree.length).toBe(0);
    });

    it('should sort items alphabetically within type groups', async () => {
      const sessionDir = path.join(testWorkspaceDir, 'sessions', testSessionId);

      // Create multiple files to test sorting
      fs.writeFileSync(path.join(sessionDir, 'zebra.txt'), 'z');
      fs.writeFileSync(path.join(sessionDir, 'alpha.txt'), 'a');
      fs.writeFileSync(path.join(sessionDir, 'beta.txt'), 'b');

      const result = await service.getWorkspaceTree(testSessionId);

      const files = result.tree.filter(n => n.type === 'file');
      const fileNames = files.map(f => f.name);

      // Check if files are sorted alphabetically
      const sortedNames = [...fileNames].sort();
      expect(fileNames).toEqual(sortedNames);
    });
  });

  describe('Security - Path Traversal Protection', () => {
    const traversalTests = [
      { name: 'Parent directory traversal', path: '../../../etc/passwd' },
      { name: 'Normalized parent traversal', path: 'scripts/../../etc/passwd' },
      { name: 'Double encoding', path: '%252e%252e%252f' },
      { name: 'Windows UNC path', path: '\\\\server\\share\\file.txt' },
      { name: 'Absolute path', path: '/etc/passwd' },
      { name: 'Null byte injection', path: 'file.txt\0.png' },
      { name: 'Backslash traversal', path: '..\\..\\..\\windows\\system32' },
    ];

    traversalTests.forEach(({ name, path: testPath }) => {
      it(`should block: ${name}`, async () => {
        await expect(
          service.getWorkspaceFile(testSessionId, testPath)
        ).rejects.toThrow(BadRequestException);
      });
    });
  });
});
