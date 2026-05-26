/**
 * Tests for TeachingRequirementsService — L1 library loader.
 *
 * Uses a tmp dir + TEACHING_REQUIREMENTS_DIR override so each test
 * gets a clean filesystem state. The service reads JSON files at
 * `reload()`; we call `reload()` explicitly instead of relying on
 * `onModuleInit` so tests control timing.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NotFoundException } from '@nestjs/common';

import { TeachingRequirementsService } from './teaching-requirements.service';

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'teaching-req-test-'));
}

async function writeLib(dir: string, file: string, lib: unknown): Promise<void> {
  await fs.writeFile(path.join(dir, file), JSON.stringify(lib, null, 2), 'utf8');
}

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
    {
      id: 'reading',
      label: '阅读策略',
      color: 'purple',
      items: [
        { id: 'r-2.1.1', code: '课标 3.2.1', text: '识别篇章主旨结构' },
      ],
    },
  ],
};

const MATH = {
  subject: 'math',
  subjectLabel: '数学',
  version: '2026-05',
  categories: [
    {
      id: 'knowledge',
      label: '知识理解',
      color: 'teal',
      items: [
        { id: 'm-1.1.1', code: '课标 1.1', text: '理解函数的对应关系定义' },
      ],
    },
  ],
};

describe('TeachingRequirementsService', () => {
  let tmpDir: string;
  let svc: TeachingRequirementsService;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
    originalEnv = process.env.TEACHING_REQUIREMENTS_DIR;
    process.env.TEACHING_REQUIREMENTS_DIR = tmpDir;
    svc = new TeachingRequirementsService();
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env.TEACHING_REQUIREMENTS_DIR;
    } else {
      process.env.TEACHING_REQUIREMENTS_DIR = originalEnv;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('loading', () => {
    it('loads every *.json file in the configured dir', async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      await writeLib(tmpDir, 'math.json', MATH);
      await svc.reload();
      expect(svc.listLibraries()).toHaveLength(2);
    });

    it('skips non-JSON files', async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      await fs.writeFile(path.join(tmpDir, 'README.md'), '# hi', 'utf8');
      await svc.reload();
      expect(svc.listLibraries()).toHaveLength(1);
    });

    it('tolerates a missing data dir without throwing', async () => {
      process.env.TEACHING_REQUIREMENTS_DIR = path.join(tmpDir, 'does-not-exist');
      await svc.reload();
      expect(svc.listLibraries()).toEqual([]);
    });

    it('tolerates malformed JSON (skips the broken file, loads the rest)', async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      await fs.writeFile(path.join(tmpDir, 'broken.json'), '{not json', 'utf8');
      await svc.reload();
      expect(svc.listLibraries()).toHaveLength(1);
      expect(svc.getLibrary('english')).not.toBeNull();
    });

    it('rejects parseable-but-schema-invalid JSON (skips file, loads the rest)', async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      // Missing `categories` — passes JSON.parse but fails the Zod
      // schema check. Without runtime validation, indexLibrary would
      // throw a misleading TypeError.
      await writeLib(tmpDir, 'malformed.json', { subject: 'x', subjectLabel: 'X', version: '1' });
      await svc.reload();
      expect(svc.listLibraries()).toHaveLength(1);
      expect(svc.getLibrary('english')).not.toBeNull();
    });

    it('rejects duplicate subject across files (keeps first)', async () => {
      await writeLib(tmpDir, '01-english.json', ENGLISH);
      // Same subject "english" — second file should be rejected.
      await writeLib(tmpDir, '02-english-dup.json', ENGLISH);
      await svc.reload();
      expect(svc.listLibraries()).toHaveLength(1);
    });

    it('orders files deterministically (alphabetical) for cross-host stability', async () => {
      // Two libraries with a colliding id; the alphabetically-first
      // file's subject should win the cross-subject lookup.
      const libA = {
        ...ENGLISH,
        subject: 'a-subject',
        categories: [
          {
            id: 'cat',
            label: 'Cat',
            color: 'teal',
            items: [{ id: 'r-collide', code: 'A.1', text: 'from A' }],
          },
        ],
      };
      const libB = {
        ...ENGLISH,
        subject: 'b-subject',
        categories: [
          {
            id: 'cat',
            label: 'Cat',
            color: 'teal',
            items: [{ id: 'r-collide', code: 'B.1', text: 'from B' }],
          },
        ],
      };
      // Write in reverse order — filename sort should still put A first.
      await writeLib(tmpDir, 'z-second.json', libB);
      await writeLib(tmpDir, 'a-first.json', libA);
      await svc.reload();
      const item = svc.findItemById('r-collide');
      expect(item.subject).toBe('a-subject');
      expect(item.text).toBe('from A');
    });

    it('onModuleInit triggers the load', async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      const fresh = new TeachingRequirementsService();
      await fresh.onModuleInit();
      expect(fresh.listLibraries()).toHaveLength(1);
    });

    it('reload() is single-flight under concurrent callers', async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      // Two concurrent reload()s shouldn't produce a partial state
      // mid-execution. Both promises resolve to the same final state.
      const [a, b] = await Promise.all([svc.reload(), svc.reload()]);
      expect(a).toBeUndefined();
      expect(b).toBeUndefined();
      expect(svc.listLibraries()).toHaveLength(1);
    });

    it('reload() never exposes intermediate empty state to readers', async () => {
      // First load.
      await writeLib(tmpDir, 'english.json', ENGLISH);
      await svc.reload();
      expect(svc.listLibraries()).toHaveLength(1);

      // Start a second reload — while in-flight, listLibraries should
      // still return the previous state (atomic swap semantics).
      const inFlight = svc.reload();
      // Reader during reload sees prior state, not empty:
      expect(svc.listLibraries()).toHaveLength(1);
      await inFlight;
      expect(svc.listLibraries()).toHaveLength(1);
    });

    it('reload() clears prior state', async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      await svc.reload();
      expect(svc.listLibraries()).toHaveLength(1);

      // Delete the file + reload — should drop the library.
      await fs.rm(path.join(tmpDir, 'english.json'));
      await svc.reload();
      expect(svc.listLibraries()).toEqual([]);
    });
  });

  describe('getLibrary', () => {
    beforeEach(async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      await svc.reload();
    });

    it('returns the library for a known subject', () => {
      const lib = svc.getLibrary('english');
      expect(lib?.subject).toBe('english');
      expect(lib?.categories).toHaveLength(2);
    });

    it('returns null for an unknown subject', () => {
      expect(svc.getLibrary('biology')).toBeNull();
    });
  });

  describe('findItemById', () => {
    beforeEach(async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      await writeLib(tmpDir, 'math.json', MATH);
      await svc.reload();
    });

    it('resolves an id from any subject + attaches category metadata', () => {
      const item = svc.findItemById('r-1.2.3');
      expect(item).toMatchObject({
        id: 'r-1.2.3',
        code: '课标 2.1.3',
        text: '在课文中推断生词含义',
        subject: 'english',
        categoryId: 'lang',
        categoryLabel: '语言能力',
        categoryColor: 'teal',
      });
    });

    it('resolves cross-subject (math id)', () => {
      const item = svc.findItemById('m-1.1.1');
      expect(item.subject).toBe('math');
      expect(item.categoryId).toBe('knowledge');
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => svc.findItemById('r-nonexistent')).toThrow(NotFoundException);
    });
  });

  describe('tryFindItemById', () => {
    beforeEach(async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      await svc.reload();
    });

    it('returns the item for a known id', () => {
      expect(svc.tryFindItemById('r-1.2.3')?.id).toBe('r-1.2.3');
    });

    it('returns undefined for unknown id (no throw)', () => {
      expect(svc.tryFindItemById('r-nope')).toBeUndefined();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await writeLib(tmpDir, 'english.json', ENGLISH);
      await writeLib(tmpDir, 'math.json', MATH);
      await svc.reload();
    });

    it('returns all items across subjects when no filters given', () => {
      const out = svc.search();
      expect(out.length).toBe(4);
    });

    it('filters by subject', () => {
      const out = svc.search({ subject: 'english' });
      expect(out.length).toBe(3);
      expect(out.every((i) => i.subject === 'english')).toBe(true);
    });

    it('returns empty for unknown subject (not error)', () => {
      expect(svc.search({ subject: 'biology' })).toEqual([]);
    });

    it('matches text substring case-insensitively', () => {
      const out = svc.search({ q: '推断生词' });
      expect(out.map((i) => i.id)).toEqual(['r-1.2.3']);
    });

    it('matches code substring', () => {
      const out = svc.search({ q: '2.1.3' });
      expect(out.map((i) => i.id)).toContain('r-1.2.3');
    });

    it('matches id substring', () => {
      const out = svc.search({ q: 'r-2' });
      expect(out.map((i) => i.id)).toContain('r-2.1.1');
    });

    it('combines subject + q', () => {
      const out = svc.search({ subject: 'math', q: '函数' });
      expect(out.map((i) => i.id)).toEqual(['m-1.1.1']);
    });
  });

  describe('cross-subject id collision', () => {
    it('cross-subject collision resolves to alphabetically-first file', async () => {
      const dup = { ...ENGLISH, subject: 'english-dup' };
      // Two libraries with the same item id `r-1.2.3`. The first file
      // (alphabetical sort) should win.
      await writeLib(tmpDir, 'english.json', ENGLISH);
      await writeLib(tmpDir, 'english-dup.json', dup);
      await svc.reload();

      // Both libraries load.
      expect(svc.listLibraries()).toHaveLength(2);

      // Alphabetically first: 'english-dup.json' < 'english.json' (the
      // hyphen-d comes before the period sort-wise in ASCII).
      const item = svc.findItemById('r-1.2.3');
      expect(item.subject).toBe('english-dup');
    });
  });
});
