# NotebookLM 附件 404 错误 - 快速参考卡

## 🚀 快速诊断（5分钟）

### 步骤 1: 启动 Backend 并观察日志

```bash
cd solutions/lesson-plan-designer/backend
npm run start:dev
```

**观察日志中的关键词**:
- `[Attachment]` - 文件上传过程
- `[DB]` - 数据库保存过程
- `[Download]` - 文件下载过程

### 步骤 2: 重现问题

在前端使用 NotebookLM 或附件功能，观察后端日志。

### 步骤 3: 运行诊断脚本

```bash
cd solutions/lesson-plan-designer/backend
node scripts/check-attachments.js [fileId]
```

## 🔍 日志速查表

| 日志内容 | 问题 | 解决 |
|---------|------|------|
| 没有任何 `[Attachment]` 日志 | 前端未调用 API | 检查前端代码 |
| `Missing required fields: fileId` | MCP 未返回 fileId | 检查 MCP server |
| `Source file not found` | 源文件路径错误 | 检查 `_originalPath` |
| `Failed to copy file` | 文件复制失败 | 检查权限/磁盘空间 |
| `File copied successfully` 但 `[DB]` 没有后续 | 数据库保存失败 | 检查 SQLite 错误 |
| `[Download] Total lesson plans: 0` | 数据库为空 | 检查数据库文件 |
| `[Download] Attachment not found` | fileId 不匹配 | 运行诊断脚本对比 |

## 📊 诊断脚本速查

```bash
# 查看所有附件
node scripts/check-attachments.js

# 搜索特定 fileId（从 404 错误 URL 中获取）
node scripts/check-attachments.js 8b8defbd-dafb-4365-9a55-1e485f917e95
```

**脚本告诉你**:
- ✅/❌ fileId 是否在数据库中
- ✅/❌ 文件是否在磁盘上
- 📍 文件应该在哪里
- 📋 所有 lesson plans 的附件列表

## 🔧 常见问题快速修复

### 问题: uploads 目录不存在

```bash
mkdir -p .agent-workspace/uploads/attachments/
```

### 问题: 数据库中找不到 fileId

**可能原因**:
1. Lesson plan 未创建
2. API 调用失败
3. 数据库保存失败

**检查**:
```bash
sqlite3 solutions/lesson-plan-designer/backend/data/lesson-plans.db \
  "SELECT id, title FROM lesson_plans;"
```

### 问题: 文件在数据库中但不在磁盘上

**可能原因**:
1. 文件复制失败但未报错
2. 文件被误删
3. 路径错误

**检查**:
```bash
ls -lh .agent-workspace/uploads/attachments/
```

## 📱 快速测试

### 测试下载端点

```bash
# 从诊断脚本获取一个有效的 fileId
FILEID="xxx-xxx-xxx"

# 测试下载
curl -I http://localhost:5280/api/v1/files/$FILEID/download

# 如果返回 200，下载文件
curl -o test.mp3 http://localhost:5280/api/v1/files/$FILEID/download

# 验证文件
file test.mp3
```

## 🎯 数据流检查点

```
MCP Server
  ↓ 生成 fileId
  ✓ 检查: MCP 日志中是否返回 fileId?

Backend Controller
  ↓ 接收 DTO
  ✓ 检查: 日志显示 `[Attachment] Received request`?

Service.addAttachmentFromMcp()
  ↓ 复制文件
  ✓ 检查: 日志显示 `File copied successfully`?
  ↓ 保存到数据库
  ✓ 检查: 日志显示 `[DB] Successfully saved`?

Download Request
  ↓ 查找 fileId
  ✓ 检查: 日志显示 `[Download] Found attachment`?
  ↓ 返回文件
  ✓ 检查: HTTP 200 响应?
```

## 📞 需要帮助时提供的信息

1. **Backend 日志** (完整的从启动到失败)
2. **诊断脚本输出**
   ```bash
   node scripts/check-attachments.js {fileId} > diagnosis.txt
   ```
3. **文件列表**
   ```bash
   ls -lh .agent-workspace/uploads/attachments/ > files.txt
   ```
4. **数据库内容**
   ```bash
   sqlite3 data/lesson-plans.db \
     "SELECT id, title, json_extract(attachments, '$') FROM lesson_plans;" \
     > db-content.txt
   ```

## 📚 详细文档

- 完整诊断指南: [ATTACHMENT_DEBUGGING_GUIDE.md](ATTACHMENT_DEBUGGING_GUIDE.md)
- 实施总结: [ATTACHMENT_404_FIX_IMPLEMENTATION.md](ATTACHMENT_404_FIX_IMPLEMENTATION.md)

---

**提示**: 90% 的问题可以通过查看日志和运行诊断脚本快速定位！
