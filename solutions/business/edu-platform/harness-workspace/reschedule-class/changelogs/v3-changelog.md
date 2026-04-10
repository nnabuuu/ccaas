# v3 Changelog

## 目标
基于 v2 eval report 的 Priority Fix 列表，提升 D6 E2E 场景的静态置信度（S3/S4/S5/S6）。

D1-D5 均为满分（75/75），本轮聚焦 D6 改进。

## 修改清单

### SKILL.md (5 处修改)

1. **[line ~177] 模糊描述处理流程强化（→ D6 S3）**
   - 添加"必须严格按以下 5 个步骤顺序执行，不可跳过"的强制指令
   - 目标：从 S3 Possible Pass (3/4) → Likely Pass (4/4)

2. **[line ~213-220] 状态查询 teacherId 获取强化（→ D6 S4）**
   - 改为"必须从 sessionContext.teacherId 直接获取"
   - 添加"禁止要求教师手动输入 teacherId"
   - 示例对话中强调"直接使用，无需询问教师"
   - 目标：从 S4 Uncertain (0/4) → Likely Pass (4/4)

3. **[line ~245] 无可用时段触发识别强化（→ D6 S5）**
   - 改为"每次调用后立即检查...若满足任一条件，必须立即进入以下流程，不得跳过"
   - 目标：从 S5 Uncertain (0/4.5) → Likely Pass (4.5/4.5)

4. **[line ~293] 硬冲突触发识别强化（→ D6 S6）**
   - 改为"每次调用后立即检查...必须立即进入以下流程，不得跳过"
   - 强化"必须拒绝并解释存在硬冲突无法提交的原因"
   - 目标：从 S6 Uncertain (0/4.5) → Likely Pass (4.5/4.5)

5. **[line ~556-600] 工具响应处理规则全面重写（→ D6 S4-S6）**
   - 添加显式 IF-THEN-ELSE 条件逻辑伪代码
   - 每个工具的返回值检查都有明确的分支处理和编号步骤
   - timetable_list_my_requests 添加"前置条件：teacherId 从 sessionContext 获取"
   - timetable_check_conflicts 的 hard 分支添加 5 步强制处理
   - timetable_find_available_slots 的空结果分支添加 4 步强制处理

6. **[line ~551-552] 工具使用表强化**
   - timetable_list_my_requests: 添加"teacherId 必须从 sessionContext 获取"
   - timetable_find_substitute_teachers: 添加"必须传入 classId 参数"

### index.ts
- 无修改（D2 已满分，保持不变）

### solution.json
- 无修改（D5 已满分，保持不变）

## 自检结果
- tsc: PASS (0 errors)
- solution.json: VALID
- 禁止 widget: 0 matches
- 工具名一致性: 全部匹配 (6/6)
- JSON 代码块: 全部可解析 (8/8)

## 本轮跳过
- D1-D5: 均已满分，无需修改
- index.ts requestId 日期格式（eval 建议 #3）: 当前格式 YYYY-MMDD 与预置数据一致，保持不变
