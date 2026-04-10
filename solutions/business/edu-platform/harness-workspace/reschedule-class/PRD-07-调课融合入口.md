# PRD-07：调课功能 · Chat 融合入口接入

> 教师通过 Chat 融合入口完成调课操作：结构化表单处理简单场景，自然语言 Chat 处理复杂/模糊场景，两种入口互通。

---

## 1. 背景

调课是教师日常高频操作（每周约 3-5% 的教师需要调课）。当前教务系统的调课流程是独立页面 + 纯表单，教师需要自己查课表、找空闲时段、联系对方教师确认、再填写申请。

**痛点：**
- 查空闲时段 + 检查冲突 + 联系对方 = 至少 15 分钟
- 复杂场景（批量调整、连续冲突）表单无法表达
- 调课后的教学衔接（调整教案时间线、通知学生）是断裂的

**机会：** 接入 Chat 融合入口后，AI 可以代替教师完成"查 + 找 + 检查 + 推荐"，教师只需确认方案并提交。

---

## 2. 调课子场景

| 子场景 | 说明 | 频率 | 表单适合？ | Chat 适合？ |
|--------|------|------|-----------|-----------|
| 互换 | 和某教师交换课时 | 高 | ✓ 两人+两时段，字段明确 | ✓ |
| 改时 | 某节课移到另一时段 | 高 | ✓ 源+目标 | ✓ |
| 代课 | 找人替课 | 中 | △ 需要匹配，表单不够灵活 | ✓✓ |
| 补课 | 缺课找时间补 | 中 | △ 需要搜索全班空闲 | ✓✓ |
| 批量调整 | 因活动调整多节课 | 低 | ✗ 表单无法表达 | ✓✓✓ |

**结论：** 互换/改时用表单快，代课/补课/批量用 Chat 好。两种入口必须互通。

---

## 3. 用户角色与权限

| 角色 | 能做什么 | 审批权 |
|------|---------|--------|
| 教师 | 提交调课申请（自己的课） | 无 |
| 备课组长 | 提交 + 组内代课指派 | 组内代课免审批 |
| 教务主任 | 提交 + 审批 + 直接执行 | 全部 |
| 校长 | 查看 + 审批 | 全部 |

---

## 4. 外部依赖（教务系统 MCP）

调课功能不直接操作数据库——所有操作通过教务系统的 MCP 完成。

```typescript
// 教务系统提供的 MCP tools
interface TimetableMcp {
  // 查询
  'timetable:query-schedule': {
    input: { teacherId?: string; classId?: string; week: number };
    output: ScheduleEntry[];
  };
  'timetable:find-available-slots': {
    input: { 
      week: number; 
      subject?: string;              // 限定学科（代课时需要）
      excludeTeacherId?: string;     // 排除某教师
      classIds?: string[];           // 限定班级（补课时需要全班空闲）
      preferredDays?: number[];      // 偏好星期几
    };
    output: AvailableSlot[];         // 含教师信息、教室信息、冲突提示
  };
  'timetable:check-conflicts': {
    input: { changes: ScheduleChange[] };
    output: ConflictReport;          // 冲突列表 + 严重程度
  };

  // 操作
  'timetable:submit-request': {
    input: { 
      type: 'swap' | 'reschedule' | 'substitute' | 'makeup' | 'batch';
      changes: ScheduleChange[];
      reason: string;
      note?: string;
    };
    output: { requestId: string; status: 'pending' | 'auto_approved'; approver?: string };
  };
  'timetable:list-my-requests': {
    input: { status?: string };
    output: RescheduleRequest[];
  };

  // 教师信息
  'timetable:find-substitute-teachers': {
    input: { subject: string; slot: TimeSlot; excludeTeacherId: string };
    output: SubstituteCandidate[];   // 含匹配度、空闲状态、历史代课次数
  };
}

interface ScheduleEntry {
  day: number;                       // 1-5
  period: number;                    // 1-8
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
  targetTeacherId: string;           // 互换时是对方教师，代课时是代课教师
  classId: string;
}

interface AvailableSlot {
  day: number;
  period: number;
  room: string;
  teacherName?: string;
  teacherId?: string;
  conflictLevel: 'none' | 'soft' | 'hard';
  conflictNote?: string;            // "八(2)班该时段已有2节数学"
}
```

---

## 5. 融合入口设计

### 5.1 工具栏入口

```
Chat 输入框
┌──────────────────────────────────────────┐
│ [📝 教案] [📋 作业] [📅 调课] [📊 学情] [@ 引用] │
├──────────────────────────────────────────┤
│ [输入消息...]                             │
└──────────────────────────────────────────┘
```

点击 `📅 调课`：

- **备课助手 / 课堂执行助手 session** → 弹出结构化调课表单
- **通用 Chat session** → 输入框预填"我想调课，"并聚焦，等教师补充描述

### 5.2 结构化表单流程

```
点击 📅 调课
  → 弹出调课面板（半屏，从底部滑上）
  → 选择调课类型 tab（互换 / 改时 / 代课 / 补课）
  → 填写必填字段
  → 实时冲突检查（每个字段变更时调 timetable:check-conflicts）
  → 系统推荐（AI 根据约束条件推荐最优方案）
  → 提交申请

特殊交互：
  - 选择"原课时"后，自动调 timetable:find-available-slots 填充推荐
  - 选择"代课"类型后，自动调 timetable:find-substitute-teachers
  - 任何时刻可以点"💬 改用自然语言描述" → 关闭表单 → 切换到 Chat
    （已填写的字段作为上下文注入 Chat）
```

### 5.3 Chat 自然语言流程

```
教师输入自然语言描述
  → AI 解析调课意图（类型 + 涉及课时 + 约束条件）
  → AI 调 MCP 查询课表 + 搜索可用方案
  → AI 给出 1-3 个推荐方案（结构化卡片）
  → 教师选择或调整
  → AI 调 timetable:check-conflicts 最终确认
  → 弹出确认卡片（结构化，不是纯文本）
  → 教师点 [提交申请]
  → AI 调 timetable:submit-request
  → 显示提交结果（申请号 + 审批状态）
```

### 5.4 两种入口的互通

**表单 → Chat：**

```
教师在表单中填了：
  类型=代课，原课时=周三第5节，原因=教研活动
  但找不到合适的代课教师

点击 "💬 改用自然语言描述"
  → 表单关闭
  → Chat 输入框预填：
    "我需要调课：周三第5节数学课（八(2)班）因为教研活动。
    表单里没找到合适的代课老师，帮我想其他方案？"
  → AI 接手，扩大搜索范围（如跨年级找代课、改为补课等）
```

**Chat → 确认卡片：**

```
AI 在 Chat 中推荐方案后，不是直接文字提交
而是弹出结构化确认卡片：

┌─────────────────────────────────────┐
│ 📅 调课确认                          │
├─────────────────────────────────────┤
│ 类型    互换                         │
│                                     │
│ 变更 1:                              │
│ 📕 数学 八(2)班                      │
│ 周三 第5节 → 周四 第5节              │
│ 和王老师（物理）互换                  │
│ ✓ 无冲突                            │
│                                     │
│ 变更 2:                              │
│ 📕 数学 八(3)班                      │
│ 周三 第6节 → 周五 第2节              │
│ 和张老师（英语）互换                  │
│ ✓ 无冲突                            │
│                                     │
│ 原因    教研活动                      │
│ 审批    需要教务处审批                 │
│                                     │
│ [取消]          [提交调课申请]        │
└─────────────────────────────────────┘
```

### 5.5 调课申请作为 @Referenceable 实体

调课申请提交后，成为一个可 @ 引用的实体：

```
@Referenceable({
  type: 'reschedule_request',
  displayName: '调课申请',
  icon: '📅',
  abilities: {
    search: true,          // 搜索调课申请
    browse: true,          // 按状态/时间浏览
    resolve: true,         // 获取申请详情
    track: true,           // 追踪状态变化
  },
  contextFields: ['type', 'changes', 'status', 'reason', 'approver', 'result'],
})
```

使用场景：
```
教师："@ 调课申请#001 这个调课批了吗？"
教师："@ 调课申请#001 调课后帮我调整教案的时间线"
管理员："本周所有调课申请的统计？"
```

---

## 6. 详细交互规格

### 6.1 结构化表单 — 互换

```
选择类型 tab → [互换]

┌─ 原课时 ─────────────────────────────┐
│ 日期  [本周 ▾] [周三 ▾]               │
│ 节次  [第5节 ▾] (14:00-14:45)        │
│ 课程  📕 数学 · 八(2)班  [自动填充]    │
└──────────────────────────────────────┘
         ⇅
┌─ 互换对象 ────────────────────────────┐
│ 教师  [🔍 搜索教师...]                │
│       💡 推荐：李老师(数学) 周四第3节空闲│
│       💡 推荐：王老师(物理) 周四第5节空闲│
│                                      │
│ 选择：[王老师 · 物理 · 周四第5节 ✓]    │
│                                      │
│ 冲突检查                              │
│ ✓ 教室可用                            │
│ ✓ 班级无冲突                          │
│ ⚠️ 八(2)班周四已有1节数学（调后将有2节）│
└──────────────────────────────────────┘

原因  [教研活动 ▾]
备注  [选填]

[💬 改用自然语言]           [提交申请]
```

### 6.2 结构化表单 — 代课

```
选择类型 tab → [代课]

┌─ 需要代课的课 ────────────────────────┐
│ 日期  [下周 ▾] [周三 ▾]               │
│ 节次  [第5节 ▾] ~ [第6节 ▾] (可多选)  │
│ 课程  📕 数学 · 八(2)班               │
│       📕 数学 · 八(3)班               │
└──────────────────────────────────────┘

┌─ 代课教师 ────────────────────────────┐
│ AI 推荐：                             │
│ ┌──────────────────────────────────┐ │
│ │ 刘老师（数学组）                    │ │
│ │ ✓ 同学科  ✓ 两节都空闲             │ │
│ │ 📊 历史代课 3 次 · 平均评价 4.5     │ │
│ │                        [选择]     │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 陈老师（数学组）                    │ │
│ │ ✓ 同学科  ⚠️ 仅第5节空闲           │ │
│ │ 📊 历史代课 1 次                   │ │
│ │                        [选择]     │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [🔍 搜索其他教师]                     │
└──────────────────────────────────────┘

原因  [请假 ▾]
备注  [选填：教学进度备注，方便代课教师了解]

[💬 改用自然语言]           [提交申请]
```

### 6.3 Chat 自然语言 — 复杂场景

```
👤 "下周三下午有区级教研，第5-8节都不能上课，
    涉及八(2)(3)(4)三个班的数学课，帮我安排一下"

🤖 这是一个批量调课，我来帮你处理。先查一下情况：

   下周三下午你的课表：
   · 第5节  数学 八(2)班
   · 第6节  数学 八(3)班
   · 第7节  自习（无课）
   · 第8节  数学 八(4)班

   需要调整 3 节课。我来找方案：

   ━━━ 方案汇总 ━━━

   📕 八(2)班 第5节
   → 建议：和王老师互换到周四第5节
   ✓ 王老师空闲 ✓ 教室可用 ✓ 八(2)班无冲突

   📕 八(3)班 第6节
   → 建议：刘老师代课（同学科，该时段空闲）
   ✓ 刘老师上周代过八(3)，熟悉进度

   📕 八(4)班 第8节
   → 建议：补课到周五第7节（课外活动时段）
   ✓ 八(4)班空闲 ⚠️ 需要学生和家长同意

   每个方案的方式不同（互换/代课/补课），
   因为约束条件不一样。要调整哪个？

👤 "八(4)班补课不太好，能不能也找人代课？"

🤖 我查了一下，第8节能代八(4)班数学课的老师：
   · 刘老师 — ⚠️ 第8节有课（已经代八(3)班第6节了，第8节不空闲）
   · 张老师（数学组）— ✓ 第8节空闲，但她没教过八(4)班
   · 赵老师（数学组）— ✓ 第8节空闲，上学期教过八(4)班

   建议赵老师，她熟悉八(4)班。要改成赵老师代课吗？

👤 "好，就这样"

🤖 [弹出确认卡片，见 §5.4]
```

### 6.4 调课后的联动

调课申请批准后，系统自动触发：

```
调课批准
  ├─ 通知相关教师（互换对象 / 代课教师）
  ├─ 通知相关班级学生（如有时间变化）
  │
  └─ AI 主动建议（通过 Chat 推送）：
     "📅 调课已批准。以下事项可能需要处理：
      · 八(2)班的教案时间线需要调整（SAS判定原计划周三讲，现在改到周四）
      · 代课教师刘老师可能需要教学进度说明
      · [调整教案时间线]  [给刘老师写进度说明]"

     点击 [调整教案时间线]
       → 自动 @ 引用对应教案 + 调课申请
       → AI 理解上下文，帮助调整
```

---

## 7. Session Template 配置

```typescript
// 调课相关的 session template 配置
const classroomAssistantTemplate = {
  // ... 已有配置
  
  // 调课工具栏入口
  toolbarShortcuts: [
    // ... 已有的 📝教案 📋作业 等
    {
      id: 'reschedule',
      icon: '📅',
      label: '调课',
      action: 'open_form',           // 点击弹表单
      formType: 'reschedule',
      fallbackAction: 'prefill_chat', // 表单不适用时切到 Chat
    },
  ],

  // 调课相关的 MCP tools
  mcpTools: [
    // ... 已有的课标、题库等
    'timetable:query-schedule',
    'timetable:find-available-slots',
    'timetable:check-conflicts',
    'timetable:submit-request',
    'timetable:find-substitute-teachers',
    'timetable:list-my-requests',
  ],
};
```

---

## 8. 数据模型

### 8.1 调课申请（Solution 侧，非教务系统）

我们的 Solution 存储调课申请的摘要信息（用于 @ 引用和 Chat 上下文），详细数据在教务系统中。

```typescript
interface RescheduleRequest {
  id: string;
  type: 'swap' | 'reschedule' | 'substitute' | 'makeup' | 'batch';
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled';
  
  // 发起人
  requesterId: string;
  requesterName: string;
  
  // 变更列表
  changes: {
    originalDay: number;
    originalPeriod: number;
    subject: string;
    className: string;
    targetDay: number;
    targetPeriod: number;
    targetTeacherName?: string;     // 互换/代课时的对方教师
    conflictLevel: 'none' | 'soft' | 'hard';
    conflictNote?: string;
  }[];
  
  // 原因和备注
  reason: string;
  note?: string;
  
  // 审批
  approverName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  
  // 来源
  source: 'form' | 'chat';         // 从哪种入口提交的
  sessionId?: string;               // 如果从 Chat 提交，关联 session
  
  // 联动
  relatedLessonPlanIds?: string[];  // 涉及的教案（调课后可能需要调整）
  
  createdAt: string;
  updatedAt: string;
}
```

### 8.2 调课申请确认卡片（Chat 中的结构化输出）

AI 在 Chat 中推荐方案后，通过 OutputSchema 渲染确认卡片：

```typescript
const rescheduleConfirmSchema: OutputSchema = {
  id: 'reschedule-confirm',
  name: '调课确认',
  fields: [
    { key: 'type', type: 'string', required: true },
    { key: 'changes', type: 'array', required: true },
    { key: 'reason', type: 'string', required: true },
    { key: 'conflicts', type: 'array', required: false },
    { key: 'approvalRequired', type: 'boolean', required: true },
  ],
  displayConfig: {
    layout: 'card',
    actions: [
      { label: '提交调课申请', action: 'submit_reschedule', style: 'primary' },
      { label: '再调整', action: 'revise', style: 'secondary' },
    ],
  },
};
```

---

## 9. 边界与约束

**本 PRD 不包含：**
- 教务系统的排课算法实现（MCP 的事）
- 审批流的 UI 设计（教务系统已有）
- 学生/家长端的通知 UI
- 课表展示页面的重新设计

**本 PRD 包含：**
- Chat 融合入口中调课的触发、交互、互通
- 结构化表单的字段和交互逻辑
- Chat 自然语言调课的 AI 交互流程
- 确认卡片的设计
- 调课申请作为 @Referenceable 实体
- 调课后的教学联动建议

**技术约束：**
- 所有调课操作通过教务 MCP 完成，Solution 不直接操作课表数据
- 冲突检查必须在提交前完成（调 MCP 实时检查）
- 确认卡片在 Chat 中必须是结构化组件，不能是纯文本
