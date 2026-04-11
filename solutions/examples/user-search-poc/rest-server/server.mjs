#!/usr/bin/env node

/**
 * User Search POC — Mock REST API Server
 *
 * Zero-dependency HTTP server using Node.js built-in `http` module.
 * Exposes the same MOCK_USERS data as the stdio MCP server,
 * but as plain REST endpoints for the REST Adapter Bridge to call.
 *
 * Endpoints:
 *   GET  /xcf-modular/users?keyword=张三   → search users
 *   POST /xcf-modular/write-output         → accept field+value
 *
 * Usage: node rest-server/server.mjs
 *   PORT=4567 (default)
 */

import { createServer } from 'node:http';

// ---------------------------------------------------------------------------
// Mock data (identical to mcp-server/index.mjs)
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
// Helpers
// ---------------------------------------------------------------------------

function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // GET /xcf-modular/users?keyword=xxx
  if (req.method === 'GET' && url.pathname === '/xcf-modular/users') {
    const keyword = url.searchParams.get('keyword') || '';
    const users = searchUsers(keyword);
    return json(res, 200, {
      code: 200,
      message: 'success',
      data: { users, total: users.length, keyword },
    });
  }

  // POST /xcf-modular/write-output
  if (req.method === 'POST' && url.pathname === '/xcf-modular/write-output') {
    const body = await readBody(req);
    return json(res, 200, {
      success: true,
      field: body.field || '',
      preview: body.preview || '已更新',
      message: `字段 "${body.field}" 已同步到前端`,
    });
  }

  // 404
  json(res, 404, { error: 'Not Found', path: url.pathname });
});

const PORT = Number(process.env.PORT) || 4567;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock REST API listening on http://localhost:${PORT}`);
});
