import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { QuestionsDataSchema } from '../schemas.js'

export const emitQuestionsCardTool: Tool = {
  name: 'emit_questions_card',
  description: `在 chat 面板插入澄清问题卡, 把"教案没明确指定"的设计决策做成*表单*让教师填, 而不是用文字反复追问。

适用场景: AI 在生成执行设计时遇到不确定的设计参数 (矩阵维度、对话轮数、兜底时间...). 比"你想怎么处理 X?"这种自由文本问效率更高。

数据形状: title + items 数组, 每项是 radio (选项题) 或 text (自由文本)。 教师填完点"确认选择", 卡片冻结为已提交摘要, 同时自动把答案以 user message 发回 chat 让你继续。

注意: *radio 题必须全部回答*才能提交, text 题可选。 同一卡片可混合两种类型。 提交后你应该在下一轮回复里基于答案继续执行设计。`,
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '卡片标题, 例 "需要确认几个设计决策"',
      },
      subtitle: {
        type: 'string',
        description: '可选副标题, 给出整体上下文',
      },
      items: {
        type: 'array',
        minItems: 1,
        description: '问题列表, radio 跟 text 可混合',
        items: {
          oneOf: [
            {
              type: 'object',
              properties: {
                id: { type: 'string', description: '问题 id, 如 "q1"' },
                label: { type: 'string', description: '问题标题' },
                type: { type: 'string', enum: ['radio'], description: '单选题' },
                desc: { type: 'string', description: '问题描述/说明' },
                options: {
                  type: 'array',
                  minItems: 2,
                  description: '选项列表 (至少 2 个)',
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: 'string', description: '选项值' },
                      label: { type: 'string', description: '显示文字' },
                      detail: { type: 'string', description: '可选补充' },
                    },
                    required: ['value', 'label'],
                  },
                },
                defaultValue: { type: 'string', description: '默认选中的 value' },
              },
              required: ['id', 'label', 'type', 'options'],
            },
            {
              type: 'object',
              properties: {
                id: { type: 'string', description: '问题 id' },
                label: { type: 'string', description: '问题标题' },
                type: { type: 'string', enum: ['text'], description: '自由文本题' },
                desc: { type: 'string', description: '问题描述' },
                placeholder: { type: 'string', description: '输入框 placeholder' },
              },
              required: ['id', 'label', 'type'],
            },
          ],
        },
      },
    },
    required: ['title', 'items'],
  },
}

export function handleEmitQuestionsCard(args: unknown): { content: { type: 'text'; text: string }[] } {
  const parsed = QuestionsDataSchema.parse(args)
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ kind: 'questions' as const, ...parsed }),
      },
    ],
  }
}
