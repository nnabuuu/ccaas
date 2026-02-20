# ExercisePlan Config Schema

**接口位置**: Skill A (Exercise Planner) → MCP Tool → Skill B (Animation Engineer)

这是用户侧 Agent 输出的训练方案格式。它**不包含任何动画细节**（关键帧、关节角度、figure类型），只描述"练什么、怎么练"。

## Schema 定义

```typescript
interface ExercisePlan {
  /** 方案元数据 */
  meta: {
    title: string;           // "脊柱友好训练" / "膝关节术后康复"
    subtitle?: string;       // "腰椎管狭窄 · 核心稳定"
    locale: "zh-CN" | "en";  // 界面语言
  };

  /** 全局训练原则（展示在页面顶部，默认折叠） */
  principles?: {
    do: string[];            // 推荐原则
    avoid: string[];         // 禁忌事项
    frequency?: string;      // 建议频率描述
  };

  /** 动作列表（有序，决定训练顺序） */
  exercises: ExerciseSpec[];
}

interface ExerciseSpec {
  /** 动作标识 — 已知动作使用标准ID，自定义动作使用 "custom" */
  type: KnownExerciseType | "custom";

  /** 自定义动作的自然语言描述（仅 type="custom" 时必填） */
  customDescription?: string;

  /** 训练参数 */
  sets: number;              // 组数 (1-10)
  reps: number;              // 每组次数 (1-50)
  restSec: number;           // 组间休息秒数 (10-120)
  tempo: string;             // 节奏描述 "慢速3秒下3秒回" / "快节奏30秒/组"

  /** 姿势指导（面向用户的自然语言） */
  howTo: string[];           // 分步说明，每步一个字符串
  safety: string[];          // 安全提醒（简短标签式）

  /** 可选覆盖 */
  overrides?: {
    nameZh?: string;         // 覆盖默认中文名
    nameEn?: string;         // 覆盖默认英文名
    muscles?: string;        // 覆盖默认目标肌群描述
    phases?: string[];       // 覆盖默认阶段名称
    phaseDurations?: number[]; // 覆盖默认阶段时长(秒)
  };
}

/** 已知动作类型（Skill B 可查表获取 keyframes） */
type KnownExerciseType =
  | "pelvic-tilt"        // 骨盆前倾
  | "dead-bug"           // 死虫式
  | "cat-cow"            // 猫牛式
  | "seated-boxing"      // 坐姿拳击
  | "bridge"             // 臀桥
  | "bird-dog"           // 鸟狗式
  | "seated-march"       // 坐姿踏步
  | "wall-slide"         // 靠墙滑动
  ;
```

## 示例

### 腰椎管狭窄康复方案

```json
{
  "meta": {
    "title": "脊柱友好训练",
    "subtitle": "核心稳定 · 椎管减压",
    "locale": "zh-CN"
  },
  "principles": {
    "do": [
      "腰椎保持中立位或轻度屈曲",
      "优先核心抗伸展训练",
      "椅子辅助有氧代替站立负重"
    ],
    "avoid": [
      "小燕飞、仰卧起坐",
      "深蹲负重、弯腰硬拉",
      "俯卧位、腰椎过伸"
    ],
    "frequency": "每天5-10分钟基础训练，每周2-3次加入坐姿拳击做有氧"
  },
  "exercises": [
    {
      "type": "pelvic-tilt",
      "sets": 3,
      "reps": 12,
      "restSec": 20,
      "tempo": "5秒保持",
      "howTo": [
        "仰卧屈膝，双脚平放地面，与髋同宽",
        "双手自然放在身体两侧",
        "呼气时收紧下腹，想象肚脐向脊柱方向靠拢",
        "轻轻将腰部压向地面（毛巾垫在腰下辅助感知）",
        "保持5秒，正常呼吸，然后缓慢放松"
      ],
      "safety": ["不需要大幅度，微微收紧即可", "这是Dead Bug的基础动作，先熟练再进阶"]
    },
    {
      "type": "dead-bug",
      "sets": 3,
      "reps": 10,
      "restSec": 30,
      "tempo": "慢速 3秒下3秒回",
      "howTo": [
        "仰卧，双臂伸向天花板，双腿抬起屈膝90°",
        "腰下垫毛巾当「传感器」，感知腰部是否离开地面",
        "呼气时，对侧手臂和腿同时缓慢伸出（右腿+左臂）",
        "全程腰部保持自然曲度，不要拱起——幅度以腰不离地为准",
        "吸气缓慢回收，换另一侧重复"
      ],
      "safety": ["感到腰部不适立刻减小伸出幅度", "速度要慢，控制比幅度更重要"]
    },
    {
      "type": "cat-cow",
      "sets": 3,
      "reps": 8,
      "restSec": 20,
      "tempo": "配合呼吸",
      "howTo": [
        "四点跪姿：双手在肩正下方，双膝在髋正下方",
        "呼气时收腹弓背，像猫一样把背拱到最高，头自然下垂",
        "保持2-3秒，感受脊柱一节一节打开",
        "吸气时缓慢回正，可以轻微塌腰但幅度减半",
        "全程动作缓慢，配合呼吸节奏"
      ],
      "safety": ["弓背(猫式)充分做，椎管打开", "塌腰方向要轻柔，幅度减半"]
    },
    {
      "type": "seated-boxing",
      "sets": 4,
      "reps": 20,
      "restSec": 30,
      "tempo": "快节奏 30秒/组",
      "howTo": [
        "坐稳椅子，双脚平放地面，背靠椅背",
        "双拳护在下巴两侧，肘部夹紧身体（防守姿势）",
        "左直拳Jab：左拳向前直线打出，拳心朝下，微曲不锁肘",
        "右直拳Cross：右拳发力穿过中线，带动躯干轻微旋转",
        "勾拳Hook/上勾Upper：手臂弯曲发力，核心收紧对抗旋转"
      ],
      "safety": ["核心收紧，不要用腰代偿", "心率过高就休息"]
    }
  ]
}
```

### 自定义动作示例

当物理治疗师教了患者一个标准库中没有的动作时：

```json
{
  "type": "custom",
  "customDescription": "改良版鸟狗式：四点跪姿，右手和右腿（同侧）同时缓慢伸出，保持3秒。与标准鸟狗式的区别是同侧而非对侧，减少旋转扭矩",
  "sets": 3,
  "reps": 8,
  "restSec": 25,
  "tempo": "慢速 3秒伸3秒回",
  "howTo": [
    "四点跪姿，手在肩下，膝在髋下",
    "同侧手脚（而非对侧）同时缓慢伸出",
    "保持3秒，感受同侧核心稳定",
    "缓慢回收，换另一侧"
  ],
  "safety": ["保持骨盆水平不倾斜"]
}
```

## 设计决策

### 为什么 howTo 和 safety 放在 ExercisePlan 而非 RenderConfig？

因为它们是**面向用户的语言**，由 Skill A 根据用户的理解水平和具体病情生成。同样的 Dead Bug 动作，对康复初期患者和健身爱好者的 howTo 描述应该不同。Skill B 不掌握这个上下文。

### 为什么有 overrides？

标准动作库有默认的 phases 和 phaseDurations，但 Skill A 可能需要调整。比如对初学者，Dead Bug 的"伸出"阶段从 3 秒延长到 5 秒。overrides 让 Skill A 有微调能力，同时保持 Skill B 的默认值作为 fallback。

### type vs customDescription

`type` 是 Skill B 的查表 key。当 `type = "custom"` 时，Skill B 切换到 LLM 模式，根据 `customDescription` 推理关节运动学并生成 keyframes。
