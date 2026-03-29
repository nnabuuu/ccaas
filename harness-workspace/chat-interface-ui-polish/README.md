# Chat Interface UI Polish — Overnight Harness

## 做什么

自动迭代优化 `packages/chat-interface/` 的视觉质量，对标 Claude Web。每轮迭代：

1. **Generator** agent 阅读上轮 eval 反馈，修改组件代码，通过浏览器验证效果
2. **Tool Agent** 运行 typecheck + test，失败则回滚
3. **Evaluator** agent 独立审阅代码 + 截图对比参考，按 5 维度打分

循环直到达到 85/100 分、15 轮上限、或连续 2 轮提升 < 3 分。

## 前提

- Claude CLI (`claude` 命令可用)
- Node.js + npm (chat-interface 依赖已安装)
- Playwright (`npx playwright install chromium`)
- Playwright MCP server 已配置（用于浏览器自动化）

## 快速开始

```bash
# 首次运行
./harness.sh

# 中断后恢复
./harness.sh --resume

# 干跑（看计划不执行）
./harness.sh --dry-run

# 设置费用上限
./harness.sh --max-cost 8
```

## 早上起来看什么

1. **`progress.md`** — 分数走势，每轮的维度分和主要问题
2. **`eval-reports/`** — 每个版本的详细评估（扣分原因 + 改进建议）
3. **`changelogs/`** — 每轮 Generator 写的改动说明
4. **`screenshots/`** — 每轮的 desktop/mobile 截图（和参考对比）
5. **`git log --grep='harness:' --oneline`** — 每轮迭代的 git commit 历史
6. **`git diff HEAD~N -- packages/chat-interface/src/`** — 查看累计代码变更

## 评分维度

| # | Dimension | Weight | 评什么 |
|---|-----------|--------|--------|
| 1 | Claude Web Visual Alignment | 30% | 与参考截图的视觉一致性 |
| 2 | Cross-Component Consistency | 25% | CSS 变量覆盖率、零硬编码 |
| 3 | Responsive & Mobile | 20% | 320px-1440px 全范围可用 |
| 4 | Interaction Polish | 15% | hover/focus/transition 覆盖率 |
| 5 | Code Quality | 10% | 无 !important、无 inline style |

## 配置

| 文件 | 改什么 |
|------|--------|
| `EVAL_CRITERIA.md` | 调整评分权重或标准 |
| `SPEC.md` | 修改冻结约束 |
| `prompts/generator.md` | 调整 Generator 行为 |
| `prompts/evaluator.md` | 调整 Evaluator 评分方式 |
| `harness.sh` 顶部变量 | MAX_ITERATIONS, TARGET_SCORE 等 |

## 架构

```
harness.sh (orchestrator)
  │
  ├─ [每轮] Step 1: Generator (claude -p + Edit/Write/Bash/Browser)
  │   └─ 修改 packages/chat-interface/src/
  │   └─ 浏览器验证 → screenshots/v{N}/
  │   └─ 写 changelogs/v{N}-changelog.md
  │
  ├─ [每轮] Step 2: Tool Agent (bash typecheck + test)
  │   └─ 失败 → git revert → score 0, skip eval
  │   └─ 成功 → git commit "harness: v{N} iteration"
  │
  ├─ [每轮] Step 3: Evaluator (claude -p + Read/Write/Grep/Browser)
  │   └─ 代码分析 + 截图对比 → eval-reports/v{N}-eval.md
  │
  └─ [每轮] Step 4: Score extraction (from eval report FILE)
      └─ progress.md ← 从 changelog + eval report 文件提取
      └─ git commit "harness: v{N} eval — score XX/100"
      └─ exit condition check
```

## 费用估算

- 每轮约 $0.50-1.00 (generator ~80K tokens + evaluator ~60K tokens + 图片 tokens)
- 8-12 轮 ≈ $5-12
- 用 `--max-cost` 控制上限
