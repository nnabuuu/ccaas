# 系统架构

## 两层 Skill 编排模式

本系统的核心设计来自一个观察：面向用户的知识（"你的腰椎狭窄适合做 Dead Bug"）和面向渲染的知识（"Dead Bug 的右髋起始角度是 -80°"）属于完全不同的领域，需要不同的上下文、不同的迭代周期、不同的缓存策略。

### Session 拓扑

```
┌─ User Session ────────────────────────────────────────────┐
│                                                            │
│  User ↔ Agent + Skill A (Exercise Planner)                │
│    │                                                       │
│    │  Agent 理解用户的诊断报告、身体状况、训练偏好          │
│    │  输出 ExercisePlan JSON                               │
│    │                                                       │
│    ├─ MCP Tool Call: create_training_page(plan)            │
│    │   │                                                   │
│    │   ▼  ┌─ Internal Session (isolated context) ──────┐  │
│    │      │                                             │  │
│    │      │  Skill B (Animation Engineer)               │  │
│    │      │  只看到: exercise types + parameters        │  │
│    │      │  看不到: 用户隐私、诊断细节                  │  │
│    │      │  输出: RenderConfig JSON                    │  │
│    │      │                                             │  │
│    │      │  ⚡ 热路径: 查 exercise-library.json        │  │
│    │      │  🧠 冷路径: LLM 生成新动作 keyframes        │  │
│    │      │                                             │  │
│    │      └─────────────────────────────────────────────┘  │
│    │      │                                                │
│    │      ▼  RenderConfig                                  │
│    │   Rendering Service → Hosted URL                      │
│    │                                                       │
│    ◄─ URL returned to agent                                │
│    │                                                       │
│    └→ "你的训练页面: https://r.jijian.dev/abc123"          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 上下文隔离原则

Skill A 的 context window 包含用户敏感信息：

```
- MRI 报告文本（"L4-L5 椎管前后径 9mm"）
- 身体指标（BMI、年龄、病史）
- 个人偏好（"我膝盖也不好"）
- 对话历史
```

Skill B 只需要接收**脱敏后的结构化指令**：

```json
{
  "exercises": [
    { "type": "dead-bug", "sets": 3, "reps": 10, "tempo": "slow" }
  ]
}
```

这不是人为的设计选择，而是隐私保护的必然要求。

### Skill B 的双模式

**热路径（查表）**: 已有动作库中的 exercise → 直接从 `exercise-library.json` 查出 keyframes，不需要 LLM 推理。延迟 < 50ms。

```
ExercisePlan { type: "dead-bug", sets: 3 }
    → lookup("dead-bug") 
    → 命中缓存
    → RenderConfig { keyframes: [...], figure: "lying", ... }
```

**冷路径（LLM 生成）**: 用户描述了一个库中没有的动作（"物理治疗师教了我一个改良版鸟狗式"），Skill B 用 LLM 生成关键帧。

```
ExercisePlan { type: "custom", description: "改良版鸟狗式: 四点跪姿，同侧手脚伸出..." }
    → LLM (Skill B prompt + 解剖学知识)
    → RenderConfig { keyframes: [...], figure: "cat", ... }
```

## 渲染引擎架构

### 动画引擎（从 fitness-v3.jsx 提取）

```
Animation Pipeline:

  keyframes[]          progress (0 → N-1)       joint angles
  ┌──────────┐        ┌──────────────────┐      ┌────────────┐
  │ 关键帧数组 │ ──→   │ interpolate()    │ ──→  │ 当前关节角度 │
  │ (声明式)   │       │ sine easing      │      │ (每帧计算)  │
  └──────────┘        └──────────────────┘      └──────┬─────┘
                                                       │
                                                       ▼
                                              ┌────────────────┐
                                              │ jointPos()     │
                                              │ 正向运动学      │
                                              │ angle → (x,y)  │
                                              └──────┬─────────┘
                                                     │
                                                     ▼
                                              ┌────────────────┐
                                              │ SVG Renderer   │
                                              │ Bone/Head/Hand │
                                              │ z-order layers │
                                              └────────────────┘
```

### Figure 类型与渲染器

每种体位（lying, cat, seated, standing...）对应一个 Figure 渲染器。渲染器负责：

1. 从关节角度计算所有骨骼端点位置（正向运动学）
2. 按正确的前后遮挡关系分层渲染（远侧 → 躯干 → 近侧）
3. 渲染动态视觉反馈（肌肉发光、运动箭头、阶段标签）

```typescript
// Figure 渲染器接口
interface FigureRenderer {
  type: FigureType;                          // "lying" | "cat" | "seated" | ...
  render(angles: Record<string, number>): SVGElement;
}

// 当前已实现的 Figure 类型
// lying  → 仰卧位（骨盆前倾、死虫式、桥式等）
// cat    → 四点跪姿（猫牛式、鸟狗式等）
// seated → 坐姿（坐姿拳击、坐姿旋转等）
```

### 关节角度坐标系

**仰卧位 (lying)**:
- 人物头朝左，脚朝右
- 0° = 正右（沿地面），-90° = 正上，+90° = 正下
- `rHip: -75` = 右大腿向上偏右倾斜（屈膝仰卧的自然角度）
- `tilt: 0~1` = 骨盆后倾程度（0=自然，1=完全贴地）

**猫式 (cat)**:
- `spine: -1~+0.3` = 脊柱曲率（负=弓背猫式，正=塌腰牛式）
- `headDrop: -10~+20` = 头部下垂程度

**坐姿 (seated)**:
- `lArmX/rArmX` = 手臂水平延伸距离（0=防守位，150=完全伸出）
- `lArmY/rArmY` = 手臂垂直偏移（负=向上）

## Hosting 策略

### 方案 A: Hash URL（推荐起步）

RenderConfig 序列化 → base64 编码 → URL hash parameter

```
https://r.jijian.dev/#config=eyJleGVyY2lzZXMiOlsi...
```

优点：零后端存储，CDN 部署即可
缺点：URL 可能很长（但 RenderConfig 通常 < 5KB，base64 后 < 8KB）

### 方案 B: 短链接 + KV 存储

RenderConfig 存入 Cloudflare KV → 生成短 ID

```
https://r.jijian.dev/t/abc123
```

优点：URL 短，可追踪访问
缺点：需要 KV 存储（Cloudflare Workers KV 免费额度足够）

### 方案 C: 持久化 + 用户账户

适合后期扩展（训练记录、进度追踪），需要数据库。
