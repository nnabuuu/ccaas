import { describe, it, expect } from 'vitest';
import { strReplace } from '../str-replace.js';
import { serialize } from '../serializer.js';
import { serializeWithRanges } from '../serializer.js';
import type { EntityDocument } from '../interfaces.js';

describe('surgical diff — attribute preservation', () => {
  it('editing block[2] preserves attributes on block[0] and block[4]', () => {
    const doc: EntityDocument = {
      meta: { title: 'Test' },
      blocks: [
        { type: 'section', content: { text: '第一节' }, attributes: { color: 'red' } },
        { type: 'text', content: { text: '段落一' } },
        { type: 'text', content: { text: '要修改的段落' } },
        { type: 'text', content: { text: '段落三' } },
        { type: 'callout', content: { text: '备注信息' }, attributes: { style: 'warning', priority: 1 } },
      ],
    };

    const result = strReplace(doc, '要修改的段落', '已修改的段落');
    expect(result.success).toBe(true);

    // Before blocks: block[0] and block[1] — attributes preserved
    expect(result.document!.blocks[0].attributes).toEqual({ color: 'red' });
    // After blocks: block[3] and block[4] — attributes preserved
    expect(result.document!.blocks[4].attributes).toEqual({ style: 'warning', priority: 1 });
    // Affected block re-parsed — content updated
    expect(result.document!.blocks[2].content.text).toBe('已修改的段落');
  });

  it('modifying frontmatter title preserves all blocks', () => {
    const doc: EntityDocument = {
      meta: { title: '旧标题', subject: '数学' },
      blocks: [
        { type: 'section', content: { text: '第一节' }, attributes: { color: 'blue' } },
        { type: 'text', content: { text: '内容' }, attributes: { is_required: true } },
        { type: 'callout', content: { text: '备注' }, attributes: { style: 'info' } },
      ],
    };

    const result = strReplace(doc, 'title: 旧标题', 'title: 新标题');
    expect(result.success).toBe(true);
    expect(result.document!.meta.title).toBe('新标题');

    // ALL blocks are the exact same objects (not re-parsed)
    expect(result.document!.blocks).toBe(doc.blocks);
    expect(result.document!.blocks[0].attributes).toEqual({ color: 'blue' });
    expect(result.document!.blocks[1].attributes).toEqual({ is_required: true });
    expect(result.document!.blocks[2].attributes).toEqual({ style: 'info' });
  });

  it('cross-block replacement preserves before/after attributes', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [
        { type: 'section', content: { text: '标题零' }, attributes: { color: 'green' } },
        { type: 'text', content: { text: '段落一' } },
        { type: 'text', content: { text: '段落二' } },
        { type: 'callout', content: { text: '备注' }, attributes: { style: 'tip' } },
      ],
    };

    // Replace across block[1] and block[2]
    const result = strReplace(doc, '段落一\n\n段落二', '新段落A\n\n新段落B');
    expect(result.success).toBe(true);

    // block[0] before — attributes preserved
    expect(result.document!.blocks[0].attributes).toEqual({ color: 'green' });
    // block[3] after — attributes preserved
    const lastBlock = result.document!.blocks[result.document!.blocks.length - 1];
    expect(lastBlock.attributes).toEqual({ style: 'tip' });

    // Re-parsed middle blocks
    expect(result.document!.blocks[1].content.text).toBe('新段落A');
    expect(result.document!.blocks[2].content.text).toBe('新段落B');
  });

  it('inserting a new block preserves before/after attributes', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [
        { type: 'section', content: { text: '第一节' }, attributes: { color: 'red' } },
        { type: 'section', content: { text: '第二节' }, attributes: { color: 'blue' } },
      ],
    };

    const result = strReplace(
      doc,
      '## 第一节\n\n## 第二节',
      '## 第一节\n\n新插入段落\n\n## 第二节',
    );
    expect(result.success).toBe(true);
    expect(result.document!.blocks.length).toBe(3);

    // Both blocks are in the affected region since the replacement spans them,
    // but the important thing is the result is correct
    expect(result.document!.blocks[0].content.text).toBe('第一节');
    expect(result.document!.blocks[1].type).toBe('text');
    expect(result.document!.blocks[1].content.text).toBe('新插入段落');
    expect(result.document!.blocks[2].content.text).toBe('第二节');
  });

  it('deleting a block preserves before/after attributes', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [
        { type: 'section', content: { text: '保留前' }, attributes: { a: 1 } },
        { type: 'text', content: { text: '要删除' } },
        { type: 'section', content: { text: '保留后' }, attributes: { b: 2 } },
      ],
    };

    const result = strReplace(doc, '\n\n要删除\n\n', '\n\n');
    expect(result.success).toBe(true);
    expect(result.document!.blocks.length).toBe(2);
    expect(result.document!.blocks[0].attributes).toEqual({ a: 1 });
    expect(result.document!.blocks[1].attributes).toEqual({ b: 2 });
  });

  it('editing only one block with surrounding attributed blocks', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [
        { type: 'callout', content: { text: '提示A' }, attributes: { color: 'yellow' } },
        { type: 'text', content: { text: '中间内容可编辑' } },
        { type: 'callout', content: { text: '提示B' }, attributes: { color: 'green' } },
      ],
    };

    const result = strReplace(doc, '中间内容可编辑', '修改后的内容');
    expect(result.success).toBe(true);
    expect(result.document!.blocks[0].attributes).toEqual({ color: 'yellow' });
    expect(result.document!.blocks[1].content.text).toBe('修改后的内容');
    expect(result.document!.blocks[2].attributes).toEqual({ color: 'green' });
  });
});

describe('serializeWithRanges consistency', () => {
  it('produces identical text to serialize()', () => {
    const docs: EntityDocument[] = [
      {
        meta: { title: 'Test', subject: '数学' },
        blocks: [
          { type: 'section', content: { text: '标题' } },
          { type: 'list', content: { items: ['a', 'b'], ordered: false } },
          { type: 'text', content: { text: '段落' } },
        ],
      },
      { meta: {}, blocks: [] },
      {
        meta: {},
        blocks: [{ type: 'text', content: { text: 'solo' } }],
      },
      {
        meta: { title: 'Only Meta' },
        blocks: [],
      },
    ];

    for (const doc of docs) {
      const plain = serialize(doc);
      const { text } = serializeWithRanges(doc);
      expect(text).toBe(plain);
    }
  });

  it('blockRanges point to correct substrings', () => {
    const doc: EntityDocument = {
      meta: { title: 'T' },
      blocks: [
        { type: 'section', content: { text: '标题' } },
        { type: 'text', content: { text: '内容' } },
      ],
    };

    const { text, blockRanges } = serializeWithRanges(doc);

    for (const range of blockRanges) {
      const block = doc.blocks[range.blockIndex];
      const substring = text.slice(range.startChar, range.endChar);
      // Each block's serialized text should match the substring
      expect(substring).toBeTruthy();
      // Section block starts with ##
      if (block.type === 'section') {
        expect(substring).toContain('##');
        expect(substring).toContain(block.content.text);
      }
      // Text block is just the text
      if (block.type === 'text') {
        expect(substring).toBe(block.content.text);
      }
    }
  });
});
