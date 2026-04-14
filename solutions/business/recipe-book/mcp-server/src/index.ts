import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const BACKEND_URL = process.env.RECIPE_BACKEND_URL || 'http://localhost:3002';

const server = new Server(
  { name: 'recipe-tools', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'recipe_search',
      description: '搜索食谱',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词' },
          limit: { type: 'number', description: '返回数量' },
        },
        required: ['query'],
      },
    },
    {
      name: 'recipe_get_document',
      description: '获取食谱 entity-document 文本',
      inputSchema: {
        type: 'object',
        properties: {
          recipe_id: { type: 'string', description: '食谱 ID' },
        },
        required: ['recipe_id'],
      },
    },
    {
      name: 'recipe_edit',
      description: '编辑食谱（支持 str_replace、field_set、block_attr_set、block_content_set）',
      inputSchema: {
        type: 'object',
        properties: {
          recipe_id: { type: 'string', description: '食谱 ID' },
          operations: {
            type: 'array',
            description: '编辑操作列表',
            items: {
              type: 'object',
              properties: {
                op: { type: 'string', enum: ['str_replace', 'field_set', 'block_attr_set', 'block_content_set'] },
                old_string: { type: 'string', description: 'str_replace: 要替换的原文本' },
                new_string: { type: 'string', description: 'str_replace: 替换后的新文本' },
                field: { type: 'string', description: 'field_set/block_content_set: 字段名' },
                value: { description: 'field_set/block_attr_set/block_content_set: 新值' },
                block_index: { type: 'number', description: 'block_attr_set/block_content_set: 目标块索引' },
                attr: { type: 'string', description: 'block_attr_set: 属性名（如 color）' },
              },
              required: ['op'],
            },
          },
        },
        required: ['recipe_id', 'operations'],
      },
    },
    {
      name: 'nutrition_analyze',
      description: '分析食谱营养成分',
      inputSchema: {
        type: 'object',
        properties: {
          recipe_id: { type: 'string', description: '食谱 ID' },
        },
        required: ['recipe_id'],
      },
    },
    {
      name: 'nutrition_compare',
      description: '对比多个食谱营养',
      inputSchema: {
        type: 'object',
        properties: {
          recipe_ids: { type: 'array', items: { type: 'string' }, description: '食谱 ID 列表' },
        },
        required: ['recipe_ids'],
      },
    },
    {
      name: 'menu_suggest',
      description: '推荐菜单组合',
      inputSchema: {
        type: 'object',
        properties: {
          days: { type: 'number', description: '天数' },
          servings: { type: 'number', description: '人数' },
          preferences: { type: 'string', description: '口味偏好' },
        },
        required: ['days'],
      },
    },
    {
      name: 'show_info_card',
      description: 'Display an info card with composed sections. USE when presenting structured data (outlines, charts, metrics, action buttons). SKIP for simple text responses.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '卡片标题' },
          badge: { type: 'string', description: '可选的标签文本' },
          sections: {
            type: 'array',
            description: '卡片内容区块列表',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['outline', 'bar_list', 'metrics', 'actions', 'text'],
                  description: '区块类型: outline=大纲树, bar_list=进度条列表, metrics=指标面板, actions=操作按钮, text=纯文本',
                },
              },
              required: ['type'],
            },
          },
        },
        required: ['title', 'sections'],
      },
    },
    {
      name: 'suggest_actions',
      description: 'Suggest follow-up actions as clickable buttons. Always call AFTER presenting information, not before.',
      inputSchema: {
        type: 'object',
        properties: {
          actions: {
            type: 'array',
            description: '操作按钮列表',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: '按钮文字' },
                prompt: { type: 'string', description: '点击后发送的消息' },
                primary: { type: 'boolean', description: '是否为主要按钮' },
                skill_hint: { type: 'string', description: '可选：导航到目标 Skill（如 nutrition-calculator）' },
              },
              required: ['label', 'prompt'],
            },
          },
        },
        required: ['actions'],
      },
    },
  ],
}));

async function apiFetch(path: string, init?: RequestInit) {
  const resp = await fetch(`${BACKEND_URL}${path}`, init);
  if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'recipe_search': {
      const data = await apiFetch(`/context/search?q=${encodeURIComponent(args.query)}&entity_type=recipe&limit=${args.limit || 10}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    case 'recipe_get_document': {
      const data = await apiFetch(`/context/entity/recipe/${encodeURIComponent(args.recipe_id)}/document`);
      return { content: [{ type: 'text', text: data.document }] };
    }
    case 'recipe_edit': {
      const data = await apiFetch(`/context/entity/recipe/${encodeURIComponent(args.recipe_id)}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: args.operations }),
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    case 'nutrition_analyze': {
      const doc = await apiFetch(`/context/entity/recipe/${encodeURIComponent(args.recipe_id)}`);
      return { content: [{ type: 'text', text: JSON.stringify({ recipe: doc.ref.display_name, note: '营养分析需要外部 API 支持' }, null, 2) }] };
    }
    case 'nutrition_compare': {
      const results = [];
      for (const id of args.recipe_ids) {
        const doc = await apiFetch(`/context/entity/recipe/${encodeURIComponent(id)}`);
        results.push({ id, name: doc.ref.display_name });
      }
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    case 'menu_suggest': {
      const data = await apiFetch(`/context/search?q=&entity_type=recipe&limit=${(args.days || 3) * 3}`);
      return { content: [{ type: 'text', text: JSON.stringify({ days: args.days, suggestions: data.results }, null, 2) }] };
    }
    case 'show_info_card':
      return { content: [{ type: 'text', text: JSON.stringify(args, null, 2) }] };
    case 'suggest_actions':
      return { content: [{ type: 'text', text: JSON.stringify(args, null, 2) }] };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
