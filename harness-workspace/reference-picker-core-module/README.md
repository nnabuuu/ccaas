# Context Layer @ Reference Picker — Overnight Harness

从设计文档 v9 出发，自主实现完整的 `@kedge-agentic/context-layer` 模块 + @ picker 前端 + mock education solution。

## 目标

13 个 Playwright E2E 场景全部通过，分数 >= 90/100。

## 快速开始

```bash
# 首次运行
./harness.sh

# 恢复中断的运行
./harness.sh --resume

# 预览（不执行）
./harness.sh --dry-run

# 设置费用上限
./harness.sh --max-cost 20
```

## 前置条件

- `claude` CLI 已安装
- Node.js 18+
- 端口 3021 (mock backend) 和 5173 (chat-interface) 空闲

## 产出包

| 包 | 路径 | 说明 |
|----|------|------|
| `@kedge-agentic/context-layer` | `packages/context-layer/` | core (纯 TS) + nestjs (薄壳) + client (SDK) |
| `@kedge-agentic/context-layer-react` | `packages/context-layer-react/` | AtPicker React 组件 |
| chat-interface 集成 | `packages/chat-interface/src/components/chat/` | MentionPicker + MentionContext |
| mock solution | `solutions/mock/context-layer-demo/` | TypeORM + SQLite 教育数据 |
| E2E 测试 | `harness-workspace/reference-picker-core-module/e2e/` | 13 个 Playwright 场景 |

## 目录结构

```
reference-picker-core-module/
├── HARNESS_SPEC.md       # 完整规格说明
├── SPEC.md               # 冻结目标（Generator 读取）
├── EVAL_CRITERIA.md      # 评分标准（Evaluator 读取）
├── prompts/
│   ├── generator.md      # Generator agent 指令
│   └── evaluator.md      # Evaluator agent 指令
├── harness.sh            # 编排脚本
├── progress.md           # 迭代进度日志
├── changelogs/           # 每轮变更记录
├── eval-reports/         # 每轮评估报告
├── screenshots/          # 每轮截图
├── e2e/                  # Playwright E2E 测试
└── reference/            # 设计文档
    ├── Jijian-Context-Layer.md  # v9 设计文档
    └── README.md                # 设计概要
```

## 评分维度

| # | 维度 | 权重 |
|---|------|------|
| D1 | 场景通过率 (13 E2E) | 35 |
| D2 | 架构合规性 | 30 |
| D3 | TypeScript 正确性 | 15 |
| D4 | 性能 SLA | 8 |
| D5 | 前端交互质量 | 8 |
| D6 | 代码规范 | 4 |

## 退出条件

- 成功: >= 90/100 且 13/13 场景通过
- 合格: >= 75/100 且 11/13 场景通过
- 最大轮次: 12
- 递减退出: 连续 3 轮提升 < 3 分
- 致命: 连续 2 轮 P1/P2/P3 penalty

## 早晨检查清单

运行结束后查看：

1. `progress.md` — 分数走势是否正常上升？
2. `eval-reports/v{latest}-eval.md` — 最新评估的 Top 3 Priority Fixes
3. `git log --grep='harness(context-layer)' --oneline` — 提交历史
4. 最后几行 `changelogs/v{latest}-generator-output.txt` — Generator 是否正常结束？
5. 如果分数停滞，检查 evaluator 报告中是否有 `[DESIGN]` 类问题需要人工干预

## 手动验证

```bash
# 启动 mock solution
cd solutions/mock/context-layer-demo && npm run dev

# 启动 chat-interface
cd packages/chat-interface && VITE_CONTEXT_LAYER_URL=http://localhost:3021/context npm run dev

# 运行 E2E
cd harness-workspace/reference-picker-core-module && npx playwright test

# 测试 API
curl http://localhost:3021/context/entity-types
curl http://localhost:3021/context/suggest
curl "http://localhost:3021/context/browse?type=lesson_plan"
curl "http://localhost:3021/context/search?q=SAS"
```
