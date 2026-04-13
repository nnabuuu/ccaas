import { describe, it, expect } from 'vitest';
import { strReplace } from '../str-replace.js';
import type { EntityDocument } from '../interfaces.js';

const sampleDoc: EntityDocument = {
  meta: { title: '三角形全等的判定', subject: '数学', duration: 45 },
  blocks: [
    { type: 'section', content: { text: '教学目标' } },
    { type: 'list', content: { items: ['掌握SSS判定', '通过对比归纳', '培养逻辑推理'], ordered: false } },
    { type: 'section', content: { text: '教学过程' } },
    {
      type: 'timeline',
      content: {
        items: [
          { time: "0-5'", duration: '5 min', desc: '导入新课' },
          { time: "5-25'", duration: '20 min', desc: '新课讲授' },
        ],
      },
    },
    { type: 'callout', content: { text: '学情备注：八(2)班 SSS 判定错误率 42%' } },
  ],
};

describe('str_replace — single block', () => {
  it('replaces text in list item', () => {
    const result = strReplace(sampleDoc, '掌握SSS判定', '掌握SAS判定');
    expect(result.success).toBe(true);
    expect(result.document!.blocks[1].content.items[0]).toBe('掌握SAS判定');
  });

  it('replaces section heading', () => {
    const result = strReplace(sampleDoc, '## 教学目标', '## 核心目标');
    expect(result.success).toBe(true);
    expect(result.document!.blocks[0].content.text).toBe('核心目标');
  });

  it('replaces table cell (timeline desc)', () => {
    const result = strReplace(sampleDoc, '导入新课', '复习回顾');
    expect(result.success).toBe(true);
    expect(result.document!.blocks[3].content.items[0].desc).toBe('复习回顾');
  });

  it('replaces frontmatter value', () => {
    const result = strReplace(sampleDoc, 'title: 三角形全等的判定', 'title: 三角形相似的判定');
    expect(result.success).toBe(true);
    expect(result.document!.meta.title).toBe('三角形相似的判定');
  });

  it('replaces callout text', () => {
    const result = strReplace(sampleDoc, '42%', '38%');
    expect(result.success).toBe(true);
    expect(result.document!.blocks[4].content.text).toContain('38%');
  });

  it('fails when old_string not found', () => {
    const result = strReplace(sampleDoc, '不存在的文本', '新文本');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails when old_string is not unique', () => {
    // "判定" appears multiple times in the document
    const result = strReplace(sampleDoc, '判定', '判别');
    expect(result.success).toBe(false);
    expect(result.error).toContain('multiple times');
  });
});

describe('str_replace — attribute preservation', () => {
  it('preserves attributes on unchanged blocks', () => {
    const docWithAttrs: EntityDocument = {
      meta: {},
      blocks: [
        { type: 'section', content: { text: '标题一' }, attributes: { color: 'blue' } },
        { type: 'text', content: { text: '内容段落' }, attributes: { is_required: true } },
      ],
    };

    const result = strReplace(docWithAttrs, '内容段落', '修改后段落');
    expect(result.success).toBe(true);
    // First block unchanged → attributes preserved
    expect(result.document!.blocks[0].attributes).toEqual({ color: 'blue' });
    // Second block changed → attributes reset
    expect(result.document!.blocks[1].attributes).toBeUndefined();
  });
});
