# Attachment Delete功能修复

**修复日期**: 2026-02-12
**问题**: lesson-plan-designer中附加的课件无法被删除

## 根本原因

前端**缺少删除附件的API调用函数**，导致点击删除按钮时只更新了本地state，没有调用backend API删除数据库中的附件记录。

### 问题分析

**Backend** ✅ 正常
- 路由存在: `DELETE /api/lesson-plans/:id/attachments/:attachmentId`
- Controller正确实现 (line 85-92)
- Service正确实现 (line 250-262)

**Frontend** ❌ 有问题
- `api.ts`: 缺少 `removeAttachment` 函数
- `LessonPlanContent.tsx`: onRemove只更新本地state，不调用API

### 问题流程

```
用户点击删除按钮
  ↓
onRemove(attachmentId) 被调用
  ↓
❌ 只执行: lessonPlan.attachments.filter(a => a.id !== id)
  ↓
本地state更新，UI中附件消失
  ↓
❌ 刷新页面后，附件又回来了 (数据库未删除)
```

## 修复方案

### 1. 添加API函数

**文件**: `frontend/src/utils/api.ts`

```typescript
// Remove an attachment from lesson plan
async removeAttachment(planId: string, attachmentId: string): Promise<LessonPlan> {
  const response = await fetch(`${API_BASE}/lesson-plans/${planId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  })
  return handleResponse<LessonPlan>(response)
}
```

**位置**: 添加在 `addAttachments` 函数之后 (line 165之前)

### 2. 更新组件调用

**文件**: `frontend/src/components/LessonPlanContent.tsx`

**添加import**:
```typescript
import api from '../utils/api'
```

**修改onRemove回调** (line 474-477):

**修复前**:
```typescript
onRemove={(id) => {
  const updated = lessonPlan.attachments.filter((a) => a.id !== id)
  onChange('attachments', updated as never)
}}
```

**修复后**:
```typescript
onRemove={async (id) => {
  try {
    // Call API to delete attachment from backend
    const updatedPlan = await api.removeAttachment(lessonPlan.id, id)
    // Update local state with response from backend
    onChange('attachments', updatedPlan.attachments as never)
  } catch (error) {
    console.error('Failed to remove attachment:', error)
    alert('删除附件失败，请重试')
  }
}}
```

## 修复后的流程

```
用户点击删除按钮
  ↓
onRemove(attachmentId) 被调用
  ↓
✅ 调用 api.removeAttachment(planId, attachmentId)
  ↓
✅ Backend删除数据库中的附件记录
  ↓
✅ Backend返回更新后的LessonPlan
  ↓
✅ 更新本地state (使用backend返回的数据)
  ↓
✅ UI更新，附件消失
  ↓
✅ 刷新页面后，附件仍然不存在 (已从数据库删除)
```

## 测试计划

### 测试环境
- Backend: http://localhost:3002
- Frontend: http://localhost:5280

### 测试步骤

#### 测试 1: 基本删除功能

1. **准备数据**:
   - 创建一个新教案
   - 使用聊天生成并附加一个文件（如"生成音频"）
   - 点击同步按钮添加附件

2. **执行删除**:
   - 找到附件卡片
   - 鼠标悬停，删除按钮应该显示（红色垃圾桶图标）
   - 点击删除按钮

3. **验证结果**:
   - ✅ 附件立即从UI中消失
   - ✅ 刷新页面，附件仍然不存在
   - ✅ 检查Network tab: 看到 `DELETE /api/lesson-plans/{id}/attachments/{attachmentId}` 请求
   - ✅ 检查Console: 没有错误信息

#### 测试 2: 多个附件删除

1. **准备数据**:
   - 创建教案，附加3个不同类型的文件：
     - 音频文件 (.mp3)
     - PPT文件 (.pdf)
     - 讲稿文件 (.md)

2. **执行删除**:
   - 删除中间的附件（PPT）
   - 刷新页面验证
   - 删除剩余的两个附件

3. **验证结果**:
   - ✅ 每次删除都成功
   - ✅ 删除顺序不影响功能
   - ✅ 最终 attachments 数组为空

#### 测试 3: 错误处理

1. **模拟网络错误**:
   - 停止backend服务
   - 尝试删除附件

2. **验证结果**:
   - ✅ 显示错误提示："删除附件失败，请重试"
   - ✅ 附件仍然显示在UI中（因为删除失败）
   - ✅ Console显示错误日志

#### 测试 4: 并发删除

1. **快速连续删除**:
   - 准备多个附件
   - 快速点击多个删除按钮

2. **验证结果**:
   - ✅ 所有删除请求都成功处理
   - ✅ 没有竞态条件导致的问题
   - ✅ 最终状态正确

## 文件变更

### 修改的文件

1. **`frontend/src/utils/api.ts`**
   - 添加 `removeAttachment` 函数 (8 lines)

2. **`frontend/src/components/LessonPlanContent.tsx`**
   - 添加 `import api` (1 line)
   - 修改 `onRemove` 回调 (11 lines)

### 变更统计

```
2 files changed
20 insertions (+)
3 deletions (-)
```

## API验证

### 手动测试API

```bash
# 创建测试教案
curl -X POST http://localhost:3002/api/lesson-plans \
  -H "Content-Type: application/json" \
  -d '{"title": "测试教案"}'

# 获取教案ID (假设返回: lpd_123)
PLAN_ID="lpd_123"

# 添加测试附件
curl -X POST http://localhost:3002/api/lesson-plans/$PLAN_ID/attachments \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: test-session" \
  -d '{
    "fileId": "test-file-1",
    "fileName": "test.pdf",
    "fileType": "pdf",
    "size": 1024,
    "description": "测试附件"
  }'

# 获取附件列表
curl http://localhost:3002/api/lesson-plans/$PLAN_ID/attachments

# 删除附件 (假设attachmentId: att_456)
curl -X DELETE http://localhost:3002/api/lesson-plans/$PLAN_ID/attachments/att_456

# 验证删除
curl http://localhost:3002/api/lesson-plans/$PLAN_ID/attachments
# 应该不包含 att_456
```

## 已知限制

1. **错误提示**: 当前使用 `alert()` 显示错误，用户体验不佳
   - 建议: 实现toast notification组件

2. **删除确认**: 没有删除确认对话框
   - 建议: 添加"确定删除？"确认对话框

3. **加载状态**: 删除过程中没有loading indicator
   - 建议: 在删除按钮上显示loading spinner

## 未来改进

### 优先级: 高

1. **添加删除确认对话框**:
   ```typescript
   const confirmed = window.confirm(`确定删除附件"${attachment.fileName}"吗？此操作不可撤销。`)
   if (!confirmed) return
   ```

2. **改进错误提示**:
   - 使用toast notification组件替代alert
   - 显示具体的错误原因

### 优先级: 中

3. **添加加载状态**:
   ```typescript
   const [deletingId, setDeletingId] = useState<string | null>(null)

   onRemove={async (id) => {
     setDeletingId(id)
     try {
       await api.removeAttachment(...)
     } finally {
       setDeletingId(null)
     }
   }}
   ```

4. **批量删除功能**:
   - 允许选择多个附件
   - 一次性删除多个附件

### 优先级: 低

5. **删除动画**:
   - 添加淡出动画
   - 改善用户体验

6. **撤销功能**:
   - 删除后显示"撤销"按钮
   - 在一定时间内可以恢复

## Commit建议

```bash
git add frontend/src/utils/api.ts
git add frontend/src/components/LessonPlanContent.tsx

git commit -m "fix(lesson-plan-designer): implement attachment deletion

- Add removeAttachment API function to call DELETE endpoint
- Update LessonPlanContent to call API instead of only updating local state
- Add error handling with user-friendly alert message

Problem: Clicking delete button only removed attachment from UI,
but not from database. Page refresh would restore the attachment.

Solution: Call backend DELETE API and update state with response.

Files:
- frontend/src/utils/api.ts: Add removeAttachment function
- frontend/src/components/LessonPlanContent.tsx: Update onRemove callback

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 总结

这是一个典型的**前后端API不同步**导致的bug：
- ✅ Backend实现了完整的CRUD功能
- ❌ Frontend只实现了CRU，缺少Delete

修复方法简单但关键：
1. 添加缺失的API函数
2. 更新组件调用API
3. 确保错误处理

这个bug提醒我们：
- **API契约必须完整** - 前后端要一致实现所有CRUD操作
- **代码审查很重要** - 应该检查API定义是否完整
- **E2E测试能发现** - 完整的用户流程测试会暴露这类问题
