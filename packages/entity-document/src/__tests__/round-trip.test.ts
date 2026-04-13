import { describe, it, expect } from 'vitest';
import { serialize } from '../serializer.js';
import { deserialize } from '../deserializer.js';
import type { EntityDocument } from '../interfaces.js';

function roundTrip(doc: EntityDocument): EntityDocument {
  const text = serialize(doc);
  return deserialize(text);
}

describe('round-trip', () => {
  it('section block', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [{ type: 'section', content: { text: '教学目标' } }],
    };
    const result = roundTrip(doc);
    expect(result.blocks).toEqual(doc.blocks);
  });

  it('text block', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [{ type: 'text', content: { text: '这是一段文本' } }],
    };
    const result = roundTrip(doc);
    expect(result.blocks).toEqual(doc.blocks);
  });

  it('unordered list block', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [{ type: 'list', content: { items: ['项目一', '项目二', '项目三'], ordered: false } }],
    };
    const result = roundTrip(doc);
    expect(result.blocks).toEqual(doc.blocks);
  });

  it('ordered list block', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [{ type: 'list', content: { items: ['第一步', '第二步'], ordered: true } }],
    };
    const result = roundTrip(doc);
    expect(result.blocks).toEqual(doc.blocks);
  });

  it('table block', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [{
        type: 'table',
        content: {
          headers: ['姓名', '分数'],
          rows: [['张三', '95'], ['李四', '88']],
        },
      }],
    };
    const result = roundTrip(doc);
    expect(result.blocks).toEqual(doc.blocks);
  });

  it('timeline block', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [{
        type: 'timeline',
        content: {
          items: [
            { time: "0-5'", duration: '5 min', desc: '导入新课' },
            { time: "5-25'", duration: '20 min', desc: '新课讲授' },
          ],
        },
      }],
    };
    const result = roundTrip(doc);
    expect(result.blocks).toEqual(doc.blocks);
  });

  it('callout block', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [{ type: 'callout', content: { text: '学情备注：错误率 42%' } }],
    };
    const result = roundTrip(doc);
    expect(result.blocks).toEqual(doc.blocks);
  });

  it('image block', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [{ type: 'image', content: { src: 'https://example.com/diagram.png' } }],
    };
    const result = roundTrip(doc);
    expect(result.blocks).toEqual(doc.blocks);
  });

  it('mixed document with frontmatter', () => {
    const doc: EntityDocument = {
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
    const result = roundTrip(doc);
    expect(result.meta).toEqual(doc.meta);
    expect(result.blocks).toEqual(doc.blocks);
  });

  it('empty blocks', () => {
    const doc: EntityDocument = { meta: {}, blocks: [] };
    const result = roundTrip(doc);
    expect(result.meta).toEqual({});
    expect(result.blocks).toEqual([]);
  });

  it('empty meta with blocks', () => {
    const doc: EntityDocument = {
      meta: {},
      blocks: [{ type: 'text', content: { text: '内容' } }],
    };
    const result = roundTrip(doc);
    expect(result.meta).toEqual({});
    expect(result.blocks).toEqual(doc.blocks);
  });

  it('frontmatter only, no blocks', () => {
    const doc: EntityDocument = {
      meta: { title: '测试', version: 1 },
      blocks: [],
    };
    const result = roundTrip(doc);
    expect(result.meta).toEqual(doc.meta);
    expect(result.blocks).toEqual([]);
  });

  it('preserves boolean and number types in meta', () => {
    const doc: EntityDocument = {
      meta: { title: '测试', duration: 45, published: true },
      blocks: [],
    };
    const result = roundTrip(doc);
    expect(result.meta.duration).toBe(45);
    expect(result.meta.published).toBe(true);
    expect(result.meta.title).toBe('测试');
  });

  it('meta values with colons round-trip correctly', () => {
    const doc: EntityDocument = {
      meta: { subject: '数学:高中' },
      blocks: [],
    };
    const result = roundTrip(doc);
    expect(result.meta.subject).toBe('数学:高中');
  });

  it('meta values with newlines round-trip correctly', () => {
    const doc: EntityDocument = {
      meta: { note: '第一行\n第二行' },
      blocks: [],
    };
    const result = roundTrip(doc);
    expect(result.meta.note).toBe('第一行\n第二行');
  });
});
