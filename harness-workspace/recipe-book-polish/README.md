# recipe-book-polish — UX/Color Fix

修复 recipe-book 前端的配色和视觉一致性问题：AtPicker theme override、文字对比度、表格样式、暗色模式完整性。

## 前提

- `solutions/business/recipe-book/frontend/` 已存在且功能完整
- recipe-book-frontend harness 已通过
- 需要 `claude` CLI 可用

## 运行

```bash
# 预检（不执行，显示预估成本）
cd harness-workspace/recipe-book-polish && bash harness.sh --dry-run

# 完整运行
bash harness.sh

# 从上次中断处继续
bash harness.sh --resume

# 限制成本
bash harness.sh --max-cost=100
```

## 评估维度

| 维度 | 权重 | 内容 |
|------|------|------|
| D1 | 20 | AtPicker Theme Integration（背景、按钮色、hover、边框、文字色） |
| D2 | 20 | Typography & Readability（食材对比度、字体一致性、行高） |
| D3 | 20 | Component Visual Quality（表格交替行、食材分隔、卡片 hover） |
| D4 | 20 | Dark Mode & Theme Consistency（AtPicker 暗色、无硬编码白黑） |
| D5 | 20 | Build Quality（tsc、vite build、frozen dirs、AtPicker 功能） |

## 次日检查清单

1. `cat progress.md` — 查看分数走势
2. 最终分数是否 ≥ 90？
3. `cd solutions/business/recipe-book/frontend && npx tsc --noEmit` — 编译通过？
4. `cd solutions/business/recipe-book/frontend && npx vite build` — 构建通过？
5. `cd solutions/business/recipe-book/backend && npx vitest run` — 后端测试未被破坏？
6. `git log --grep='recipe-book.*polish' --oneline` — 查看迭代历史

## 文件结构

```
recipe-book-polish/
├── SPEC.md              # 冻结需求规格
├── EVAL_CRITERIA.md     # 评分标准
├── prompts/
│   ├── generator.md     # Generator agent 指令
│   └── evaluator.md     # Evaluator agent 评分模板
├── harness.sh           # Bash 编排脚本
├── progress.md          # 分数追踪表
├── changelogs/          # 每轮改动日志
├── eval-reports/        # 每轮评估报告
└── README.md            # 本文件
```
