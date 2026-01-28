# CLAUDE.md - Lesson Plan Designer

## 项目概述

备课方案设计器，包含：
- `backend/` - NestJS 后端 API (端口 3002)
- `frontend/` - React 前端
- `mcp-server/` - MCP 工具服务器
- `data/` - JSON 数据文件（教材章节、课程标准）

## 开发命令

```bash
# 后端
cd backend && npm run start:dev    # 开发模式
cd backend && npm test             # 运行测试

# 前端
cd frontend && npm run dev         # 开发模式
```

## API 契约

### Textbook API（重要！）

前端期望的响应格式（**不可随意更改**）：

```typescript
// GET /api/textbook/subjects
TextbookSubject[] = [{ id: string, label: string }]

// GET /api/textbook/grades?subject=math
TextbookGrade[] = [{ id: number, label: string, stage: string }]

// GET /api/textbook/publishers?subject=math&gradeId=3
TextbookPublisher[] = [{ id: string, label: string }]

// GET /api/textbook/volumes?subject=math&gradeId=3&publisher=人教版
TextbookVolume[] = [{ id: string, label: string }]

// GET /api/textbook/chapters?subject=math&gradeId=3&publisher=人教版&volume=上册
TextbookChapter[] = [{ id: number, title: string, children?: TextbookChapter[] }]
```

⚠️ **修改这些 API 前必须**：
1. 检查 `frontend/src/types/index.ts` 中的类型定义
2. 检查 `frontend/src/hooks/useTextbook.ts` 中的调用方式
3. 运行 `backend/npm test` 确认测试通过

## 教训记录

### 2025-01: API 格式不兼容事件

**问题**：修改 textbook API 后，前端"创建新备课方案"功能完全失效。

**原因**：
- 计划文档定义了简化的 API 格式（返回 `string[]`）
- 没有先运行测试就按计划实现
- 前端实际需要 `{id, label}` 格式

**教训**：
```
测试 > 计划
现有代码 > 新设计
先验证 > 后实现
```

### 2025-01: output_update 事件结构不匹配

**问题**：AI生成内容后提示"请点击前端的'同步到表单'按钮"，但前端没有显示同步按钮。

**原因**：
- 前端定义了本地的 `OutputUpdateEvent` 类型，期望 flat 结构 `{ field, value, preview }`
- 但后端 EventMapper 实际发送嵌套结构 `{ payload: { data: { field, value, preview } } }`
- 错误的注释误导："backend sends flat structure"（实际发送嵌套结构）
- 没有使用 `@ccaas/shared` 的类型定义

**修复**：
1. 创建 `src/utils/outputUpdateParser.ts` 解析嵌套结构
2. 删除本地的 `OutputUpdateEvent` 类型，使用 `@ccaas/shared` 的定义
3. 更新 `useLessonPlanSession.ts` 使用解析器

**教训**：
```
使用 @ccaas/shared 的类型定义，不要定义本地类型
注释必须与代码行为一致
添加集成测试验证前后端事件结构匹配
```

## 强制检查清单

修改 backend 代码前：
- [ ] `cd backend && npm test` - 确认当前测试通过
- [ ] 检查前端类型定义是否会受影响

修改后：
- [ ] `cd backend && npm test` - 确认测试仍然通过
- [ ] 手动测试前端功能
