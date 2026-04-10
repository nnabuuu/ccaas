# v1 Changelog

## 目标
从零搭建 reschedule-class Skill + 6 个动态 timetable MCP 工具 + solution.json 配置。
优先级: D5 满分 + D2 基础分 + D1 基础分。

## 修改清单

### NEW: `skills/reschedule-class/SKILL.md`
- 角色定义：调课助手，帮助教师高效安全地完成调课
- 上下文感知：从 sessionContext 获取 teacherId/teacherName/subject/classIds
- 完整意图解析决策树：4 种明确类型 + 模糊描述分流 + 查询类
- 4 种调课类型工作流（swap/substitute/reschedule/makeup），每种含完整 MCP 调用序列
- 模糊描述处理：先查课表 → 逐课分析 → 组合方案
- 异常处理：无可用时段降级建议 + 硬冲突阻止提交
- 确认门控：明确写 "在用户选择确认之前，禁止调用 timetable_submit_request"
- 4 个 show_info_card JSON 示例（方案推荐、提交确认、申请状态、代课候选）
- suggest_actions 示例含 skill_hint
- 工具使用表（8 个工具）

### MODIFY: `mcp-server/src/index.ts`
- 新增共享数据模型:
  - `TEACHERS`: 7 教师（数学4人、物理1人、英语1人、语文1人）
  - `SCHEDULE`: 完整周课表（70+ 条记录，5天×8节格式）
  - `ROOM_EVENTS`: 3 个教室活动事件（用于 hard 冲突）
  - `SUBMITTED_REQUESTS`: 3 条历史调课申请（pending/approved/rejected 各1）
- 新增 6 个 timetable 工具定义 + handler:
  - `timetable_query_schedule`: 按 teacherId/classId 从 SCHEDULE 过滤
  - `timetable_find_available_slots`: 遍历 5天×8节，排除教师和班级已占用时段，检查 ROOM_EVENTS
  - `timetable_check_conflicts`: 交叉查询 SCHEDULE 判断 teacher_busy/class_busy/room_event/subject_overload
  - `timetable_submit_request`: 写入 SUBMITTED_REQUESTS + 生成 requestId
  - `timetable_list_my_requests`: 按 teacherId/status 过滤 SUBMITTED_REQUESTS
  - `timetable_find_substitute_teachers`: matchScore = subjectMatch(40) + taughtThisClass(30) + availability(20) + historyBonus(max10)
- 所有工具注册到 ListToolsRequestSchema

### MODIFY: `solution.json`
- skills 数组添加 `{ "slug": "reschedule-class", "name": "reschedule-class" }`
- sessionTemplates.lesson-planning.enabledSkills 添加 `"reschedule-class"`

## 自检结果
- tsc: PASS (0 errors)
- solution.json: VALID
- 禁止 widget: 0 matches
- 工具名一致性: 全部匹配（6/6）

## 本轮跳过
- 无（v1 是全新创建，所有基础内容都已包含）
