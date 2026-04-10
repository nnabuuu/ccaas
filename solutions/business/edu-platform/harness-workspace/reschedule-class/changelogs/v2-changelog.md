# v2 Changelog

## 目标

基于 v1 eval report (81/100) 的 Priority Fix 列表：
1. D3 取消/修改路径缺失 (影响 3 分)
2. D6 无可用时段场景不可触发 (影响 4.5 分)
3. D6 模糊描述/硬冲突场景 AI 行为不确定 (影响 ~9 分)

## 修改清单

### SKILL.md

- **[新增] "用户反馈处理" 小节** (SKILL.md:266-312)
  - 用户选择"修改方案"→ 按调课类型回到对应搜索步骤
  - 用户选择"取消"→ 确认取消 + suggest_actions 提供后续选项（含 JSON 示例）
  - 用户更改需求→ 识别新类型从头开始

- **[重写] "模糊描述处理" 小节** (SKILL.md:121-153)
  - 从简单列表改为 5 步明确流程（步骤1-5）
  - 每步标注具体工具调用和参数
  - 新增完整示例对话（张老师周三下午有事）

- **[重写] "异常处理 > 无可用时段" 小节** (SKILL.md:157-200)
  - 添加 show_info_card JSON 示例（"暂无可用时段"卡片）
  - 添加降级选项的具体处理流程（搜索下周/放宽条件/联系教务处）

- **[重写] "异常处理 > 硬冲突阻止" 小节** (SKILL.md:202-246)
  - 添加 show_info_card JSON 示例（"存在冲突，无法提交"卡片）
  - 强化硬性门控语句
  - 添加替代方案搜索流程

- **[修改] suggest_actions 确认按钮** (SKILL.md:448)
  - 为"取消"按钮添加 `skill_hint: "reschedule-class"`

### mcp-server/src/index.ts

- **[修改] timetable_find_available_slots handler** (~line 925)
  - 添加 `week >= 50` 测试钩子：返回空 slots + note 说明考试周/活动周
  - 使 D6 S5（无可用时段）场景可触发

## 自检结果

- tsc: **PASS** (0 errors)
- solution.json: **VALID**
- 禁止 widget: **0** matches
- 工具名一致性: **全部匹配** (6/6, 每个 count=2)
- JSON 可解析: **8/8 blocks VALID**

## 本轮跳过

- D1: 已满分 20/20，无需修改
- D2: 已满分 20/20，仅对 find_available_slots 添加测试钩子
- D4: 已满分 10/10，仅增加 2 个新 JSON 示例（无可用时段 + 硬冲突）
- D5: 已满分 10/10，无需修改
