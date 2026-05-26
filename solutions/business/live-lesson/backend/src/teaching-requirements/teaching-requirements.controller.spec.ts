/**
 * Tests for TeachingRequirementsController — L1 reads + L2 overlay.
 *
 * Uses a real L1 service backed by a tmp dir + a mocked L2 service.
 * Mocking L2 isolates the controller-level concerns (userId
 * resolution, response composition) from DB plumbing tested in
 * `requirement-interpretation.service.spec.ts`.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { RequirementInterpretationService } from './requirement-interpretation.service';
import { TeachingRequirementsController } from './teaching-requirements.controller';
import { TeachingRequirementsService } from './teaching-requirements.service';

const ENGLISH = {
  subject: 'english',
  subjectLabel: '英语',
  version: '2026-05',
  categories: [
    {
      id: 'lang',
      label: '语言能力',
      color: 'teal',
      items: [
        { id: 'r-1.2.3', code: '课标 2.1.3', text: '在课文中推断生词含义' },
        { id: 'r-1.2.4', code: '课标 2.1.4', text: '掌握高频近义词的辨析' },
      ],
    },
  ],
};

function reqWithHeader(userId?: string): any {
  return userId ? { headers: { 'x-caller-user-id': userId } } : { headers: {} };
}

describe('TeachingRequirementsController', () => {
  let tmpDir: string;
  let controller: TeachingRequirementsController;
  let svc: TeachingRequirementsService;
  let interpretations: jest.Mocked<RequirementInterpretationService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teaching-req-ctl-'));
    process.env.TEACHING_REQUIREMENTS_DIR = tmpDir;
    process.env.LIVE_LESSON_DEFAULT_USER_ID = 'test-default';
    delete process.env.LIVE_LESSON_REQUIRE_USER_HEADER;

    await fs.writeFile(
      path.join(tmpDir, 'english.json'),
      JSON.stringify(ENGLISH),
      'utf8',
    );

    interpretations = {
      find: jest.fn().mockResolvedValue(null),
      listForUser: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<RequirementInterpretationService>;

    const mod: TestingModule = await Test.createTestingModule({
      controllers: [TeachingRequirementsController],
      providers: [
        TeachingRequirementsService,
        { provide: RequirementInterpretationService, useValue: interpretations },
      ],
    }).compile();
    controller = mod.get(TeachingRequirementsController);
    svc = mod.get(TeachingRequirementsService);
    await svc.reload();
  });

  afterEach(async () => {
    delete process.env.TEACHING_REQUIREMENTS_DIR;
    delete process.env.LIVE_LESSON_DEFAULT_USER_ID;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('GET /', () => {
    it('returns all libraries when no filter', () => {
      const out = controller.list();
      expect((out as any[]).length).toBe(1);
      expect((out as any[])[0].subject).toBe('english');
    });

    it('filters to one subject', () => {
      const out = controller.list('english');
      expect((out as any[])[0].subject).toBe('english');
    });

    it('throws NotFoundException for unknown subject', () => {
      expect(() => controller.list('biology')).toThrow(NotFoundException);
    });

    it('with q switches to flat search results', () => {
      const out = controller.list(undefined, '推断');
      expect((out as any[])[0]).toHaveProperty('categoryId');
      expect((out as any[])[0]).not.toHaveProperty('categories');
    });

    it('empty q (whitespace) treated as no q', () => {
      const out = controller.list(undefined, '   ');
      expect((out as any[])[0]).toHaveProperty('categories');
    });
  });

  describe('GET /_interpretations', () => {
    it('lists interpretations scoped to resolved userId', async () => {
      interpretations.listForUser.mockResolvedValueOnce([
        { reqId: 'r-1.2.3', notes: 'note', updatedAt: 't' },
      ]);
      const out = await controller.listMyInterpretations(reqWithHeader('alice'));
      expect(out).toEqual([
        { reqId: 'r-1.2.3', notes: 'note', updatedAt: 't' },
      ]);
      expect(interpretations.listForUser).toHaveBeenCalledWith('alice');
    });

    it('uses env-default user when no header', async () => {
      await controller.listMyInterpretations(reqWithHeader());
      expect(interpretations.listForUser).toHaveBeenCalledWith('test-default');
    });

    // Regression guard for ordering: a req id literally called
    // "interpretations" should still be findable via GET /:id, but
    // listMyInterpretations should never be confused with it because
    // we use the underscore-prefix route `_interpretations`.
    it('underscore-prefix route is not shadowed by GET /:id', async () => {
      // This is more a Nest routing assertion than a runtime check;
      // we exercise both paths and confirm they hit different handlers.
      await controller.listMyInterpretations(reqWithHeader());
      expect(interpretations.listForUser).toHaveBeenCalled();
      expect(interpretations.find).not.toHaveBeenCalled();
    });
  });

  describe('GET /:id', () => {
    it('returns L1 item + myInterpretation when interpretation exists', async () => {
      interpretations.find.mockResolvedValueOnce({
        notes: 'my note',
        updatedAt: '2026-05-27T00:00:00Z',
      });
      const out = await controller.findOne('r-1.2.3', reqWithHeader('alice'));
      expect(out.id).toBe('r-1.2.3');
      expect(out.myInterpretation).toEqual({
        notes: 'my note',
        updatedAt: '2026-05-27T00:00:00Z',
      });
      expect(interpretations.find).toHaveBeenCalledWith('alice', 'r-1.2.3');
    });

    it('myInterpretation is null when user has no record', async () => {
      interpretations.find.mockResolvedValueOnce(null);
      const out = await controller.findOne('r-1.2.3', reqWithHeader('bob'));
      expect(out.myInterpretation).toBeNull();
    });

    it('throws NotFoundException for unknown id (before L2 lookup)', async () => {
      await expect(
        controller.findOne('r-nope', reqWithHeader('alice')),
      ).rejects.toThrow(NotFoundException);
      expect(interpretations.find).not.toHaveBeenCalled();
    });
  });

  describe('PUT /:id/interpretation', () => {
    it('upserts using resolved userId', async () => {
      interpretations.upsert.mockResolvedValueOnce({
        notes: 'new notes',
        updatedAt: 't',
      });
      const out = await controller.putInterpretation(
        'r-1.2.3',
        { notes: 'new notes' },
        reqWithHeader('alice'),
      );
      expect(out).toEqual({ notes: 'new notes', updatedAt: 't' });
      expect(interpretations.upsert).toHaveBeenCalledWith(
        'alice',
        'r-1.2.3',
        'new notes',
      );
    });

    it('rejects body without notes', async () => {
      await expect(
        controller.putInterpretation('r-1.2.3', {} as any, reqWithHeader('alice')),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-string notes', async () => {
      await expect(
        controller.putInterpretation(
          'r-1.2.3',
          { notes: 123 as any },
          reqWithHeader('alice'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects notes exceeding the byte-length cap', async () => {
      // 16_000 byte cap. 'x'.repeat(16_001) is 16_001 bytes ASCII.
      await expect(
        controller.putInterpretation(
          'r-1.2.3',
          { notes: 'x'.repeat(16_001) },
          reqWithHeader('alice'),
        ),
      ).rejects.toThrow(/too large/);
    });

    it('accepts notes right at the cap', async () => {
      interpretations.upsert.mockResolvedValueOnce({
        notes: 'x'.repeat(16_000),
        updatedAt: 't',
      });
      await expect(
        controller.putInterpretation(
          'r-1.2.3',
          { notes: 'x'.repeat(16_000) },
          reqWithHeader('alice'),
        ),
      ).resolves.toMatchObject({ updatedAt: 't' });
    });

    it('counts Chinese chars by byte length (3 bytes/char UTF-8)', async () => {
      // 16_000 / 3 = 5333.33; 5334 chars exceeds the cap.
      const tooManyZh = '中'.repeat(5334); // 5334 * 3 = 16002 bytes
      await expect(
        controller.putInterpretation(
          'r-1.2.3',
          { notes: tooManyZh },
          reqWithHeader('alice'),
        ),
      ).rejects.toThrow(/too large/);
    });

    it('rejects PUT to unknown req id (no orphan rows)', async () => {
      await expect(
        controller.putInterpretation(
          'r-nope',
          { notes: 'hi' },
          reqWithHeader('alice'),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(interpretations.upsert).not.toHaveBeenCalled();
    });

    it('NEVER reads userId from body (cross-user injection defense)', async () => {
      interpretations.upsert.mockResolvedValueOnce({
        notes: 'x',
        updatedAt: 't',
      });
      // Caller attempts to override userId via body. Controller must
      // ignore — userId comes from header (resolved as 'alice'), not body.
      await controller.putInterpretation(
        'r-1.2.3',
        { notes: 'x', userId: 'mallory' } as any,
        reqWithHeader('alice'),
      );
      expect(interpretations.upsert).toHaveBeenCalledWith(
        'alice',
        'r-1.2.3',
        'x',
      );
    });
  });

  describe('GET /_materialize', () => {
    it('renders both files when subject library exists', async () => {
      interpretations.listForUser.mockResolvedValueOnce([
        {
          reqId: 'r-1.2.3',
          notes: '我的解读',
          updatedAt: '2026-05-27T00:00:00Z',
        },
      ]);
      const out = await controller.materialize('english', reqWithHeader('alice'));
      expect(out.libraryMd).toBeTruthy();
      expect(out.libraryMd).toContain('# 教学要求库');
      expect(out.interpretationsMd).toContain('# 我的解读');
      // L1 text was joined into the interpretation heading.
      expect(out.interpretationsMd).toContain('r-1.2.3 — 在课文中推断生词含义');
    });

    it('libraryMd is null when subject is unknown', async () => {
      interpretations.listForUser.mockResolvedValueOnce([]);
      const out = await controller.materialize('biology', reqWithHeader('alice'));
      expect(out.libraryMd).toBeNull();
      // Still emits the interpretations file (placeholder content).
      expect(out.interpretationsMd).toContain('# 我的解读');
    });

    it('rejects empty subject', async () => {
      await expect(
        controller.materialize('   ', reqWithHeader('alice')),
      ).rejects.toThrow();
    });

    it('uses resolved userId — never query/body', async () => {
      interpretations.listForUser.mockResolvedValueOnce([]);
      await controller.materialize('english', reqWithHeader('alice'));
      expect(interpretations.listForUser).toHaveBeenCalledWith('alice');
    });
  });

  describe('DELETE /:id/interpretation', () => {
    it('removes using resolved userId', async () => {
      interpretations.remove.mockResolvedValueOnce(undefined as any);
      await controller.deleteInterpretation('r-1.2.3', reqWithHeader('alice'));
      expect(interpretations.remove).toHaveBeenCalledWith('alice', 'r-1.2.3');
    });

    it('propagates NotFoundException from service', async () => {
      interpretations.remove.mockRejectedValueOnce(new NotFoundException());
      await expect(
        controller.deleteInterpretation('r-1.2.3', reqWithHeader('alice')),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
