/**
 * Tests for TeachingRequirementsController — L1 read endpoints.
 *
 * Uses a real (in-memory-indexed) service backed by a tmp dir so we
 * exercise the actual controller→service path. Mocking the service
 * out would test less than the underlying serialization contract.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

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

describe('TeachingRequirementsController', () => {
  let tmpDir: string;
  let controller: TeachingRequirementsController;
  let svc: TeachingRequirementsService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teaching-req-ctl-'));
    process.env.TEACHING_REQUIREMENTS_DIR = tmpDir;
    await fs.writeFile(
      path.join(tmpDir, 'english.json'),
      JSON.stringify(ENGLISH),
      'utf8',
    );

    const mod: TestingModule = await Test.createTestingModule({
      controllers: [TeachingRequirementsController],
      providers: [TeachingRequirementsService],
    }).compile();
    controller = mod.get(TeachingRequirementsController);
    svc = mod.get(TeachingRequirementsService);
    await svc.reload();
  });

  afterEach(async () => {
    delete process.env.TEACHING_REQUIREMENTS_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('GET /', () => {
    it('returns all libraries when no filter', () => {
      const out = controller.list();
      expect(Array.isArray(out)).toBe(true);
      expect((out as any[]).length).toBe(1);
      expect((out as any[])[0].subject).toBe('english');
    });

    it('filters to one subject', () => {
      const out = controller.list('english');
      expect((out as any[]).length).toBe(1);
      expect((out as any[])[0].subject).toBe('english');
    });

    it('throws NotFoundException for unknown subject', () => {
      expect(() => controller.list('biology')).toThrow(NotFoundException);
    });

    it('with q switches to flat search results', () => {
      const out = controller.list(undefined, '推断');
      expect(Array.isArray(out)).toBe(true);
      expect((out as any[]).length).toBeGreaterThanOrEqual(1);
      // Search response has category metadata flat (no nested `categories`)
      expect((out as any[])[0]).toHaveProperty('categoryId');
      expect((out as any[])[0]).not.toHaveProperty('categories');
    });

    it('with subject + q narrows search', () => {
      const out = controller.list('english', 'r-1');
      expect((out as any[]).every((i: any) => i.subject === 'english')).toBe(true);
    });

    it('empty q (whitespace) treated as no q (falls back to library list)', () => {
      const out = controller.list(undefined, '   ');
      expect((out as any[])[0]).toHaveProperty('categories');
    });
  });

  describe('GET /:id', () => {
    it('returns the item with category metadata', () => {
      const item = controller.findOne('r-1.2.3');
      expect(item.id).toBe('r-1.2.3');
      expect(item.categoryLabel).toBe('语言能力');
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => controller.findOne('r-nope')).toThrow(NotFoundException);
    });
  });
});
