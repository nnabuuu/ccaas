# Live Lesson 部署文档

目标域名：`live-lesson.edunest.cn`

## 架构总览

```
                        live-lesson.edunest.cn
                               │
                          ┌────┴────┐
                          │  Nginx  │ :80 / :443
                          └────┬────┘
                ┌──────────────┼──────────────┐
                │              │              │
         /  (静态)       /api/*         /ccaas/*
                │              │              │
       frontend/dist/    Backend :3007   CCAAS :3001
                         (NestJS)        (平台后端)
                               │
                          SQLite DB
                    data/live-lesson.db
```

| 组件 | 端口 | 技术栈 | 说明 |
|------|------|--------|------|
| Frontend | — | React + Vite (构建为静态文件) | SPA，Nginx 托管 |
| Solution Backend | 3007 | NestJS + TypeORM + SQLite | 课堂 API + SSE 推送 |
| MCP Server | stdio | Node.js | 由 CCAAS 平台管理，无需独立部署 |
| CCAAS Backend | 3001 | NestJS + Socket.IO | 平台核心，Agent 引擎 |

---

## 1. 服务器准备

### 系统要求

- OS: Ubuntu 22.04+ / Debian 12+
- Node.js: 20.x LTS
- PM2: 最新版
- Nginx: 1.24+
- 内存: >= 2GB
- 磁盘: >= 10GB

### 安装依赖

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx

# PM2
npm install -g pm2

# 验证
node -v   # v20.x
npm -v    # 10.x
pm2 -v    # 5.x
```

---

## 2. 代码部署

### 目录结构

项目部署在 `/root/ccaas`，live-lesson 位于：

```
/root/ccaas/                              # 仓库根目录
├── packages/
│   ├── common/                           # 共享类型
│   ├── react-sdk/                        # React SDK
│   └── observer-engine/                  # 观察引擎
└── solutions/business/live-lesson/       # ← 项目根目录
    ├── backend/                          # NestJS 后端
    ├── frontend/                         # React 前端
    ├── mcp-server/                       # MCP Server
    └── data/lessons/                     # 课程数据
```

```bash
# 克隆仓库（或通过 CI/CD 推送）
git clone <repo-url> /root/ccaas
cd /root/ccaas
```

### 构建

```bash
cd /root/ccaas

# 1. 安装根依赖（monorepo 的 workspace packages）
npm install

# 2. 构建共享包（backend 和 frontend 依赖这些）
npm run build -w packages/common
npm run build -w packages/react-sdk
npm run build -w packages/observer-engine

# 3. 构建 Solution Backend
cd solutions/business/live-lesson/backend
npm install --legacy-peer-deps
npx nest build

# 4. 构建 Frontend
cd ../frontend
npm install
npm run build
# 产物在 frontend/dist/

# 5. 构建 MCP Server
cd ../mcp-server
npm install
npx tsc
```

### 数据库初始化

SQLite 数据库会在 backend 首次启动时自动创建和 seed。

```bash
# 确保 data 目录存在
mkdir -p /root/ccaas/solutions/business/live-lesson/backend/data

# 如果需要预置课程数据，确认 manifest 文件存在：
ls /root/ccaas/solutions/business/live-lesson/data/lessons/*/manifest.json
```

> **注意**：生产环境 `synchronize` 为 `false`（由 `NODE_ENV=production` 控制）。
> 首次部署时需先用 `NODE_ENV=development` 启动一次让 TypeORM 创建表结构，
> 或手动运行 migration。

### Schema Migration（已有环境新增表）

当代码新增了 Entity 但生产数据库尚无对应表时，需要手动建表。
以下 SQL 涵盖截至当前版本的所有需要手动创建的表：

```bash
cd /root/ccaas/solutions/business/live-lesson/backend

sqlite3 data/live-lesson.db <<'SQL'
-- discuss_highlights（讨论高光记录）
CREATE TABLE IF NOT EXISTS discuss_highlights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  task_num INTEGER NOT NULL,
  cluster_id TEXT NOT NULL,
  message TEXT NOT NULL,
  gist TEXT NOT NULL,
  evidence_span TEXT NOT NULL,
  detected_at INTEGER NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(session_id, student_id, task_num, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_highlights_session_detected
  ON discuss_highlights(session_id, detected_at);

-- discuss_target_hits（讨论 target-point 命中记录）
CREATE TABLE IF NOT EXISTS discuss_target_hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  task_num INTEGER NOT NULL,
  target_point_id TEXT NOT NULL,
  evidence_span TEXT NOT NULL DEFAULT '',
  hit_at INTEGER NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(session_id, student_id, task_num, target_point_id)
);
SQL

echo "Migration done"
```

> **Tip**：用 `CREATE TABLE IF NOT EXISTS`，可安全重复执行。

---

## 3. 环境变量

### Backend (`backend/.env`)

```bash
# 必填
NODE_ENV=production
PORT=3007
CORS_ORIGIN=https://live-lesson.edunest.cn

# LLM API (智谱 GLM，用于 AI 批改和苏格拉底对话)
ZHIPU_API_KEY=<your-api-key>
ZHIPU_MODEL=glm-4-flash
```

### Frontend (`frontend/.env`)

Vite 构建时会将 `VITE_` 前缀的变量注入到 `import.meta.env`：

```bash
# Vite dev proxy 目标（仅开发时）
BACKEND_URL=http://localhost:3007

# CCAAS 平台后端地址（构建时注入，SDK 通过 Socket.IO 直连）
VITE_CCAAS_URL=https://live-lesson.edunest.cn
```

> `VITE_CCAAS_URL` 在构建时写入产物，修改后需重新 `npm run build`。

---

## 4. Nginx 配置

```nginx
# /etc/nginx/sites-available/live-lesson.edunest.cn

upstream solution_backend {
    server 127.0.0.1:3007;
}

upstream ccaas_backend {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name live-lesson.edunest.cn;

    # SSL 由 certbot 自动配置（见下方）
    # listen 443 ssl;

    # ── 静态前端 ──
    root /root/ccaas/solutions/business/live-lesson/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── Solution Backend API + SSE ──
    location /api/ {
        proxy_pass http://solution_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 支持（classroom stream 端点）
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;  # SSE 长连接
        chunked_transfer_encoding on;
    }

    # ── CCAAS Backend (Socket.IO) ──
    location /socket.io/ {
        proxy_pass http://ccaas_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }

    # ── CCAAS REST API (如果 SDK 也发 HTTP 请求) ──
    location /ccaas/ {
        proxy_pass http://ccaas_backend/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    # 静态资源缓存（Vite 构建带 hash）
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/live-lesson.edunest.cn \
           /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL 证书

```bash
sudo certbot --nginx -d live-lesson.edunest.cn
# certbot 会自动修改 nginx 配置添加 SSL
```

---

## 5. 进程管理 (PM2)

### 启动 Solution Backend

```bash
cd /root/ccaas/solutions/business/live-lesson/backend

# 首次启动
pm2 start dist/main.js --name live-lesson-backend \
  --cwd /root/ccaas/solutions/business/live-lesson/backend

# 保存进程列表（开机自启）
pm2 save
pm2 startup
```

### 启动 CCAAS Backend（如果需要在同一台机器运行）

```bash
cd /root/ccaas/packages/backend

pm2 start dist/main.js --name ccaas-backend \
  --cwd /root/ccaas/packages/backend

pm2 save
```

### PM2 常用命令

```bash
# 查看所有进程
pm2 list

# 查看日志
pm2 logs live-lesson-backend
pm2 logs live-lesson-backend --lines 100

# 重启
pm2 restart live-lesson-backend

# 停止
pm2 stop live-lesson-backend

# 删除
pm2 delete live-lesson-backend

# 监控面板
pm2 monit
```

### 使用 ecosystem 配置文件（可选）

创建 `/root/ccaas/solutions/business/live-lesson/ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'live-lesson-backend',
      script: 'dist/main.js',
      cwd: '/root/ccaas/solutions/business/live-lesson/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 3007,
        CORS_ORIGIN: 'https://live-lesson.edunest.cn',
      },
      max_memory_restart: '500M',
      error_file: '/root/.pm2/logs/live-lesson-backend-error.log',
      out_file: '/root/.pm2/logs/live-lesson-backend-out.log',
    },
  ],
};
```

```bash
# 使用 ecosystem 文件启动
pm2 start /root/ccaas/solutions/business/live-lesson/ecosystem.config.js

# 重启
pm2 restart ecosystem.config.js
```

---

## 6. 首次启动检查清单

```bash
# 1. 验证 backend 启动
pm2 list
curl http://localhost:3007/api/lessons
# 应返回 JSON 课程列表

# 2. 验证课程 manifest
curl http://localhost:3007/api/lessons/ideal-beauty-reading/manifest
# 应返回 manifest JSON

# 3. 验证 Nginx 代理
curl https://live-lesson.edunest.cn/api/lessons
# 应返回同样的 JSON

# 4. 验证前端
curl -I https://live-lesson.edunest.cn/
# 应返回 200，Content-Type: text/html

# 5. 验证 SSE（开一个终端监听）
curl -N https://live-lesson.edunest.cn/api/classroom/<session-code>/stream
# 应保持连接，收到 SSE 事件

# 6. 验证 CCAAS WebSocket
# 在浏览器打开 https://live-lesson.edunest.cn，检查 Network 面板
# Socket.IO 连接应该建立成功
```

---

## 7. 课程数据管理

### 添加新课程

1. 在 `data/lessons/<lesson-id>/` 下创建 `manifest.json`
2. 重启 backend（seed 逻辑在启动时运行，只 insert 不 update）

### 更新已有课程

Seed 逻辑只做 insert-if-not-exists，更新需手动：

```bash
cd /root/ccaas/solutions/business/live-lesson/backend

node -e "
const fs = require('fs'), path = require('path'), DB = require('better-sqlite3');
const lessonId = 'ideal-beauty-reading';
const raw = fs.readFileSync(path.resolve('..', 'data/lessons/' + lessonId + '/manifest.json'), 'utf-8');
const db = new DB(path.resolve('data/live-lesson.db'));
db.prepare('UPDATE lessons SET manifest_json=? WHERE id=?').run(raw, JSON.parse(raw).id);
db.close();
console.log('Updated', lessonId);
"

# 然后重启 backend
pm2 restart live-lesson-backend
```

---

## 8. 日常运维

### 日志

```bash
# Backend 日志（实时）
pm2 logs live-lesson-backend

# Backend 日志（最近 200 行）
pm2 logs live-lesson-backend --lines 200

# 清除日志
pm2 flush live-lesson-backend

# Nginx 访问日志
tail -f /var/log/nginx/access.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log
```

### 数据库备份

```bash
# SQLite 热备份
sqlite3 /root/ccaas/solutions/business/live-lesson/backend/data/live-lesson.db \
  ".backup '/root/backups/live-lesson-$(date +%Y%m%d).db'"
```

建议设置 cron 每日备份：

```bash
# /etc/cron.d/live-lesson-backup
0 3 * * * root mkdir -p /root/backups && sqlite3 /root/ccaas/solutions/business/live-lesson/backend/data/live-lesson.db ".backup '/root/backups/live-lesson-$(date +\%Y\%m\%d).db'"
```

### 更新部署

```bash
cd /root/ccaas
git pull origin master

# 重新构建
cd solutions/business/live-lesson/backend && npx nest build
cd ../frontend && npm install && npm run build

# 如果有新增 Entity / 表结构变更，先执行 migration SQL（见第 2 节）
# 如果 manifest 有改动，更新 DB 中的课程数据（见第 7 节）

# 重启
pm2 restart live-lesson-backend
```

---

## 9. 故障排查

| 症状 | 排查 |
|------|------|
| 前端空白页 | 检查 `frontend/dist/index.html` 是否存在，Nginx root 路径是否正确 |
| API 返回 502 | `pm2 list` 确认 backend 在运行，`pm2 logs live-lesson-backend` 看错误 |
| SSE 断开 | 检查 Nginx `proxy_buffering off` 和 `proxy_read_timeout` |
| Socket.IO 连不上 | 检查 `frontend/.env` 中 `VITE_CCAAS_URL` 是否正确，重新 build |
| 课程列表为空 | 检查 `data/lessons/*/manifest.json` 是否存在，或 DB 是否已 seed |
| AI 批改无响应 | 检查 `ZHIPU_API_KEY` 是否配置，`pm2 logs` 看 LLM 调用错误 |
| 数据库锁 | SQLite WAL 模式下并发写入受限，确认只有一个 backend 实例 |
| PM2 进程重启循环 | `pm2 logs live-lesson-backend --err --lines 50` 查看崩溃原因 |

---

## 10. 安全注意事项

- `ZHIPU_API_KEY` 不要提交到 git，通过 `.env` 管理
- 生产环境 `synchronize: false`（由 `NODE_ENV=production` 控制），避免表结构自动变更
- SQLite 文件权限限制为 `root:root 600`
- Nginx 启用 HTTPS 后，确保 HSTS header
- `CORS_ORIGIN` 严格限制为 `https://live-lesson.edunest.cn`
