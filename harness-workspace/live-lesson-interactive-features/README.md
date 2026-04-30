# live-lesson-interactive-features Harness

在 e2e-collaboration 管道（100/100）基础上，实现 6 个 backlog/partial 功能：教师推步同步、推送通知、AI 助教自由提问、实时计时器。

## 前提

- Node.js 18+
- Claude CLI (`claude`) in PATH
- CCAAS core backend 能在 :3001 启动
- live-lesson backend 能在 :3007 启动
- Playwright MCP server 配置好（评估器需要 multi-tab 浏览器交互）

## 运行

```bash
# 完整运行（最多 8 轮，~$80）
bash harness-workspace/live-lesson-interactive-features/harness.sh

# 干跑 — 仅估算成本
bash harness-workspace/live-lesson-interactive-features/harness.sh --dry-run

# 从中断处恢复
bash harness-workspace/live-lesson-interactive-features/harness.sh --resume

# 设置成本上限
bash harness-workspace/live-lesson-interactive-features/harness.sh --max-cost=100
```

## Artifact

可修改文件：
- `solutions/business/live-lesson/frontend/` — 前端代码
- `solutions/business/live-lesson/backend/` — 后端代码

冻结目录（不可修改）：
- `packages/`
- `solutions/business/recipe-book/`
- `solutions/business/live-lesson/mcp-server/`
- `solutions/business/live-lesson/skills/`

## Feature Groups

| Group | 内容 | 关键维度 |
|-------|------|----------|
| A | Teacher Direct Step Sync | D2 (25pts) |
| B | Push Notifications | D3 (20pts) |
| C | AI Assistant Free Questions | D4 (20pts) |
| D | Timer & Extend | D5 (10pts) |

## 评分维度

| 维度 | 分值 | 测试方法 |
|------|------|----------|
| D1 Build + Service Health | 10 | bash build + curl new endpoints |
| D2 Teacher Step Sync | 25 | **Playwright multi-tab** |
| D3 Push Notifications | 20 | **Playwright multi-tab** |
| D4 AI Assistant | 20 | **Playwright** |
| D5 Timer & Polish | 10 | **Playwright** |
| D6 Regression Guard | 15 | curl + Playwright |

## 退出条件

- 分数 >= 95 → 成功
- 分数 >= 90 → 通过
- 连续 2 轮改进 < 3 分 → 停止
- 回归 > 5 分 → 自动 revert
- 成本 > $250 → 停止
- 最多 8 轮

## 晨间检查清单

运行完成后检查：

1. `cat harness-workspace/live-lesson-interactive-features/progress.md` — 查看分数走势
2. `ls harness-workspace/live-lesson-interactive-features/eval-reports/` — 查看最新 eval report
3. `git log --grep='interactive-features' --oneline` — 查看迭代历史
4. 检查最后一轮 eval report 的 "Top 3 Priority Fixes" — 判断是否需要人工介入
5. 如果最终分数 < 90，检查是否有系统级 bug 需要手动修复
