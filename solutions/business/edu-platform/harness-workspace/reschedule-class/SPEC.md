# SPEC: Reschedule-Class Skill + Dynamic Mock MCP

## Goal

为 edu-platform 实现调课（reschedule）功能的 **Skill 层** 和 **动态 Mock MCP 工具层**：
- 新建 `skills/reschedule-class/SKILL.md` — 调课助手 Skill prompt（可直接上线水准）
- 扩展 `mcp-server/src/index.ts` — 添加 6 个动态 mock timetable MCP 工具（基于共享课表数据推算）
- 更新 `solution.json` — 注册新 Skill

## Scope

| 包含 | 不包含 |
|------|--------|
| SKILL.md prompt 设计（含完整决策树） | 前端 UI 组件（表单/卡片） |
| 6 个动态 mock timetable tools | 后端 RescheduleRequest 实体 |
| solution.json 配置更新 | 审批流/通知系统 |
| 共享课表数据模型 + 推算逻辑 | 外部教务系统对接 |
| | Context Layer @Referenceable 注册 |

## Work Items

### W1: 共享课表数据模型 (→ D2)

在 `mcp-server/src/index.ts` 中创建统一的课表数据结构，所有 6 个 timetable 工具从这里读取和推算：

```typescript
// 统一数据源（非 mock 工具各自硬编码）
const TEACHERS: Teacher[] = [...];           // ≥5 教师，含 teacherId/name/subject
const SCHEDULE: ScheduleEntry[] = [...];     // 完整周课表 (5天 × 8节)
const SUBMITTED_REQUESTS: Request[] = [...]; // 模拟已有的调课申请
```

**关键要求：**
- ≥5 个教师（数学组 2-3 人、物理/英语/语文各 1 人）
- 周一到周五每天 8 节，有教室分配
- 数据中内置 soft 冲突（同班同日 2 节数学）和 hard 冲突（教室被活动占用）条件

### W2: 6 个动态 Mock Timetable Tools (→ D2)

| Tool | 推算逻辑 |
|------|---------|
| `timetable_query_schedule` | 按 teacherId/classId/week 过滤 `SCHEDULE` |
| `timetable_find_available_slots` | 遍历 `SCHEDULE` 排除已占用时段 → 计算空闲 |
| `timetable_check_conflicts` | 交叉查询 `SCHEDULE` 判断 none/soft/hard |
| `timetable_submit_request` | 写入 `SUBMITTED_REQUESTS` + 返回 requestId |
| `timetable_list_my_requests` | 按 teacherId 过滤 `SUBMITTED_REQUESTS` |
| `timetable_find_substitute_teachers` | 计算 matchScore = f(学科匹配, 教过该班, 空闲时段数) |

**动态推算 vs 硬编码：**
- `find_available_slots` 必须通过排除 `query_schedule` 已占用时段得出，不能独立硬编码
- `check_conflicts` 必须读取 `SCHEDULE` 数据判断冲突级别
- `find_substitute_teachers` 的 matchScore 必须有计算公式（不是随机数）

### W3: Reschedule Skill Prompt (→ D1, D3)

创建 `skills/reschedule-class/SKILL.md`，遵循 lesson-plan-generator 的结构模式。

**核心结构：**

1. **角色定义**：调课助手，帮助教师高效安全地完成调课

2. **意图解析决策树**（D1 核心）：
   ```
   教师输入
     ├── 明确类型 → 直接进入对应流程
     │   ├── "换课/互换/交换" → swap 流程
     │   ├── "代课/找人/请假" → substitute 流程
     │   ├── "改时/换时间/移到" → reschedule 流程
     │   └── "补课/补上" → makeup 流程
     ├── 模糊描述 → 先查课表，分析受影响课时，再推荐方案
     │   └── "有事/想想办法/帮我安排" → query_schedule → 逐课分析
     └── 查询类 → 直接查询
         └── "申请/状态/批了吗" → list_my_requests
   ```

3. **4 种调课类型的完整工作流**（每种包含 MCP 调用序列）

4. **确认门控**（D3 核心）：
   - 提交前必须 show_info_card 展示变更摘要
   - 必须 suggest_actions [确认提交] [修改方案] [取消]
   - SKILL.md 中明确写：**"在用户选择确认之前，禁止调用 timetable_submit_request"**

5. **工具使用表**：8 个工具（6 timetable + show_info_card + suggest_actions）

### W4: Solution Configuration (→ D5)

更新 `solution.json`：
- `skills` 数组添加 `{ "slug": "reschedule-class", "name": "reschedule-class" }`
- `sessionTemplates.lesson-planning.enabledSkills` 添加 `"reschedule-class"`

### W5: 交互场景示例 (→ D1, D3)

SKILL.md 中必须包含以下场景的完整交互示例：

**场景 A：简单互换**
```
"帮我把周三第5节和王老师换一下"
→ query_schedule → check_conflicts → show_info_card(方案) → suggest_actions(确认) → submit_request
```

**场景 B：代课 + 教师推荐**
```
"下周三第5-6节我请假，找人代课"
→ query_schedule → find_substitute_teachers → show_info_card(候选排名) → suggest_actions(选择) → check_conflicts → submit_request
```

**场景 C：模糊描述**
```
"下周三下午有事，课帮我想想办法"
→ query_schedule(查下午所有课) → 逐课分析最佳方案 → show_info_card(组合方案) → confirm → submit
```

**场景 D：状态查询**
```
"我的调课申请批了吗？"
→ list_my_requests → show_info_card(申请列表+状态)
```

**场景 E：无可用时段（异常）**
```
所有时段已满 → 降级建议（跨周/减少条件/联系教务处）
```

**场景 F：硬冲突阻止（异常）**
```
方案有 hard 冲突 → 阻止提交 + 说明原因 + 展示替代方案
```

### W6: show_info_card JSON 示例 (→ D4)

SKILL.md 中包含 ≥3 个 show_info_card JSON 示例：
1. 方案推荐卡片（metrics + text + actions）
2. 提交结果卡片（metrics + text）
3. 申请状态卡片（metrics + text + actions）

所有示例只使用 5 种允许的 section type，JSON 可解析。

## Frozen Constraints

**不可修改：**
- `solutions/business/edu-platform/backend/` — 整个后端冻结
- `solutions/business/edu-platform/frontend/` — 整个前端冻结
- `packages/` — 所有核心包冻结
- `mcp-server/src/index.ts` 中已有工具的定义和 handler 不可修改（只能添加新工具）

**必须遵守：**
- show_info_card 只允许 5 种 section type: outline, bar_list, metrics, actions, text
- 工具名在 SKILL.md 和 mcp-server 中完全一致
- solution.json 保持合法 JSON
- SKILL.md 中 JSON 示例可解析
- 提交前必须确认

## Modifiable Files

| 文件 | 操作 | 预期变更 |
|------|------|----------|
| `skills/reschedule-class/SKILL.md` | NEW | 调课助手 Skill prompt（含决策树 + 确认门控） |
| `mcp-server/src/index.ts` | MODIFY | 共享课表数据 + 6 个动态 timetable tools |
| `solution.json` | MODIFY | skill 注册 + session template 更新 |
