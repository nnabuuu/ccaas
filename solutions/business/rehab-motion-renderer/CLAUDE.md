# CLAUDE.md — Rehab Motion Renderer

## 一句话

从医学检查报告出发，AI 生成个性化康复训练方案，渲染为带 SVG 骨架动画的交互式训练页面。

## 端口

| 服务 | 端口 |
|------|------|
| Core CCAAS backend | 3001 |
| Rehab frontend | 5286 |

## 目录结构

```
rehab-motion-renderer/
├── solution.json              # 即见平台配置
├── setup.sh                   # 一键启动
├── CLAUDE.md                  # 本文件
├── skills/
│   └── exercise-planner/
│       └── SKILL.md           # 康复规划 AI Skill
├── mcp-server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/index.ts           # write_output + get_exercise_library
├── frontend/
│   ├── package.json
│   ├── vite.config.ts         # 端口 5286
│   └── src/
│       ├── App.tsx            # 主布局（左聊天 + 右表单/预览）
│       ├── components/
│       │   ├── ChatPanel.tsx
│       │   ├── TrainingPlanForm.tsx
│       │   ├── TrainingPagePreview.tsx
│       │   └── figures/
│       │       ├── Primitives.tsx
│       │       ├── LyingFigure.tsx
│       │       ├── CatFigure.tsx
│       │       └── SeatedFigure.tsx
│       ├── engine/
│       │   └── animation.ts   # ease() + jointPos() + interpolate()
│       ├── hooks/
│       │   ├── useRehabSession.ts
│       │   └── useOutputSync.ts
│       ├── types/index.ts
│       └── data/
│           └── exercise-library.json
└── design/                    # 只读设计材料（不修改）
```

## 快速启动

```bash
# 先确保 CCAAS 后端运行
cd /path/to/ccaas
npm run dev:backend

# 启动 rehab solution
cd solutions/rehab-motion-renderer
./setup.sh
```

## 数据流

```
用户描述病情
  → ChatPanel → CCAAS http://localhost:3001 (SSE)
    → exercise-planner Skill
      → get_exercise_library（获取可用动作）
      → write_output × N（每个字段一次调用）
        → output_update → useOutputSync → pendingUpdates
          → SyncButton 显示（per field）
            → 用户点击 Sync → applyField()
              → exercises JSON → 查 exercise-library.json 补 keyframes
                → TrainingPagePreview 渲染 SVG 动画
```

## SyncFields（10个）

| Field | 类型 | 描述 |
|-------|------|------|
| title | string | 训练标题 |
| subtitle | string | 副标题 |
| medicalSummary | string | 医学摘要 |
| contraindications | string | 禁忌事项 |
| principlesDo | string | 推荐原则 |
| principlesAvoid | string | 禁忌原则 |
| frequency | string | 训练频率 |
| exercises | JSON string | ExerciseSpec[] JSON |
| progressionPlan | string | 进阶计划 |
| medicalReminder | string | 医疗提醒 |

## exercises 字段格式

AI 输出 `JSON.stringify(ExerciseSpec[])`:
```json
[
  {
    "type": "pelvic-tilt",
    "sets": 3,
    "reps": 12,
    "restSec": 20,
    "tempo": "5秒保持",
    "howTo": ["步骤1", "步骤2"],
    "safety": ["注意1"]
  }
]
```

前端 `applyField('exercises')` 时，查 `exercise-library.json` 补充 keyframes。

## 动画引擎

- **engine/animation.ts**: `ease()` + `jointPos()` + `interpolate()`
- **从 fitness-v3.jsx 直接移植，不修改任何动画参数**
- LyingFigure / CatFigure / SeatedFigure 也是直接移植

## CRITICAL: serverUrl 必须是绝对 URL

```typescript
// ✅ 正确
const SOCKET_URL = 'http://localhost:3001'

// ❌ 错误（会把请求发到前端端口 5286）
const SOCKET_URL = ''
const SOCKET_URL = '/'
```

## 可用动作库

| ID | 名称 | 体位 |
|----|------|------|
| pelvic-tilt | 骨盆前倾 | lying |
| dead-bug | 死虫式 | lying |
| cat-cow | 猫牛式 | cat |
| seated-boxing | 坐姿拳击 | seated |
