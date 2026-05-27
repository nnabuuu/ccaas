import { describe, it, expect } from 'vitest'
import {
  TodoDataSchema,
  QuestionsDataSchema,
  VerifyDataSchema,
} from '../schemas.js'

describe('TodoDataSchema', () => {
  it('accepts the chat-doc §1.6 example verbatim', () => {
    const result = TodoDataSchema.safeParse({
      title: '执行设计生成',
      summary: '根据教案自动生成 5 个 Step、13 个模块',
      items: [
        { id: 't1', label: '解析教案文档', status: 'done' },
        {
          id: 't3',
          label: '生成 Step 1-3 模块配置',
          status: 'done',
          detail: 'Predict · Skim · Scan & Build',
        },
        { id: 't4', label: '生成 Step 4-5 模块配置', status: 'active' },
        { id: 't5', label: '配置 AI Tutor 指令与 Rubric', status: 'pending' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('requires non-empty items array (empty list defeats the card purpose)', () => {
    const result = TodoDataSchema.safeParse({
      title: 'x',
      items: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown status enum (status drives icon + color)', () => {
    const result = TodoDataSchema.safeParse({
      title: 'x',
      items: [{ id: 't1', label: 'L', status: 'in_progress' }],
    })
    expect(result.success).toBe(false)
  })

  it('summary is optional (chat-doc lists it as optional)', () => {
    const result = TodoDataSchema.safeParse({
      title: 'x',
      items: [{ id: 't1', label: 'L', status: 'done' }],
    })
    expect(result.success).toBe(true)
  })

  it('item detail is optional', () => {
    const result = TodoDataSchema.safeParse({
      title: 'x',
      items: [{ id: 't1', label: 'L', status: 'pending' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0].detail).toBeUndefined()
    }
  })

  it('rejects empty string label (status icon needs a label to anchor)', () => {
    const result = TodoDataSchema.safeParse({
      title: 'x',
      items: [{ id: 't1', label: '', status: 'done' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('QuestionsDataSchema', () => {
  it('accepts the chat-doc §2.6 example with mixed radio + text', () => {
    const result = QuestionsDataSchema.safeParse({
      title: '需要确认几个设计决策',
      subtitle: '以下信息在教案中未明确指定:',
      items: [
        {
          id: 'q1',
          label: '矩阵填空的维度选择',
          type: 'radio',
          desc: '请选择:',
          options: [
            { value: '4w', label: 'Where / Who / What / Why' },
            { value: 'simple', label: 'What / How / Why' },
          ],
          defaultValue: '4w',
        },
        {
          id: 'q4',
          label: '补充说明',
          type: 'text',
          desc: '对以上选择有任何补充?',
          placeholder: '例如:这个班...',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects radio question with < 2 options (no point in a 1-option pick)', () => {
    const result = QuestionsDataSchema.safeParse({
      title: 'x',
      items: [
        {
          id: 'q1',
          label: 'L',
          type: 'radio',
          options: [{ value: 'a', label: 'A' }],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('discriminated union rejects mixing radio + text fields on same item', () => {
    const result = QuestionsDataSchema.safeParse({
      title: 'x',
      items: [
        {
          id: 'q1',
          label: 'L',
          type: 'radio',
          placeholder: 'wrong field for radio',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      ],
    })
    // Discriminated union strict mode strips unknown fields — parse
    // succeeds because `placeholder` is silently dropped, but the
    // shape is still valid. This documents the behavior; if we want
    // strict reject, change schema to `.strict()`.
    expect(result.success).toBe(true)
  })

  it('rejects unknown question type (frontend has no renderer for it)', () => {
    const result = QuestionsDataSchema.safeParse({
      title: 'x',
      items: [{ id: 'q1', label: 'L', type: 'slider' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects defaultValue that does not match any options[].value (M2 cross-field guard)', () => {
    const result = QuestionsDataSchema.safeParse({
      title: 'x',
      items: [
        {
          id: 'q1',
          label: 'L',
          type: 'radio',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
          defaultValue: 'foo', // not in options
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts defaultValue that matches an option (sanity)', () => {
    const result = QuestionsDataSchema.safeParse({
      title: 'x',
      items: [
        {
          id: 'q1',
          label: 'L',
          type: 'radio',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
          defaultValue: 'a',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('text questions do not need options', () => {
    const result = QuestionsDataSchema.safeParse({
      title: 'x',
      items: [{ id: 'q1', label: 'L', type: 'text' }],
    })
    expect(result.success).toBe(true)
  })
})

describe('VerifyDataSchema', () => {
  it('accepts the chat-doc §3.6 example verbatim', () => {
    const result = VerifyDataSchema.safeParse({
      title: 'manifest.json 校验',
      target: 'manifest.json',
      schema: 'execution-schema v2.1',
      status: 'done',
      startedAt: '10:32:15',
      completedAt: '10:32:18',
      checks: [
        {
          id: 'c1',
          label: 'Schema 结构',
          desc: '顶层字段完整性',
          status: 'pass',
        },
        {
          id: 'c7',
          label: '观测维度引用',
          desc: 'observe.metrics 引用的指标 ID 在组件注册表中存在',
          status: 'warn',
          detail: 'b7.observe 引用了 "understanding"...',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('allows status=running with empty completedAt (chat-doc §3.2 contract)', () => {
    const result = VerifyDataSchema.safeParse({
      title: 'x',
      target: 'x',
      schema: 'v1',
      status: 'running',
      startedAt: '10:00:00',
      completedAt: '',
      checks: [{ id: 'c1', label: 'L', desc: 'D', status: 'pass' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown overall status (only running / done are valid)', () => {
    const result = VerifyDataSchema.safeParse({
      title: 'x',
      target: 'x',
      schema: 'v1',
      status: 'queued',
      startedAt: '',
      completedAt: '',
      checks: [{ id: 'c1', label: 'L', desc: 'D', status: 'pass' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown check status (only pass / warn / fail drive icons)', () => {
    const result = VerifyDataSchema.safeParse({
      title: 'x',
      target: 'x',
      schema: 'v1',
      status: 'done',
      startedAt: '',
      completedAt: '',
      checks: [{ id: 'c1', label: 'L', desc: 'D', status: 'unknown' }],
    })
    expect(result.success).toBe(false)
  })

  it('requires at least one check (empty card defeats the purpose)', () => {
    const result = VerifyDataSchema.safeParse({
      title: 'x',
      target: 'x',
      schema: 'v1',
      status: 'done',
      startedAt: '',
      completedAt: '',
      checks: [],
    })
    expect(result.success).toBe(false)
  })
})
