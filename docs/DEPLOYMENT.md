# Deployment Guide

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 18.0.0 | |
| npm | >= 9.0.0 | |
| Claude CLI | latest | Must be installed and authenticated |
| SQLite3 | any | For database management commands |

**Verify Claude CLI is ready:**
```bash
claude --version
claude --print "hello"   # Should respond without prompts
```

---

## 1. Install & Build

```bash
# Clone the repo
git clone <repo-url>
cd kedge-ccaas

# Install all dependencies
npm install

# Build in order (shared first, then everything else)
npm run build:common
npm run build:backend
npm run build:admin
```

---

## 2. Configure Backend

```bash
cd packages/backend
cp .env.example.nestjs .env
```

Edit `.env`:

```env
# Server
PORT=3001
NODE_ENV=production

# Workspace (where sessions and database live)
WORKSPACE_DIR=.agent-workspace
DATABASE_PATH=.agent-workspace/data.db

# Session settings
SESSION_TTL_MS=1800000       # 30 minutes idle timeout
MAX_SESSIONS=100

# Claude CLI — use absolute path for reliability in production
CLAUDE_CLI_PATH=/usr/local/bin/claude   # adjust to your actual path

# Bootstrap admin key — set this BEFORE first start
INITIAL_ADMIN_KEY=sk-default-<generate-a-random-hex-32>
```

**Generate a secure key:**
```bash
echo "sk-default-$(openssl rand -hex 16)"
```

---

## 3. Start the Backend

```bash
cd packages/backend
node dist/main.js
```

On first startup, the backend will:
- Create `.agent-workspace/data.db`
- Create a default tenant
- Register the `INITIAL_ADMIN_KEY` as the bootstrap admin key

Confirm it's running:
```bash
curl http://localhost:3001/api/v1/chat/health
# → { "status": "ok" }
```

**Keep it running with PM2:**
```bash
npm install -g pm2
pm2 start dist/main.js --name kedge-backend
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

---

## 4. Serve the Admin UI

The admin UI is a static Vite build. Serve it with any web server.

**Build output is at:** `packages/admin-next/dist/`

**Option A — simple static server (for testing):**
```bash
cd packages/admin-next
npx serve dist -p 5175
```

**Option B — Nginx (recommended for production):**

```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;
    root /path/to/kedge-ccaas/packages/admin-next/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API to backend (includes SSE endpoints)
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_buffering off;              # Required for SSE streaming
        proxy_cache off;
        proxy_set_header Connection '';    # Required for SSE keep-alive
        proxy_read_timeout 3600s;         # SSE long-lived; backend sends heartbeat every 30s
    }
}
```

**Log in:** Open the admin UI, enter your `INITIAL_ADMIN_KEY` on the login page.

---

## 5. First-Time Setup: Create a Solution

Every solution needs its own tenant and API key.

```bash
BACKEND=http://localhost:3001
ADMIN_KEY=sk-default-<your-key>

# Create a tenant
curl -s -X POST $BACKEND/api/v1/solutions \
  -H "x-api-key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Solution",
    "slug": "my-solution"
  }'
# → { "id": "<tenant-id>", ... }

# Create an API key for the tenant
curl -s -X POST $BACKEND/api/v1/admin/api-keys \
  -H "x-api-key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "solutionId": "<tenant-id>",
    "name": "My Solution Key",
    "scopes": ["skills:read", "skills:write", "mcp:read", "mcp:write", "chat"]
  }'
# → { "rawKey": "sk-my-solution-xxxxx" }
# ⚠️  Save rawKey — it is only shown once
```

---

## 6. Register Skills

After creating a tenant, import its skills from `solution.json`:

```bash
cd packages/backend
npm run skill:import -- <solution-name>

# Example
npm run skill:import -- quiz-analyzer
npm run skill:import -- live-lesson
```

Verify in the Admin UI: **Solutions → [your tenant] → Skills tab**

---

## Ports Summary

| Service | Port | Notes |
|---------|------|-------|
| Backend API | 3001 | NestJS |
| Admin UI | 5175 | Static files / Nginx |

---

## Upgrading

```bash
git pull
npm install
npm run build:common
npm run build:backend
npm run build:admin
pm2 restart kedge-backend
```

---

## Troubleshooting

**Backend won't start — "cannot find claude"**
Set `CLAUDE_CLI_PATH` to the absolute path returned by `which claude`.

**Admin UI shows "Invalid API key"**
Use the exact value of `INITIAL_ADMIN_KEY` from your `.env` to log in.

**Sessions hang / no response from agent**
Run `claude --print "test"` as the same system user that runs the backend. If it prompts for login, re-authenticate: `claude auth`.

**Port 3001 already in use**
Change `PORT` in `.env` and update the Nginx proxy target accordingly.
