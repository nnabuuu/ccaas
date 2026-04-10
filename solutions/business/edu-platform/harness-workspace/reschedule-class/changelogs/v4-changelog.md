# v4 Changelog

## 目标
基于 v3 eval report：D1-D5 满分（75/75），D6 仅 12/25（S4-S6 因 token quota 429 失败）。
本轮聚焦两个方向：
1. **减少每场景 token 消耗**，让 S4-S6 有机会在配额内执行
2. **修复 S5 行为缺陷**：preferredDays 传入非教学日（如周六=6）时工具返回有效结果而非 0

## 修改清单

### index.ts (2 处修改)

1. **[find_available_slots] preferredDays 校验（→ D6 S5）**
   - 新增：过滤 preferredDays 到有效范围 1-5（周一至周五）
   - 当所有请求日期都不在 1-5 范围时，返回 `totalSlots: 0` + 提示"指定日期不在正常教学日范围内"
   - 修复：S5 场景"换到周六"现在正确触发"无可用时段"降级流程

2. **[find_available_slots] 减少最大返回时段数（→ D6 token 优化）**
   - `slots.slice(0, 20)` → `slots.slice(0, 10)`
   - 减少每次调用 ~600 tokens 响应体积

### solution.json (1 处修改)

3. **appendSystemPrompt 精简（→ D6 token 优化）**
   - 将 ~30 行的 "调课技能 (reschedule-class)" 详细说明压缩为 3 行核心规则
   - 详细指令已在 SKILL.md 中完整覆盖，appendSystemPrompt 中的重复内容是纯粹的 token 浪费
   - 预计每场景节省 ~800 tokens

### SKILL.md (2 处修改)

4. **"无可用时段"段落添加非教学日触发条件（→ D6 S5）**
   - 新增一行："如果教师请求将课移到周六、周日等非教学日，视同'无可用时段'，直接进入降级建议流程"
   - 引导 AI 正确处理非教学日请求

5. **"工具响应处理规则"段落压缩（→ D6 token 优化）**
   - 从 ~50 行 → ~8 行，使用紧凑 bullet 格式
   - 保留所有关键检查规则（totalSlots/severity/totalCandidates/totalEntries/teacherId from sessionContext）
   - 预计每场景节省 ~400 tokens

## 预期效果
- 每场景节省约 1800-2000 tokens（appendSystemPrompt 800 + slots response 600 + 工具规则压缩 400）
- 6 场景总节省约 10,000-12,000 tokens
- S5 行为修复：非教学日正确返回 totalSlots=0

## 自检结果
- tsc: PASS (0 errors)
- solution.json: VALID
- 禁止 widget: 0 matches
- 工具名一致性: 全部匹配 (6/6)
- JSON 代码块: 全部可解析 (8/8)

## 本轮跳过
- D1-D5: 均已满分，无结构性修改（仅压缩冗余文本）
- S6 硬冲突场景：现有 check_conflicts 逻辑已能正确检测，无需修改
- 更激进的 token 优化（如压缩 tool descriptions、trim schedule response fields）：风险/收益比不佳，留待 v5
