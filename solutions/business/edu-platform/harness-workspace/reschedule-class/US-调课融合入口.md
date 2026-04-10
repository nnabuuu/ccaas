# 调课功能 · 用户故事

> 模块：教学执行 / Chat 融合入口
> 关联 PRD：PRD-07 调课融合入口

---

## Story 1：工具栏触发结构化表单

**As a** 教师
**I want to** 在 Chat 工具栏点击"📅 调课"弹出结构化调课表单
**so that** 简单的调课场景（互换/改时）不需要打字描述，直接选择即可

**Acceptance Criteria:**

```
Scenario 1a: 点击工具栏弹出表单
Given: 教师在备课助手 / 课堂执行助手 session 中
When: 点击工具栏的"📅 调课" pill
Then: 从底部滑出调课面板，显示 4 个 tab（互换 / 代课 / 改时 / 补课），默认选中"互换"

Scenario 1b: 通用 session 中点击
Given: 教师在通用 Chat session 中（非备课/课堂助手）
When: 点击工具栏的"📅 调课" pill
Then: 输入框预填"我想调课，"并聚焦光标，等待教师补充描述
```

**业务规则：**
- 工具栏的"📅 调课"pill 仅在 session template 配置了 timetable MCP tools 时显示
- 面板弹出时不关闭当前 Chat 对话，叠在上层

---

## Story 2：互换类型 — 选择原课时

**As a** 教师
**I want to** 选择我要调换的原课时后，系统自动显示我这节课的详细信息
**so that** 我确认选对了课，不会调错

**Acceptance Criteria:**

```
Scenario 2a: 选择原课时
Given: 调课面板已打开，类型 = 互换
When: 教师选择 周/日/节次（如 下周 · 周三 · 第5节）
Then: 下方自动显示该课时的详情卡片（课程名 · 班级 · 教室 · 时间段）
And: 数据来源为 timetable:query-schedule MCP 调用

Scenario 2b: 该时段无课
Given: 调课面板已打开
When: 教师选择的时段没有课
Then: 显示"该时段无课"提示，提交按钮置灰
```

---

## Story 3：互换类型 — AI 推荐互换对象

**As a** 教师
**I want to** 选完原课时后系统自动推荐可互换的教师和时段
**so that** 我不需要自己逐个联系教师问是否有空

**Acceptance Criteria:**

```
Scenario 3a: 显示推荐列表
Given: 教师已选择原课时（周三第5节 · 数学 · 八(2)班）
When: 原课时选择完成
Then: 系统调 timetable:find-available-slots 获取推荐
And: 显示最多 5 个推荐卡片，每个含：教师名 · 学科 · 可互换时段 · 冲突检查标签

Scenario 3b: 冲突标签
Given: 推荐列表已显示
When: 某个推荐有 soft 级别冲突（如"八(2)班该日已有2节数学"）
Then: 该推荐卡片显示黄色 ⚠️ 标签 + 冲突说明
And: 仍可选择（soft 冲突不阻塞）

Scenario 3c: 无可用推荐
Given: 教师选择的原课时在本周内找不到可互换时段
When: timetable:find-available-slots 返回空
Then: 显示"当前周无可用互换时段"
And: 提示"试试代课或补课？" + "💬 用自然语言描述，让 AI 帮你想更多方案"
```

---

## Story 4：互换类型 — 提交申请

**As a** 教师
**I want to** 选择推荐方案 + 填写原因后提交调课申请
**so that** 申请进入审批流程

**Acceptance Criteria:**

```
Scenario 4a: 正常提交
Given: 教师已选择互换对象 + 填写原因
When: 点击"提交申请"
Then: 调 timetable:check-conflicts 做最终冲突检查
And: 无 hard 冲突 → 调 timetable:submit-request 提交
And: 显示提交成功提示（申请号 + 审批人 + 预计处理时间）
And: 面板关闭，Chat 中插入一条状态卡片

Scenario 4b: 提交时发现 hard 冲突
Given: 教师选择了一个推荐方案
When: 最终冲突检查发现 hard 冲突（如教室被其他活动占用）
Then: 阻止提交
And: 显示冲突详情 + "该时段已被占用，请选择其他方案"
```

---

## Story 5：代课类型 — AI 推荐代课教师

**As a** 教师
**I want to** 选择需要代课的课时后，系统推荐可代课的同学科教师
**so that** 我能快速找到合适的代课人选

**Acceptance Criteria:**

```
Scenario 5a: 推荐代课教师
Given: 教师选择了代课类型 + 选中 1-2 节需要代课的课
When: 课时选择完成
Then: 调 timetable:find-substitute-teachers 获取推荐
And: 每个推荐显示：教师名 · 学科匹配 · 空闲状态 · 历史代课次数 · 平均评价
And: 按匹配度排序（同学科 + 全部时段空闲 + 教过该班 排最前）

Scenario 5b: 多节课代课教师匹配
Given: 教师选择了 2 节连续课需要代课
When: 推荐列表显示
Then: 标注哪些教师两节都空闲 vs 仅部分空闲
And: 两节都空闲的排在前面
```

---

## Story 6：代课类型 — 教学进度备注

**As a** 教师
**I want to** 在代课申请中附上教学进度备注
**so that** 代课教师知道讲到哪里了，不会重复或跳过内容

**Acceptance Criteria:**

```
Scenario 6a: 填写进度备注
Given: 教师已选择代课教师
When: 在"教学进度备注"字段输入内容
Then: 备注随申请一起提交
And: 代课教师收到通知时可以看到这段备注

Scenario 6b: AI 辅助生成进度备注
Given: 教师的教案已关联在系统中
When: 教师点击"AI 帮我写进度说明"
Then: AI 根据教案内容 + 最近课堂记录自动生成进度摘要
And: 教师可以编辑后确认
```

---

## Story 7：表单切换到 Chat

**As a** 教师
**I want to** 在表单中遇到复杂情况时切换到 Chat 自然语言模式
**so that** 不被表单字段限制，可以自由描述我的需求

**Acceptance Criteria:**

```
Scenario 7a: 带上下文切换
Given: 教师在代课表单中已填了原课时（周三第5节）和原因（教研活动）
When: 点击"💬 改用自然语言"
Then: 表单关闭
And: Chat 输入框预填："我需要调课：周三第5节数学课（八(2)班）因为教研活动。帮我想方案？"
And: 光标在预填文本末尾，教师可以补充

Scenario 7b: 空表单切换
Given: 教师刚打开表单，还没填任何字段
When: 点击"💬 改用自然语言"
Then: 表单关闭
And: Chat 输入框预填"我想调课，"并聚焦
```

---

## Story 8：Chat 自然语言 — AI 解析调课意图

**As a** 教师
**I want to** 用自然语言描述调课需求，AI 自动理解并查询方案
**so that** 复杂场景（批量调整、模糊需求）不需要我自己查课表

**Acceptance Criteria:**

```
Scenario 8a: 简单描述
Given: 教师在 Chat 中
When: 输入"帮我把周三第5节和李老师换一下"
Then: AI 解析出 类型=互换，原课时=周三第5节，目标教师=李老师
And: AI 调 MCP 查询双方课表 + 检查冲突
And: 给出结果（可行 / 有冲突 + 替代方案）

Scenario 8b: 模糊描述
Given: 教师在 Chat 中
When: 输入"下周三下午有事，课帮我想想办法"
Then: AI 调 timetable:query-schedule 查询下周三下午的课表
And: 列出所有受影响的课
And: 针对每节课分别推荐方案（可能是互换/代课/补课的组合）

Scenario 8c: 批量描述
Given: 教师在 Chat 中
When: 输入"下周三下午有区级教研，第5-8节都不能上课，涉及三个班"
Then: AI 识别为批量调课
And: 查询所有受影响课时
And: 给出一套组合方案（尽量不同方式避免资源冲突）
```

---

## Story 9：Chat 中的方案推荐卡片

**As a** 教师
**I want to** 在 Chat 中看到结构化的方案推荐（不是纯文本）
**so that** 我能清楚地看到每个方案的冲突情况和差异

**Acceptance Criteria:**

```
Scenario 9a: 方案卡片展示
Given: AI 找到了 2-3 个可行方案
When: AI 回复推荐
Then: 每个方案以结构化卡片展示，含：变更详情 + 冲突检查标签（✓/⚠️）+ 一句话说明
And: 教师可以直接选择某个方案

Scenario 9b: 教师要求调整
Given: AI 展示了方案
When: 教师回复"方案2不行，八(4)班补课不好"
Then: AI 理解约束，重新搜索
And: 给出修改后的方案
```

---

## Story 10：确认卡片 + 提交

**As a** 教师
**I want to** 在 Chat 中确认最终方案时看到结构化的确认卡片
**so that** 我能在提交前清楚看到所有变更 + 冲突情况 + 审批信息

**Acceptance Criteria:**

```
Scenario 10a: 确认卡片
Given: 教师在 Chat 中选定了最终方案
When: AI 弹出确认卡片
Then: 卡片显示：所有变更列表（每条含课程/班级/原时段/目标时段/对方教师/冲突状态）+ 原因 + 审批提示
And: 卡片有 [提交调课申请] 和 [再调整] 两个按钮

Scenario 10b: 点击提交
Given: 确认卡片已显示
When: 教师点击 [提交调课申请]
Then: 调 timetable:submit-request 提交
And: 卡片变为不可编辑状态，显示"已提交"
And: 下方插入状态卡片（申请号 + 审批人 + 状态）

Scenario 10c: 点击再调整
Given: 确认卡片已显示
When: 教师点击 [再调整]
Then: Chat 输入框聚焦
And: 教师可以继续用自然语言描述调整需求
```

---

## Story 11：提交后状态追踪

**As a** 教师
**I want to** 在 Chat 中实时看到调课申请的审批状态变化
**so that** 我不需要去教务系统单独查看

**Acceptance Criteria:**

```
Scenario 11a: 审批通过推送
Given: 教师之前在某个 Chat session 中提交了调课申请
When: 教务处审批通过
Then: 该 Chat session 中插入一条状态卡片："✓ 已批准 · #2025-0315-003 · 李主任已审批"
And: 卡片显示所有变更的确认状态（互换教师已确认 / 代课教师已确认）

Scenario 11b: 审批驳回推送
Given: 教师提交了调课申请
When: 教务处驳回
Then: Chat 中插入状态卡片："✗ 已驳回 · 原因：该时段教室已被活动占用"
And: 提示"要修改方案重新申请吗？"
```

---

## Story 12：调课后联动建议

**As a** 教师
**I want to** 调课批准后系统主动提醒我需要处理的后续事项
**so that** 不会遗忘教案调整、代课交接等事项

**Acceptance Criteria:**

```
Scenario 12a: 联动建议列表
Given: 调课申请已批准
When: 批准通知卡片显示后
Then: 下方显示联动建议列表（最多 3 项），如：
  - "📝 调整教案时间线"（点击 → @ 引用教案 + 调课申请，AI 帮助调整）
  - "📋 给代课老师写进度说明"（点击 → AI 自动生成草稿）
  - "📅 查看调课申请状态"（点击 → @ 引用调课申请）

Scenario 12b: 点击联动建议
Given: 联动建议列表已显示
When: 教师点击"📝 调整教案时间线"
Then: Chat 输入框自动插入 @ 引用（教案 + 调课申请）
And: 发送后 AI 理解上下文，帮助调整教案的时间线
```

---

## Story 13：调课申请作为 @ 引用实体

**As a** 教师
**I want to** 在任何 Chat 对话中通过 @ 引用调课申请
**so that** 在其他工作场景中能快速关联调课信息

**Acceptance Criteria:**

```
Scenario 13a: @ 搜索调课申请
Given: 教师在 Chat 中
When: 输入 @ 并搜索"调课"
Then: 搜索结果显示该教师的调课申请列表（含状态标签）
And: 选中后调课申请的详情（变更列表 + 状态）注入上下文

Scenario 13b: 最近使用
Given: 教师刚提交了一个调课申请
When: 在另一个 session 中按 @
Then: 该调课申请出现在"最近使用"列表中
And: 显示图标 📅 + 申请摘要 + 状态标签
```
