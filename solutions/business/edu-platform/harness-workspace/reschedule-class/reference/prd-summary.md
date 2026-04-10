# 调课功能 PRD 摘要

> 完整 PRD 见 `harness-workspace/reschedule-class/PRD-07-调课融合入口.md`

## 4 种调课类型

| 类型 | 说明 | 频率 |
|------|------|------|
| 互换 (swap) | 和另一位教师交换课时 | 高 |
| 改时 (reschedule) | 将某节课移到另一时段 | 高 |
| 代课 (substitute) | 找人替课 | 中 |
| 补课 (makeup) | 缺课后找时间补 | 中 |

## 6 个 MCP 工具接口

### timetable_query_schedule
```typescript
input: { teacherId?: string; classId?: string; week: number }
output: ScheduleEntry[]
```

### timetable_find_available_slots
```typescript
input: {
  week: number;
  subject?: string;
  excludeTeacherId?: string;
  classIds?: string[];
  preferredDays?: number[];
}
output: AvailableSlot[]
```

### timetable_check_conflicts
```typescript
input: { changes: ScheduleChange[] }
output: ConflictReport  // conflicts[] + severity: none/soft/hard
```

### timetable_submit_request
```typescript
input: {
  type: 'swap' | 'reschedule' | 'substitute' | 'makeup' | 'batch';
  changes: ScheduleChange[];
  reason: string;
  note?: string;
}
output: { requestId: string; status: 'pending' | 'auto_approved'; approver?: string }
```

### timetable_list_my_requests
```typescript
input: { status?: string }
output: RescheduleRequest[]
```

### timetable_find_substitute_teachers
```typescript
input: { subject: string; slot: TimeSlot; excludeTeacherId: string }
output: SubstituteCandidate[]  // 含匹配度、空闲状态、历史代课次数
```

## 数据结构

```typescript
interface ScheduleEntry {
  day: number;          // 1-5 (周一到周五)
  period: number;       // 1-8
  subject: string;
  className: string;
  classId: string;
  room: string;
  teacherId: string;
  teacherName: string;
}

interface ScheduleChange {
  originalDay: number;
  originalPeriod: number;
  originalTeacherId: string;
  targetDay: number;
  targetPeriod: number;
  targetTeacherId: string;
  classId: string;
}

interface AvailableSlot {
  day: number;
  period: number;
  room: string;
  teacherName?: string;
  teacherId?: string;
  conflictLevel: 'none' | 'soft' | 'hard';
  conflictNote?: string;
}

interface SubstituteCandidate {
  teacherId: string;
  teacherName: string;
  subject: string;
  availableSlots: number;     // 该时段空闲节数
  totalSlots: number;         // 需要代课的节数
  historyCount: number;       // 历史代课次数
  taughtThisClass: boolean;   // 是否教过该班
  matchScore: number;         // 0-100 匹配度
}
```

## 交互模式

### Chat 自然语言流程
```
教师描述需求
  → AI 解析意图（类型 + 课时 + 约束）
  → AI 调 MCP 查课表 + 搜索方案
  → AI 给出 1-3 个推荐（用 show_info_card 展示）
  → 教师选择或调整（用 suggest_actions 按钮）
  → AI 调 check_conflicts 最终确认
  → 展示确认摘要 → 教师确认
  → AI 调 submit_request 提交
  → 展示结果（申请号 + 状态）+ 后续操作建议
```

### show_info_card 使用方式

**方案推荐卡片：**
```json
{
  "title": "调课方案推荐",
  "badge": "互换",
  "sections": [
    {
      "type": "metrics",
      "items": [
        { "label": "方案数", "value": "3", "suffix": "个" },
        { "label": "无冲突", "value": "2", "suffix": "个" }
      ]
    },
    {
      "type": "text",
      "content": "**方案1**: 和王老师（物理）互换到周四第5节 ✓ 无冲突\n**方案2**: 和李老师（数学）互换到周五第3节 ⚠️ 八(2)班当天已有2节数学"
    },
    {
      "type": "actions",
      "actions": [
        { "label": "选择方案1", "prompt": "用方案1" },
        { "label": "选择方案2", "prompt": "用方案2" }
      ]
    }
  ]
}
```

**提交结果卡片：**
```json
{
  "title": "调课申请已提交",
  "badge": "待审批",
  "sections": [
    {
      "type": "metrics",
      "items": [
        { "label": "申请号", "value": "#2025-0418-001" },
        { "label": "审批人", "value": "李主任" }
      ]
    },
    {
      "type": "text",
      "content": "您的调课申请已提交，等待教务处审批。通常 1 个工作日内处理。"
    }
  ]
}
```

## Mock 数据建议

**教师数据（≥5人）：**

| teacherId | 姓名 | 学科 | 任教班级 |
|-----------|------|------|---------|
| t-zhang | 张老师 | 数学 | 八(2)班、八(3)班 |
| t-wang | 王老师 | 物理 | 八(1)班、八(2)班 |
| t-li | 李老师 | 数学 | 八(1)班、八(4)班 |
| t-liu | 刘老师 | 数学 | 八(3)班、八(4)班 |
| t-chen | 陈老师 | 英语 | 八(1)班、八(2)班 |
| t-zhao | 赵老师 | 数学 | 七(1)班、七(2)班 |
| t-sun | 孙老师 | 语文 | 八(2)班、八(3)班 |

**课表时间段：**
- 第1-4节：上午（8:00-11:30）
- 第5-8节：下午（14:00-16:50）
- 第7节通常是自习或课外活动

## 用户角色

| 角色 | 能做什么 |
|------|---------|
| 教师 | 提交调课申请（自己的课） |
| 备课组长 | 提交 + 组内代课指派（免审批） |
| 教务主任 | 提交 + 审批 + 直接执行 |
