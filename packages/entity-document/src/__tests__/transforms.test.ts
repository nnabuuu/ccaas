import { describe, it, expect } from 'vitest';
import { sectionTransform } from '../transforms/section.js';
import { textTransform } from '../transforms/text.js';
import { listTransform } from '../transforms/list.js';
import { tableTransform } from '../transforms/table.js';
import { timelineTransform } from '../transforms/timeline.js';
import { calloutTransform } from '../transforms/callout.js';
import { imageTransform } from '../transforms/image.js';

describe('section transform', () => {
  it('serializes heading', () => {
    expect(sectionTransform.serialize({ text: '教学目标' })).toBe('## 教学目标');
  });

  it('deserializes heading', () => {
    expect(sectionTransform.deserialize(['## 教学目标'])).toEqual({ text: '教学目标' });
  });

  it('detects heading', () => {
    expect(sectionTransform.detect(['## 教学目标'])).toBe(true);
    expect(sectionTransform.detect(['# 一级标题'])).toBe(false);
    expect(sectionTransform.detect(['普通文本'])).toBe(false);
  });
});

describe('text transform', () => {
  it('serializes text', () => {
    expect(textTransform.serialize({ text: '段落内容' })).toBe('段落内容');
  });

  it('deserializes text', () => {
    expect(textTransform.deserialize(['段落内容'])).toEqual({ text: '段落内容' });
  });

  it('deserializes multi-line text', () => {
    expect(textTransform.deserialize(['第一行', '第二行'])).toEqual({ text: '第一行\n第二行' });
  });

  it('always detects (fallback)', () => {
    expect(textTransform.detect(['any content'])).toBe(true);
  });
});

describe('list transform', () => {
  it('serializes unordered list', () => {
    const result = listTransform.serialize({ items: ['掌握SSS判定', '通过对比归纳'], ordered: false });
    expect(result).toBe('- 掌握SSS判定\n- 通过对比归纳');
  });

  it('serializes ordered list', () => {
    const result = listTransform.serialize({ items: ['第一步', '第二步', '第三步'], ordered: true });
    expect(result).toBe('1. 第一步\n2. 第二步\n3. 第三步');
  });

  it('deserializes unordered list', () => {
    const result = listTransform.deserialize(['- 掌握SSS判定', '- 通过对比归纳']);
    expect(result).toEqual({ items: ['掌握SSS判定', '通过对比归纳'], ordered: false });
  });

  it('deserializes ordered list', () => {
    const result = listTransform.deserialize(['1. 第一步', '2. 第二步']);
    expect(result).toEqual({ items: ['第一步', '第二步'], ordered: true });
  });

  it('detects unordered list', () => {
    expect(listTransform.detect(['- item'])).toBe(true);
  });

  it('detects ordered list', () => {
    expect(listTransform.detect(['1. item'])).toBe(true);
  });

  it('does not detect non-list', () => {
    expect(listTransform.detect(['普通文本'])).toBe(false);
  });
});

describe('table transform', () => {
  it('serializes table', () => {
    const result = tableTransform.serialize({
      headers: ['姓名', '分数'],
      rows: [['张三', '95'], ['李四', '88']],
    });
    expect(result).toBe(
      '| 姓名 | 分数 |\n| --- | --- |\n| 张三 | 95 |\n| 李四 | 88 |',
    );
  });

  it('deserializes table', () => {
    const lines = [
      '| 姓名 | 分数 |',
      '| --- | --- |',
      '| 张三 | 95 |',
      '| 李四 | 88 |',
    ];
    const result = tableTransform.deserialize(lines);
    expect(result).toEqual({
      headers: ['姓名', '分数'],
      rows: [['张三', '95'], ['李四', '88']],
    });
  });

  it('detects table', () => {
    expect(tableTransform.detect(['| a | b |', '| --- | --- |'])).toBe(true);
    expect(tableTransform.detect(['普通文本'])).toBe(false);
  });
});

describe('timeline transform', () => {
  it('serializes timeline', () => {
    const result = timelineTransform.serialize({
      items: [
        { time: "0-5'", duration: '5 min', desc: '导入新课' },
        { time: "5-25'", duration: '20 min', desc: '新课讲授' },
      ],
    });
    expect(result).toContain('<!-- type:timeline -->');
    expect(result).toContain('| 时段 | 时长 | 内容 |');
    expect(result).toContain("| 0-5' | 5 min | 导入新课 |");
  });

  it('deserializes timeline', () => {
    const lines = [
      '<!-- type:timeline -->',
      '| 时段 | 时长 | 内容 |',
      '| --- | --- | --- |',
      "| 0-5' | 5 min | 导入新课 |",
      "| 5-25' | 20 min | 新课讲授 |",
    ];
    const result = timelineTransform.deserialize(lines);
    expect(result).toEqual({
      items: [
        { time: "0-5'", duration: '5 min', desc: '导入新课' },
        { time: "5-25'", duration: '20 min', desc: '新课讲授' },
      ],
    });
  });

  it('detects timeline', () => {
    expect(timelineTransform.detect(['<!-- type:timeline -->'])).toBe(true);
    expect(timelineTransform.detect(['| a |'])).toBe(false);
  });
});

describe('callout transform', () => {
  it('serializes callout', () => {
    expect(calloutTransform.serialize({ text: '学情备注：错误率 42%' })).toBe(
      '> 学情备注：错误率 42%',
    );
  });

  it('serializes multi-line callout', () => {
    expect(calloutTransform.serialize({ text: '第一行\n第二行' })).toBe(
      '> 第一行\n> 第二行',
    );
  });

  it('deserializes callout', () => {
    expect(calloutTransform.deserialize(['> 学情备注'])).toEqual({ text: '学情备注' });
  });

  it('deserializes multi-line callout', () => {
    expect(calloutTransform.deserialize(['> 第一行', '> 第二行'])).toEqual({
      text: '第一行\n第二行',
    });
  });

  it('detects callout', () => {
    expect(calloutTransform.detect(['> text'])).toBe(true);
    expect(calloutTransform.detect(['普通文本'])).toBe(false);
  });
});

describe('image transform', () => {
  it('serializes image with src', () => {
    expect(imageTransform.serialize({ src: 'https://example.com/img.png' })).toBe(
      '![image](https://example.com/img.png)',
    );
  });

  it('serializes image without src', () => {
    expect(imageTransform.serialize({})).toBe('![image]()');
  });

  it('deserializes image', () => {
    expect(imageTransform.deserialize(['![image](https://example.com/img.png)'])).toEqual({
      src: 'https://example.com/img.png',
    });
  });

  it('deserializes image with empty src', () => {
    expect(imageTransform.deserialize(['![image]()'])).toEqual({});
  });

  it('detects image', () => {
    expect(imageTransform.detect(['![image](https://example.com/img.png)'])).toBe(true);
    expect(imageTransform.detect(['![alt text](./local.jpg)'])).toBe(true);
    expect(imageTransform.detect(['普通文本'])).toBe(false);
  });
});
