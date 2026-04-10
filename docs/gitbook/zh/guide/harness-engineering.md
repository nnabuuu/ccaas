# Harness Engineering

Harness Engineering 是一种运行长时间 AI Agent 任务的工程实践，通过结构化迭代、自动化评估和质量门禁，将模糊的改进目标转化为可度量、可复现的 Agent 工作流。

## 适用场景

当你的任务满足以下条件时，适合使用 Harness：

- 需要**多轮迭代**才能达到可接受的质量（如 UI 重设计、代码重构）
- 有**可度量的评估标准**（分数、测试通过率、静态分析）
- 能从**自动化反馈循环**中受益 —— Agent 读取自己的评估报告并改进

## 架构

Harness 遵循 **Generator-Evaluator** 模式：

```
┌─────────────┐     ┌───────────┐     ┌─────────────┐
│  Generator   │ ──→ │ Pre-gate  │ ──→ │  Evaluator   │
│  (实现)       │     │ (tsc/测试) │     │  (评分)       │
└─────────────┘     └───────────┘     └─────────────┘
       ↑                                      │
       └──────────── progress.md ←────────────┘
```

1. **Generator**：读取 Spec、上一轮 eval 报告和当前代码，进行改进
2. **Pre-gate**：执行快速验证（如 `tsc --noEmit`）。失败则该版本得 0 分，Generator 必须先修复编译错误
3. **Evaluator**：读取评估标准和当前代码，生成结构化评分报告
4. **循环**：编排器更新 `progress.md` 并检查退出条件

## 工作空间结构

每个 Harness 任务位于 `harness-workspace/<task-name>/`：

```
harness-workspace/<task-name>/
├── SPEC.md              # 构建什么 — 工作项 + 冻结约束
├── EVAL_CRITERIA.md     # 如何评分 — 维度、权重、检测方法
├── README.md            # 如何运行 — 前置条件、命令
├── harness.sh           # 编排脚本
├── progress.md          # 迭代日志（分数轨迹表）
├── prompts/
│   ├── generator.md     # Generator Agent 指令
│   └── evaluator.md     # Evaluator Agent 指令
├── reference/           # 设计令牌、原型、架构文档
├── eval-reports/        # v{N}-eval.md — 每版评估
└── changelogs/          # v{N}-changelog.md — 每版变更
```

## 核心文件

### SPEC.md

定义**构建什么**，包含：

- **Goal**：目标分数和最大迭代次数
- **Work Items**：编号任务（W1, W2, ...），映射到评估维度
- **Frozen Constraints**：不可修改的文件和 API
- **Architecture**：文件树，标注需要创建/修改的文件

### EVAL_CRITERIA.md

定义**如何评分**，包含：

- **Pre-gate**：评分前必须通过的命令（通常是 `tsc --noEmit`）
- **Dimensions**：加权评分维度（D1, D2, ...），每个维度 1-5 分
- **Detection Methods**：Evaluator 用于验证各维度的 Bash 命令或代码模式
- **Penalty Rules**：回退或违反约束的扣分规则

### harness.sh

编排脚本，负责：

- 服务启动（开发服务器、后端）
- 迭代循环（可配置最大轮数）
- 版本间 Git 快照
- 分数解析和退出条件检查
- `--resume` 标志用于恢复中断的运行
- `--dry-run` 标志用于验证但不执行

## 退出条件

满足以下任一条件时停止：

1. **达标**：分数 >= 目标（如 95/100）
2. **达到上限**：到达配置的最大迭代次数（如 15 轮）
3. **进入平台期**：连续 N 轮分数提升 < 阈值（如连续 2 轮提升 < 3 分）

## 评估标准设计

好的评估标准应该是：

- **加权的**：不是所有维度都同等重要，按影响力分配分值
- **可验证的**：每个维度有具体的检测方法（grep、文件存在性、测试结果）
- **渐进的**：使用 1-5 分制，部分进展也能得分，而非只有通过/不通过
- **可操作的**：评估报告告诉 Generator 接下来具体要修什么

示例维度结构：

| 维度 | 权重 | 5/5 | 3/5 | 1/5 |
|------|------|-----|-----|-----|
| 视觉层级 | 20/100 | 完整 design tokens + 面包屑 + 一致排版 | 基本导航栏，缺少 tokens | 无改进 |
| 加载状态 | 15/100 | 所有页面都有 Skeleton + ErrorState + EmptyState | 部分页面有加载状态 | 无加载状态 |

## Harness Agent 的 Prompt 工程

### Generator Prompt 技巧

- 按工作项编号引用 Spec（W1, W2）
- 包含最新的 eval 报告，让 Agent 知道哪项得分低
- 指定**阶段策略**（如 "v1-3: 基础设施, v4-6: 可视化, v7+: 打磨"）
- 提醒冻结约束

### Evaluator Prompt 技巧

- 在 prompt 中内联检测命令，让 Evaluator 可以机械化验证
- 要求结构化输出格式：维度分数、总分、以及给 Generator 的 "Top Issue"
- 强调 Evaluator 不得修改代码 —— 只评估

## 运行 Harness

```bash
# 空跑 — 验证工作空间结构
bash harness-workspace/<task-name>/harness.sh --dry-run

# 完整运行
bash harness-workspace/<task-name>/harness.sh

# 中断后恢复
bash harness-workspace/<task-name>/harness.sh --resume
```

## 与 Stitch 集成

对于 UI 类的 Harness 任务，可以在运行前用 Stitch MCP 生成设计原型：

1. 创建 Stitch 项目并配置设计系统（配色、字体、圆角）
2. 为每个主要视图生成屏幕
3. 将屏幕 HTML 导出到 `reference/` 或 `prototypes/`
4. Generator 读取这些原型作为视觉目标

## 实战案例

- [Article Analyzer UI/UX 重设计](../examples/article-analyzer-ui-redesign.md) — 4 轮迭代达到 100/100
- [Context Layer @ Reference Picker](../examples/reference-picker.md) — 从零代码到全栈模块
