# NotebookLM 附件下载 404 问题诊断指南

## 问题现象

用户报告：NotebookLM 生成的文件下载失败
- **URL**: `http://localhost:5280/api/v1/files/{fileId}/download`
- **错误**: 404 Not Found
- **端口**: 5280 (lesson-plan-designer backend)

## 代码验证结果

✅ **Backend 代码逻辑正确**：
- `lesson-plans.service.ts:337` - 使用 DTO 的 `fileId`（不生成新的）
- `lesson-plans.service.ts:331` - 用 `fileId` 保存文件到 `uploads/attachments/{fileId}{ext}`
- `lesson-plans.service.ts:342` - downloadUrl 使用相同的 `fileId`
- `lesson-plans.service.ts:379` - 用 `fileId` 查找 attachment

✅ **MCP Server 代码逻辑正确**：
- `mcp-server/src/index.ts:609` - 生成 `fileId: randomUUID()`
- `mcp-server/src/index.ts:633-636` - 传递 `fileId` 给 backend

## 已实施的改进

### 1. 添加详细日志

在 `lesson-plans.service.ts` 的关键位置添加了日志：

#### addAttachmentFromMcp()
- ✅ 记录收到的请求参数
- ✅ 记录 DTO 完整内容
- ✅ 记录文件复制过程
- ✅ 记录文件验证结果
- ✅ 记录创建的 attachment metadata

#### addAttachmentToLessonPlan()
- ✅ 记录数据库操作
- ✅ 记录当前和新的 attachments 数量
- ✅ 记录保存成功/失败
- ✅ 验证更新后的 attachments 数量

#### getFileMetadata()
- ✅ 记录查找的 fileId
- ✅ 记录总 lesson plans 数量
- ✅ 记录每个 plan 的 attachments 数量
- ✅ 记录找到的 attachment
- ✅ 记录文件路径和是否存在

### 2. 创建诊断脚本

**脚本位置**: `solutions/lesson-plan-designer/backend/scripts/check-attachments.js`

**功能**:
- 列出所有 lesson plans 及其 attachments
- 显示每个 attachment 的 fileId、fileName、downloadUrl
- 检查物理文件是否存在于 uploads 目录
- 支持搜索特定的 fileId
- 列出 uploads 目录中的所有文件

**使用方法**:
```bash
# 查看所有 attachments
node solutions/lesson-plan-designer/backend/scripts/check-attachments.js

# 搜索特定的 fileId
node solutions/lesson-plan-designer/backend/scripts/check-attachments.js 8b8defbd-dafb-4365-9a55-1e485f917e95
```

## 诊断步骤

### 步骤 1: 启动服务并启用日志

```bash
# Terminal 1: CCAAS Backend (如果需要)
cd packages/backend
npm run start:dev

# Terminal 2: Lesson Plan Designer Backend
cd solutions/lesson-plan-designer/backend
npm run start:dev
# 日志会显示详细的 [Attachment] 和 [Download] 信息

# Terminal 3: Lesson Plan Designer Frontend
cd solutions/lesson-plan-designer/frontend
npm run dev
```

### 步骤 2: 重现问题

1. 打开前端: http://localhost:5173
2. 使用 NotebookLM 或 attach_file 功能
3. 观察后端日志输出

### 步骤 3: 分析日志输出

根据日志判断问题点：

| 日志模式 | 问题诊断 | 解决方案 |
|---------|---------|---------|
| 没有 `[Attachment] Received request` | Controller 未被调用 | 检查前端 API 调用 |
| `dto: undefined` 或缺少字段 | DTO 未正确传递 | 检查 Controller 参数绑定 |
| `dto.fileId is undefined` | fileId 缺失 | 检查 MCP server 返回值 |
| `lessonPlanId not found` | Lesson plan 不存在 | 先创建 lesson plan |
| `Source file not found` | 源文件路径错误 | 检查 MCP `_originalPath` |
| `File copied successfully` 但找不到 | 数据库保存失败 | 检查 SQLite 错误 |
| `[Download] Total lesson plans: 0` | 数据库为空 | 检查数据库连接 |
| `[Download] Attachment not found` | 数据不匹配 | 运行诊断脚本 |

### 步骤 4: 运行诊断脚本

使用错误消息中的 fileId 运行诊断脚本：

```bash
node solutions/lesson-plan-designer/backend/scripts/check-attachments.js 8b8defbd-dafb-4365-9a55-1e485f917e95
```

**脚本会告诉你**：
- ✅ fileId 是否存在于数据库中
- ✅ 哪个 lesson plan 包含这个 attachment
- ✅ 物理文件是否存在于 uploads 目录
- ✅ 文件路径是否正确

### 步骤 5: 检查前端调用

打开浏览器 DevTools → Network:

1. 检查是否有 POST 请求到 `/api/v1/lesson-plans/{id}/attachments`
   - ✅ 如果没有：前端未调用 API
   - ✅ 如果有：检查 request body

2. 检查 request body 是否包含：
   ```json
   {
     "fileId": "xxx-xxx-xxx",
     "fileName": "xxx.mp3",
     "_originalPath": "/absolute/path/to/file",
     ...
   }
   ```

3. 检查响应状态码：
   - 200: 成功，继续检查下载端点
   - 400: 缺少必填字段
   - 404: Lesson plan 不存在
   - 500: 服务器错误，检查后端日志

### 步骤 6: 手动测试下载端点

```bash
# 1. 查看数据库中的 fileId
node solutions/lesson-plan-designer/backend/scripts/check-attachments.js

# 2. 使用找到的 fileId 测试下载
curl -I http://localhost:5280/api/v1/files/{fileId}/download

# 3. 如果返回 200，尝试下载文件
curl -o test-download.mp3 http://localhost:5280/api/v1/files/{fileId}/download

# 4. 验证文件内容
file test-download.mp3
```

### 步骤 7: 检查数据库内容

```bash
# 连接数据库
sqlite3 solutions/lesson-plan-designer/backend/data/lesson-plans.db

# 查看所有 lesson plans 及其 attachments
SELECT id, title, json_extract(attachments, '$') as attachments
FROM lesson_plans
WHERE attachments IS NOT NULL;

# 搜索特定的 fileId
SELECT id, title, attachments
FROM lesson_plans
WHERE attachments LIKE '%8b8defbd-dafb-4365-9a55-1e485f917e95%';

# 退出
.quit
```

### 步骤 8: 检查文件系统

```bash
# 检查上传目录是否存在
ls -lh .agent-workspace/uploads/attachments/

# 搜索特定的 fileId
find .agent-workspace/uploads/attachments/ -name "8b8defbd-dafb-4365-9a55-1e485f917e95*"

# 检查目录权限
ls -ld .agent-workspace/uploads/attachments/
```

## 常见问题和解决方案

### 问题 1: Lesson Plan 未创建

**现象**:
```
[Attachment] lessonPlanId not found
```

**原因**: 前端在附件创建之前没有先创建 lesson plan

**解决方案**:
1. 确保前端在调用 `POST /:id/attachments` 之前先创建 lesson plan
2. 或者修改逻辑为自动创建 lesson plan

### 问题 2: fileId 未传递

**现象**:
```
[Attachment] Missing required fields: fileId
```

**原因**: MCP server 返回的数据中缺少 fileId

**解决方案**:
检查 `mcp-server/src/index.ts` 的 `attach_file` tool 返回值

### 问题 3: 数据库保存失败

**现象**:
```
[Attachment] File copied successfully
[DB] Failed to save attachment to database: ...
```

**原因**: SQLite 写入失败或 JSON.stringify 出错

**解决方案**:
1. 检查数据库文件权限
2. 检查 attachments 数据格式
3. 检查磁盘空间

### 问题 4: 文件复制失败

**现象**:
```
[Attachment] Failed to copy file: ENOENT
```

**原因**: 源文件路径错误或文件已被删除

**解决方案**:
1. 检查 MCP server 的 `_originalPath` 是否正确
2. 确保文件在复制前没有被删除
3. 检查文件权限

### 问题 5: uploads 目录不存在

**现象**:
```
[Attachment] Failed to copy file: ENOENT: no such file or directory
```

**原因**: `.agent-workspace/uploads/attachments/` 目录不存在

**解决方案**:
```bash
mkdir -p .agent-workspace/uploads/attachments/
```

或在代码中自动创建目录。

## 验证清单

使用此清单确保所有组件正常工作：

### Backend 验证

- [ ] `npm test` 通过
- [ ] 启动时没有错误
- [ ] 日志显示正确的 UPLOAD_DIR 路径
- [ ] uploads 目录存在且有写权限

### 数据流验证

- [ ] MCP server 返回 fileId
- [ ] Controller 收到正确的 DTO
- [ ] 文件成功复制到 uploads 目录
- [ ] attachment 保存到数据库
- [ ] 数据库中的 fileId 与 MCP 一致

### 下载验证

- [ ] GET `/api/v1/files/{fileId}/download` 返回 200
- [ ] 文件内容正确
- [ ] 文件类型正确（Content-Type）
- [ ] 文件可以在浏览器中下载

### 前端验证

- [ ] 下载按钮显示
- [ ] 点击下载触发正确的请求
- [ ] 文件成功下载到本地
- [ ] 文件可以正常打开

## 下一步

如果以上步骤仍无法解决问题，请收集以下信息：

1. **后端日志** (从启动到下载失败的完整日志)
2. **诊断脚本输出**
   ```bash
   node solutions/lesson-plan-designer/backend/scripts/check-attachments.js {fileId}
   ```
3. **数据库查询结果**
   ```sql
   SELECT * FROM lesson_plans WHERE attachments LIKE '%{fileId}%';
   ```
4. **uploads 目录内容**
   ```bash
   ls -lh .agent-workspace/uploads/attachments/
   ```
5. **前端 Network 面板截图**

将这些信息提供给开发者以便进一步诊断。

## 相关文件

| 文件 | 说明 |
|------|------|
| `solutions/lesson-plan-designer/backend/src/lesson-plans/lesson-plans.service.ts` | 核心业务逻辑（已添加日志） |
| `solutions/lesson-plan-designer/backend/src/lesson-plans/files.controller.ts` | 文件下载端点 |
| `solutions/lesson-plan-designer/backend/src/lesson-plans/lesson-plans.controller.ts` | Attachment API 端点 |
| `solutions/lesson-plan-designer/backend/scripts/check-attachments.js` | 诊断脚本 |
| `solutions/lesson-plan-designer/mcp-server/src/index.ts` | MCP server（fileId 生成） |

## 技术原理

### 数据流

```
1. MCP Server
   ↓ 生成 fileId (UUID)
   ↓ 返回 { fileId, fileName, _originalPath, ... }

2. Backend Controller
   ↓ 接收 DTO
   ↓ 调用 addAttachmentFromMcp()

3. Service Layer
   ↓ 复制文件: _originalPath → uploads/attachments/{fileId}{ext}
   ↓ 创建 attachment metadata (使用 DTO 的 fileId)
   ↓ 保存到数据库 (JSON.stringify)

4. Download Request
   ↓ 从数据库查找 fileId
   ↓ 构造文件路径: uploads/attachments/{fileId}{ext}
   ↓ 返回文件流
```

### 关键点

1. **fileId 必须一致**: MCP → DTO → DB → 文件名 → 下载查询
2. **文件路径格式**: `{UPLOAD_DIR}/{fileId}{ext}`
3. **数据库存储**: attachments 字段存储 JSON 数组
4. **查找逻辑**: 遍历所有 lesson plans 的 attachments 数组

## 参考文档

- [NotebookLM Skill 实现](solutions/lesson-plan-designer/skills/notebooklm/SKILL.md)
- [Attachment 功能实现](ATTACH_FILE_IMPLEMENTATION.md)
- [Backend CLAUDE.md](solutions/lesson-plan-designer/backend/CLAUDE.md)
