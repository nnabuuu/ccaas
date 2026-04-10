# v6 Changelog

## 目标

D1-D5 已满分 (75/75)。本轮目标：提高 D6 E2E 场景通过率。基于 v5 eval 的 Priority Fix：
1. E2E config 文件已存在但评估器未成功执行 E2E（基础设施/评估器行为问题）
2. 改善 mock 数据和 SKILL.md 以确保 6 个 E2E 场景的 AI 行为正确性

## 根因分析

| 场景 | 潜在风险 | 修复策略 |
|------|---------|---------|
| S1 自身课时互换 | SKILL.md 仅覆盖"与他人互换"，无自身对调指引 | 添加子类型 B：自身互换流程 |
| S2 代课推荐 | teacher-wang 的 class-701/702 无教师 taughtThisClass=true | t-zhao 添加 class-701/702 到 classIds |
| S4 状态查询 | teacher-wang 仅有 pending+approved，无 rejected | 添加一条 rejected 申请 |
| S6 多课到同一时段 | AI 可能跳过 check_conflicts 直接拒绝 | 添加显式指引：必须构造变更并调用 check_conflicts |

## 修改清单

### mcp-server/src/index.ts
1. **t-zhao classIds 扩展**: `['c-7-1', 'c-7-2']` → `['c-7-1', 'c-7-2', 'class-701', 'class-702']`
   - 使 S2 代课场景中 t-zhao 对 class-701 的 taughtThisClass=true，matchScore 更高（+30分）
2. **teacher-wang rejected 申请**: 添加 `#2025-04-05-006`（改时，被驳回，原因"目标时段与校级活动冲突"）
   - 使 S4 状态查询返回全部 3 种状态（pending/approved/rejected）

### skills/reschedule-class/SKILL.md
1. **互换类型拆分为两个子类型**:
   - 子类型 A：与其他教师互换（原有流程不变）
   - 子类型 B：自身课时互换（新增，无需查对方课表）
2. **添加"多节课移到同一时段"指引**: 明确要求必须构造多条变更并调用 check_conflicts，不可跳过检测
3. **关键场景预期行为表**: 新增"自身课时互换"和"多课到同一时段"两行

### solution.json
1. **appendSystemPrompt 更新**: 互换类型说明增加"自身课时对调"；改时类型说明增加"多节课移到同一时段必须 check_conflicts"

## 自检结果

- tsc: PASS (0 errors)
- solution.json: VALID
- 禁止 widget: 0 matches
- 工具名一致性: 6/6 全部匹配

## 本轮跳过

- D1-D5: 已满分，无需修改
- E2E 基础设施: 评估器执行 E2E 的条件（CCAAS 运行、API 可达）不在 generator 控制范围内
