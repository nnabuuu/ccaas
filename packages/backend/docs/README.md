# CCAAS Backend Documentation

Complete documentation for Claude Code as a Service backend system.

---

## 📚 Documentation Index

### For Solution Developers

| Document | Description | Audience |
|----------|-------------|----------|
| **[Skill Registration](./SKILL_REGISTRATION.md)** | Register solution skills to CCAAS backend database | Solution Developers |
| **[Authentication & Authorization](./AUTHENTICATION_AND_AUTHORIZATION.md)** | Complete guide on API Keys, permissions, and integration | Solution Developers, Platform Admins |
| **[Error Handling](./ERROR_HANDLING.md)** | Standardized error handling and exception system | All Developers |
| **[Swagger/OpenAPI](./SWAGGER.md)** | Interactive API documentation (中英文) | All Developers |

### Core Concepts

#### Authentication & Authorization
- **API Key Types**: Solution-Level (system) vs User-Level (personal)
- **Scopes**: chat, skills:*, mcp:*, admin, analytics:read
- **Bootstrap Workflow**: Creating first API Key to solve chicken-and-egg
- **Guard Chain**: ApiKeyGuard → SolutionAuthGuard → SkillPermissionGuard
- **Permission Patterns**: Public, Personal, Hybrid models

#### Error Handling
- **12 Standard Error Codes**: Validation, Auth, NotFound, RateLimit, etc.
- **HTTP Status Mapping**: 400, 401, 403, 404, 429, 500, 502, 503, 504
- **Retry Hints**: recoverable, retryable, retryAfter fields
- **Global Filter**: Automatic error transformation and logging

---

## 🚀 Quick Start

### For New Solution Developers

1. **Register Skills** (Required First Step)
   ```bash
   cd packages/backend
   npm run skill:import -- your-solution
   ```

2. **Create Solution and Bootstrap Key**
   ```bash
   cd solutions/your-solution
   ./create-bootstrap-key.sh
   # Save the output: sk-bootstrap_xxx
   ```

3. **Register MCP Servers** (if needed)
   ```bash
   export CCAAS_API_KEY=sk-bootstrap_xxx
   ./inject-mcp-servers.sh
   ```

4. **Frontend Integration**
   ```typescript
   // React
   const { connection, chat } = useAgentChat({
     serverUrl: 'http://localhost:3001',
     solutionId: 'your-solution'
   });

   // Vue
   const connection = useAgentConnection({
     serverUrl: 'http://localhost:3001',
     solutionId: 'your-solution'
   });
   ```

**That's it!** CCAAS backend automatically:
- ✅ Loads all registered Skills
- ✅ Starts all configured MCP Servers
- ✅ Configures AgentEngine CLI arguments
- ✅ Manages session lifecycle

---

## 📖 API Reference

### Swagger UI
- **中文版**: http://localhost:3001/api/docs
- **English**: http://localhost:3001/api/docs/en
- **OpenAPI JSON**: http://localhost:3001/api/docs-json

### Key Endpoints

**Authentication:**
- `POST /api/v1/admin/api-keys` - Create API Key (requires admin)
- `GET /api/v1/admin/api-keys` - List API Keys
- `POST /api/v1/admin/api-keys/:id/revoke` - Revoke Key

**Skills:**
- `POST /api/v1/skills` - Create Skill
- `GET /api/v1/skills` - List Skills
- `PUT /api/v1/skills/:id` - Update Skill
- `POST /api/v1/skills/:id/publish` - Publish Skill

**MCP Servers:**
- `POST /api/v1/mcp-servers` - Create MCP Server
- `GET /api/v1/mcp-servers` - List MCP Servers
- `PUT /api/v1/mcp-servers/:id` - Update MCP Server
- `POST /api/v1/mcp-servers/:id/health` - Health Check

**Sessions:**
- WebSocket: `ws://localhost:3001` - Real-time messaging
- `GET /api/v1/sessions/:id/messages` - Message history
- `POST /api/v1/sessions/:id/cancel` - Cancel operation

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend  │◄───►│  NestJS Server   │◄───►│  AgentEngine        │
│ (Socket.io) │     │  (ChatGateway)   │     │ (claude/opencode)   │
└─────────────┘     └──────────────────┘     └─────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌──────────┐  ┌──────────────┐
              │MCP Pool  │  │ Skill Router │
              └──────────┘  └──────────────┘
```

### Key Modules

| Module | Purpose | Documentation |
|--------|---------|---------------|
| **AuthModule** | API Key authentication, scope-based authorization | [Auth Guide](./AUTHENTICATION_AND_AUTHORIZATION.md) |
| **ChatModule** | WebSocket gateway, session management | [CLAUDE.md](../CLAUDE.md#chatmodule-chat) |
| **SkillsModule** | Skill CRUD, routing, versioning | [CLAUDE.md](../CLAUDE.md#skillsmodule-skills) |
| **McpModule** | MCP server pool, health checks | [CLAUDE.md](../CLAUDE.md#mcpmodule-mcp) |
| **SchedulerModule** | Cron jobs, background tasks | [CLAUDE.md](../CLAUDE.md#schedulermodule-scheduler) |
| **ProtocolModule** | Event types, validation, errors | [Error Handling](./ERROR_HANDLING.md) |

---

## 🔐 Security Best Practices

### API Key Management

**✅ DO:**
- Rotate Bootstrap Keys every 90 days
- Use separate keys for different environments (dev/staging/prod)
- Set expiration dates on temporary keys
- Store keys in environment variables or secret managers
- Use minimum required scopes (Principle of Least Privilege)

**❌ DON'T:**
- Commit API Keys to Git
- Hardcode keys in source code
- Share the same key across multiple users
- Use Bootstrap Keys in production
- Pass keys in URL parameters

### Permission Design

**Solution-Level Keys:**
```json
{
  "scopes": ["skills:write", "mcp:write", "admin"],
  "use_case": "Deployment scripts, CI/CD, system integration"
}
```

**User-Level Keys:**
```json
{
  "scopes": ["chat", "skills:read", "skills:execute"],
  "use_case": "Frontend users, mobile apps, personal access"
}
```

---

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:e2e
```

### Manual API Testing
```bash
# Health check
curl http://localhost:3001/api/v1/health

# List skills (requires API key)
curl http://localhost:3001/api/v1/skills \
  -H "X-Solution-Id: your-solution" \
  -H "X-Api-Key: sk-xxx"
```

---

## 🐛 Troubleshooting

### Common Issues

**Problem: "PERMISSION_DENIED" when creating Skills**
- **Cause**: API Key missing `skills:write` scope
- **Solution**: Create new key with correct scopes or use Bootstrap Key

**Problem: "Solution not found"**
- **Cause**: Solution not created or wrong solutionId
- **Solution**: Create solution via `/api/v1/solutions` or check slug

**Problem: "Invalid API key format"**
- **Cause**: API Key doesn't start with `sk-`
- **Solution**: Use correct format `sk-{context}_{random_hex}`

**Problem: inject-skills.sh fails with jq error**
- **Cause**: JSON parsing issue with spaces in descriptions
- **Solution**: Use `while read` instead of `for` loop (fixed in latest version)

### Debug Mode

```bash
# Enable debug logging
DEBUG=true npm run start:dev

# Check logs
tail -f packages/backend/.agent-workspace/logs/app.log
```

---

## 📝 Examples

### Example Solutions

| Solution | Description | Key Features |
|----------|-------------|--------------|
| **lesson-plan-designer** | AI备课助手 | Skills, MCP Server, Bootstrap workflow |
| **quiz-analyzer** | 试卷分析系统 | Complete analysis, PDF output |
| **ccaas-demo** | Demo application | All CCAAS features showcase |

### Bootstrap Script Template

```bash
#!/bin/bash
# solutions/your-solution/create-bootstrap-key.sh

DB_PATH="../../packages/backend/.agent-workspace/data.db"
TENANT_SLUG="your-solution"

# Generate key
RAW_KEY="sk-bootstrap_$(openssl rand -hex 24)"
KEY_HASH=$(echo -n "$RAW_KEY" | openssl dgst -sha256 -binary | xxd -p -c 256)

# Insert into database
sqlite3 "$DB_PATH" <<EOF
INSERT INTO api_keys (
  id, solutionId, name, keyHash, keyPrefix,
  scopes, rateLimitRpm, status, createdAt, updatedAt
) VALUES (
  lower(hex(randomblob(16))),
  (SELECT id FROM solutions WHERE slug='$TENANT_SLUG'),
  'bootstrap-solution-key',
  '$KEY_HASH',
  '${RAW_KEY:0:16}',
  '["skills:write","mcp:write","admin"]',
  100,
  'active',
  datetime('now'),
  datetime('now')
);
EOF

echo "API Key: $RAW_KEY"
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for contribution guidelines.

---

## 📄 License

See [LICENSE](../../../LICENSE) for license information.
