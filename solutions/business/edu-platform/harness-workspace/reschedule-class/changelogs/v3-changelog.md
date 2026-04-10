# v3 Changelog

## 目标

基于 v2 eval report 的 Priority Fix 列表，专攻 D6 E2E 场景（S3-S6）的静态置信度提升。

v2 得分：86/100（D1-D5=75/75, D6=11/25）。D6 失分集中在 S4(0/4)、S5(0/4.5)、S6(0/4.5)。

## 根因分析

| 场景 | 失分原因 | 根因类型 | 修复策略 |
|------|----------|----------|----------|
| S4 状态查询 | teacherId 参数传递不确定 | 内容缺失 + 工具schema | 添加专用流程节 + teacherId required |
| S5 无可用时段 | AI 是否正确触发降级流程不确定 | 内容不够显式 | 强化触发识别条件 + 必须用词 |
| S6 硬冲突阻止 | AI 是否遵守禁止提交规则不确定 | 缺乏预提交验证规则 | 添加第5条确认门控规则 |
| S2/S3 | classId 参数不一致 | 内容错误 | 修复示例 + 添加调用规范 |

## 修改清单

### SKILL.md

1. **[line 89] 修复 classId 参数缺失**：substitute 流程示例中 `find_substitute_teachers` 调用添加 `classId: "c-8-2"`
2. **[line 89+] 添加调用规范**：新增 `find_substitute_teachers` 必须传 classId 的显式规范说明
3. **[line 36-39] 决策树状态查询扩展**：`list_my_requests` 调用明确参数 `{ teacherId: sessionContext.teacherId }`
4. **[新增节] 状态查询完整流程**：在"模糊描述处理"和"异常处理"之间新增"状态查询流程"节，含4步完整处理流程 + 示例对话
5. **[确认门控] 添加第5条规则**：提交前冲突验证 — `submit_request` 前必须确认 `check_conflicts.severity !== "hard"`
6. **[无可用时段] 强化触发识别**：明确 `data.totalSlots === 0` 触发条件，强化"必须"用词，添加等待教师选择步骤
7. **[硬冲突阻止] 强化触发识别 + 拒绝规则**：明确 `data.severity === "hard"` 触发条件，添加"即使用户要求直接提交也必须拒绝"，添加第4步重走正常流程

### mcp-server/src/index.ts

1. **timetable_list_my_requests**: teacherId 从 optional 改为 required，description 添加 sessionContext 获取说明
2. **submit_request**: 添加 requestId 日期格式注释（`YYYY-MMDD`）

## 自检结果

- tsc: **PASS** (0 errors)
- solution.json: **VALID**
- 禁止 widget: **0** matches
- 工具名一致性: **全部匹配** (6/6)
- JSON 代码块: **全部可解析** (8/8)

## 本轮跳过

- D1-D5: 已满分，无需修改
- index.ts requestId 格式变更: 仅添加注释说明，不改变格式（与预置数据保持一致）
