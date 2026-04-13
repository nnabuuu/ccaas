import { describe, it, expect } from 'vitest';
import { strReplace } from '../str-replace.js';
import { serialize } from '../serializer.js';
import type { EntityDocument } from '../interfaces.js';

describe('str_replace — cross block', () => {
  it('replaces text spanning text + list blocks', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [
        { type: 'text', content: { text: '以下是重点' } },
        { type: 'list', content: { items: ['要点一', '要点二'], ordered: false } },
      ],
    };

    const text = serialize(doc);
    // The replacement spans from text block into list block
    const result = strReplace(doc, '以下是重点\n\n- 要点一', '以下是核心内容\n\n- 核心要点');
    expect(result.success).toBe(true);
    expect(result.document!.blocks[0].content.text).toBe('以下是核心内容');
    expect(result.document!.blocks[1].content.items[0]).toBe('核心要点');
  });

  it('replaces text spanning section + list', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [
        { type: 'section', content: { text: '教学目标' } },
        { type: 'list', content: { items: ['目标一', '目标二'], ordered: false } },
      ],
    };

    const result = strReplace(
      doc,
      '## 教学目标\n\n- 目标一',
      '## 学习目标\n\n- 新目标一',
    );
    expect(result.success).toBe(true);
    expect(result.document!.blocks[0].content.text).toBe('学习目标');
    expect(result.document!.blocks[1].content.items[0]).toBe('新目标一');
  });

  it('deletes an entire block by replacing with empty string', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [
        { type: 'section', content: { text: '第一节' } },
        { type: 'text', content: { text: '要删除的段落' } },
        { type: 'section', content: { text: '第二节' } },
      ],
    };

    const result = strReplace(doc, '\n\n要删除的段落\n\n', '\n\n');
    expect(result.success).toBe(true);
    // Should now have 2 blocks: section "第一节" and section "第二节"
    expect(result.document!.blocks.length).toBe(2);
    expect(result.document!.blocks[0].content.text).toBe('第一节');
    expect(result.document!.blocks[1].content.text).toBe('第二节');
  });

  it('inserts new content between blocks', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [
        { type: 'section', content: { text: '第一节' } },
        { type: 'section', content: { text: '第二节' } },
      ],
    };

    const result = strReplace(
      doc,
      '## 第一节\n\n## 第二节',
      '## 第一节\n\n新插入的段落\n\n## 第二节',
    );
    expect(result.success).toBe(true);
    expect(result.document!.blocks.length).toBe(3);
    expect(result.document!.blocks[0].type).toBe('section');
    expect(result.document!.blocks[1].type).toBe('text');
    expect(result.document!.blocks[1].content.text).toBe('新插入的段落');
    expect(result.document!.blocks[2].type).toBe('section');
  });
});
