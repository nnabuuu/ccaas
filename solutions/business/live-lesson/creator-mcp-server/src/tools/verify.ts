import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { VerifyDataSchema } from '../schemas.js'

export const emitVerifyCardTool: Tool = {
  name: 'emit_verify_card',
  description: `在 chat 面板插入校验进度卡, 逐项展示对 manifest.json 等配置的 schema/约束/业务规则校验结果。

适用场景: AI 完成执行设计生成或修改后, 自动校验 schema 合法性 / 字段引用 / 时间预算等。 让教师看到"做了哪些 check + 哪些 pass / warn / fail", 而非只一句"已校验通过"。

数据形状: title + target (校验对象) + schema (版本) + status (running/done) + checks 数组 (每项: label + desc + status: pass/warn/fail + 可选 detail)。 status='running' 时前端会用 setInterval 模拟逐条揭示; status='done' 时立刻全显。 后端建议一次性传完整 checks 数组 (POC 阶段不支持流式更新)。

注意: 你*不需要*真的"逐条 check" —— 直接把完整结果数组传过去, 前端的揭示动画是 UX 修饰, 不依赖后端流式。 完成时 startedAt + completedAt 都填; running 时 completedAt 可为空字符串。`,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '卡片标题, 例 "manifest.json 校验"' },
      target: { type: 'string', description: '校验对象, 例 "manifest.json"' },
      schema: { type: 'string', description: 'Schema 版本, 例 "execution-schema v2.1"' },
      status: {
        type: 'string',
        enum: ['running', 'done'],
        description: 'running=前端模拟逐条揭示 / done=立刻全显',
      },
      startedAt: { type: 'string', description: '开始时间, 例 "10:32:15"' },
      completedAt: {
        type: 'string',
        description: '完成时间; running 时可空字符串',
      },
      checks: {
        type: 'array',
        minItems: 1,
        description: '检查项列表',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string', description: '检查项名称, 如 "Schema 结构"' },
            desc: { type: 'string', description: '检查内容描述' },
            status: {
              type: 'string',
              enum: ['pass', 'warn', 'fail'],
              description: 'pass=通过 / warn=可接受但需关注 / fail=不通过',
            },
            detail: { type: 'string', description: '可选 detail, warn/fail 时通常有' },
          },
          required: ['id', 'label', 'desc', 'status'],
        },
      },
    },
    required: ['title', 'target', 'schema', 'status', 'startedAt', 'completedAt', 'checks'],
  },
}

export function handleEmitVerifyCard(args: unknown): { content: { type: 'text'; text: string }[] } {
  const parsed = VerifyDataSchema.parse(args)
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ kind: 'verify' as const, ...parsed }),
      },
    ],
  }
}
