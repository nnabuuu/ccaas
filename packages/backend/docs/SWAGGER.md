# Swagger API 文档

CCAAS 现已配置完整的 Swagger/OpenAPI 文档，提供**中英文双语**版本。

## 访问方式

启动 backend 服务后，可以通过以下方式访问：

### 🇨🇳 中文版（默认）

- **Swagger UI**: http://localhost:3001/api/docs
- **OpenAPI JSON**: http://localhost:3001/api/docs-json
- **OpenAPI YAML**: http://localhost:3001/api/docs-yaml

### 🇬🇧 英文版

- **Swagger UI**: http://localhost:3001/api/docs/en
- **OpenAPI JSON**: http://localhost:3001/api/docs/en-json
- **OpenAPI YAML**: http://localhost:3001/api/docs/en-yaml

## 功能特性

✅ **中英文双语**
- 所有接口描述、参数说明、响应示例均提供中英文版本
- 适合国内团队使用，同时方便国际化

✅ **交互式文档**
- 在线调试 API 接口
- 填写参数、执行请求、查看响应
- 支持 API Key 认证

✅ **完整的类型定义**
- 所有 DTO 都有详细的字段说明
- 包含示例值和数据格式
- 支持嵌套对象和数组

✅ **分组组织**
- 按功能模块分组（sessions, messages, files, skills, etc.）
- 清晰的层级结构
- 快速定位所需接口

## 文档结构

### API 分组

| 分组 | 中文描述 | 英文描述 |
|------|---------|---------|
| **sessions** | 会话管理 - Session 创建、消息发送、状态查询 | Session Management - Session creation, messaging, status |
| **messages** | 消息历史 - 消息查询、工具事件、思考块 | Message History - Query messages, tool events, thinking blocks |
| **files** | 文件资源 - 文件上传、下载、预览 | File Resources - Upload, download, preview files |
| **skills** | 技能管理 - Skill CRUD、版本控制 | Skill Management - Skill CRUD, version control |
| **mcp** | MCP 服务器 - MCP 服务器配置与管理 | MCP Servers - MCP server configuration and management |
| **auth** | 认证授权 - API Key 管理 | Authentication - API Key management |
| **solutions** | Solution 管理 - 多 Solution 配置 | Solution Management - Multi-solution configuration |
| **scheduler** | 定时任务 - 定时执行 Agent 任务 | Scheduled Tasks - Execute agent tasks on schedule |
| **admin** | 管理接口 - 系统管理功能 | Admin APIs - System administration |

### 主要端点示例

#### Sessions - 会话管理

```
POST   /api/v1/sessions/{sessionId}/completion     发送消息
DELETE /api/v1/sessions/{sessionId}/completion     取消操作
GET    /api/v1/sessions/{sessionId}                获取会话状态
GET    /api/v1/sessions/{sessionId}/sub-agents     获取活跃子代理
POST   /api/v1/sessions/{sessionId}/restart        重启会话
PUT    /api/v1/sessions/{sessionId}/context        更新会话上下文
GET    /api/v1/sessions/{sessionId}/workspace      列出工作区文件
```

#### Messages - 消息历史

```
GET    /api/v1/sessions/{sessionId}/messages       获取会话消息
GET    /api/v1/sessions/{sessionId}/files          获取会话文件
GET    /api/v1/messages/{messageId}                获取单条消息
GET    /api/v1/messages/{messageId}/files          获取消息文件
GET    /api/v1/messages/{messageId}/tool-events    获取工具调用事件
GET    /api/v1/sessions/{sessionId}/full-trace     获取完整会话跟踪
```

#### Files - 文件资源

```
GET    /api/v1/files/{fileId}                      获取文件元数据
GET    /api/v1/files/{fileId}/download             下载文件
GET    /api/v1/files/{fileId}/preview              预览文件内容
POST   /api/v1/files/upload                        上传文件
```

## 使用示例

### 1. 在 Swagger UI 中测试

1. 访问 http://localhost:3001/api/docs
2. 点击展开任意 API 接口
3. 点击 "Try it out" 按钮
4. 填写参数（如果需要认证，点击右上角 "Authorize" 按钮输入 API Key）
5. 点击 "Execute" 执行请求
6. 查看响应结果

### 2. 使用 API Key 认证

1. 点击页面右上角的 "Authorize" 按钮
2. 在 `api-key (apiKey)` 输入框中输入你的 API Key：
   ```
   ccaas_xxxxxxxxxxxxxxxx
   ```
3. 点击 "Authorize"
4. 现在所有需要认证的接口都会自动带上 API Key

### 3. 导出 OpenAPI 规范

```bash
# 导出 JSON 格式
curl http://localhost:3001/api/docs-json > openapi.json

# 导出 YAML 格式
curl http://localhost:3001/api/docs-yaml > openapi.yaml

# 使用 OpenAPI Generator 生成客户端 SDK
openapi-generator-cli generate \
  -i http://localhost:3001/api/docs-json \
  -g typescript-axios \
  -o ./sdk/typescript
```

## 生成客户端 SDK

使用 OpenAPI 规范可以自动生成多种语言的客户端 SDK：

### TypeScript / JavaScript

```bash
npm install @openapitools/openapi-generator-cli -g
openapi-generator-cli generate \
  -i http://localhost:3001/api/docs-json \
  -g typescript-axios \
  -o ./sdk/typescript-client
```

### Python

```bash
openapi-generator-cli generate \
  -i http://localhost:3001/api/docs-json \
  -g python \
  -o ./sdk/python-client
```

### Java

```bash
openapi-generator-cli generate \
  -i http://localhost:3001/api/docs-json \
  -g java \
  -o ./sdk/java-client
```

### Go

```bash
openapi-generator-cli generate \
  -i http://localhost:3001/api/docs-json \
  -g go \
  -o ./sdk/go-client
```

## 维护指南

### 添加新的 API 端点

1. **在 Controller 中添加装饰器**：

```typescript
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@ApiTags('my-module')
@Controller('api/v1/my-module')
export class MyController {

  @Get(':id')
  @ApiOperation({
    summary: '获取资源 / Get Resource',
    description: '根据 ID 获取资源详情 / Get resource details by ID',
  })
  @ApiParam({
    name: 'id',
    description: '资源 ID / Resource ID',
    example: 'resource-123',
  })
  @ApiResponse({
    status: 200,
    description: '资源详情 / Resource details',
  })
  @ApiResponse({
    status: 404,
    description: '资源不存在 / Resource not found',
  })
  async getResource(@Param('id') id: string) {
    // ...
  }
}
```

2. **为 DTO 添加装饰器**：

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateResourceDto {
  @ApiProperty({
    description: '资源名称 / Resource name',
    example: 'My Resource',
    minLength: 1,
    maxLength: 100,
  })
  name: string;

  @ApiProperty({
    description: '资源描述 / Resource description',
    required: false,
    example: 'This is a sample resource',
  })
  description?: string;
}
```

3. **重启服务器**，文档将自动更新

### 装饰器说明

| 装饰器 | 用途 |
|--------|------|
| `@ApiTags()` | 为 Controller 设置分组标签 |
| `@ApiOperation()` | 描述端点的功能 |
| `@ApiParam()` | 描述路径参数 |
| `@ApiQuery()` | 描述查询参数 |
| `@ApiBody()` | 描述请求体 |
| `@ApiResponse()` | 描述响应 |
| `@ApiProperty()` | 描述 DTO 字段 |
| `@ApiSecurity()` | 指定认证方式 |

## 常见问题

### Q: 如何添加新的 tag（分组）？

在 `main.ts` 中的 `DocumentBuilder` 配置中添加：

```typescript
.addTag('new-module', '新模块 - 模块描述')
```

### Q: 如何隐藏某些端点？

使用 `@ApiExcludeEndpoint()` 装饰器：

```typescript
@Get('internal')
@ApiExcludeEndpoint()
async internalEndpoint() {
  // 此端点不会出现在 Swagger 文档中
}
```

### Q: 如何自定义响应 Schema？

使用 `@ApiResponse()` 的 `schema` 参数：

```typescript
@ApiResponse({
  status: 200,
  description: '成功响应',
  schema: {
    type: 'object',
    properties: {
      data: { type: 'array', items: { type: 'string' } },
      total: { type: 'number' },
    },
  },
})
```

### Q: 如何在生产环境中禁用 Swagger？

在 `main.ts` 中添加环境检查：

```typescript
if (process.env.NODE_ENV !== 'production') {
  // 只在非生产环境启用 Swagger
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
```

## 相关资源

- [NestJS Swagger 官方文档](https://docs.nestjs.com/openapi/introduction)
- [OpenAPI 规范](https://swagger.io/specification/)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)

## 更新日志

- **2026-02-09**: 初始版本，配置中英文双语 Swagger 文档
  - 添加 Sessions, Messages, Files 主要端点文档
  - 配置 API Key 认证方式
  - 添加详细的中英文描述和示例
