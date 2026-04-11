# Reschedule-Class Harness

**状态: 完成** | **最终分数: 93/100** | **迭代: 6 轮** | **日期: 2026-04-11**

## 概述

为 edu-platform 实现调课助手（reschedule-class）的 **Skill Prompt + 6 个动态 Mock MCP 工具**，通过 Generator/Evaluator 自动迭代达到生产可用水准。

### 交付物

| 交付物 | 文件路径（相对 `solutions/business/edu-platform/`） | 说明 |
|--------|------|------|
| Skill Prompt | `skills/reschedule-class/SKILL.md` | ~700 行，含完整决策树、4 种调课流程、确认门控、9 个 JSON 示例 |
| 6 个动态 MCP 工具 | `mcp-server/src/index.ts` | 基于共享 SCHEDULE/TEACHERS 数据模型动态推算 |
| Solution 配置 | `solution.json` | skill 注册 + session template 更新 + appendSystemPrompt |

### 功能覆盖

| 调课类型 | 关键词 | 工具调用链 |
|----------|--------|-----------|
| 互换（swap） | 换课/互换/交换/对调 | query_schedule → check_conflicts → show_info_card → confirm → submit_request |
| 代课（substitute） | 代课/找人代/请假 | query_schedule → find_substitute_teachers → show_info_card → confirm → submit_request |
| 改时（reschedule） | 改时/换时间/移到 | query_schedule → find_available_slots → check_conflicts → show_info_card → confirm → submit_request |
| 补课（makeup） | 补课/补上 | query_schedule → find_available_slots → show_info_card → confirm → submit_request |
| 模糊描述 | 有事/想想办法/帮我安排 | query_schedule → 逐课分析 → show_info_card(组合方案) → 逐项确认 |
| 状态查询 | 申请/状态/批了吗 | list_my_requests → show_info_card |

### 6 个 Timetable MCP 工具

| 工具 | 推算逻辑 |
|------|---------|
| `timetable_query_schedule` | 按 teacherId/classId/week 从共享 SCHEDULE 过滤 |
| `timetable_find_available_slots` | 遍历 day×period 排除已占用，含周末过滤、考试周检测 |
| `timetable_check_conflicts` | 5 层检测：教师忙/班级忙/教室事件/同科超载/批内冲突，vacatedKeys 互换识别 |
| `timetable_submit_request` | 写入 SUBMITTED_REQUESTS + 返回 requestId，含批内冲突安全网 |
| `timetable_list_my_requests` | 按 teacherId 过滤历史申请（含 pending/approved/rejected） |
| `timetable_find_substitute_teachers` | matchScore = 学科匹配(40) + 教过该班(30) + 空闲率(20) + 历史代课(10) |

## 迭代历史

| Version | Score | D1 | D2 | D3 | D4 | D5 | D6 | 关键变更 |
|---------|-------|----|----|----|----|----|-----|----------|
| v1 | 81 | 20/20 | 20/20 | 12/15 | 10/10 | 10/10 | 9/25 | 基础搭建：SKILL 框架 + 6 工具 + 共享数据 |
| v2 | 86 | 20/20 | 20/20 | 15/15 | 10/10 | 10/10 | 11/25 | 确认门控补全 + 取消/修改路径 |
| v4 | 75 | 20/20 | 20/20 | 15/15 | 10/10 | 10/10 | 0/25 | D1-D5 满分；D6=0（评估器基础设施问题） |
| v5 | 75 | 20/20 | 20/20 | 15/15 | 10/10 | 10/10 | 0/25 | 添加 teacher-wang E2E 数据 + 周末/批内冲突处理 |
| **v6** | **93** | **20/20** | **20/20** | **15/15** | **10/10** | **10/10** | **18/25** | E2E 首次运行：S3/S5/S6 Pass，S1/S2/S4 Partial |

> v3 eval 因评估器版本号 bug 被重命名，v4-v5 D6=0 因评估器无法加载 E2E 配置（已修复为硬编码）。

## 最终评估 (v6)

### D1-D5: 75/75 (满分)

- **D1 工具决策树 (20/20)**: 完整意图解析树覆盖 4 种类型 + 模糊描述 + 查询类，8 工具全表列出
- **D2 动态 Mock (20/20)**: 8 教师 + ~80 条课表，6 工具全部动态推算，matchScore 有完整公式
- **D3 确认门控 (15/15)**: 硬性禁止未确认提交，show_info_card 摘要 + suggest_actions 确认按钮，取消/修改路径完整
- **D4 输出格式 (10/10)**: 9 个 JSON 块全部可解析，5 种合法 section type，无禁止 widget
- **D5 集成 (10/10)**: solution.json 合法，skill 注册，template 更新，工具名 100% 一致，tsc 零错误

### D6 E2E: 18/25

| 场景 | 分数 | 结果 |
|------|------|------|
| S1 简单互换 | 2/4 | Partial — teacherId 上下文提取错误 |
| S2 代课推荐 | 2/4 | Partial — 未调用 find_substitute_teachers |
| S3 模糊描述 | 4/4 | Pass |
| S4 状态查询 | 1/4 | Partial — teacherId 传了 "current" 字面量 |
| S5 无可用时段 | 4.5/4.5 | Pass — 正确降级，未直接放弃 |
| S6 硬冲突阻止 | 4.5/4.5 | Pass — 检测到 hard 冲突，阻止提交 |

**D6 系统性问题**: S1/S2/S4 失分均因 AI 未正确从 sessionContext 提取 `teacherId: "teacher-wang"`。根因是 solution.json 的 `appendSystemPrompt` 中 `t-zhang` 示例误导 AI。SKILL.md 指令本身正确。

## Harness 基础设施

### 运行方式

```bash
cd solutions/business/edu-platform/harness-workspace/reschedule-class

# 完整运行（最多 10 轮）
bash harness.sh

# 从断点恢复
bash harness.sh --resume

# 干运行（估算成本）
bash harness.sh --dry-run
```

### 每轮流程

```
Generator (claude -p)
  → 读 SPEC + progress + eval report → 修改 SKILL.md / index.ts / solution.json
  → MCP rebuild (tsc) + inject skills/mcp to CCAAS
  → Pre-gate: npx tsc --noEmit (失败 → 0 分)
  → Git snapshot
Evaluator (claude -p)
  → 读 EVAL_CRITERIA + 代码 → D1-D5 静态检查
  → D1-D5 ≥ 53 → D6 E2E: 6 个 CCAAS session 场景
  → 写 eval report + 更新 progress.md
退出条件: score ≥ 90 | 连续 2 轮 <3 分提升 | 10 轮 | $150
```

### E2E 前置条件

D6 E2E 测试需要 CCAAS 后端运行：

```bash
# 1. 启动后端
cd packages/backend && npm run start:dev

# 2. 确保 tenant token 配额充足（默认 200K 可能不够）
curl -X PUT "http://localhost:3001/api/v1/admin/tenants/<TENANT_ID>/quotas" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <ADMIN_API_KEY>" \
  -d '{"period":"monthly","maxTokens":5000000}'

# 3. 确保 MCP workspace 部署正确
# harness.sh 的 verify_mcp_workspace() 会自动处理
```

### 已解决的基础设施问题

| 问题 | 根因 | 修复 |
|------|------|------|
| MCP 工具不可用 | tenant workspace 缺少 node_modules | `verify_mcp_workspace()` 自动部署完整目录 |
| ToolSearch 返回空 | DB 中 config.tools 为空 | `update_mcp_tools_config()` 从源码提取工具名写入 DB |
| Token 配额耗尽 (429) | 默认 200K 月限额 | 通过 admin API 提升至 5M |
| 评估器找不到 .e2e-config | LLM 不可靠地执行 shell `source` 命令 | 硬编码 CCAAS 凭据到评估器 prompt |
| 评估器版本号错乱 | LLM 忽略 `{N}` 替换值 | 加强指令 + harness.sh 自动重命名安全网 |
| SOLUTION_DIR 被 source 重置 | solution-lib.sh 第 46 行 reset | rebuild_mcp() 中 save/restore |

## 文件结构

```
harness-workspace/reschedule-class/
├── README.md                    # 本文件
├── SPEC.md                      # 6 个 Work Items + 冻结约束
├── HARNESS_SPEC.md              # 6 维度评分规格 + agent 架构
├── EVAL_CRITERIA.md             # 详细检测方法 + bash 检查脚本
├── harness.sh                   # 编排脚本（Generator → Build → Eval 循环）
├── progress.md                  # 迭代分数表
├── .e2e-config                  # CCAAS 连接配置（TENANT_ID/API_KEY）
├── prompts/
│   ├── generator.md             # Generator agent 指令
│   └── evaluator.md             # Evaluator agent 指令
├── reference/
│   └── prd-summary.md           # PRD 摘要
├── eval-reports/
│   ├── v1-eval.md ... v6-eval.md
├── changelogs/
│   ├── v1-changelog.md ... v6-changelog.md
```

## 后续优化方向

如需进一步提升 D6 分数（18→25）：

1. **修复 appendSystemPrompt 示例 teacherId**: solution.json 中 `t-zhang` → 占位符或警告文本
2. **MCP 工具描述强化**: timetable_list_my_requests 的 teacherId 参数说明加入 "不可传 'current' 字面量"
3. **重新构建 dist/**: 确保 `npm run build` 后 dist 与 src 一致（周末过滤逻辑）
