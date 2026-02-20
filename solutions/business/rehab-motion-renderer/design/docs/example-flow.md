# 端到端示例流程

## 场景

用户在 Jijian 平台（或 Claude）中发送消息：

> 我今天拿到了MRI报告，显示L4-L5节段椎管前后径约9mm，轻度椎管狭窄。走路超过500米左腿就开始发麻。医生说目前不需要手术，建议保守治疗加核心训练。我之前没有健身习惯，体重偏大BMI大概28。能帮我安排一个在家可以做的康复训练吗？

## Step 1: Skill A (Exercise Planner) 处理

Agent 加载 Skill A，分析用户的情况：

**病情评估**:
- L4-L5 轻度椎管狭窄（9mm，正常 > 12mm）
- 间歇性跛行（500m 触发）
- BMI 28（需要低冲击有氧）
- 零健身基础（需要从最简单的动作开始）

**禁忌推理**:
- ✗ 腰椎过伸类（小燕飞、Superman）→ 加重椎管狭窄
- ✗ 轴向负重（深蹲、硬拉）→ 椎间盘压力
- ✗ 高冲击有氧（跑步、跳绳）→ BMI + 关节负担
- ✓ 屈曲位训练 → 打开椎管空间
- ✓ 仰卧/四点跪姿 → 最小脊柱负荷
- ✓ 坐姿有氧 → 低冲击替代

**方案设计**:
- 从最基础的骨盆前倾开始（建立核心意识）
- 进阶到 Dead Bug（核心抗伸展）
- 猫牛式做脊柱灵活度
- 坐姿拳击替代站立有氧

Agent 输出 ExercisePlan JSON（见 Step 2）并调用 MCP tool。

## Step 2: MCP Tool Call

```typescript
// Agent 发起 MCP tool call
await mcp.call("create_training_page", {
  plan: {
    meta: {
      title: "脊柱友好训练",
      subtitle: "核心稳定 · 椎管减压",
      locale: "zh-CN"
    },
    principles: {
      do: [
        "腰椎保持中立位或轻度屈曲，避免过伸",
        "优先核心抗伸展训练（Dead Bug > 平板支撑）",
        "椅子辅助有氧代替站立负重训练"
      ],
      avoid: [
        "小燕飞、仰卧起坐、深蹲负重、弯腰硬拉",
        "俯卧位、腰椎过伸、长时间站立"
      ],
      frequency: "每天5-10分钟完成基础训练。每周2-3次加入坐姿拳击。感到腿部不适立即停止。"
    },
    exercises: [
      {
        type: "pelvic-tilt",
        sets: 3, reps: 12, restSec: 20,
        tempo: "5秒保持",
        howTo: [
          "仰卧屈膝，双脚平放地面，与髋同宽",
          "双手自然放在身体两侧",
          "呼气时收紧下腹，想象肚脐向脊柱方向靠拢",
          "轻轻将腰部压向地面（毛巾垫在腰下辅助感知）",
          "保持5秒，正常呼吸，然后缓慢放松"
        ],
        safety: ["不需要大幅度，微微收紧即可", "这是Dead Bug的基础动作，先熟练再进阶"]
      },
      {
        type: "dead-bug",
        sets: 3, reps: 10, restSec: 30,
        tempo: "慢速 3秒下3秒回",
        howTo: [
          "仰卧，双臂伸向天花板，双腿抬起屈膝90°",
          "腰下垫毛巾当「传感器」，感知腰部是否离开地面",
          "呼气时，对侧手臂和腿同时缓慢伸出（右腿+左臂）",
          "全程腰部保持自然曲度，不要拱起——幅度以腰不离地为准",
          "吸气缓慢回收，换另一侧重复"
        ],
        safety: ["感到腰部不适立刻减小伸出幅度", "速度要慢，控制比幅度更重要"]
      },
      {
        type: "cat-cow",
        sets: 3, reps: 8, restSec: 20,
        tempo: "配合呼吸",
        howTo: [
          "四点跪姿：双手在肩正下方，双膝在髋正下方",
          "呼气时收腹弓背，像猫一样把背拱到最高，头自然下垂",
          "保持2-3秒，感受脊柱一节一节打开",
          "吸气时缓慢回正，可以轻微塌腰但幅度减半",
          "全程动作缓慢，配合呼吸节奏"
        ],
        safety: ["弓背(猫式)充分做，椎管打开", "塌腰方向要轻柔，幅度减半"]
      },
      {
        type: "seated-boxing",
        sets: 4, reps: 20, restSec: 30,
        tempo: "快节奏 30秒/组",
        howTo: [
          "坐稳椅子，双脚平放地面，背靠椅背",
          "双拳护在下巴两侧，肘部夹紧身体（防守姿势）",
          "左直拳Jab：左拳向前直线打出，拳心朝下，微曲不锁肘",
          "右直拳Cross：右拳发力穿过中线，带动躯干轻微旋转",
          "勾拳Hook/上勾Upper：手臂弯曲发力，核心收紧对抗旋转"
        ],
        safety: ["核心收紧，不要用腰代偿", "心率过高就休息"]
      }
    ]
  }
});
```

## Step 3: MCP Server 内部处理

```typescript
// MCP Server 接收到 ExercisePlan
async function createTrainingPage(plan: ExercisePlan): Promise<string> {
  
  // 对每个 exercise，查表或调 Skill B 生成 RenderConfig
  const renderExercises = await Promise.all(
    plan.exercises.map(async (ex) => {
      if (ex.type !== "custom") {
        // 热路径：从 exercise-library.json 查表
        const template = exerciseLibrary[ex.type];
        return {
          id: ex.type,
          name: template.name,
          nameZh: template.nameZh,
          sets: ex.sets,
          reps: ex.reps,
          restSec: ex.restSec,
          tempo: ex.tempo,
          muscles: ex.overrides?.muscles ?? template.muscles,
          howTo: ex.howTo,
          safety: ex.safety,
          phases: ex.overrides?.phases ?? template.phases,
          phaseDurations: ex.overrides?.phaseDurations ?? template.phaseDurations,
          figure: template.figure,
          keyframes: template.keyframes,
          visualHints: template.visualHints,
        };
      } else {
        // 冷路径：调 Skill B (Animation Engineer) 的独立 session
        return await callSkillB(ex);
      }
    })
  );

  const renderConfig: RenderConfig = {
    meta: plan.meta,
    principles: plan.principles,
    exercises: renderExercises,
  };

  // 生成 hosted URL
  const url = await hostPage(renderConfig);
  return url;
}
```

## Step 4: Rendering Service

渲染服务收到 RenderConfig，注入到 React 组件中：

```typescript
// renderer/src/app.tsx
function App() {
  const config = useConfigFromURL();  // 从 URL hash 或 KV 加载
  
  if (!config) return <Loading />;
  
  return <TrainingPage config={config} />;
}
```

TrainingPage 组件的结构与当前 fitness-v3.jsx 一致，只是数据从 props 注入而非硬编码。

## Step 5: 用户收到回复

Agent 回复用户：

> 根据你的 MRI 报告和身体状况，我为你安排了一套脊柱友好的家庭康复训练。这 4 个动作都避免了腰椎过伸，从最基础的骨盆前倾开始，逐步进阶。
> 
> 🔗 你的训练页面：https://r.jijian.dev/t/abc123
> 
> 建议每天花 5-10 分钟完成前三个动作，每周加 2-3 次坐姿拳击做有氧。如果训练中感到腿部发麻加重，立即停止。
> 
> 这套方案是辅助康复手段，请定期随访你的脊柱外科医生。

## Skill B 冷路径示例

假设用户说："我的物理治疗师教了我一个'超人式改良版'，趴着但只抬对侧手脚，不抬上半身。"

Skill A 输出：

```json
{
  "type": "custom",
  "customDescription": "改良超人式：俯卧位，只抬对侧手脚（右手+左脚），上半身保持贴地。与标准超人式的区别是躯干不抬起，避免腰椎过伸",
  "sets": 3,
  "reps": 8,
  "restSec": 25,
  "tempo": "3秒抬3秒放",
  "howTo": ["俯卧，额头贴地", "对侧手脚同时缓慢抬起约10cm", "保持3秒", "缓慢放下，换另一侧"],
  "safety": ["躯干不要抬起", "抬起高度不要超过10cm"]
}
```

MCP Server 将此发给 Skill B 独立 session。Skill B 判断：
- 体位：俯卧 → 可能需要新的 `prone` FigureType，或复用 `lying` 做镜像
- 运动学：对侧手脚交替抬起
- 生成 keyframes 并返回 RenderConfig

```json
{
  "id": "modified-superman",
  "name": "Modified Superman",
  "nameZh": "改良超人式",
  "figure": "lying",
  "keyframes": [
    { "rHip": 5, "rKnee": 2, "lHip": 3, "lKnee": 0, "rSh": 95, "lSh": 92, "tilt": 0 },
    { "rHip": 5, "rKnee": 2, "lHip": 3, "lKnee": 0, "rSh": 95, "lSh": 92, "tilt": 0 },
    { "rHip": 5, "rKnee": 2, "lHip": -8, "lKnee": 0, "rSh": 70, "lSh": 92, "tilt": 0 },
    { "rHip": 5, "rKnee": 2, "lHip": 3, "lKnee": 0, "rSh": 95, "lSh": 92, "tilt": 0 },
    { "rHip": -8, "rKnee": 0, "lHip": 3, "lKnee": 0, "rSh": 95, "lSh": 68, "tilt": 0 },
    { "rHip": 5, "rKnee": 2, "lHip": 3, "lKnee": 0, "rSh": 95, "lSh": 92, "tilt": 0 }
  ],
  "phases": ["俯卧静息", "右手+左脚抬起", "放下", "左手+右脚抬起", "放下"],
  "phaseDurations": [2, 3, 2, 3, 2]
}
```
