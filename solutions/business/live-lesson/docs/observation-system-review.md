# Observation 系统 Review：教师端能否看到所有学生行为？

> 审计日期: 2026-05-21

## 背景

Review 当前 Observation 体系，回答三个核心问题：
1. 每个 phase / sub-phase 的统计信息能否被 review？
2. 每个 sub-phase 能否看到特定学生的行为信息（Drawer 展开）？
3. 每个学生的所有环节都能被看到？

---

## 当前架构概览

```
教师视角
├── TeacherShell 左侧栏
│   ├── SubTaskRow: 每个 step 的完成人数、均分、ProgressBar(phase分布)
│   └── 点击 step → 打开 ObserveDrawer
│
├── ObserveDrawer (2层)
│   ├── Layer 0: 全班聚合视图 (ClassView)
│   └── Layer 1: 单个学生详情 (StudentView)
│
├── 3-Tab 面板
│   ├── 讨论洞察: ClusterStats + 活动流
│   ├── 学生分析: 四象限 + 弱维度 + 推荐提问
│   └── 课堂状态: Alerts + Coaching + Indicators
│
└── StudentModal: 点击学生名 → Journey Strip + 步骤详情
```

---

## 逐层分析

### 一、Phase 级统计信息

| Phase | 教师能看到？ | 方式 | 缺口 |
|-------|------------|------|------|
| **listen** | ⚠️ 部分 | ProgressBar 显示"阅读中"人数 | 无耗时统计、无完成率 |
| **practice** | ✅ 完整 | stepMetrics: avgScore, completionRate, byDimension, avgTime | — |
| **discuss** | ✅ 完整 | DiscussObserveHandler: goalReachedRate, avgRounds, avgTime, clusterCoverage; DiscussInsightTab: 聚类+活动流 | — |
| **takeaway** | ❌ 无 | 无任何统计 | 无法知道多少人看了总结、停留多久 |
| **personal-touch** | ❌ 无 | PersonalizationService 无事件发射 | 完全不可见 |
| **bonus** | ⚠️ 部分 | Student entity 有 `bonusStatus` 字段 | 无 observe handler，无详情 |

### 二、Sub-Phase 级统计（以 math-difference-of-squares Step 1 为例）

**Step 1 (探索发现) — 6 个 sub-phase:**

| Sub-Phase | Phase ID | 教师能看到？ | 方式 |
|-----------|----------|------------|------|
| 讲解 | listen | ⚠️ | ProgressBar 人数 |
| 练习1 | practice-1 | ✅ | RCQ observe (image-upload handler) |
| 练习2 | practice-2 | ✅ | RCQ observe |
| 练习3 | practice-3 | ✅ | RCQ observe |
| 引导发现 | discovery | ✅ | GuidedDiscoveryObserveHandler: 4 sub-step pass rate + error |
| 小结 | takeaway | ❌ | 无统计 |

**Guided Discovery 4 个 sub-step:**

| Sub-Step | 全班统计？ | 单学生详情？ | 数据 |
|----------|----------|------------|------|
| observation_choice | ✅ | ✅ | passedRate, errors, per-student stepResults |
| formula_blanks | ✅ | ✅ | passedRate, errors, per-student answers |
| derivation_blank | ✅ | ✅ | passedRate, errors, per-student answers |
| text_blanks | ✅ | ✅ | passedRate, errors, per-student answers |

**Steps 2-6 (标准练习):**

| Phase | 教师能看到？ | Drawer? |
|-------|------------|---------|
| listen (ExampleDemoCard) | ⚠️ 仅人数 | 无 Drawer |
| practice (RCQ photo) | ✅ | ✅ ImageUpload ClassView/StudentView |
| discuss | ✅ | ✅ Discuss ClassView/StudentView |
| takeaway | ❌ | 无 Drawer |

### 三、单学生全环节可见性（StudentModal）

| 信息 | 可见？ | 来源 |
|------|-------|------|
| 当前 step + phase | ✅ | `student.currentTask` + `student.currentPhase` |
| Journey Strip (所有 step 完成状态) | ✅ | `submissions` + `currentTask` 推导 |
| 当前 phase 标签 | ✅ | `PHASE_LABELS[currentPhase]` |
| 练习得分 + 维度分析 | ✅ | `submissions[stepIdx].score` |
| 讨论状态 (达标/讨论中) | ✅ | `student.discussMeta` |
| 提交图片预览 | ✅ | `submission.data` |
| Scaffold 级别 | ✅ | `submission.data.parts` |
| AI 提问记录 | ✅ | `AiQuestion` 表 |
| 第一次尝试 vs 最终答案 | ✅ | `data.firstAttemptAnswers` |
| 翻译使用 | ⚠️ | 仅 lifecycle event，无详情 |
| **phase 耗时** | ❌ | 仅有 step 级 `stepStartedAt`，无 phase 时间戳 |
| **listen 确认时间** | ❌ | 无记录 |
| **takeaway 查看时间** | ❌ | 无记录 |
| **personal-touch 交互** | ❌ | 无记录 |

---

## Observe Handler 覆盖表

| 练习类型 | Handler | 状态 | ClassView | StudentView |
|----------|---------|------|-----------|-------------|
| mc (选择题) | McObserveHandler | ✅ | 选项分布、错误率、misconception | 逐题答案 |
| matrix | MatrixObserveHandler | ✅ | 行列质量、what/why 评分 | 逐行详情 |
| evidence | EvidenceObserveHandler | ✅ | 功能选择、证据命中率 | section 详情 |
| map | MapObserveHandler | ✅ | 坐标偏差、推理分析 | 放置+理由 |
| image-upload | ImageUploadObserveHandler | ✅ | 评分分布、rubric | 图片+反馈 |
| rich-content-quiz | → image-upload fallback | ✅ | scaffold 分布、error clusters | parts+attempts |
| guided-discovery | GdObserveHandler | ✅ | sub-step pass rate、errors | 逐步答案 |
| discuss | DiscussObserveHandler | ✅ | 达标率、轮数、聚类 | 完整对话 |
| fill-blank | ❌ stub | 返回 `{ type, students: [] }` | 无 | 无 |
| match | ⚠️ 前端→mc | 前端映射为 `mc`，但提交数据可能不兼容 | 待验证 | 待验证 |
| stance | ❌ 无 | 未实现 | — | — |
| order | ⚠️ 前端→mc | 前端映射为 `mc`，但提交数据可能不兼容 | 待验证 | 待验证 |

> **注**: `match` 和 `order` 在前端 `teacher-helpers.ts:241` 映射为 `mc`，因此 ObserveDrawer 会尝试用 McClassView/McStudentView 渲染。但后端 `observe-registry.ts:60` 对未注册类型抛 BadRequestException。由于前端发送的是映射后的 `mc` 类型，实际会走 McObserveHandler —— 但 match/order 的提交数据格式与 quiz 不同，可能导致渲染异常。

---

## Observation Event Handler 覆盖表

| Handler | 触发事件 | 产出 |
|---------|---------|------|
| JoinHandler | student_join | lifecycle observation |
| ExerciseHandler | exercise_result | student_observation_changed |
| ChatTurnHandler | AI ask/discuss message | 对话记录 |
| StatusChangeHandler | student_observation_changed | LLM-derived status (active/struggling/stuck/cruising) |
| StepCompleteHandler | step_complete | progress observation |
| SystemEventHandler | translate_request, discuss_complete, etc. | lifecycle events |

**缺失事件**: 无 `phase_change`, `takeaway_viewed`, `personal_touch_start/complete` 事件。

---

## 回答三个核心问题

### Q1: 每个 phase / sub-phase 的统计信息能被 review 吗？

**practice 和 discuss: ✅ 完整**，有得分、维度、耗时、聚类等丰富统计。
**guided-discovery sub-steps: ✅ 完整**，4 个子步骤都有 pass rate + error 分布。
**listen: ⚠️ 仅实时人数**，无耗时/完成率历史。
**takeaway + personal-touch: ❌ 完全无统计**。

### Q2: 每个 sub-phase 能看到特定学生的行为信息吗？（Drawer 展开）

**practice: ✅** ImageUpload/RCQ StudentView — 图片、分数、AI反馈、scaffold。
**discuss: ✅** Discuss StudentView — 完整对话、轮数、达标状态。
**guided-discovery sub-steps: ✅** GD StudentView — 每个子步骤的具体答案、对错。
**listen / takeaway / personal-touch: ❌ 无 Drawer**。

### Q3: 每个学生的所有环节都能被看到吗？

**StudentModal** 显示 journey strip + 当前 phase + 练习/讨论详情: **大部分可见**。
**缺少**: phase 级时间线（只知"现在在哪"，不知"每个 phase 花了多久"）、listen/takeaway/personal-touch 记录。

---

## 缺口优先级

| # | 缺口 | 影响 | 优先级 |
|---|------|------|--------|
| 1 | Phase 转换无事件记录 | 无法分析 phase 耗时 | 中 |
| 2 | Takeaway 完全不可观察 | 较小（被动阅读） | 低 |
| 3 | Personal-touch 完全不可观察 | 无法评估个性化反馈效果 | 低 |
| 4 | Listen 缺乏深度数据 | 较小（被动接收） | 低 |
| 5 | fill-blank/match/stance/order handler 不完整 | 仅影响使用这些类型的课程 | 按需 |

---

## 关键文件索引

### Backend Observe Handlers
- `backend/src/classroom/observe/observe-registry.ts` — Handler 自动发现 + 类型分发
- `backend/src/classroom/observe/handlers/mc.handler.ts` — Quiz/MC
- `backend/src/classroom/observe/handlers/matrix.handler.ts` — Matrix
- `backend/src/classroom/observe/handlers/evidence.handler.ts` — Select-Evidence
- `backend/src/classroom/observe/handlers/map.handler.ts` — Map
- `backend/src/classroom/observe/handlers/discuss.handler.ts` — Socratic Discussion
- `backend/src/classroom/observe/handlers/image-upload.handler.ts` — Image Upload (+ RCQ fallback)
- `backend/src/classroom/observe/handlers/guided-discovery.handler.ts` — Guided Discovery

### Backend Observation Handlers
- `backend/src/classroom/observation/handlers/join-handler.ts`
- `backend/src/classroom/observation/handlers/exercise-handler.ts`
- `backend/src/classroom/observation/handlers/chat-turn-handler.ts`
- `backend/src/classroom/observation/handlers/status-change-handler.ts`
- `backend/src/classroom/observation/handlers/step-complete-handler.ts`
- `backend/src/classroom/observation/handlers/system-event-handler.ts`

### Frontend Teacher UI
- `frontend/src/components/teacher/ObserveDrawer.tsx` — 2-layer drawer (ClassView + StudentView)
- `frontend/src/components/teacher/SubTaskRow.tsx` — Step metrics row
- `frontend/src/components/teacher/StudentModal.tsx` — Student detail + journey strip
- `frontend/src/components/teacher/ProgressBar.tsx` — Phase distribution bar
- `frontend/src/components/teacher/teacher-helpers.ts` — Phase config, status helpers, observe type mapping
- `frontend/src/components/teacher/DiscussInsightTab.tsx` — 讨论洞察 tab
- `frontend/src/components/teacher/summary/SummaryTab.tsx` — 学生分析 tab
- `frontend/src/components/teacher/ClassroomStatusTab.tsx` — 课堂状态 tab

---

## 总体结论

核心教学环节（练习 + 讨论 + 引导发现）的观察能力**完整且深入**。主要缺口在被动环节（listen/takeaway）和辅助功能（personal-touch），对教学决策影响较小。
