# 学生四象限算法设计文档

> 文件: `frontend/src/components/teacher/summary/summary-helpers.ts`
> 可视化: `SummaryOverlay.tsx` (SVG 散点图) / `SummaryTab.tsx` (分组列表)

## 1. 概述

教师总览页将每个学生映射到 **掌握度-参与度** 二维坐标系上,形成四象限分类:

| 象限 | 掌握度 | 参与度 | 标签 | 颜色 |
|------|--------|--------|------|------|
| 右上 | ≥ 50 | ≥ 50 | 学优 (star) | 绿色 |
| 左上 | < 50 | ≥ 50 | 努力但困惑 (struggling) | 琥珀色 |
| 右下 | ≥ 50 | < 50 | 游刃有余 (coasting) | 蓝色 |
| 左下 | < 50 | < 50 | 需要关注 (at-risk) | 红色 |

阈值: `MASTERY_THRESHOLD = 50`, `ENGAGEMENT_THRESHOLD = 50`

---

## 2. 当前计算公式

### 2.1 掌握度 (mastery, X 轴, 0-100)

```
mastery = round(avgScore × completionRatio)

avgScore      = sum(submission.score.total) / submittedCount
completionRatio = min(1, submittedCount / totalSteps)
```

**含义**: 平均得分 × 完成比例。既考虑质量(分数),也惩罚进度慢的学生。

**示例** (5 个 task):

| 学生 | 已提交 | 平均分 | completionRatio | mastery |
|------|--------|--------|-----------------|---------|
| Alice | 3/5 | 90 | 0.6 | **54** |
| Bob | 1/5 | 100 | 0.2 | **20** |
| Charlie | 5/5 | 60 | 1.0 | **60** |

> **注意**: Bob 全对但只做了 1 题,mastery 只有 20 → 可能被分到 at-risk。

### 2.2 参与度 (engagement, Y 轴, 0-100)

```
engagement = round((0.4 × progressRate + 0.3 × (1 - stuckPenalty) + 0.3 × aiActivity) × 100)

progressRate = min(1, currentTask / totalSteps)     // 走到第几步
stuckPenalty = elapsed > 180s ? 1 : 0               // 当前步停留超3分钟
aiActivity   = min(1, aiRounds / 5)                 // AI 交互次数(上限5)
```

**权重分配**:

| 因子 | 权重 | 范围 | 含义 |
|------|------|------|------|
| progressRate | 40% | 0-1 | 课程进度 |
| 1 - stuckPenalty | 30% | 0 或 1 | 是否卡住 |
| aiActivity | 30% | 0-1 | AI 使用活跃度 |

**极端场景分析**:

| 场景 | progress | stuck | AI | engagement |
|------|----------|-------|----|------------|
| 最高: 5/5 步 + 没卡 + 5轮 AI | 0.4 | 0.3 | 0.3 | **100** |
| 正常: 3/5 步 + 没卡 + 2轮 AI | 0.24 | 0.3 | 0.12 | **66** |
| 刚入学: 1/5 步 + 没卡 + 0 AI | 0.08 | 0.3 | 0 | **38** |
| 卡住: 3/5 步 + 卡住 + 2轮 AI | 0.24 | 0 | 0.12 | **36** |
| 最低: 1/5 步 + 卡住 + 0 AI | 0.08 | 0 | 0 | **8** |

### 2.3 象限分类

```ts
if (mastery >= 50 && engagement >= 50) → 'star'
if (mastery <  50 && engagement >= 50) → 'struggling'
if (mastery >= 50 && engagement <  50) → 'coasting'
else                                   → 'at-risk'
```

### 2.4 弱项步骤 (weakSteps)

遍历学生每个提交,如果该步得分 < 该步全班平均分,则标记为弱项。用于教师推荐提问和重讲。

### 2.5 SVG 坐标映射

```ts
cx = mastery          // X: 0=最左(低掌握), 100=最右(高掌握)
cy = 100 - engagement // Y: 0=最上(高参与), 100=最下(低参与)
```

viewBox 为 `(-10, -10, 120, 120)`, 支持鼠标滚轮缩放和拖拽平移。

---

## 3. 当前问题

### 3.1 stuckPenalty 阈值过低 (Critical)

**问题**: 硬编码 `180s (3分钟)`,但 manifest 中各步预期时长为 5-15 分钟:

| Step | 预期时长 | 超过 3 分钟即"卡住"? |
|------|---------|---------------------|
| Predict | 5 min | 学生做了 4 分钟就被罚 |
| Skim | 8 min | 学生做了 4 分钟就被罚 |
| Scan & Build | 15 min | 学生做了 4 分钟就被罚 |
| Evaluate | 12 min | 学生做了 4 分钟就被罚 |
| Wrap-up | 5 min | 学生做了 4 分钟就被罚 |

**影响**: 几乎所有认真做题的学生都会被标记为"卡住",engagement 直接扣 30 分。大多数学生的参与度被系统性低估。

### 3.2 stuckPenalty 是二值的 (Medium)

**问题**: penalty 只有 0 和 1,没有渐变。179 秒和 181 秒的差异是 0 vs 30 分。

**影响**: 学生坐标可能在某一刻突然跳变,教师看到的散点图不稳定。

### 3.3 mastery 对慢学生过于严苛 (Low)

**问题**: `avgScore × completionRatio` 意味着一个得了 100 分但只完成 1/5 步骤的学生 mastery = 20。教师可能会困惑——"这个学生明明全对,为什么在左下角?"

**权衡**: 这是设计选择,不一定是 bug。但需要在 UI 上明确标注"掌握度 = 质量 × 进度"而非纯粹的正确率。

### 3.4 aiActivity 上限偏低 (Low)

**问题**: `min(1, aiRounds / 5)` — 5 轮 AI 交互就封顶。在 discuss 环节,一个深度讨论的学生可能用 6-8 轮,但和 5 轮的学生一样得分。

---

## 4. 改进方案

### 4.1 基于 manifest 的动态 stuck 阈值 (推荐)

用每步的预期时长 (`manifest.readingSteps[].duration`) 作为参考:

```ts
function computeEngagement(
  student: Student,
  totalSteps: number,
  aiRounds: number,
  expectedDuration?: number, // 当前步预期分钟数,来自 manifest
): number {
  const progressRate = totalSteps > 0
    ? Math.min(1, student.currentTask / totalSteps) : 0

  // 动态阈值: 预期时长的 1.5 倍;如果没有预期时长,默认 5 分钟
  let stuckPenalty = 0
  if (student.stepStartedAt) {
    const elapsed = Date.now() - new Date(student.stepStartedAt).getTime()
    const thresholdMs = (expectedDuration ?? 5) * 60_000 * 1.5
    stuckPenalty = Math.min(1, Math.max(0, (elapsed - thresholdMs) / thresholdMs))
  }

  const aiActivity = Math.min(1, aiRounds / 5)
  const raw = 0.4 * progressRate + 0.3 * (1 - stuckPenalty) + 0.3 * aiActivity
  return Math.round(raw * 100)
}
```

**变化**:
- 阈值从固定 3 分钟 → `预期时长 × 1.5` (如 Scan & Build 15 分钟 × 1.5 = 22.5 分钟才开始扣分)
- penalty 从二值 (0/1) → 线性渐变 (超过阈值后线性增长到 1.0)
- 需要在 `computeStudentQuadrants` 调用时传入当前步的 `duration`

### 4.2 数据流变更

```
manifest.readingSteps[currentStepIdx].duration
  ↓
SummaryOverlay / SummaryTab 传入 computeStudentQuadrants
  ↓
computeEngagement 接收 expectedDuration 参数
```

需要改动:
1. `computeStudentQuadrants` 签名加参数: `taskDurations: Record<number, number>`
2. `computeEngagement` 签名加参数: `expectedDuration?: number`
3. `SummaryOverlay.tsx` / `SummaryTab.tsx` 构建 `taskDurations` 从 `taskSteps[].duration`
4. `TeacherShell.tsx` 无需改动 (已传入 `taskSteps`)

### 4.3 可选: mastery 标注优化

在 UI 上将"掌握度"tooltip 改为"掌握度 = 正确率 × 完成率",帮助教师理解为什么高分学生可能掌握度低。

---

## 5. 附录: 数据来源

| 字段 | 来源 | 说明 |
|------|------|------|
| `student.submissions[stepIdx].score.total` | `getState()` API → 后端 GradingService | 0-100 百分制 |
| `student.currentTask` | Student entity | task number, 1-indexed |
| `student.stepStartedAt` | Student entity, 每次 currentTask 变更时重置 | ISO 时间戳 |
| `questions[]` | ChatMessage entity, category='ask' | AI 问答记录 |
| `stepMetrics[taskNum].avgScore` | MetricsAggregator | 全班平均分 |
| `manifest.readingSteps[].duration` | 课程 manifest | 预期分钟数 |
