# 管理员 API Key 管理指南

本指南介绍如何通过 REST API 和基于 Web 的管理控制台管理 API 密钥。

## 概述

API 密钥是访问 CCaaS 平台的主要身份验证机制。每个密钥：
- 属于特定租户
- 具有可配置的权限范围
- 可设置速率限制（每分钟和每天）
- 可选择设置过期时间
- 跟踪使用统计信息

## 密钥类型

| 类型 | Scope | 创建者 | 用途 |
|------|-------|--------|------|
| Admin | `admin` | 平台引导 | 完整平台管理 |
| Builder | `builder` | Admin（通过 Builder Users API） | 自助管理租户和密钥 |
| Solution | `chat`, `skills:*` 等 | Admin 或 Builder | SDK/前端集成 |

### 密钥层级关系

```
Admin → 创建 Builder key（需绑定 userId）
Builder → 创建 Solution key（无 userId，不可包含 admin/builder scope）
Solution key → 供终端用户应用使用
```

Builder key 需要绑定 `userId` 才能正常使用。
Builder 创建的 Solution key 故意不含 `userId`，因此无法调用 Builder API。

## 管理控制台

### 访问 API Keys 页面

1. 登录管理控制台
2. 点击侧边栏导航中的 **API Keys**
3. 列表页面显示所选租户的所有 API 密钥

### 列表视图

API 密钥列表显示：
- **密钥前缀**：密钥的前 20 个字符（例如 `ccaas_live_abc123`）
- **类型**：Admin、Builder 或 Solution 徽章（根据 scope 推断）
- **名称**：可读的标识符
- **权限范围**：权限徽章（显示前 3 个，溢出显示 +N）
- **状态**：活动或已吊销
- **使用量**：API 调用总次数
- **最后使用**：最近使用的时间戳
- **操作**：吊销/删除的下拉菜单

### 创建新的 API Key

1. 点击 **Create API Key** 按钮
2. 填写表单：
   - **名称**：描述性名称（例如 "生产环境前端"）
   - **租户 ID**：选择目标租户（默认："default"）
3. 点击 **Create Key**
4. **⚠️ 重要**：完整密钥仅显示一次
   - 立即复制密钥
   - 安全存储（例如在密码管理器中）
   - 警告消息强调这是唯一机会
5. 点击 **Done** 关闭弹窗

**默认设置**（自动应用）：
- 权限范围：`["chat", "skills:read", "skills:execute"]`
- 速率限制：60 次请求/分钟，1000 次请求/天
- 无过期时间

### 吊销密钥

在不删除的情况下阻止密钥使用：

1. 点击密钥行的 **⋮** 菜单
2. 选择 **Revoke**
3. 确认操作
4. 密钥状态更改为 "已吊销"
5. 密钥保留在数据库中用于审计

**使用场景**：
- 疑似密钥泄露
- 临时暂停访问
- 停用前员工的密钥

### 删除密钥

永久删除密钥：

1. 点击密钥行的 **⋮** 菜单
2. 选择 **Delete**
3. 确认永久删除
4. 删除前创建审计日志记录
5. 从数据库中删除密钥

**⚠️ 警告**：删除是永久性的。建议使用 **吊销** 以保留审计记录。

## 引导密钥链（新环境部署）

部署到新环境时，会遇到先有鸡还是先有蛋的问题：你需要管理员 API 密钥来创建 Solution 专用密钥，但此时还没有任何密钥。平台通过**引导密钥链**解决这个问题：

```
INITIAL_ADMIN_KEY（环境变量）
  → 后端启动时在数据库中创建管理员密钥
    → setup.sh 使用 CCAAS_BOOTSTRAP_KEY 调用管理员 API
      → 管理员 API 创建 Solution 专用密钥
        → Solution 密钥写入 .env 文件
```

### 配置

| 环境变量 | 设置位置 | 用途 |
|---------|---------|------|
| `INITIAL_ADMIN_KEY` | 后端 `.env` / K8s secret | 固定管理员密钥（替代自动生成） |
| `CCAAS_BOOTSTRAP_KEY` | 运行 `setup.sh` 前的 Shell | 告诉安装脚本使用哪个管理员密钥 |

### 快速开始

```bash
# 1. 生成密钥（必须以 'sk-' 开头，至少 20 个字符）
ADMIN_KEY="sk-$(openssl rand -hex 24)"

# 2. 设置后端环境变量
export INITIAL_ADMIN_KEY="$ADMIN_KEY"
# 启动后端...

# 3. 运行 Solution 安装
export CCAAS_BOOTSTRAP_KEY="$ADMIN_KEY"
export CCAAS_URL="http://localhost:3001"
cd solutions/business/my-solution && bash setup.sh
```

### 关键文件

| 文件 | 作用 |
|------|------|
| `packages/backend/src/config/configuration.ts` | 读取 `INITIAL_ADMIN_KEY` 环境变量 |
| `packages/backend/src/auth/api-key.service.ts` | 首次启动时创建管理员密钥 |
| `tools/solution-lib.sh` | `get_or_create_bootstrap_key()` 读取 `CCAAS_BOOTSTRAP_KEY` |
| `solutions/business/*/setup.sh` | 每个 Solution 的安装脚本（未设置环境变量时回退到开发默认值） |

{% hint style="warning" %}
硬编码的回退值 `sk-default-test...` 仅用于本地开发。在测试/生产环境中必须设置 `CCAAS_BOOTSTRAP_KEY`。
{% endhint %}

## REST API 使用

### 身份验证

所有管理员端点都需要具有 `admin` 权限范围的 API 密钥：

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  https://your-domain.com/api/v1/admin/api-keys?solutionId=default
```

### 通过 API 创建密钥

```bash
curl -X POST https://your-domain.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "solutionId": "default",
    "name": "生产环境 API Key",
    "scopes": ["chat", "skills:read", "skills:write"],
    "rateLimitRpm": 100,
    "rateLimitRpd": 5000
  }'
```

**响应**：
```json
{
  "apiKey": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "keyPrefix": "ccaas_live_abc123",
    "name": "生产环境 API Key",
    "scopes": ["chat", "skills:read", "skills:write"]
  },
  "rawKey": "ccaas_live_abc123def456ghi789jkl012mno345pqr678stu901",
  "warning": "这是唯一一次显示完整密钥。"
}
```

**⚠️ 立即存储 `rawKey`** - 之后无法再次获取。

### 列出密钥

```bash
curl "https://your-domain.com/api/v1/admin/api-keys?solutionId=default&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

**分页**：
- `page`：页码（默认：1）
- `limit`：每页条数（默认：50，最大：100）

### 更新密钥

```bash
curl -X PUT https://your-domain.com/api/v1/admin/api-keys/KEY_ID \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "更新后的名称",
    "scopes": ["chat", "skills:read", "skills:write", "mcp:read"],
    "rateLimitRpm": 120
  }'
```

**为已有密钥关联用户**（例如修复创建时未带 `userId` 的 builder key）：

```bash
curl -X PUT https://your-domain.com/api/v1/admin/api-keys/KEY_ID \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<user-id>"
  }'
```

**审计日志**：所有更新都会记录修改前后的值。

{% hint style="warning" %}
**Builder scope 校验**：`builder` scope 的 API key **必须**绑定 `userId`。创建或更新 key 时如果包含 `builder` scope 但没有 `userId`，会返回 400 Bad Request。推荐使用 `POST /api/v1/admin/builder-users` 一站式完成 builder onboarding。
{% endhint %}

### 吊销密钥

```bash
curl -X POST https://your-domain.com/api/v1/admin/api-keys/KEY_ID/revoke \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

### 删除密钥

```bash
curl -X DELETE https://your-domain.com/api/v1/admin/api-keys/KEY_ID \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

## 权限范围

### 可用范围

| 范围 | 说明 |
|------|------|
| `chat` | 发送聊天消息并接收响应 |
| `skills:read` | 查看技能定义 |
| `skills:write` | 创建和更新技能 |
| `skills:execute` | 手动触发技能执行 |
| `skills:delete` | 删除技能 |
| `mcp:read` | 查看 MCP 服务器配置 |
| `mcp:write` | 注册和管理 MCP 服务器 |
| `analytics:read` | 访问使用分析和指标 |
| `admin` | 完整管理权限（包含所有范围） |

{% hint style="info" %}
**Admin 权限特权**：具有 `admin` 范围的 API Key 会绕过技能级别的权限检查（如 `allowedTools` 限制）。Admin Key 还支持自动解析 `solutionId` — 通过 API Key 发送消息时，可以省略请求体中的 `solutionId`，系统会自动从 API Key 的租户上下文中解析。
{% endhint %}

### 权限范围组合

**常见模式**：

1. **前端应用**：
   ```json
   ["chat", "skills:read"]
   ```
   - 可以发送消息
   - 可以查看可用技能
   - 无法修改配置

2. **后端服务**：
   ```json
   ["chat", "skills:read", "skills:write", "mcp:read"]
   ```
   - 完整聊天功能
   - 可以管理技能
   - 可以查看 MCP 集成

3. **管理工具**：
   ```json
   ["admin"]
   ```
   - 完全访问所有资源
   - 可以管理 API 密钥
   - 访问分析数据

## 速率限制

### 理解速率限制

每个 API 密钥有两个速率限制设置：

1. **每分钟请求数（RPM）**：短期突发保护
2. **每天请求数（RPD）**：长期使用控制

**默认值**：
- RPM：60
- RPD：1000

### 速率限制何时生效

速率限制针对每个 API 密钥的所有请求强制执行。超过限制时：

**RPM 超限**：
```json
{
  "statusCode": 429,
  "message": "速率限制已超：每分钟 60 次请求",
  "retryAfter": 45
}
```

**RPD 超限**：
```json
{
  "statusCode": 429,
  "message": "每日速率限制已超：每天 1000 次请求",
  "retryAfter": 43200
}
```

### 最佳实践

1. **设置适当的限制** 基于预期使用量
2. **监控使用情况** 通过管理控制台
3. **为不同环境使用单独的密钥**
4. **在客户端代码中实现指数退避**
5. **在适当的地方缓存响应**

## 安全最佳实践

### 密钥管理

✅ **应该**：
- 为每个环境生成单独的密钥（开发、测试、生产）
- 使用描述性名称标识密钥用途
- 定期轮换密钥（例如每 90 天）
- 密钥泄露时立即吊销
- 将密钥存储在安全保险库中（如 AWS Secrets Manager）
- 使用环境变量，永远不要硬编码密钥

❌ **不应该**：
- 在应用程序之间共享密钥
- 将密钥提交到版本控制
- 在开发中使用生产密钥
- 重用已吊销的密钥
- 以明文文件存储密钥

### 最小权限原则

仅授予所需的最小权限范围：

```json
// ✅ 好：前端只需基本访问权限
{
  "scopes": ["chat", "skills:read"]
}

// ❌ 差：前端不需要管理员权限
{
  "scopes": ["admin"]
}
```

### 监控和审计

1. **定期审查使用情况**：
   - 检查 "最后使用" 时间戳
   - 识别未使用的密钥以便删除
   - 监控异常使用模式

2. **检查审计日志**：
   - 所有密钥创建/更新都有记录
   - 跟踪谁在何时进行了更改
   - 调查任何意外修改

3. **设置警报**（如果可用）：
   - 高使用率模式
   - 身份验证失败尝试
   - 速率限制违规

## 故障排除

### 密钥无法使用

**症状**：API 返回 401 未授权

**检查**：
1. ✓ 密钥未被吊销（状态应为 "active"）
2. ✓ 密钥未过期（检查 `expiresAt` 字段）
3. ✓ 密钥具有操作所需的权限范围
4. ✓ 正确的 `Authorization: Bearer KEY` 头格式
5. ✓ 密钥中没有额外的空格或换行符

### 速率限制问题

**症状**：API 返回 429 请求过多

**解决方案**：
1. **增加限制**：更新 `rateLimitRpm` 或 `rateLimitRpd`
2. **优化调用**：减少不必要的 API 请求
3. **实现缓存**：在适当的时候存储响应
4. **使用单独的密钥**：将流量分散到多个密钥

### 缺少权限

**症状**：API 返回 403 禁止访问

**检查**：
1. ✓ 密钥具有所需的权限范围（例如创建技能需要 `skills:write`）
2. ✓ 租户 ID 与密钥的租户匹配
3. ✓ 密钥的权限范围级别允许该操作
4. ✓ Builder key 必须绑定 `userId` — 通过 `PUT /api/v1/admin/api-keys/:id` 补充，或通过 `POST /api/v1/admin/builder-users` 重建

## 使用跟踪

### 查看统计信息

在管理控制台中，每个密钥显示：
- **使用次数**：API 调用总数
- **最后使用时间**：最近使用的时间戳

### 分析集成

查看详细分析：
1. 导航到 **Analytics** 页面
2. 按 API 密钥 ID 过滤
3. 查看：
   - 随时间变化的请求量
   - Token 使用量
   - 错误率
   - 响应时间

## 示例

### 开发工作流

```bash
# 1. 创建具有有限权限范围的开发密钥
curl -X POST https://dev.example.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -d '{
    "solutionId": "dev-solution",
    "name": "开发环境",
    "scopes": ["chat", "skills:read"]
  }'

# 2. 存储在环境变量中
export CCAAS_API_KEY="ccaas_live_..."

# 3. 在应用程序中使用
curl -H "Authorization: Bearer $CCAAS_API_KEY" \
  https://dev.example.com/api/v1/skills
```

### 生产部署

```bash
# 1. 创建具有完整权限范围的生产密钥
curl -X POST https://api.example.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -d '{
    "solutionId": "production",
    "name": "生产环境前端",
    "scopes": ["chat", "skills:read", "skills:write"],
    "rateLimitRpm": 200,
    "rateLimitRpd": 10000,
    "expiresAt": "2026-01-15T00:00:00Z"
  }'

# 2. 存储在 AWS Secrets Manager
aws secretsmanager create-secret \
  --name prod/ccaas/api-key \
  --secret-string "ccaas_live_..."

# 3. 在应用程序启动时检索
export CCAAS_API_KEY=$(aws secretsmanager get-secret-value \
  --secret-id prod/ccaas/api-key \
  --query SecretString \
  --output text)
```

### 密钥轮换

```bash
# 1. 创建新密钥
NEW_KEY=$(curl -X POST .../admin/api-keys -d '...' | jq -r '.rawKey')

# 2. 更新应用程序配置
kubectl set env deployment/app CCAAS_API_KEY="$NEW_KEY"

# 3. 等待推出
kubectl rollout status deployment/app

# 4. 吊销旧密钥
curl -X POST .../admin/api-keys/OLD_KEY_ID/revoke
```

## 常见问题

**问：能否找回丢失的 API 密钥？**
答：不能。完整密钥仅在创建时显示一次。如果丢失，请创建新密钥并吊销旧密钥。

**问：如何更改密钥的权限范围？**
答：使用 PUT 端点更新权限范围。更改立即生效。

**问：吊销密钥时，正在进行的请求会发生什么？**
答：正在进行的请求正常完成。后续请求将被拒绝，返回 401 未授权。

**问：能否在不吊销的情况下临时禁用密钥？**
答：将状态更新为 `revoked`，需要时再改回 `active`。

**问：审计日志保留多长时间？**
答：审计日志无限期保留。请查看您组织的数据保留政策。

**问：能否为不同端点设置不同的速率限制？**
答：不能。速率限制全局应用于使用该密钥的所有请求。对于不同的速率要求，请使用单独的密钥。
