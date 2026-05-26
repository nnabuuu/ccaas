/**
 * Tests for `_lib/*.md` renderers.
 *
 * These outputs are the grep contract for the agent — when format
 * drifts, agents writing prompts that grep for `### r-X.Y.Z` patterns
 * break silently. Hence the asserts on exact heading shape.
 */

import {
  materializeLibFiles,
  renderInterpretations,
  renderLibrary,
} from './lib-renderer';

const LIB = {
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

describe('renderLibrary', () => {
  it('includes the agent-contract HTML comment at the top', () => {
    const out = renderLibrary(LIB);
    expect(out).toMatch(/^<!--/);
    expect(out).toContain('教学要求库');
  });

  it('renders each item as ### <id> — <code> followed by text on the next line', () => {
    const out = renderLibrary(LIB);
    // Agent-grep contract: matching on `### r-1.2.3` returns the
    // heading; the very next non-empty line is the canonical text.
    expect(out).toMatch(/### r-1\.2\.3 — 课标 2\.1\.3\n在课文中推断生词含义/);
  });

  it('groups items under their category heading', () => {
    const out = renderLibrary(LIB);
    expect(out).toMatch(/## 语言能力 \(lang\)/);
    expect(out).toMatch(/## 阅读策略 \(reading\)/);
  });

  it('output ends with a trailing newline (POSIX text file convention)', () => {
    const out = renderLibrary(LIB);
    expect(out.endsWith('\n')).toBe(true);
  });
});

describe('renderInterpretations', () => {
  it('shows a placeholder when no interpretations recorded', () => {
    const out = renderInterpretations([]);
    expect(out).toContain('尚未记录');
  });

  it('renders each interpretation under ## <id> — <text>', () => {
    const out = renderInterpretations([
      {
        reqId: 'r-1.2.3',
        text: '在课文中推断生词含义',
        notes: '我的解读: 重点训练上下文线索',
        updatedAt: '2026-05-27T00:00:00Z',
      },
    ]);
    expect(out).toMatch(/## r-1\.2\.3 — 在课文中推断生词含义\n\n我的解读/);
  });

  it('marks orphans when text is missing (L1 dropped the id)', () => {
    const out = renderInterpretations([
      { reqId: 'r-old', notes: '...', updatedAt: 't' },
    ]);
    expect(out).toMatch(/r-old — \(库 item 已失效\)/);
  });

  it('separates multiple interpretations with --- so Grep -A returns clean blocks', () => {
    const out = renderInterpretations([
      { reqId: 'r-1', text: 'one', notes: 'note 1', updatedAt: 't1' },
      { reqId: 'r-2', text: 'two', notes: 'note 2', updatedAt: 't2' },
    ]);
    const sepCount = out.match(/^---$/gm)?.length ?? 0;
    expect(sepCount).toBeGreaterThanOrEqual(2);
  });

  it('preserves the agent-contract HTML comment header', () => {
    const out = renderInterpretations([]);
    expect(out).toMatch(/^<!--/);
    expect(out).toContain('per-user overlay');
  });
});

describe('materializeLibFiles', () => {
  it('produces both files when library + interpretations present', () => {
    const out = materializeLibFiles({
      library: LIB,
      interpretations: [
        { reqId: 'r-1.2.3', text: '推断生词', notes: 'note', updatedAt: 't' },
      ],
    });
    expect(out.libraryMd).toContain('# 教学要求库');
    expect(out.interpretationsMd).toContain('# 我的解读');
  });

  it('libraryMd is null when no library for the subject', () => {
    const out = materializeLibFiles({
      library: null,
      interpretations: [],
    });
    expect(out.libraryMd).toBeNull();
    // interpretationsMd should still render (just the placeholder).
    expect(out.interpretationsMd).toContain('尚未记录');
  });
});
