# 权限控制与认证完整指南

> 📚 **完整文档**: [packages/backend/docs/AUTHENTICATION_AND_AUTHORIZATION.md](../../../packages/backend/docs/AUTHENTICATION_AND_AUTHORIZATION.md)

本指南为 Solution 开发者提供 CCAAS 权限控制系统的完整说明。

---

## 概述

CCAAS 使用 **API Key** 进行身份认证和授权。每个 API Key 都属于一个 **Tenant**（租户），并具有特定的 **Scopes**（权限范围）。

### 核心概念

- **Multi-Tenancy**：每个 Solution 都是一个独立的 Tenant
- **API Key Authentication**：所有请求都通过 API Key 认证
- **Scope-Based Authorization**：基于 Scope 的细粒度权限控制
- **Two-Level Keys**：Tenant-Level（租户级）和 User-Level（用户级）

### 设计哲学

```
前端用户不应知道 Skills、MCP Servers、API Keys 等概念
CCAAS Backend 根据 tenantId 自动加载所有资源
Solution 通过 Bootstrap Scripts 完成自动化部署
```

---

## API Key 系统

### Tenant-Level Keys vs User-Level Keys

#### Tenant-Level Keys（租户级 API Key）

**特征：**
- ❌ **没有 `userId`**，代表整个租户
- ✅ 用于**系统级操作**和**自动化部署**
- ✅ 适用于 Bootstrap Scripts、CI/CD、后台任务

**使用场景：**
- Solution 初始化脚本（inject-skills.sh）
- 自动化 Skills/MCP Server 注册
- 后台定时任务
- 系统集成和 API 调用

**创建方式：**
```bash
# 通过 Bootstrap Script（直接插入数据库）
./create-bootstrap-key.sh
```

#### User-Level Keys（用户级 API Key）

**特征：**
- ✅ **有 `userId`**，代表租户内的特定用户
- ✅ 用于**个人操作**和**用户权限控制**
- ✅ 受用户角色（role）和权限（canCreateSkills）限制

**使用场景：**
- 用户个人操作（创建个人 Skills）
- Web 前端调用（用户登录后）
- 移动端 App 集成
- 第三方应用集成（代表特定用户）

### API Key Scopes

CCAAS 定义了 **9 个标准 Scopes**：

| Scope | 用途 | 适用对象 |
|-------|------|---------|
| `chat` | 发送消息、创建会话 | 所有用户 |
| `skills:read` | 读取 Skills 列表和详情 | 所有用户 |
| `skills:write` | 创建/更新 Skills | 管理员、开发者 |
| `skills:execute` | 执行 Skills | 所有用户 |
| `skills:delete` | 删除 Skills | 管理员 |
| `mcp:read` | 读取 MCP Servers 列表 | 管理员、开发者 |
| `mcp:write` | 创建/更新 MCP Servers | 管理员、开发者 |
| `analytics:read` | 读取使用统计和分析数据 | 管理员 |
| `admin` | 完全管理权限（创建 API Key 等） | 管理员 |

**Bootstrap Key Scopes（推荐）：**
```json
["skills:write", "mcp:write", "admin"]
```

---

## Bootstrap 工作流

### 问题：Chicken-and-Egg

当部署一个新的 Solution 时，面临"鸡生蛋"问题：

```
需要 API Key 才能调用 Admin API 创建 API Key
↓
但是没有初始 API Key，无法创建第一个 API Key
↓
陷入循环：需要 Key 才能创建 Key
```

### 解决方案：Bootstrap Script

通过 **直接访问数据库** 创建第一个 Tenant-Level API Key：

**文件：** `solutions/{solution-name}/create-bootstrap-key.sh`

```bash
#!/bin/bash
# Create bootstrap API key directly in database

DB_PATH="../../packages/backend/.agent-workspace/data.db"
TENANT_SLUG="your-solution"

# Generate API key
RAW_KEY="sk-bootstrap_$(openssl rand -hex 24)"
KEY_PREFIX="${RAW_KEY:0:16}"
KEY_HASH=$(echo -n "$RAW_KEY" | openssl dgst -sha256 -binary | xxd -p -c 256)

# Insert into database
sqlite3 "$DB_PATH" <<EOF
INSERT INTO api_keys (
  id,
  tenantId,
  name,
  keyHash,
  keyPrefix,
  scopes,
  rateLimitRpm,
  rateLimitRpd,
  status,
  expiresAt,
  lastUsedAt,
  usageCount,
  metadata,
  createdAt,
  updatedAt
) VALUES (
  lower(hex(randomblob(16))),
  (SELECT id FROM tenants WHERE slug='$TENANT_SLUG'),
  'bootstrap-tenant-key',
  '$KEY_HASH',
  '$KEY_PREFIX',
  '["skills:write","mcp:write","admin"]',
  100,
  10000,
  'active',
  NULL,
  NULL,
  0,
  NULL,
  datetime('now'),
  datetime('now')
);
EOF

echo "API Key: $RAW_KEY"
echo "⚠️  SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN"
```

### 使用示例

```bash
# Step 1: 创建 Bootstrap API Key（仅首次）
cd solutions/your-solution
./create-bootstrap-key.sh

# Step 2: 导出 API Key 到环境变量
export CCAAS_API_KEY=sk-bootstrap_xxx

# Step 3: 运行 Skills/MCP 注入脚本
./inject-skills.sh

# 输出：
# ✅ Skills processed: 3
# ✅ MCP servers processed: 1
# ✅ Injection Complete
```

---

## Solution 开发者集成指南

### 设计原则

#### 1. 前端透明化

**❌ 错误做法：**
```typescript
// 前端代码中硬编码 Skill 路径和 MCP Server 配置
const session = useAgentChat({
  serverUrl: 'http://localhost:3001',
  skillPath: '/path/to/skills',  // ❌ 前端不应知道这些
  mcpServers: { ... }             // ❌ 前端不应配置这些
});
```

**✅ 正确做法：**
```typescript
// 前端只需提供 tenantId，一切自动加载
const session = useAgentChat({
  serverUrl: 'http://localhost:3001',
  tenantId: 'your-solution'  // ✅ 仅此而已
});

// CCAAS Backend 自动：
// 1. 加载该租户的所有 Skills
// 2. 启动该租户的所有 MCP Servers
// 3. 配置 AgentEngine CLI 参数
```

#### 2. 自动化部署

**Solution 目录结构：**
```
solutions/your-solution/
├── skills/
│   ├── skill-1/
│   │   └── SKILL.md
│   └── skill-2/
│       └── SKILL.md
├── mcp-server/
│   └── src/
│       └── index.ts
├── solution.json          # Solution 配置
├── create-bootstrap-key.sh  # Bootstrap Script
└── inject-skills.sh        # 注入 Script
```

### 集成步骤

#### Step 1: 创建 Tenant

```bash
# inject-skills.sh 会自动创建 Tenant
./inject-skills.sh
```

#### Step 2: 创建 Bootstrap API Key

```bash
# 运行 create-bootstrap-key.sh
./create-bootstrap-key.sh

# 保存输出的 API Key
export CCAAS_API_KEY=sk-bootstrap_xxx
```

#### Step 3: 注册 Skills

创建 Skills 目录结构：
```
skills/
└── main-skill/
    └── SKILL.md
```

注册到 CCAAS：
```bash
./inject-skills.sh
```

#### Step 4: 注册 MCP Servers

配置 `solution.json`：
```json
{
  "mcpServers": {
    "your-mcp-server": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Your MCP server"
    }
  }
}
```

注册到 CCAAS：
```bash
./inject-skills.sh
```

#### Step 5: 前端集成

**React 示例：**
```typescript
import { useAgentChat } from '@ccaas/react-sdk';

function YourApp() {
  const { connection, chat, status } = useAgentChat({
    serverUrl: 'http://localhost:3001',
    tenantId: 'your-solution',  // ← 仅需 tenantId
  });

  return <ChatPanel connection={connection} chat={chat} status={status} />;
}
```

**Vue 示例：**
```vue
<script setup lang="ts">
import { useAgentConnection, useAgentChat } from '@ccaas/vue-sdk';

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  tenantId: 'your-solution',  // ← 仅需 tenantId
});

const chat = useAgentChat({ connection });
</script>
```

---

## 权限设计模式

### Pattern 1: 公共 Solution（所有用户共享）

**场景：** Quiz Analyzer, Lesson Plan Designer

**配置：**
```typescript
// Skill.scope = 'tenant'
// 所有租户内用户都可以访问和执行

{
  "scopes": ["chat", "skills:read", "skills:execute"]
}
```

**特点：**
- ✅ 所有用户可以读取和执行
- ✅ 仅管理员可以修改
- ✅ Skills 由 Bootstrap Script 创建和维护

### Pattern 2: 个人 Skills（用户私有）

**场景：** 用户自定义的 AI Agents, 个人工作流

**配置：**
```typescript
// Skill.scope = 'personal'
// Skill.createdBy = userId

{
  "scopes": ["chat", "skills:write", "skills:execute"]
}
```

**特点：**
- ✅ 用户可以创建自己的 Skills
- ✅ 仅所有者可以读取和修改
- ✅ 管理员可以查看所有 Personal Skills

### Pattern 3: 混合模式（公共 + 个人）

**场景：** 提供基础 Skills，允许用户扩展

**配置：**
```typescript
// 基础 Skills: scope = 'tenant'
// 用户扩展: scope = 'personal'

// UserTenant.canCreateSkills = true
```

---

## 最佳实践

### API Key 管理

**✅ 推荐做法：**

- 分离 Bootstrap Key 和 Runtime Key
- 定期轮换 API Key（每 90 天）
- 设置过期时间
- 使用最小权限原则

**❌ 避免做法：**

- ❌ 在前端代码中硬编码 API Key
- ❌ 将 Bootstrap Key 用于生产环境
- ❌ 将 API Key 提交到 Git 仓库
- ❌ 使用相同的 API Key 给所有用户

### 安全措施

**API Key 存储：**
```bash
# ✅ 环境变量
export CCAAS_API_KEY=sk-bootstrap_xxx

# ✅ .env 文件（加入 .gitignore）
CCAAS_API_KEY=sk-bootstrap_xxx

# ❌ 避免硬编码
const apiKey = 'sk-bootstrap_xxx';  // 危险！
```

---

## API 参考

### 创建 API Key

```bash
POST /api/v1/admin/api-keys
Content-Type: application/json
X-Api-Key: sk-bootstrap_xxx

{
  "tenantId": "your-solution",
  "name": "bootstrap-key",
  "scopes": ["skills:write", "mcp:write", "admin"],
  "rateLimitRpm": 100,
  "rateLimitRpd": 10000
}
```

### 创建 Skill

```bash
POST /api/v1/skills
Content-Type: application/json
X-Tenant-Id: your-solution
X-Api-Key: sk-bootstrap_xxx

{
  "name": "Main Skill",
  "slug": "main-skill",
  "description": "Primary skill",
  "content": "# Skill Content...",
  "type": "skill"
}
```

### 创建 MCP Server

```bash
POST /api/v1/mcp-servers
Content-Type: application/json
X-Tenant-Id: your-solution
X-Api-Key: sk-bootstrap_xxx

{
  "name": "your-mcp-server",
  "slug": "your-mcp-server",
  "type": "stdio",
  "config": {
    "command": "node",
    "args": ["mcp-server/dist/index.js"]
  }
}
```

---

## 总结

### 核心要点

1. **两种 API Key**：Tenant-Level（系统操作）和 User-Level（用户操作）
2. **Bootstrap 流程**：通过数据库直接插入创建第一个 API Key
3. **前端透明**：前端只需 tenantId，无需知道 Skills/MCP
4. **自动化部署**：通过 Scripts 完成 Skills/MCP 注册
5. **最小权限**：根据场景设计合适的 Scopes

### 快速开始

```bash
# 1. 创建 Bootstrap Key
./create-bootstrap-key.sh

# 2. 注册 Skills 和 MCP Servers
export CCAAS_API_KEY=sk-bootstrap_xxx
./inject-skills.sh

# 3. 前端集成
const session = useAgentChat({
  serverUrl: 'http://localhost:3001',
  tenantId: 'your-solution'
});
```

---

## 相关文档

- [完整权限控制文档](../../../packages/backend/docs/AUTHENTICATION_AND_AUTHORIZATION.md)
- [Error Handling](../../../packages/backend/docs/ERROR_HANDLING.md)
- [API 文档索引](../../../packages/backend/docs/README.md)
- [Solution 快速开始](solution-quick-start.md)
- [创建 Solution 完整指南](creating-a-solution.md)
