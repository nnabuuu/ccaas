# Authentication and Authorization

完整的 CCAAS 权限控制指南，适用于 Solution 开发者和平台管理员。

---

## 目录

- [概述](#概述)
- [API Key 系统](#api-key-系统)
  - [Tenant-Level Keys vs User-Level Keys](#tenant-level-keys-vs-user-level-keys)
  - [API Key Scopes](#api-key-scopes)
  - [API Key 格式](#api-key-格式)
- [权限控制架构](#权限控制架构)
  - [Guard 链](#guard-链)
  - [RequestContext](#requestcontext)
  - [权限判断流程](#权限判断流程)
- [Bootstrap 工作流](#bootstrap-工作流)
  - [问题：Chicken-and-Egg](#问题chicken-and-egg)
  - [解决方案：Bootstrap Script](#解决方案bootstrap-script)
  - [使用示例](#使用示例)
- [Solution 开发者指南](#solution-开发者指南)
  - [设计原则](#设计原则)
  - [集成步骤](#集成步骤)
  - [权限设计模式](#权限设计模式)
- [最佳实践](#最佳实践)
- [API 参考](#api-参考)

---

## 概述

CCAAS 使用 **API Key** 进行身份认证和授权。每个 API Key 都属于一个 **Tenant**（租户），并具有特定的 **Scopes**（权限范围）。

**核心概念：**
- **Multi-Tenancy**：每个 Solution 都是一个独立的 Tenant
- **API Key Authentication**：所有请求都通过 API Key 认证
- **Scope-Based Authorization**：基于 Scope 的细粒度权限控制
- **Two-Level Keys**：Tenant-Level（租户级）和 User-Level（用户级）

**设计哲学：**
```
前端用户不应知道 Skills、MCP Servers、API Keys 等概念
CCAAS Backend 根据 tenantId 自动加载所有资源
Solution 通过 Bootstrap Scripts 完成自动化部署
```

---

## API Key 系统

### Tenant-Level Keys vs User-Level Keys

CCAAS 支持两种类型的 API Key：

#### 1. Tenant-Level Keys（租户级 API Key）

**特征：**
- ❌ **没有 `userId`**，代表整个租户（Tenant）
- ✅ 用于**系统级操作**和**自动化部署**
- ✅ 适用于 Bootstrap Scripts、CI/CD、后台任务

**使用场景：**
- Solution 初始化脚本（inject-skills.sh）
- 自动化 Skills/MCP Server 注册
- 后台定时任务（scheduled tasks）
- 系统集成和 API 调用

**权限检查逻辑：**
```typescript
// SkillPermissionGuard.ts
if (context.apiKeyScopes?.includes('skills:write') && !context.userId) {
  // Tenant-level key with skills:write scope
  // Full access to create/update/delete skills
  return true;
}
```

**创建方式：**
```bash
# 通过 Admin API（需要 admin scope）
curl -X POST http://localhost:3001/api/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "xxx",
    "name": "bootstrap-key",
    "scopes": ["skills:write", "mcp:write", "admin"]
  }'

# 或通过 Bootstrap Script（直接插入数据库）
./create-bootstrap-key.sh
```

#### 2. User-Level Keys（用户级 API Key）

**特征：**
- ✅ **有 `userId`**，代表租户内的特定用户
- ✅ 用于**个人操作**和**用户权限控制**
- ✅ 受用户角色（role）和权限（canCreateSkills）限制

**使用场景：**
- 用户个人操作（创建个人 Skills）
- Web 前端调用（用户登录后）
- 移动端 App 集成
- 第三方应用集成（代表特定用户）

**权限检查逻辑：**
```typescript
// SkillPermissionGuard.ts
if (!context.userTenant) {
  throw new ForbiddenException('User tenant information required');
}

// Check user's role and permissions
if (context.userTenant.role === 'admin') {
  return true; // Admin can modify all skills
}

// Regular users can only modify their own skills
if (skill.createdBy === context.userId) {
  return true;
}

throw new ForbiddenException('You do not have permission');
```

**创建方式：**
```bash
# 通过 Tenant API（需要 userId）
curl -X POST http://localhost:3001/api/v1/tenants/{tenantId}/api-keys \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{
    "name": "user-personal-key",
    "scopes": ["chat", "skills:execute"]
  }'
```

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
| `builder` | 自助管理租户和密钥（需绑定 `userId`） | 外部开发者 |

> **Builder scope 约束**：`builder` scope 的 API key **必须**绑定 `userId`，否则创建和更新时会返回 400 Bad Request。推荐通过 `POST /api/v1/admin/builder-users` 一站式 onboarding。已有的 key 可通过 `PUT /api/v1/admin/api-keys/:id` 补充 `userId`。

**Default Scopes（默认授予）：**
```typescript
const DEFAULT_SCOPES: ApiKeyScope[] = ['chat', 'skills:read', 'skills:execute'];
```

**Bootstrap Key Scopes（推荐）：**
```typescript
const BOOTSTRAP_SCOPES: ApiKeyScope[] = ['skills:write', 'mcp:write', 'admin'];
```

### API Key 格式

**格式规则：**
```
sk-{context}_{random_hex_48}

示例：
sk-bootstrap_dc3ca02e42dfcc300faf2d61edfe3c946b1d96e662b5cf39
sk-lessonplan_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

**组成部分：**
- `sk-`：前缀，表示 "Secret Key"（必需）
- `{context}`：上下文标识（bootstrap, lessonplan, etc.）
- `_{random_hex_48}`：48 字节随机十六进制字符串

**存储方式：**
- **数据库存储**：SHA-256 Hash（不可逆）
- **返回给用户**：仅在创建时返回一次原始 Key
- **Key Prefix**：存储前 16 个字符，用于识别和日志记录

**安全措施：**
```typescript
// 生成密钥
const rawKey = `sk-${context}_${randomBytes(24).toString('hex')}`;

// 哈希存储
const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

// 保存 Key Prefix 用于识别
const keyPrefix = rawKey.substring(0, 16);

// 数据库存储
await apiKeyRepository.save({
  keyHash,        // SHA-256 哈希
  keyPrefix,      // 前 16 个字符
  // rawKey 永远不存储
});
```

---

## Dev Login（开发环境登录）

为开发和测试环境提供基于用户名/密码的快速登录机制。

### 端点

```
POST /api/v1/auth/login
```

### 启用条件

仅在以下条件下可用：
- `NODE_ENV !== 'production'`
- `NODE_ENV !== 'staging'`

在生产和预发布环境中，此端点完全禁用（不注册路由）。

### 认证流程

1. 用户提交 `{ username, password }`
2. 系统查询 User 实体，获取 `passwordHash`（默认不查询）
3. 使用 scrypt 算法验证密码（N:16384, r:8, p:1, keylen:64）
4. 验证成功后创建 24 小时有效期的 session API key（`admin` scope）
5. 返回 `{ apiKey, user: { id, username, name } }`

### 密码哈希

- **算法**：scrypt
- **参数**：N=16384, r=8, p=1, maxmem=64MB
- **输出格式**：`scrypt:{salt_hex}:{hash_hex}`（keylen=64 bytes）
- **验证**：使用 `crypto.timingSafeEqual()` 进行常量时间比较

### 预置用户

系统在 `onModuleInit` 时自动创建/更新以下开发用户：

| 用户名 | 密码 | 邮箱 | 名称 | 来源 |
|--------|------|------|------|------|
| `admin` | `dev123` | `admin@localhost` | Dev Admin | 环境变量可覆盖 |
| `demo` | `Demo123` | `demo@localhost` | Demo User | 硬编码 |

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEV_LOGIN_USERNAME` | `admin` | 管理员用户名 |
| `DEV_LOGIN_PASSWORD` | `dev123` | 管理员密码 |
| `ADMIN_EMAIL` | `admin@localhost` | 管理员邮箱 |

### 速率限制

`@Throttle({ default: { ttl: 60000, limit: 5 } })` — 每分钟最多 5 次请求。

### 安全注意事项

- 预置密码仅用于开发环境，**绝不应在生产环境中使用**
- Session API Key 24 小时后自动过期
- 登录失败不会泄露用户是否存在（统一返回 `UnauthorizedException`）

---

## User 管理 API

### User CRUD 端点

所有端点需要 `admin` scope。

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST /users` | 创建用户（email, name） |
| `GET /users` | 列出所有活跃用户 |
| `GET /users/:id` | 获取用户详情 |
| `PATCH /users/:id` | 更新用户（name, status） |
| `DELETE /users/:id` | 软删除用户（status → deleted） |

### UserTenant CRUD 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST /users/tenants` | 将用户添加到租户（userId, tenantId, role） |
| `GET /users/tenants/by-tenant/:tenantId` | 列出租户下用户 |
| `GET /users/tenants/by-user/:userId` | 列出用户所属租户 |
| `PATCH /users/tenants/:id` | 更新角色/权限 |
| `DELETE /users/tenants/:id` | 软移除（isActive → false） |

### canCreateSkills 自动推导

当 `canCreateSkills` 参数未提供时，根据角色自动设置：

```typescript
if (canCreateSkills === undefined) {
  canCreateSkills = (role === 'admin' || role === 'developer')
}
```

- `admin` → `canCreateSkills = true`
- `developer` → `canCreateSkills = true`
- `viewer` → `canCreateSkills = false`

显式传入 `canCreateSkills` 时覆盖自动推导。

### 软删除策略

- **User 软删除**：设置 `User.status = 'deleted'`，用户数据保留
- **UserTenant 软移除**：设置 `UserTenant.isActive = false`，关联记录保留
- **级联**：删除用户时，关联的 UserTenant 记录同步设为不活跃，相关 API Key 被吊销

### 角色层级

```
admin (3) > developer (2) > viewer (1)
```

角色决定权限边界：
- **admin**：可管理所有用户、Skills 和资源
- **developer**：可创建 Skills、编辑自己的资源
- **viewer**：只读访问，不能创建或编辑资源

---

## 权限控制架构

### Guard 链

CCAAS 使用 NestJS Guard 链进行多层权限验证：

```
Request
  ↓
┌──────────────────┐
│ ApiKeyGuard      │ ← 验证 API Key，设置 RequestContext
└────────┬─────────┘
         ↓
┌──────────────────┐
│ TenantGuard      │ ← 验证 Tenant，加载 Tenant 信息
└────────┬─────────┘
         ↓
┌──────────────────┐
│ SkillPermission  │ ← 验证 Skill 操作权限
│ Guard            │
└────────┬─────────┘
         ↓
    Controller
```

**装饰器与 Guard 触发规则：**

| 装饰器 | ApiKeyGuard | 无 Key 行为 | 无效 Key 行为 |
|--------|-------------|------------|--------------|
| `@Auth()` | ✅ 执行 | ❌ 401 拒绝 | ❌ 401 拒绝 |
| `@OptionalAuth()` | ✅ 执行 | ✅ 匿名通过（`AUTH_ALLOW_ANONYMOUS=true` 时）或 null context（`false` 时），请求继续 | ❌ 401 拒绝 |
| `@Public()` | ❌ 跳过 | ✅ 直接通过 | ✅ 直接通过（不验证） |

> **注意**：`@OptionalAuth()` 和 `@Auth()` 都会注册 `ApiKeyGuard`，区别在于无 Key 时的回退行为。`@OptionalAuth()` 会尝试创建匿名上下文而非拒绝请求，但如果提供了无效/过期的 Key，仍然返回 401。

**Guard 职责：**

1. **ApiKeyGuard**（`@UseGuards(ApiKeyGuard)`）
   - 由 `@Auth()` 和 `@OptionalAuth()` 两种装饰器触发
   - 从 `X-Api-Key` 或 `Authorization` header 获取 API Key
   - 验证 Key 有效性（SHA-256 匹配）
   - 检查 Key 状态（active, expired, revoked）
   - 检查 Rate Limit（RPM, RPD）
   - 加载 API Key 关联的 User（如果有 userId）
   - 设置 `RequestContext`
   - **可选认证回退**：当路由标记 `@OptionalAuth()` 且未提供 Key 时，尝试创建匿名上下文（`AUTH_ALLOW_ANONYMOUS=true`）或设置 null context（`false`），请求不被拒绝；但如果提供了无效/过期 Key，仍然返回 401

2. **TenantGuard**（`@UseGuards(TenantGuard)`）
   - 从 `X-Tenant-Id` header 或 `context.tenantId` 获取 Tenant ID
   - 验证 Tenant 存在
   - 检查 Tenant 状态（active, suspended）
   - 将 `tenantId` 设置到 `RequestContext`

3. **SkillPermissionGuard**（`@UseGuards(SkillPermissionGuard)`）
   - 针对 Skill 操作的细粒度权限控制
   - 区分 Tenant-Level Key 和 User-Level Key
   - 检查 Skill 作用域（tenant, personal）
   - 验证用户角色和权限

### RequestContext

所有 Guard 共享一个 `RequestContext` 对象，包含完整的认证和授权信息：

```typescript
export interface RequestContext {
  // Tenant 信息
  tenantId: string;              // 租户 ID
  tenant?: Tenant;               // 租户对象（可选）

  // API Key 信息
  apiKeyId?: string;             // API Key ID
  apiKeyScopes?: ApiKeyScope[];  // API Key 权限范围

  // User 信息（User-Level Key）
  userId?: string;               // 用户 ID（仅 User-Level Key）
  user?: User;                   // 用户对象（可选）
  userTenant?: UserTenant;       // 用户在租户内的角色和权限

  // 匿名标识
  isAnonymous: boolean;          // 是否匿名请求
}
```

**UserTenant 结构：**
```typescript
export interface UserTenant {
  role: 'admin' | 'developer' | 'viewer';  // 用户角色
  canCreateSkills: boolean;                // 是否可创建 Skills
  canManageMcp: boolean;                   // 是否可管理 MCP
}
```

### 权限判断流程

#### Skills 写操作权限

```typescript
// SkillPermissionGuard.checkWritePermission()

1. 匿名检查
   if (!context || context.isAnonymous) {
     throw ForbiddenException('Authentication required');
   }

2. Tenant-Level Key 检查
   if (context.apiKeyScopes?.includes('skills:write') && !context.userId) {
     return true; // Tenant-level key, full access
   }

3. User-Level Key 检查
   if (!context.userTenant) {
     throw ForbiddenException('User tenant information required');
   }

   3.1 CREATE 操作
       if (method === 'POST' && !skillId) {
         return checkCreatePermission(context);
         // → Check userTenant.canCreateSkills
       }

   3.2 UPDATE/DELETE 操作
       if (skillId) {
         return checkModifyPermission(skillId, context);
         // → Check skill ownership or admin role
       }
```

#### Skills 读操作权限

```typescript
// SkillPermissionGuard.checkReadPermission()

1. Tenant-Scoped Skills
   if (skill.scope === 'tenant') {
     return true; // Anyone in tenant can read
   }

2. Personal Skills
   if (skill.scope === 'personal') {
     2.1 匿名用户
         if (!context || context.isAnonymous) {
           throw ForbiddenException('Authentication required');
         }

     2.2 管理员
         if (context.userTenant?.role === 'admin') {
           return true; // Admin can read all personal skills
         }

     2.3 所有者
         if (skill.createdBy === context.userId) {
           return true; // Owner can read their own skill
         }

         throw ForbiddenException('No permission to access this personal skill');
   }
```

---

## Bootstrap 工作流

### 问题：Chicken-and-Egg

当部署一个新的 Solution 时，面临经典的"鸡生蛋"问题：

```
需要 API Key 才能调用 Admin API 创建 API Key
↓
但是没有初始 API Key，无法创建第一个 API Key
↓
陷入循环：需要 Key 才能创建 Key
```

**为什么不能匿名创建？**
- Admin API 需要 `admin` scope，防止未授权访问
- 任何人都能创建 API Key 会导致严重安全问题

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
```

**关键点：**
1. ✅ **直接插入数据库**，绕过 API 认证
2. ✅ **Tenant-Level Key**（无 userId）
3. ✅ **完整权限**（admin, skills:write, mcp:write）
4. ✅ **仅显示一次**，安全警告

### 使用示例

**完整 Bootstrap 流程：**

```bash
# Step 1: 确保 CCAAS Backend 运行
cd packages/backend
npm run start:dev

# Step 2: 创建 Bootstrap API Key（仅首次）
cd ../../solutions/lesson-plan-designer
./create-bootstrap-key.sh

# 输出：
# ✅ Bootstrap API key created successfully!
# API Key: sk-bootstrap_dc3ca02e42dfcc300faf2d61edfe3c946b1d96e662b5cf39
# ⚠️  SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN

# Step 3: 导出 API Key 到环境变量
export CCAAS_API_KEY=sk-bootstrap_dc3ca02e42dfcc300faf2d61edfe3c946b1d96e662b5cf39

# Step 4: 运行 Skills/MCP 注入脚本
./inject-skills.sh

# 输出：
# ✅ Skills processed: 3
# ✅ MCP servers processed: 1
# ✅ Injection Complete
```

**后续部署（已有 API Key）：**

```bash
# 直接使用已保存的 API Key
export CCAAS_API_KEY=sk-bootstrap_xxx
./inject-skills.sh
```

---

## Solution 开发者指南

### 设计原则

当你开发一个新的 Solution（如 lesson-plan-designer, quiz-analyzer）时，遵循以下原则：

#### 1. 前端透明化

**❌ 错误做法：**
```typescript
// 前端代码中硬编码 Skill 路径和 MCP Server 配置
const session = useAgentChat({
  serverUrl: 'http://localhost:3001',
  skillPath: '/path/to/skills',  // ❌ 前端不应知道这些
  mcpServers: {                   // ❌ 前端不应配置这些
    'my-server': {
      command: 'node',
      args: ['server.js']
    }
  }
});
```

**✅ 正确做法：**
```typescript
// 前端只需提供 tenantId，一切自动加载
const session = useAgentChat({
  serverUrl: 'http://localhost:3001',
  tenantId: 'lesson-plan-designer'  // ✅ 仅此而已
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

**solution.json 格式：**
```json
{
  "name": "Your Solution",
  "slug": "your-solution",
  "version": "1.0.0",
  "description": "Solution description",

  "mcpServers": {
    "your-mcp-server": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "MCP server for your solution",
      "env": {
        "NODE_ENV": "production"
      }
    }
  },

  "skill": {
    "name": "Main Skill",
    "description": "Primary skill for this solution",
    "triggers": [
      { "type": "keyword", "value": "关键词", "priority": 10 }
    ],
    "allowedTools": ["Write", "Read", "Skill"],
    "skillFile": "skills/main-skill/SKILL.md"
  }
}
```

#### 3. 职责分离

| 组件 | 职责 | 不应涉及 |
|------|------|---------|
| **Frontend** | UI 渲染、用户交互、消息发送 | Skills 路径、MCP 配置、API Key 管理 |
| **Backend API** | 业务逻辑、数据存储、API 提供 | AgentEngine 配置、Skill 加载 |
| **CCAAS Backend** | AgentEngine 管理、Skills/MCP 加载、会话管理 | Solution 业务逻辑 |
| **Bootstrap Scripts** | 自动化部署、资源注册 | 运行时操作 |

### 集成步骤

#### Step 1: 创建 Tenant

**方法 A：通过 API**
```bash
curl -X POST http://localhost:3001/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "your-solution",
    "name": "Your Solution",
    "description": "Solution description"
  }'
```

**方法 B：通过 Bootstrap Script**
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

**创建 Skills 目录结构：**
```
skills/
└── main-skill/
    └── SKILL.md
```

**SKILL.md 示例：**
```markdown
---
name: Main Skill
description: Primary skill for this solution
triggers:
  - type: keyword
    value: 关键词
    priority: 10
allowedTools:
  - Write
  - Read
  - Skill
---

# Main Skill

This is your skill prompt.

## Instructions

1. Do this
2. Then that
```

**注册到 CCAAS：**
```bash
./inject-skills.sh
```

#### Step 4: 注册 MCP Servers

**配置 solution.json：**
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

**注册到 CCAAS：**
```bash
# inject-skills.sh 会自动注册 MCP Servers
./inject-skills.sh
```

#### Step 5: 前端集成

**React 示例：**
```typescript
import { useAgentChat } from '@kedge-agentic/react-sdk';

function YourApp() {
  const { connection, chat, status } = useAgentChat({
    serverUrl: 'http://localhost:3001',
    tenantId: 'your-solution',  // ← 仅需 tenantId
  });

  const handleSendMessage = async (text: string) => {
    await chat.sendMessage(text);
  };

  return (
    <div>
      <ChatPanel
        connection={connection}
        chat={chat}
        status={status}
      />
    </div>
  );
}
```

**Vue 示例：**
```vue
<script setup lang="ts">
import { useAgentConnection, useAgentChat } from '@kedge-agentic/vue-sdk';

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  tenantId: 'your-solution',  // ← 仅需 tenantId
});

const chat = useAgentChat({ connection });

const sendMessage = async (text: string) => {
  await chat.sendMessage(text);
};
</script>
```

### 权限设计模式

#### Pattern 1: 公共 Solution（所有用户共享）

**场景：** Quiz Analyzer, Lesson Plan Designer

**配置：**
```typescript
// Skill.scope = 'tenant'
// 所有租户内用户都可以访问和执行

// 权限设置
{
  "scopes": ["chat", "skills:read", "skills:execute"]
}
```

**特点：**
- ✅ 所有用户可以读取和执行
- ✅ 仅管理员可以修改
- ✅ Skills 由 Bootstrap Script 创建和维护

#### Pattern 2: 个人 Skills（用户私有）

**场景：** 用户自定义的 AI Agents, 个人工作流

**配置：**
```typescript
// Skill.scope = 'personal'
// Skill.createdBy = userId

// 权限设置
{
  "scopes": ["chat", "skills:write", "skills:execute"]
}
```

**特点：**
- ✅ 用户可以创建自己的 Skills
- ✅ 仅所有者可以读取和修改
- ✅ 管理员可以查看所有 Personal Skills

#### Pattern 3: 混合模式（公共 + 个人）

**场景：** 提供基础 Skills，允许用户扩展

**配置：**
```typescript
// 基础 Skills: scope = 'tenant'
// 用户扩展: scope = 'personal'

// UserTenant.canCreateSkills = true
```

**特点：**
- ✅ 平台提供预设 Skills
- ✅ 用户可以创建个人 Skills
- ✅ 个人 Skills 不影响其他用户

---

## 最佳实践

### 1. API Key 管理

**✅ 推荐做法：**

- **分离 Bootstrap Key 和 Runtime Key**
  ```bash
  # Bootstrap Key: 仅用于部署和初始化
  sk-bootstrap_xxx (scopes: admin, skills:write, mcp:write)

  # Runtime Key: 用于前端和用户操作
  sk-runtime_xxx (scopes: chat, skills:read, skills:execute)
  ```

- **定期轮换 API Key**
  ```bash
  # 每 90 天轮换一次 Bootstrap Key
  ./create-bootstrap-key.sh
  # 撤销旧 Key
  curl -X POST http://localhost:3001/api/v1/admin/api-keys/{id}/revoke
  ```

- **设置过期时间**
  ```json
  {
    "expiresAt": "2026-12-31T23:59:59Z"  // 1 年后过期
  }
  ```

**❌ 避免做法：**

- ❌ 在前端代码中硬编码 API Key
- ❌ 将 Bootstrap Key 用于生产环境
- ❌ 将 API Key 提交到 Git 仓库
- ❌ 使用相同的 API Key 给所有用户

### 2. Scope 设计

**最小权限原则（Principle of Least Privilege）：**

```typescript
// ✅ 前端用户 Key：仅需要的最小权限
{
  "scopes": ["chat", "skills:read", "skills:execute"]
}

// ✅ 开发者 Key：额外的 Skills 管理权限
{
  "scopes": ["chat", "skills:read", "skills:write", "skills:execute"]
}

// ✅ 管理员 Key：完整权限
{
  "scopes": ["admin", "skills:write", "mcp:write", "analytics:read"]
}

// ❌ 避免：给所有用户 admin scope
{
  "scopes": ["admin"]  // 危险！
}
```

### 3. 安全措施

**API Key 存储：**
```typescript
// ✅ 环境变量
export CCAAS_API_KEY=sk-bootstrap_xxx

// ✅ .env 文件（加入 .gitignore）
# .env
CCAAS_API_KEY=sk-bootstrap_xxx

// ✅ 密钥管理服务
AWS Secrets Manager
Azure Key Vault
HashiCorp Vault

// ❌ 避免
const apiKey = 'sk-bootstrap_xxx';  // 硬编码
```

**传输安全：**
```typescript
// ✅ HTTPS
https://api.yourdomain.com

// ✅ Header 传递
X-Api-Key: sk-bootstrap_xxx

// ❌ 避免 URL 参数
?api_key=sk-bootstrap_xxx  // 会记录在日志中
```

### 4. 错误处理

**标准错误响应：**
```json
{
  "code": "PERMISSION_DENIED",
  "message": "API key with required scopes is needed for this endpoint",
  "statusCode": 403,
  "recoverable": false,
  "retryable": false,
  "timestamp": "2026-02-10T00:48:51.352Z",
  "path": "/api/v1/admin/api-keys",
  "requestId": "req_xxx"
}
```

**错误处理示例：**
```typescript
try {
  await createSkill(data);
} catch (error) {
  if (error.code === 'PERMISSION_DENIED') {
    // 提示用户权限不足
    showError('You do not have permission to create skills');
  } else if (error.code === 'INVALID_API_KEY') {
    // 提示 API Key 无效
    showError('Invalid API key. Please check your credentials');
  } else {
    // 其他错误
    showError(error.message);
  }
}
```

---

## API 参考

### Admin API - 创建 API Key

**Endpoint:**
```
POST /api/v1/admin/api-keys
```

**Headers:**
```
Content-Type: application/json
X-Api-Key: sk-bootstrap_xxx  (需要 admin scope)
```

**Request Body:**
```json
{
  "tenantId": "your-solution",
  "name": "bootstrap-key",
  "scopes": ["skills:write", "mcp:write", "admin"],
  "rateLimitRpm": 100,
  "rateLimitRpd": 10000,
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "apiKey": {
    "id": "api-key-uuid",
    "name": "bootstrap-key",
    "keyPrefix": "sk-bootstrap_xxx",
    "scopes": ["skills:write", "mcp:write", "admin"],
    "rateLimitRpm": 100,
    "rateLimitRpd": 10000,
    "status": "active",
    "expiresAt": "2026-12-31T23:59:59Z",
    "createdAt": "2026-02-10T00:00:00Z"
  },
  "rawKey": "sk-bootstrap_dc3ca02e42dfcc300faf2d61edfe3c946b1d96e662b5cf39",
  "warning": "This is the only time the raw API key will be displayed. Please save it securely."
}
```

### Admin API - 列出 API Keys

**Endpoint:**
```
GET /api/v1/admin/api-keys?tenantId={tenantId}&page=1&limit=50
```

**Headers:**
```
X-Api-Key: sk-bootstrap_xxx  (需要 admin scope)
```

**Response:**
```json
{
  "items": [
    {
      "id": "api-key-uuid",
      "tenantId": "your-solution",
      "name": "bootstrap-key",
      "keyPrefix": "sk-bootstrap_xxx",
      "scopes": ["skills:write", "mcp:write", "admin"],
      "rateLimitRpm": 100,
      "rateLimitRpd": 10000,
      "lastUsedAt": "2026-02-10T00:00:00Z",
      "usageCount": 42,
      "status": "active",
      "expiresAt": null,
      "createdAt": "2026-02-10T00:00:00Z",
      "updatedAt": "2026-02-10T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

### Admin API - 撤销 API Key

**Endpoint:**
```
POST /api/v1/admin/api-keys/{id}/revoke
```

**Headers:**
```
X-Api-Key: sk-bootstrap_xxx  (需要 admin scope)
```

**Response:**
```json
{
  "id": "api-key-uuid",
  "status": "revoked"
}
```

### Skills API - 创建 Skill

**Endpoint:**
```
POST /api/v1/skills
```

**Headers:**
```
Content-Type: application/json
X-Tenant-Id: your-solution
X-Api-Key: sk-bootstrap_xxx  (需要 skills:write scope)
```

**Request Body:**
```json
{
  "name": "Main Skill",
  "slug": "main-skill",
  "description": "Primary skill for this solution",
  "content": "# Skill Content\n\nInstructions...",
  "type": "skill"
}
```

**Response:**
```json
{
  "id": "skill-uuid",
  "name": "Main Skill",
  "slug": "main-skill",
  "description": "Primary skill for this solution",
  "type": "skill",
  "scope": "tenant",
  "status": "draft",
  "createdAt": "2026-02-10T00:00:00Z"
}
```

### MCP Servers API - 创建 MCP Server

**Endpoint:**
```
POST /api/v1/mcp-servers
```

**Headers:**
```
Content-Type: application/json
X-Tenant-Id: your-solution
X-Api-Key: sk-bootstrap_xxx  (需要 mcp:write scope)
```

**Request Body:**
```json
{
  "name": "your-mcp-server",
  "slug": "your-mcp-server",
  "description": "Your MCP server",
  "type": "stdio",
  "config": {
    "command": "node",
    "args": ["mcp-server/dist/index.js"],
    "env": {}
  },
  "status": "active"
}
```

**Response:**
```json
{
  "id": "mcp-server-uuid",
  "name": "your-mcp-server",
  "slug": "your-mcp-server",
  "description": "Your MCP server",
  "type": "custom",
  "status": "active",
  "createdAt": "2026-02-10T00:00:00Z"
}
```

---

## 总结

**核心要点：**

1. **两种 API Key**：Tenant-Level（系统操作）和 User-Level（用户操作）
2. **Bootstrap 流程**：通过数据库直接插入创建第一个 API Key
3. **前端透明**：前端只需 tenantId，无需知道 Skills/MCP
4. **自动化部署**：通过 Scripts 完成 Skills/MCP 注册
5. **最小权限**：根据场景设计合适的 Scopes

**快速开始：**
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

**参考文档：**
- [API 完整文档](./API_REFERENCE.md)
- [Error Handling](./ERROR_HANDLING.md)
- [Skills 开发指南](../../docs/SKILLS.md)
- [MCP Servers 开发指南](../../docs/MCP_SERVERS.md)
