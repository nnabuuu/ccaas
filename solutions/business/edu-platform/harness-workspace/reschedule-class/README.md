# Reschedule-Class Harness

## 范围

为 edu-platform 实现调课助手的 **Skill 层 + Dynamic Mock MCP 工具层**。

| 交付物 | 文件 |
|--------|------|
| Skill Prompt | `skills/reschedule-class/SKILL.md` |
| 6 个动态 Mock Timetable Tools | `mcp-server/src/index.ts` (新增) |
| Solution 配置 | `solution.json` (更新) |

## 设计文档

- `HARNESS_SPEC.md` — 完整的 harness 规格（6 维度 + agent 架构 + 退出条件）
- `SPEC.md` — Work Items 和冻结约束
- `EVAL_CRITERIA.md` — 评分标准和检测方法
- `reference/prd-summary.md` — PRD 摘要

## 前置条件

```bash
# 确保 mcp-server 可编译
cd solutions/business/edu-platform/mcp-server
npm install
npx tsc --noEmit
```

## 运行

```bash
# 完整运行（最多 10 轮）
cd solutions/business/edu-platform/harness-workspace/reschedule-class
bash harness.sh

# 从断点恢复
bash harness.sh --resume

# 干运行（估算成本）
bash harness.sh --dry-run

# 限制最大花费
bash harness.sh --max-cost=100
```

## 评估维度

| # | 维度 | 权重 | 说明 |
|---|------|------|------|
| D1 | 工具决策树清晰度 | 20/100 | AI 能否正确选择工具 |
| D2 | 动态 Mock 正确性 | 20/100 | mock 工具基于共享数据推算 |
| D3 | 确认流程严密性 | 15/100 | 提交前必须确认 |
| D4 | 输出格式合规性 | 10/100 | JSON 合法 + section type 合规 |
| D5 | 集成正确性 | 10/100 | solution.json + tsc + 工具名一致 |
| D6 | E2E 教师体验 | 25/100 | Playwright 6 场景（条件激活） |

> D6 激活条件: D1-D5 总分 ≥ 53/75

## 目标分数

90/100（10 轮内）

## 退出条件

- 分数 ≥ 90
- 连续 2 轮提升 < 3 分
- 达到 10 轮上限
- 成本超过 $150
