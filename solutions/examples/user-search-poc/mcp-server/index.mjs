#!/usr/bin/env node

/**
 * User Search POC — Mock MCP Server (stdio)
 *
 * Exposes two tools that mimic the Builder's REST adapter endpoints:
 *   - business_http_request  — returns mock user data
 *   - write_output           — accepts field+value, returns success
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_USERS = [
  { id: 1, name: '张三', department: '技术部', position: '高级工程师', email: 'zhangsan@example.com', phone: '13800138001' },
  { id: 2, name: '张三丰', department: '产品部', position: '产品经理', email: 'zhangsanfeng@example.com', phone: '13800138002' },
  { id: 3, name: '李四', department: '市场部', position: '市场总监', email: 'lisi@example.com', phone: '13800138003' },
  { id: 4, name: '王五', department: '技术部', position: '前端工程师', email: 'wangwu@example.com', phone: '13800138004' },
  { id: 5, name: '赵六', department: '人事部', position: 'HR经理', email: 'zhaoliu@example.com', phone: '13800138005' },
];

function searchUsers(keyword) {
  if (!keyword) return MOCK_USERS;
  return MOCK_USERS.filter(u => u.name.includes(keyword) || u.department.includes(keyword));
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'user-search-tools',
  version: '1.0.0',
});

server.tool(
  'business_http_request',
  '调用业务系统 HTTP 接口，根据 authBindingId 自动注入业务 token',
  {
    authBindingId: z.string().describe('前端写入会话上下文的短期身份绑定 ID'),
    method: z.string().describe('HTTP 方法：GET/POST/PUT/DELETE'),
    path: z.string().describe('业务接口路径，只允许 /xcf-modular、/xcoffice、/xcadmin 前缀'),
    query: z.string().optional().describe('查询参数对象（JSON）'),
    body: z.string().optional().describe('请求体对象（JSON）'),
  },
  async ({ authBindingId, method, path, query }) => {
    // Validate path prefix
    const allowedPrefixes = ['/xcf-modular', '/xcoffice', '/xcadmin'];
    if (!allowedPrefixes.some(p => path.startsWith(p))) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `路径不允许: ${path}，只允许 ${allowedPrefixes.join('、')} 前缀` }) }],
        isError: true,
      };
    }

    // Parse query to extract keyword
    let keyword = '';
    if (query) {
      try {
        const q = JSON.parse(query);
        keyword = q.keyword || '';
      } catch {
        keyword = query;
      }
    }

    const users = searchUsers(keyword);

    const result = {
      code: 200,
      message: 'success',
      data: {
        users,
        total: users.length,
        keyword,
      },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  'write_output',
  '将结构化字段同步到前端面板',
  {
    field: z.string().describe('字段名，目前固定为 search_result'),
    value: z.string().describe('字段值（JSON 对象序列化为字符串）'),
    preview: z.string().optional().describe('前端展示的简短摘要'),
  },
  async ({ field, value, preview }) => {
    // In mock mode, just acknowledge receipt
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          field,
          preview: preview || '已更新',
          message: `字段 "${field}" 已同步到前端`,
        }),
      }],
    };
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
