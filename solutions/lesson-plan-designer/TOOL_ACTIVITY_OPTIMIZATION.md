# 工具活动展示优化 - 只显示 Task，折叠子工具

## 实施完成总结

根据用户反馈"只有 task 才应该被展示，其他的普通工具调用已经在调用结束时被用户查看完信息了"，成功优化了工具活动展示逻辑。

## ✅ 已完成的改进

### 1. 类型定义完善
- ✅ `ToolActivityEvent` 已包含 `parentToolUseId` 字段（用于层级跟踪）
- ✅ `ToolActivityEvent` 已包含 `nestingLevel` 字段（0=主代理, 1+=子代理）

### 2. AgentActivityLine 核心功能

**新增辅助函数**：
- `isTopLevelTool()` - 判断是否为顶层工具
- `isTaskTool()` - 判断是否为 Task 工具
- `toggleTaskExpand()` - 切换 Task 展开/收起状态

**新增状态管理**：
- `expandedTasks: Set<string>` - 跟踪每个 Task 的展开状态

**新增过滤逻辑**：
- `childToolsMap` - 构建父工具 → 子工具映射
- `topLevelTasks` - 过滤出顶层 Task 工具

**新增 UI 组件**：
- Task 卡片列表（替代原有的"工具活动"）
- 展开/收起按钮（仅当有子工具时显示）
- 子工具列表（默认折叠）

### 3. 视觉效果

**折叠视图（默认）**：
```
📋 [Task] 生成播客    运行中  ▼
```

**展开视图（点击后）**：
```
📋 [Task] 生成播客    运行中  ▲
├─ 内部工具调用 (2):
│  💻 Bash: notebooklm artifact wait...
│  📄 Read: reading notebook data...
```

## 关键改进对比

| 改进项 | 之前 | 之后 |
|--------|------|------|
| 显示内容 | 所有工具 | 仅顶层 Task |
| 层级关系 | 平铺，无层级 | 清晰的父子关系 |
| 子工具 | 始终显示 | 默认折叠 |
| 信息噪音 | 高 | 低 |

## 过滤逻辑示例

**输入（activeTools）**：
```
task-001: { toolName: 'Task', nestingLevel: 0, parentToolUseId: null }
bash-001: { toolName: 'Bash', nestingLevel: 1, parentToolUseId: 'task-001' }
read-001: { toolName: 'Read', nestingLevel: 1, parentToolUseId: 'task-001' }
grep-001: { toolName: 'Grep', nestingLevel: 0, parentToolUseId: null }
```

**输出**：
- **显示**：`task-001` (Task)
- **不显示**：`grep-001` (非 Task)、`bash-001` (子工具)、`read-001` (子工具)
- **展开后显示**：`bash-001`、`read-001`（Task 的子工具）

## 向后兼容性

代码自动降级处理：
1. 优先使用 `parentToolUseId` 判断层级
2. 如果缺失，回退到 `nestingLevel`
3. 如果都缺失，假设为顶层工具

## 测试验证

### 构建测试
```bash
✅ TypeScript 编译通过
✅ Vite 构建成功
✅ 无错误和警告
```

### 功能测试场景
- ✅ 主代理工具（Grep, Read）不显示
- ✅ Task 工具正确显示
- ✅ Task 展开/收起功能正常
- ✅ 子工具只在展开时显示
- ✅ 多个 Task 独立展开/收起

## 用户体验提升

1. **信息密度降低** - 只显示关键 Task，减少噪音
2. **层级关系清晰** - 父子关系一目了然
3. **按需查看详情** - 默认折叠，点击展开
4. **专注 SubAgent** - 只关注后台任务

## 文件变更

- ✅ `frontend/src/components/AgentActivityLine.tsx` - 核心实现
- ✅ `frontend/src/types/index.ts` - 类型已完善（无需修改）

**代码统计**：约 +150 行代码

## 总结

成功实现用户期望的功能：
- ✅ 只显示 Task 工具
- ✅ 子工具默认折叠
- ✅ 展开查看内部调用
- ✅ 减少信息噪音
- ✅ 向后兼容

用户现在可以清晰地看到哪些 Task 在运行，并在需要时展开查看详情！🎉
