# live-lesson-e2e-collaboration Harness

端到端验证 live-lesson 5-step 协作管道：学生加入 → 逐步提交 → SSE 广播 → 教师实时看到。

## 前提

- Node.js 18+
- Claude CLI (`claude`) in PATH
- CCAAS core backend 能在 :3001 启动
- live-lesson backend 能在 :3007 启动
- Playwright MCP server 配置好（评估器需要浏览器交互）

## 运行

```bash
# 完整运行（最多 8 轮，~$80）
bash harness-workspace/live-lesson-e2e-collaboration/harness.sh

# 干跑 — 仅估算成本
bash harness-workspace/live-lesson-e2e-collaboration/harness.sh --dry-run

# 从中断处恢复
bash harness-workspace/live-lesson-e2e-collaboration/harness.sh --resume

# 设置成本上限
bash harness-workspace/live-lesson-e2e-collaboration/harness.sh --max-cost=100
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

## 评分维度

| 维度 | 分值 | 测试方法 |
|------|------|----------|
| D1 Build + Service Health | 15 | tsc + nest build + curl health |
| D2 Student Join + 5-Step Submission | 25 | curl API + Playwright UI |
| D3 Teacher Real-Time Dashboard | 25 | curl SSE + state + Playwright |
| D4 Three-Surface Sync | 20 | Playwright iframe + postMessage |
| D5 Data Integrity + Edge Cases | 15 | curl idempotent/upsert/validation |

## 退出条件

- 分数 >= 95 → 成功
- 分数 >= 90 → 通过
- 连续 2 轮改进 < 3 分 → 停止
- 回归 > 5 分 → 自动 revert
- 成本 > $250 → 停止
- 最多 8 轮

## 晨间检查清单

运行完成后检查：

1. `cat harness-workspace/live-lesson-e2e-collaboration/progress.md` — 查看分数走势
2. `ls harness-workspace/live-lesson-e2e-collaboration/eval-reports/` — 查看最新 eval report
3. `git log --grep='e2e-collaboration' --oneline` — 查看迭代历史
4. 检查最后一轮 eval report 的 "Top 3 Priority Fixes" — 判断是否需要人工介入
5. 如果最终分数 < 90，检查是否有 [SYSTEM] 类 bug 需要手动修复
