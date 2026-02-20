# RenderConfig Schema

**接口位置**: Skill B (Animation Engineer) → Rendering Service

这是渲染服务接收的完整配置，包含所有动画数据。渲染服务是**纯确定性的**——同一 RenderConfig 永远产出相同的页面。

## Schema 定义

```typescript
interface RenderConfig {
  /** 页面元数据 */
  meta: {
    title: string;
    subtitle?: string;
    locale: "zh-CN" | "en";
    theme?: "dark" | "light";       // 默认 "dark"
  };

  /** 训练原则（可选，默认折叠展示） */
  principles?: {
    do: string[];
    avoid: string[];
    frequency?: string;
  };

  /** 动作列表（完整渲染数据） */
  exercises: ExerciseRenderData[];
}

interface ExerciseRenderData {
  /** 标识 */
  id: string;                        // unique key, e.g. "dead-bug"
  name: string;                      // English name
  nameZh: string;                    // 中文名

  /** 训练参数 */
  sets: number;
  reps: number;
  restSec: number;
  tempo: string;

  /** 展示内容 */
  muscles: string;                   // 目标肌群描述
  howTo: string[];                   // 分步指导
  safety: string[];                  // 安全提醒标签

  /** 动画阶段定义 */
  phases: string[];                  // 阶段名称 (与 keyframes 对应)
  phaseDurations: number[];          // 每阶段秒数 (length = phases.length)

  /** 骨架动画数据 */
  figure: FigureType;                // 渲染器类型
  keyframes: Keyframe[];             // 关键帧数组 (length = phases.length + 1)

  /** 可选：视觉增强 */
  visualHints?: VisualHint[];
}

/** Figure 类型决定使用哪个 SVG 渲染器 */
type FigureType = "lying" | "cat" | "seated" | "standing";

/** 关键帧 — 键值对，键名取决于 FigureType */
type Keyframe = Record<string, number>;

/** 视觉提示（运动箭头、标签、发光效果等） */
interface VisualHint {
  type: "label" | "glow" | "arrow" | "indicator";
  /** 触发条件：关键帧字段名 + 阈值 */
  trigger: {
    field: string;                   // keyframe 中的字段名
    condition: "gt" | "lt" | "eq";   // 比较方式
    value: number;                   // 阈值
  };
  /** 展示内容 */
  text?: string;                     // label 类型的文字
  color?: string;                    // 颜色 (hex)
  position?: "top" | "bottom" | "left" | "right" | "center";
}
```

## 各 FigureType 的 Keyframe 字段

### `lying` — 仰卧位

适用动作：骨盆前倾、死虫式、臀桥、仰卧腿交替

```typescript
interface LyingKeyframe {
  rHip: number;    // 右髋角度 (deg)，0=平躺，负值=向上抬起
  rKnee: number;   // 右膝角度 (deg)，相对于大腿方向
  lHip: number;    // 左髋角度
  lKnee: number;   // 左膝角度
  rSh: number;     // 右肩角度 (deg)，控制手臂方向
  lSh: number;     // 左肩角度
  tilt: number;    // 骨盆后倾程度 (0~1)，0=自然，1=完全贴地
}
```

**坐标系说明**:
- 人物头朝左脚朝右（侧视图）
- 0° = 正右（沿地面方向）
- -90° = 正上方
- +90° = 正下方（向地面）
- 关节链：髋 → 膝 → 脚（正向运动学）
- 肩 → 肘 → 手（正向运动学）

**仰卧位参考角度**:
```
静息屈膝仰卧:   rHip ≈ -75, rKnee ≈ 75
腿完全伸直:     rHip ≈ -15, rKnee ≈ 5
手臂放身侧:     rSh ≈ 100 (手在身体两侧地面上)
手臂举过头顶:   rSh ≈ -160 (手在头后方)
手臂指向天花板: rSh ≈ -85
```

### `cat` — 四点跪姿

适用动作：猫牛式、鸟狗式

```typescript
interface CatKeyframe {
  spine: number;     // 脊柱曲率: -1=完全弓背(猫), 0=中立, +0.3=轻微塌腰(牛)
  headDrop: number;  // 头部下垂: 正值=低头, 负值=抬头
}
```

**注意**: 塌腰(牛式)的 `spine` 上限建议不超过 +0.3，对腰椎狭窄患者更安全。弓背(猫式)可以到 -1.0 充分打开椎管。

### `seated` — 坐姿

适用动作：坐姿拳击、坐姿踏步、坐姿旋转

```typescript
interface SeatedKeyframe {
  lArmX: number;    // 左臂水平延伸 (px offset), 0=防守位
  lArmY: number;    // 左臂垂直偏移 (px), 负=向上
  rArmX: number;    // 右臂水平延伸
  rArmY: number;    // 右臂垂直偏移
}
```

**坐姿拳击参考值**:
```
防守姿势:  lArmX=0, lArmY=0
Jab 直拳:  lArmX=150, lArmY=-12
Hook 勾拳: lArmX=100, lArmY=-40
Uppercut:  rArmX=60, rArmY=-65
```

### `standing` — 站姿 (待实现)

预留，适用动作：靠墙滑动、站姿提踵

## 完整示例

### Dead Bug 的 RenderConfig

```json
{
  "id": "dead-bug",
  "name": "Dead Bug",
  "nameZh": "死虫式",
  "sets": 3,
  "reps": 10,
  "restSec": 30,
  "tempo": "慢速 3秒下3秒回",
  "muscles": "腹横肌 · 腹直肌 · 髂屈肌",
  "howTo": [
    "仰卧，双臂伸向天花板，双腿抬起屈膝90°",
    "腰下垫毛巾当「传感器」，感知腰部是否离开地面",
    "呼气时，对侧手臂和腿同时缓慢伸出（右腿+左臂）",
    "全程腰部保持自然曲度，不要拱起——幅度以腰不离地为准",
    "吸气缓慢回收，换另一侧重复"
  ],
  "safety": ["感到腰部不适立刻减小伸出幅度", "速度要慢，控制比幅度更重要"],
  "phases": ["起始位", "右腿伸出+左臂", "回收", "左腿伸出+右臂", "回收"],
  "phaseDurations": [2, 3, 2, 3, 2],
  "figure": "lying",
  "keyframes": [
    { "rHip": -80, "rKnee": 80, "lHip": -77, "lKnee": 77, "rSh": -85, "lSh": -80, "tilt": 0 },
    { "rHip": -80, "rKnee": 80, "lHip": -77, "lKnee": 77, "rSh": -85, "lSh": -80, "tilt": 0 },
    { "rHip": -25, "rKnee": 8,  "lHip": -77, "lKnee": 77, "rSh": -85, "lSh": -155, "tilt": 0 },
    { "rHip": -80, "rKnee": 80, "lHip": -77, "lKnee": 77, "rSh": -85, "lSh": -80, "tilt": 0 },
    { "rHip": -80, "rKnee": 80, "lHip": -20, "lKnee": 6,  "rSh": -160, "lSh": -80, "tilt": 0 },
    { "rHip": -80, "rKnee": 80, "lHip": -77, "lKnee": 77, "rSh": -85, "lSh": -80, "tilt": 0 }
  ],
  "visualHints": [
    {
      "type": "arrow",
      "trigger": { "field": "rHip", "condition": "gt", "value": -60 },
      "text": "→",
      "color": "#22d3ee",
      "position": "right"
    },
    {
      "type": "glow",
      "trigger": { "field": "rHip", "condition": "gt", "value": -60 },
      "color": "#22d3ee",
      "position": "center"
    }
  ]
}
```

## keyframes 数组长度规则

`keyframes.length = phases.length + 1`

原因：N 个阶段有 N+1 个边界点。第一个 keyframe 是初始姿态，最后一个是动作循环结束回到的姿态（通常等于第一个）。

```
phases:    [  "起始位",  "右腿伸出", "回收",  "左腿伸出", "回收"  ]
keyframes: [kf0,      kf1,       kf2,    kf3,       kf4,      kf5]
           ↑起点                                              ↑终点(=起点)
```

动画引擎在 kf[i] 和 kf[i+1] 之间做 sine easing 插值，`phaseDurations[i]` 控制这段插值的时长。
