/**
 * SkillsService - Skill File Management Tests
 *
 * Tests for multi-file skill CRUD: upsertFiles, getSkillFiles,
 * getSkillFile, deleteFile, normalizePath, and version snapshotting.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SkillsService } from './skills.service';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SkillFile } from './entities/skill-file.entity';
import { SkillVersionFile } from './entities/skill-version-file.entity';
import { SessionService } from '../sessions/session.service';

describe('SkillsService - File Management', () => {
  let service: SkillsService;
  let skillFileRepo: Record<string, jest.Mock>;
  let skillVersionFileRepo: Record<string, jest.Mock>;
  let skillRepo: Record<string, jest.Mock>;
  let versionRepo: Record<string, jest.Mock>;
  let txManager: Record<string, jest.Mock>;

  const skillId = 'skill-123';
  const tenantId = 'tenant-123';

  beforeEach(async () => {
    txManager = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((_entity: any, data: any) => data),
      save: jest.fn().mockImplementation((_entity: any, data: any) => {
        if (Array.isArray(data)) return Promise.resolve(data.map((d: any, i: number) => ({ id: `saved-${i}`, ...d })));
        return Promise.resolve({ id: 'saved-1', ...data });
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      transaction: jest.fn().mockImplementation((cb: any) => cb(txManager)),
    };

    skillFileRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn().mockImplementation((data: any) => {
        if (Array.isArray(data)) return Promise.resolve(data.map((d: any, i: number) => ({ id: `file-${i}`, ...d })));
        return Promise.resolve({ id: 'file-1', ...data });
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    skillVersionFileRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn(),
    };

    skillRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn().mockImplementation((data: any) =>
        Promise.resolve({ ...data, updatedAt: new Date() }),
      ),
      createQueryBuilder: jest.fn(),
      manager: txManager as any,
    };

    versionRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(SkillVersion), useValue: versionRepo },
        { provide: getRepositoryToken(SkillFile), useValue: skillFileRepo },
        { provide: getRepositoryToken(SkillVersionFile), useValue: skillVersionFileRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: SessionService, useValue: { getAffectedSessions: jest.fn().mockReturnValue([]) } },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // getSkillFiles
  // =========================================================================

  describe('getSkillFiles', () => {
    it('should return all files for a skill sorted by path', async () => {
      const files = [
        { id: 'f1', skillId, relativePath: 'a.md', content: 'A' },
        { id: 'f2', skillId, relativePath: 'refs/b.md', content: 'B' },
      ];
      skillFileRepo.find.mockResolvedValue(files);

      const result = await service.getSkillFiles(skillId);

      expect(skillFileRepo.find).toHaveBeenCalledWith({
        where: { skillId },
        order: { relativePath: 'ASC' },
      });
      expect(result).toEqual(files);
    });

    it('should return empty array when skill has no files', async () => {
      skillFileRepo.find.mockResolvedValue([]);
      const result = await service.getSkillFiles(skillId);
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getSkillFile
  // =========================================================================

  describe('getSkillFile', () => {
    it('should return a single file by ID', async () => {
      const file = { id: 'f1', skillId, relativePath: 'refs/a.md', content: 'content' };
      skillFileRepo.findOne.mockResolvedValue(file);

      const result = await service.getSkillFile(skillId, 'f1');

      expect(skillFileRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'f1', skillId },
      });
      expect(result).toEqual(file);
    });

    it('should return null for non-existent file', async () => {
      skillFileRepo.findOne.mockResolvedValue(null);
      const result = await service.getSkillFile(skillId, 'non-existent');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // upsertFiles
  // =========================================================================

  describe('upsertFiles', () => {
    it('should create new files when none exist', async () => {
      skillFileRepo.find.mockResolvedValue([]);

      const files = [
        { relativePath: 'references/fold.md', content: 'fold content' },
        { relativePath: 'references/reflect.md', content: 'reflect content' },
      ];

      const result = await service.upsertFiles(skillId, files);

      expect(skillFileRepo.save).toHaveBeenCalledTimes(1);
      const savedFiles = skillFileRepo.save.mock.calls[0][0];
      expect(savedFiles).toHaveLength(2);
      expect(savedFiles[0].relativePath).toBe('references/fold.md');
      expect(savedFiles[1].relativePath).toBe('references/reflect.md');
      expect(result).toHaveLength(2);
    });

    it('should update existing files when content changes', async () => {
      const existingFile = {
        id: 'f1',
        skillId,
        relativePath: 'refs/a.md',
        content: 'old content',
        contentHash: 'old-hash',
      };
      skillFileRepo.find.mockResolvedValue([existingFile]);

      const result = await service.upsertFiles(skillId, [
        { relativePath: 'refs/a.md', content: 'new content' },
      ]);

      expect(skillFileRepo.save).toHaveBeenCalledTimes(1);
      const saved = skillFileRepo.save.mock.calls[0][0];
      expect(saved[0].content).toBe('new content');
      expect(saved[0].id).toBe('f1'); // Same entity updated
    });

    it('should skip unchanged files (same content hash)', async () => {
      // The hash for "same content" — we need to match SkillsService's hashContent
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update('same content').digest('hex').substring(0, 16);

      const existingFile = {
        id: 'f1',
        skillId,
        relativePath: 'refs/a.md',
        content: 'same content',
        contentHash: hash,
      };
      skillFileRepo.find.mockResolvedValue([existingFile]);

      const result = await service.upsertFiles(skillId, [
        { relativePath: 'refs/a.md', content: 'same content' },
      ]);

      // save should not be called (or called with empty array avoided)
      // Since toSave is empty, the code skips the save call
      expect(skillFileRepo.save).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('f1');
    });

    it('should handle mix of new, updated, and unchanged files', async () => {
      const crypto = require('crypto');
      const unchangedHash = crypto.createHash('sha256').update('unchanged').digest('hex').substring(0, 16);

      const existingFiles = [
        { id: 'f1', skillId, relativePath: 'a.md', content: 'unchanged', contentHash: unchangedHash },
        { id: 'f2', skillId, relativePath: 'b.md', content: 'old', contentHash: 'old-hash' },
      ];
      skillFileRepo.find.mockResolvedValue(existingFiles);

      const result = await service.upsertFiles(skillId, [
        { relativePath: 'a.md', content: 'unchanged' },  // skip
        { relativePath: 'b.md', content: 'updated' },     // update
        { relativePath: 'c.md', content: 'brand new' },   // create
      ]);

      expect(skillFileRepo.save).toHaveBeenCalledTimes(1);
      const saved = skillFileRepo.save.mock.calls[0][0];
      expect(saved).toHaveLength(2); // b.md updated + c.md new
      expect(result).toHaveLength(3); // 2 saved + 1 unchanged
    });

    it('should normalize paths (remove leading ./)', async () => {
      skillFileRepo.find.mockResolvedValue([]);

      await service.upsertFiles(skillId, [
        { relativePath: './references/fold.md', content: 'content' },
      ]);

      const saved = skillFileRepo.save.mock.calls[0][0];
      expect(saved[0].relativePath).toBe('references/fold.md');
    });
  });

  // =========================================================================
  // deleteFile
  // =========================================================================

  describe('deleteFile', () => {
    it('should delete a file by relativePath', async () => {
      skillFileRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteFile(skillId, 'refs/a.md');

      expect(skillFileRepo.delete).toHaveBeenCalledWith({
        skillId,
        relativePath: 'refs/a.md',
      });
    });

    it('should throw NotFoundException if file does not exist', async () => {
      skillFileRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.deleteFile(skillId, 'non-existent.md'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // normalizePath (tested indirectly through upsertFiles)
  // =========================================================================

  describe('path traversal security', () => {
    it('should reject paths with ../', async () => {
      skillFileRepo.find.mockResolvedValue([]);

      await expect(
        service.upsertFiles(skillId, [
          { relativePath: '../../../etc/passwd', content: 'malicious' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject paths with encoded traversal', async () => {
      skillFileRepo.find.mockResolvedValue([]);

      await expect(
        service.upsertFiles(skillId, [
          { relativePath: 'refs/../../outside.md', content: 'malicious' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject absolute paths', async () => {
      skillFileRepo.find.mockResolvedValue([]);

      await expect(
        service.upsertFiles(skillId, [
          { relativePath: '/etc/passwd', content: 'malicious' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid nested paths', async () => {
      skillFileRepo.find.mockResolvedValue([]);

      await service.upsertFiles(skillId, [
        { relativePath: 'references/geometry/fold.md', content: 'ok' },
      ]);

      const saved = skillFileRepo.save.mock.calls[0][0];
      expect(saved[0].relativePath).toBe('references/geometry/fold.md');
    });

    it('should accept simple filenames', async () => {
      skillFileRepo.find.mockResolvedValue([]);

      await service.upsertFiles(skillId, [
        { relativePath: 'readme.md', content: 'ok' },
      ]);

      const saved = skillFileRepo.save.mock.calls[0][0];
      expect(saved[0].relativePath).toBe('readme.md');
    });
  });

  // =========================================================================
  // createVersion - File Snapshotting
  // =========================================================================

  describe('createVersion - file snapshotting', () => {
    it('should snapshot skill files into version files', async () => {
      const mockSkill = {
        id: skillId,
        name: 'Test Skill',
        content: 'skill content',
        config: {},
        allowedTools: [],
        currentVersion: null,
      };

      const mockFiles = [
        { id: 'f1', skillId, relativePath: 'refs/a.md', content: 'A', contentHash: 'hash-a' },
        { id: 'f2', skillId, relativePath: 'refs/b.md', content: 'B', contentHash: 'hash-b' },
      ];

      // Transaction manager mocks
      txManager.findOne.mockResolvedValue(mockSkill);
      txManager.find
        .mockResolvedValueOnce([])     // existing versions (for auto-version)
        .mockResolvedValueOnce(mockFiles); // current skill files

      const result = await service.createVersion(skillId, {});

      // Should snapshot 2 files
      expect(txManager.save).toHaveBeenCalledWith(
        SkillVersionFile,
        expect.arrayContaining([
          expect.objectContaining({ relativePath: 'refs/a.md', content: 'A', contentHash: 'hash-a' }),
          expect.objectContaining({ relativePath: 'refs/b.md', content: 'B', contentHash: 'hash-b' }),
        ]),
      );
    });

    it('should handle version creation when no files exist', async () => {
      const mockSkill = {
        id: skillId,
        name: 'Test Skill',
        content: 'content',
        config: {},
        allowedTools: [],
        currentVersion: null,
      };

      txManager.findOne.mockResolvedValue(mockSkill);
      txManager.find
        .mockResolvedValueOnce([])  // existing versions
        .mockResolvedValueOnce([]); // no skill files

      await service.createVersion(skillId, {});

      // Should NOT call save for SkillVersionFile
      const versionFileSaveCalls = txManager.save.mock.calls.filter(
        (call: any[]) => call[0] === SkillVersionFile,
      );
      expect(versionFileSaveCalls).toHaveLength(0);
    });
  });

  // =========================================================================
  // rollbackToVersion - File Restoration
  // =========================================================================

  describe('rollbackToVersion - file restoration', () => {
    it('should restore files from version snapshot on rollback', async () => {
      const mockSkill = {
        id: skillId,
        tenantId,
        name: 'Test Skill',
        slug: 'test-skill',
        content: 'current content',
        config: {},
        allowedTools: [],
        currentVersion: '2.0.0',
      };

      const mockVersion = {
        id: 'version-1',
        skillId,
        version: '1.0.0',
        content: 'v1 content',
        config: { old: true },
        allowedTools: ['tool1'],
      };

      const versionFiles = [
        { id: 'vf1', versionId: 'version-1', relativePath: 'refs/a.md', content: 'V1 A', contentHash: 'vh-a' },
        { id: 'vf2', versionId: 'version-1', relativePath: 'refs/b.md', content: 'V1 B', contentHash: 'vh-b' },
      ];

      skillRepo.findOne.mockResolvedValue(mockSkill);
      versionRepo.findOne.mockResolvedValue(mockVersion);
      txManager.find.mockResolvedValue(versionFiles); // version files to restore

      await service.rollbackToVersion(tenantId, skillId, '1.0.0');

      // Should delete current files
      expect(txManager.delete).toHaveBeenCalledWith(SkillFile, { skillId });

      // Should restore files from version snapshot
      expect(txManager.save).toHaveBeenCalledWith(
        SkillFile,
        expect.arrayContaining([
          expect.objectContaining({ skillId, relativePath: 'refs/a.md', content: 'V1 A' }),
          expect.objectContaining({ skillId, relativePath: 'refs/b.md', content: 'V1 B' }),
        ]),
      );
    });

    it('should handle rollback when version has no files', async () => {
      const mockSkill = {
        id: skillId,
        tenantId,
        name: 'Test',
        slug: 'test',
        content: 'current',
        config: {},
        allowedTools: [],
        currentVersion: '2.0.0',
      };

      const mockVersion = {
        id: 'version-1',
        skillId,
        version: '1.0.0',
        content: 'v1 content',
        config: {},
        allowedTools: [],
      };

      skillRepo.findOne.mockResolvedValue(mockSkill);
      versionRepo.findOne.mockResolvedValue(mockVersion);
      txManager.find.mockResolvedValue([]); // no version files

      await service.rollbackToVersion(tenantId, skillId, '1.0.0');

      // Should still delete current files
      expect(txManager.delete).toHaveBeenCalledWith(SkillFile, { skillId });

      // Should NOT save any restored files
      const skillFileSaveCalls = txManager.save.mock.calls.filter(
        (call: any[]) => call[0] === SkillFile,
      );
      expect(skillFileSaveCalls).toHaveLength(0);
    });
  });

  // =========================================================================
  // create / update - files integration
  // =========================================================================

  describe('create with files', () => {
    it('should upsert files when provided in create DTO', async () => {
      const createDto = {
        name: 'Multi-file Skill',
        slug: 'multi-file',
        type: 'skill' as const,
        content: 'Main content',
        files: [
          { relativePath: 'refs/a.md', content: 'ref A' },
        ],
      };

      // create() now runs everything inside one transaction (HIGH #3 fix).
      // Duplicate check + skill row + skill_files + version + version_files
      // all flow through txManager.
      txManager.findOne.mockResolvedValue(null);
      txManager.save.mockImplementation((entity: any, data: any) => {
        if (Array.isArray(data)) return Promise.resolve(data);
        if (entity === Skill) return Promise.resolve({ id: skillId, ...data });
        return Promise.resolve({ id: 'tx-row-1', ...data });
      });

      await service.create(tenantId, createDto);

      // skill_files rows go through the transaction manager.
      const fileSaves = txManager.save.mock.calls.filter(
        (call: any[]) => call[0] === SkillFile,
      );
      expect(fileSaves).toHaveLength(1);
      expect(fileSaves[0][1][0].relativePath).toBe('refs/a.md');
    });
  });

  describe('update with files', () => {
    it('should upsert files when provided in update DTO', async () => {
      const existingSkill = {
        id: skillId,
        tenantId,
        name: 'Existing',
        content: 'old',
        config: {},
      };

      const updateDto = {
        name: 'Updated',
        files: [
          { relativePath: 'refs/new.md', content: 'new ref' },
        ],
      };

      skillRepo.findOne.mockResolvedValue(existingSkill);
      skillRepo.save.mockResolvedValue({ ...existingSkill, ...updateDto, updatedAt: new Date() });

      await service.update(tenantId, skillId, updateDto);

      // upsertFiles should be called
      expect(skillFileRepo.find).toHaveBeenCalledWith({ where: { skillId } });
    });
  });
});
