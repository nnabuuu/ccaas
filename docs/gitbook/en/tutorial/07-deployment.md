# Chapter 7: Deployment

In previous chapters, you designed a domain model, mapped user journeys, built the data flow, implemented forms with the `output_update` protocol, and wired everything together in the implementation walkthrough. Now it is time to prepare your Solution for production.

This chapter covers environment configuration, database management, monitoring, performance optimization, and scaling strategies. By the end, you will have a production-ready deployment checklist.

## Prerequisites

Before deploying, verify your Solution runs correctly in development:

```bash
# From the monorepo root
npm test                    # All tests pass
npm run build               # All packages build cleanly
```

Your Solution should have the standard structure:

```
solutions/lesson-plan-designer/
├── solution.json
├── setup.sh
├── inject-skills.sh
├── frontend/
├── backend/
├── mcp-server/
└── skills/
```

## 7.1 Environment Configuration

### Development vs Production Settings

The CCAAS backend uses environment variables for all configuration. Create a `.env.production` file for your deployment:

```bash
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_PATH=/data/ccaas/ccaas.db

# Workspace
WORKSPACE_DIR=/data/ccaas/agent-workspace
SESSION_TTL_MS=1800000          # 30 minutes idle timeout
MAX_SESSIONS=100
CLEANUP_INTERVAL_MS=300000      # 5 minutes

# Authentication
AUTH_ALLOW_ANONYMOUS=false       # Require API keys in production
AUTH_ENABLE_RATE_LIMITING=true

# Skills
SKILL_REGISTRY_DIR=/data/ccaas/skill-packages
DEFAULT_TENANT_ID=default

# MCP Health
MCP_HEALTH_CHECK_INTERVAL_MS=60000

# Message Queue (optional)
MESSAGE_QUEUE_ENABLED=false
MESSAGE_QUEUE_POLL_INTERVAL_MS=1000
MESSAGE_QUEUE_CONCURRENCY=5
MESSAGE_QUEUE_MAX_RETRIES=2

# Debug
DEBUG=false
```

### Key Differences from Development

| Setting | Development | Production |
|---------|-------------|------------|
| `NODE_ENV` | `development` | `production` |
| `AUTH_ALLOW_ANONYMOUS` | `true` | `false` |
| `AUTH_ENABLE_RATE_LIMITING` | `false` | `true` |
| `DEBUG` | `true` | `false` |
| `DATABASE_PATH` | `.agent-workspace/data.db` | Persistent volume path |
| `MCP_HEALTH_CHECK_INTERVAL_MS` | `30000` | `60000` |

### Solution Backend Configuration

Your Solution backend (port 3002) needs its own environment configuration:

```bash
# Solution backend
SOLUTION_PORT=3002
CCAAS_BACKEND_URL=http://localhost:3001
DATABASE_PATH=/data/lesson-plan-designer/lesson-plans.db
```

{% hint style="warning" %}
**Security**: Never commit `.env` files with real credentials. Use environment variable injection from your deployment platform (Docker secrets, Kubernetes ConfigMaps, etc.).
{% endhint %}

## 7.2 Database Management

### SQLite in Production

CCAAS uses SQLite by default, which is suitable for single-node deployments. TypeORM handles schema creation automatically on startup.

**Data directories to persist**:

```
/data/ccaas/
├── ccaas.db                    # CCAAS core database
├── agent-workspace/            # Session workspaces
│   └── sessions/               # Per-session directories
└── skill-packages/             # Skill definitions

/data/lesson-plan-designer/
└── lesson-plans.db             # Solution domain database
```

### Backup Strategy

For SQLite, use file-level backups:

```bash
#!/bin/bash
# backup.sh - SQLite backup script
BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Use SQLite online backup (safe for concurrent access)
sqlite3 /data/ccaas/ccaas.db ".backup '$BACKUP_DIR/ccaas.db'"
sqlite3 /data/lesson-plan-designer/lesson-plans.db ".backup '$BACKUP_DIR/lesson-plans.db'"

echo "Backup completed: $BACKUP_DIR"
```

{% hint style="info" %}
**SQLite `.backup` command** creates a consistent snapshot even while the database is being written to. Do not simply copy the `.db` file -- use the `.backup` command or set `PRAGMA wal_checkpoint(TRUNCATE)` first.
{% endhint %}

### Upgrading to PostgreSQL

For cluster deployments, TypeORM supports PostgreSQL. Update the database configuration:

```bash
# PostgreSQL configuration
DATABASE_TYPE=postgres
DATABASE_HOST=db.example.com
DATABASE_PORT=5432
DATABASE_NAME=ccaas
DATABASE_USER=ccaas_app
DATABASE_PASSWORD=<from-secret>
DATABASE_SSL=true
```

TypeORM will handle schema synchronization. For production schema changes, use explicit migrations:

```bash
# Generate a migration from entity changes
npx typeorm migration:generate -n AddLessonPlanStatus

# Run pending migrations
npx typeorm migration:run
```

## 7.3 Docker Deployment

### Dockerfile for CCAAS Backend

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/

RUN npm ci --workspace=@ccaas/backend --workspace=@ccaas/common

COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

RUN npm run build:shared && npm run build:backend

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/

EXPOSE 3001
CMD ["node", "packages/backend/dist/main.js"]
```

### Docker Compose

A complete deployment with CCAAS backend, Solution backend, and Solution frontend:

```yaml
version: '3.8'

services:
  ccaas-backend:
    build:
      context: .
      dockerfile: Dockerfile.ccaas
    ports:
      - "3001:3001"
    volumes:
      - ccaas-data:/data/ccaas
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/data/ccaas/ccaas.db
      - WORKSPACE_DIR=/data/ccaas/agent-workspace
      - AUTH_ALLOW_ANONYMOUS=false
      - AUTH_ENABLE_RATE_LIMITING=true
    restart: unless-stopped

  lesson-plan-backend:
    build:
      context: ./solutions/lesson-plan-designer/backend
    ports:
      - "3002:3002"
    volumes:
      - solution-data:/data/lesson-plan-designer
    environment:
      - CCAAS_BACKEND_URL=http://ccaas-backend:3001
      - DATABASE_PATH=/data/lesson-plan-designer/lesson-plans.db
    depends_on:
      - ccaas-backend
    restart: unless-stopped

  lesson-plan-frontend:
    build:
      context: ./solutions/lesson-plan-designer/frontend
    ports:
      - "80:80"
    depends_on:
      - ccaas-backend
      - lesson-plan-backend

volumes:
  ccaas-data:
  solution-data:
```

### Starting the Stack

```bash
# Build and start all services
docker compose up -d --build

# Check service health
docker compose ps
docker compose logs ccaas-backend

# Stop all services
docker compose down
```

## 7.4 Monitoring and Health Checks

### Built-in Health Endpoint

CCAAS provides a health check endpoint:

```bash
curl http://localhost:3001/api/v1/chat/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-15T10:30:00.000Z"
}
```

### Status Endpoint

For detailed session statistics:

```bash
curl http://localhost:3001/api/v1/chat/status
```

### Docker Health Check

Add a health check to your Docker Compose:

```yaml
services:
  ccaas-backend:
    # ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/v1/chat/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

### Application Logging

In production, configure structured logging:

```bash
# Log level control
NODE_ENV=production  # Reduces verbose logging
DEBUG=false          # Disables debug output
```

Monitor these log patterns for issues:

| Log Pattern | Meaning | Action |
|-------------|---------|--------|
| `Session cleanup` | Idle session recycled | Normal operation |
| `MCP health check failed` | MCP server unreachable | Check MCP server status |
| `Rate limit exceeded` | Client hitting rate limit | Review client behavior |
| `CLI process error` | Agent engine failure | Check agent engine logs |

### Monitoring Checklist

```
[] Health endpoint returns 200
[] Session count stays within MAX_SESSIONS
[] MCP servers pass health checks
[] Database size is within expected range
[] Agent workspace disk usage is manageable
[] Error rate is below threshold
```

## 7.5 Performance Optimization

### Session Management

Sessions are the primary resource consumed by the platform. Tune these settings based on your workload:

```bash
# Maximum concurrent sessions
MAX_SESSIONS=100

# Idle session timeout (30 minutes default)
SESSION_TTL_MS=1800000

# Cleanup interval (how often to check for expired sessions)
CLEANUP_INTERVAL_MS=300000
```

**Guidelines**:
- Lower `SESSION_TTL_MS` if users have short interactions (e.g., quick Q&A)
- Raise `MAX_SESSIONS` if you have many concurrent users
- Shorter `CLEANUP_INTERVAL_MS` frees resources faster but adds overhead

### Message Queue Tuning

If you enable the message queue for high-traffic scenarios:

```bash
MESSAGE_QUEUE_ENABLED=true
MESSAGE_QUEUE_POLL_INTERVAL_MS=500    # Faster polling
MESSAGE_QUEUE_CONCURRENCY=10          # More concurrent messages
MESSAGE_QUEUE_MAX_RETRIES=3           # More retry attempts
```

### Frontend Build Optimization

For your Solution frontend, ensure production builds are optimized:

```bash
# Vite production build
npm run build -- --mode production

# Verify bundle size
npx vite-bundle-visualizer
```

### Database Performance

For SQLite, these pragmas improve write performance:

```sql
PRAGMA journal_mode=WAL;           -- Write-Ahead Logging
PRAGMA synchronous=NORMAL;         -- Balance between safety and speed
PRAGMA cache_size=-64000;          -- 64MB cache
PRAGMA busy_timeout=5000;          -- 5 second timeout for locks
```

TypeORM applies sensible defaults, but for high-throughput scenarios you may need to tune these in the data source configuration.

## 7.6 Scaling Strategies

### Single-Node Scaling

For a single machine, scale vertically:

| Resource | Recommendation |
|----------|---------------|
| CPU | 2+ cores (agent processes are CPU-intensive) |
| RAM | 4GB minimum, 8GB recommended |
| Disk | SSD required for SQLite performance |
| Network | Low latency to AI provider APIs |

### Multi-Node Architecture

For larger deployments, split services across nodes:

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │────→│  Load Balancer   │────→│   CCAAS      │
│   (CDN/Nginx)│     │  (Sticky Session)│     │   Backend    │
└──────────────┘     └──────────────────┘     │   Node 1..N  │
                                               └──────┬───────┘
                                                      │
                                               ┌──────┴───────┐
                                               │  PostgreSQL  │
                                               │  (Shared DB) │
                                               └──────────────┘
```

{% hint style="warning" %}
**Sticky sessions required**: WebSocket connections must route to the same backend node throughout their lifetime. Configure your load balancer for session affinity (e.g., based on the Socket.io `sid` cookie).
{% endhint %}

### Scaling Checklist

```
[] Database: SQLite for single-node, PostgreSQL for multi-node
[] Load balancer: sticky sessions enabled for WebSocket
[] Storage: persistent volumes for database and workspace
[] Secrets: environment variables injected securely
[] MCP servers: health checks configured
[] Backups: automated and tested
```

## 7.7 Security Hardening

### Authentication

In production, always require API key authentication:

```bash
AUTH_ALLOW_ANONYMOUS=false
AUTH_ENABLE_RATE_LIMITING=true
```

### API Key Management

- Rotate API keys periodically
- Use scoped keys with minimum required permissions
- Monitor the admin audit log for key usage

```bash
# Create a scoped key for your Solution frontend
POST /api/v1/admin/api-keys
{
  "tenantId": "lesson-plan-designer",
  "name": "Lesson Plan Designer Frontend",
  "scopes": ["chat", "skills:read", "skills:execute"]
}
```

### Network Security

- Run the CCAAS backend behind a reverse proxy (Nginx, Caddy)
- Terminate TLS at the reverse proxy
- Restrict direct access to backend ports
- Use internal networking for service-to-service communication

### CORS Configuration

Configure CORS to allow only your frontend origins:

```bash
# In reverse proxy or backend configuration
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

## 7.8 Deployment Checklist Exercise

Use this checklist before every production deployment:

### Pre-Deployment

```
[] All tests pass: npm test
[] Production build succeeds: npm run build
[] Environment variables configured (no defaults for secrets)
[] Database backup completed
[] API keys created with appropriate scopes
```

### Infrastructure

```
[] Persistent volumes mounted for databases and workspace
[] Health checks configured and passing
[] Reverse proxy with TLS configured
[] Firewall rules restrict direct backend access
[] Log aggregation configured
```

### Application

```
[] AUTH_ALLOW_ANONYMOUS=false
[] AUTH_ENABLE_RATE_LIMITING=true
[] NODE_ENV=production
[] DEBUG=false
[] SESSION_TTL_MS appropriate for workload
[] MAX_SESSIONS appropriate for capacity
```

### Solution-Specific

```
[] solution.json is correct (MCP servers, Skills, tenant ID)
[] Skills injected: ./inject-skills.sh
[] MCP server health checks pass
[] Frontend connects to correct backend URLs
[] Conversation persistence configured (tenantId set)
```

### Post-Deployment

```
[] Health endpoint returns 200
[] Can create a new session via WebSocket
[] Can send a message and receive a response
[] Message history persists across page refresh
[] Admin dashboard accessible
[] Monitoring alerts configured
```

## Production Checkpoint

At this point, you have covered the full lifecycle of building a Solution on the KedgeAgentic platform:

1. **Architecture** -- Understanding how CCAAS core, Solution backends, and frontends interact
2. **Domain Model** -- Designing entities that live in your Solution backend
3. **User Journeys** -- Mapping the flows your users will follow
4. **Data Flow** -- Connecting WebSocket events, REST APIs, and state management
5. **Forms** -- Using the `output_update` protocol for structured data synchronization
6. **Implementation** -- Building the backend, MCP server, Skills, frontend, and tests
7. **Deployment** -- Configuring, optimizing, and securing for production

### What to Explore Next

- **Scheduled Tasks**: Automate recurring agent tasks with the Scheduler module
- **Conversation Persistence**: Enable cross-session message history (see the [Conversation Persistence Guide](../guide/conversation-persistence.md))
- **Custom MCP Servers**: Build advanced tool integrations
- **Admin Dashboard**: Monitor sessions, manage Skills, and configure API keys

Congratulations on completing the tutorial. You now have the knowledge to build, test, and deploy production Solutions on the KedgeAgentic platform.
