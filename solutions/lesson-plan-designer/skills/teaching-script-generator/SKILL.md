---
name: teaching-script-generator
slug: teaching-script-generator
description: 基于教案生成教师讲稿，将结构化教学设计转化为口语化授课指南
triggers:
  - type: keyword
    value: "生成讲稿"
    priority: 100
  - type: keyword
    value: "生成教学脚本"
    priority: 100
  - type: intent
    value: "将教案转化为讲稿"
    priority: 80
  - type: intent
    value: "创建教学讲稿"
    priority: 80
---

# 教学讲稿生成器

> **⚠️ 强制要求：在回复用户任何消息之前，你必须首先使用 Read 工具读取 `.context/lesson-plan.json` 文件，了解用户当前正在编辑的教案。不要直接询问用户已经在表单中填写的信息。**

## 何时使用

当你需要：
- 将教案转化为教师授课讲稿
- 生成口语化的教学指导脚本
- 为教师提供授课话术参考
- 创建可以直接用于课堂的讲解文本
- 配合音频生成（NotebookLM）或 PPT 生成使用

## 什么是教学讲稿？

教学讲稿（Teaching Script）是将结构化教案转化为**口语化呈现指南**的文档，特点包括：

### 讲稿 vs. 教案

| 特征 | 教案 (Lesson Plan) | 讲稿 (Teaching Script) |
|------|-------------------|----------------------|
| **语言风格** | 书面语、程序化 | 口语化、对话式 |
| **受众** | 教研员、同行教师 | 授课教师本人 |
| **目的** | 记录教学设计 | 指导课堂实施 |
| **内容** | 目标、活动、评价 | 教师话术、过渡语 |
| **使用场景** | 备课、教研、存档 | 课堂授课、说课 |

### 讲稿核心价值

1. **口语化呈现**：将"组织讨论"转化为"现在请大家分成小组，讨论一下..."
2. **教学话术**：提供关键环节的建议表述
3. **过渡衔接**：连接各教学环节的自然过渡语
4. **设计意图**：解释为什么这样设计
5. **应对策略**：预设学生困难和应对方法

### 理论基础

参考文献：
- [Improving teaching: scripting](https://awildsurmise.medium.com/improving-teaching-scripting-5950e1d15f54) - 教学脚本化方法
- [Planning Scripted Instruction Guide](https://khsbpp.wordpress.com/2019/04/02/planning-scripted-instruction-a-sort-of-guide/) - 脚本化教学指南
- [如何利用生成式AI提升教学设计](https://www.wsp-publishing.com/rc-pub/front/front-article/download/118686389/) - 2025年最新研究

---

## 强制前置步骤

**⚠️ 这是强制步骤！在回复用户的任何消息之前，你必须先读取教案上下文。**

### 步骤 1：读取教案上下文

```
Read(".context/lesson-plan.json")
```

这个文件包含当前教案的完整信息，包括：
- 基本信息：`title`, `subject`, `gradeLevel`, `durationMinutes`
- 核心内容：`objectives`, `content`, `assessmentMethods`
- 辅助信息：`studentAnalysis`, `materialsNeeded`, `teachingMethods`

### 步骤 2：验证必填字段

讲稿生成需要以下**必填字段**：
- ✅ `title` (课题名称)
- ✅ `subject` (学科)
- ✅ `gradeLevel` (年级)
- ✅ `objectives` (教学目标) - **核心**
- ✅ `content` (学习过程) - **核心**

**可选但建议**：
- `studentAnalysis` - 改善开场白和针对性
- `assessmentMethods` - 完善评价指导
- `teachingMethods` - 增强课堂管理提示
- `materialsNeeded` - 提供准备指导

### 步骤 3：查询课程标准（可选但推荐）

如果教案中填写了 `subject` 和 `gradeLevel`，可以查询课程标准以丰富讲稿内容：

```
使用 MCP 工具 get_curriculum_standards:
{
  "subject": lessonPlan.subject,
  "keyword": "从 objectives 中提取的关键词"
}
```

### 步骤 4：查询教材章节（可选）

如果教案中填写了教材信息（`publisher`, `volume`, `chapterId`），可以获取教材内容：

```
使用 MCP 工具 get_textbook_chapters:
{
  "subject": lessonPlan.subject,
  "gradeId": lessonPlan.gradeLevel,
  "publisher": lessonPlan.publisher,
  "volume": lessonPlan.volume
}
```

---

## 讲稿标准结构

### 完整模板

```markdown
# 教学讲稿：[课程标题]

## 一、课程基本信息
- **学科**：[subject]
- **年级**：[gradeLevel]
- **课时**：[durationMinutes] 分钟
- **教材**：[publisher] [volume] [chapterTitle]
- **教案编号**：[lessonPlanCode]

---

## 二、开场白（建议用语）

各位同学好！今天我们将要学习的是 [主题]。

[根据 studentAnalysis 生成针对性开场白]
[例如：我知道大家对XX已经有了一定了解，今天我们要在此基础上...]

这节课结束时，我希望大家能够 [核心目标的口语化表述]。

---

## 三、教学目标讲解

### 为什么学这个？（课程价值）

[将 objectives 转化为学生能理解的语言]
[解释学习这个内容对学生的意义]

### 本节课的学习目标

**知识与技能目标**
- [目标1的口语化表述]
- [目标2的口语化表述]

**过程与方法目标**
- [方法类目标的口语化表述]

**情感态度与价值观目标**
- [素养类目标的口语化表述]

---

## 四、教学重难点分析

### 教学重点

**重点内容**：[列出重点]

**为什么是重点？**
[解释该内容在知识体系中的地位]
[说明掌握该内容对后续学习的重要性]

**突破策略**：
- [策略1：如何帮助学生掌握]
- [策略2：使用什么方法强化]

### 教学难点

**难点内容**：[列出难点]

**为什么是难点？**
[分析学生可能的认知障碍]
[预判学生常见的理解困难]

**突破策略**：
- [策略1：如何化解认知障碍]
- [策略2：使用什么工具或方法]
- [预设问题及应对话术]

---

## 五、教学过程讲解

[将 content 中的教学环节转化为教师授课脚本]

### 环节一：[环节名称]（预计 X 分钟）

**【教师活动脚本】**

*开场语：*
"同学们，现在我们来..."

*过渡语：*
"接下来，让我们..."

*提问话术：*
"谁能告诉我...？"
"大家思考一下..."

*互动引导：*
"请大家看这个例子..."
"注意观察这里的..."

*总结语：*
"很好！我们刚才学到了..."

**【学生活动引导】**

- "请大家分成小组，每组4人，讨论..."
- "给大家5分钟时间，完成..."
- "请一位同学上台展示..."

**【设计意图】**

[解释这个环节为什么这样设计]
[说明这个环节要达成什么目标]
[阐述这样设计的教育学依据]

**【关键提示】**

- ⏰ 时间控制：确保不超过 X 分钟
- 🎯 观察要点：注意学生是否...
- 💡 应对策略：如果学生遇到困难，可以...

---

### 环节二：[环节名称]（预计 X 分钟）

[同上结构]

---

### 环节三：[环节名称]（预计 X 分钟）

[同上结构]

---

## 六、评价与检测说明

[将 assessmentMethods 转化为实施指导]

### 观察要点

在课堂中需要观察：
- [要点1：学生的XX表现]
- [要点2：学生的XX反应]
- [要点3：学生的XX能力]

### 提问策略

**检验理解的关键问题：**
- "请用自己的话解释..."
- "如果改变XX条件，结果会怎样？"
- "这个和我们之前学的XX有什么联系？"

### 作业布置话术

"今天的作业有两部分：

**基础作业**（必做）：
[作业内容和要求]

**拓展作业**（选做）：
[作业内容和要求]

请大家在XX时间前完成，下节课我们会..."

---

## 七、课堂管理提示

[基于 teachingMethods 和 materialsNeeded 生成]

### 时间控制

- 总时长：[durationMinutes] 分钟
- 环节一：X 分钟（可压缩至 Y 分钟）
- 环节二：X 分钟（重点环节，预留弹性时间）
- 环节三：X 分钟
- 机动时间：5 分钟（应对意外情况）

### 材料准备

**课前准备**：
- [材料1：用于XX环节]
- [材料2：用于XX环节]

**分发时机**：
- [材料1在XX时刻发放]
- [材料2在XX时刻发放]

### 突发情况应对

**学生提前完成任务**：
- 准备拓展问题："那如果..."

**学生遇到困难**：
- 降低难度："我们先从...开始"
- 提供支架："你可以参考..."

**讨论偏离主题**：
- 温和引导："这个问题很有意思，不过我们今天主要讨论..."

**时间不足**：
- 优先保证 [核心环节]
- 可以压缩 [次要环节]

---

## 八、课程总结（建议用语）

**知识回顾：**
"今天我们学习了 [核心内容]，大家掌握了 [关键技能]。"

**要点强调：**
"特别要记住的是 [重点内容]，这对我们后续学习 [相关内容] 非常重要。"

**作业布置：**
"课后希望大家能够 [作业要求]，这样可以帮助你 [作业目的]。"

**下节预告：**
"下节课我们将继续 [预告内容]，请大家提前 [准备要求]。"

**结束语：**
"今天大家表现都很好，特别是 [表扬具体表现]。下课！"

---

## 九、教学反思提示

**课后需要思考的问题：**

### 效果评估
- ✅ 学生是否达成了预设的学习目标？
- ✅ 哪些环节学生反应最积极？为什么？
- ✅ 哪些学生可能没有完全理解？

### 问题诊断
- ⚠️ 哪些内容需要补充讲解？
- ⚠️ 哪些活动用时超出预期？
- ⚠️ 哪些问题提得不够好？

### 改进方向
- 💡 时间分配是否需要调整？
- 💡 教学方法是否需要优化？
- 💡 评价方式是否需要改进？
- 💡 下次上这节课，会如何改进？

---

*本讲稿由 AI 教学助手生成，仅供参考，请根据实际情况调整。*
```

---

## 生成算法流程

### 核心生成逻辑

```typescript
function generateTeachingScript(lessonPlan: LessonPlan): string {
  // 1. 读取教案上下文
  const context = Read('.context/lesson-plan.json')

  // 2. 验证必填字段
  if (!context.objectives || !context.content) {
    throw new Error('缺少必填字段：objectives 和 content')
  }

  // 3. 查询课程标准（可选）
  const standards = get_curriculum_standards({
    subject: lessonPlan.subject,
    keyword: extractKeywords(lessonPlan.objectives)
  })

  // 4. 查询教材章节（可选）
  const chapters = get_textbook_chapters({
    subject: lessonPlan.subject,
    gradeId: lessonPlan.gradeLevel,
    publisher: lessonPlan.publisher,
    volume: lessonPlan.volume
  })

  // 5. 生成各个部分
  const script = {
    basicInfo: generateBasicInfo(lessonPlan),
    opening: generateOpening(lessonPlan),
    objectives: generateObjectivesExplanation(lessonPlan.objectives, standards),
    keyPoints: extractKeyPointsAndDifficulties(lessonPlan),
    teachingProcess: parseContentToScript(lessonPlan.content),
    assessment: generateAssessmentGuidance(lessonPlan.assessmentMethods),
    classroomManagement: generateManagementTips(lessonPlan),
    closing: generateClosing(lessonPlan),
    reflection: generateReflectionPrompts()
  }

  // 6. 格式化为 Markdown
  return formatScriptMarkdown(script)
}
```

### 关键函数详解

#### 1. 解析教学环节

```typescript
function parseContentToScript(content: string): Section[] {
  // 识别常见模式：
  // - "环节一：..." → 教学环节
  // - "活动：..." → 学生活动
  // - "1. " / "2. " → 编号步骤
  // - "【导入】" / "【新授】" → 环节标记

  // 对每个环节：
  // 1. 提取环节名称和时长
  // 2. 识别教师活动
  // 3. 识别学生活动
  // 4. 生成对话脚本
  // 5. 提取或推断设计意图

  return sections.map(section => ({
    title: section.name,
    duration: extractDuration(section),
    teacherScript: generateTeacherDialogue(section),
    studentGuidance: generateStudentGuidance(section),
    rationale: extractOrInferRationale(section),
    tips: generateClassroomTips(section)
  }))
}
```

#### 2. 生成教师对话

```typescript
function generateTeacherDialogue(section: Section): DialogueScript {
  // 转化规则：
  // "教师讲解概念" → "同学们，今天我们要学习的这个概念是..."
  // "提问学生" → "谁能告诉我，为什么...？"
  // "组织讨论" → "现在请大家分成小组，讨论一下..."
  // "演示实验" → "请大家注意观察，我现在要..."

  return {
    opening: generateOpeningPhrase(section),
    transition: generateTransitionPhrase(section),
    questioning: generateQuestions(section),
    interaction: generateInteractionGuide(section),
    summary: generateSummaryPhrase(section)
  }
}
```

#### 3. 提取重难点

```typescript
function extractKeyPointsAndDifficulties(lessonPlan: LessonPlan): KeyPoints {
  // 分析 objectives 识别：
  // - 核心概念（重点）
  // - 复杂技能（难点）
  // - 常见误解

  // 交叉参考课程标准
  // 提供突破策略

  return {
    keyPoints: {
      content: [...],
      reasoning: "为什么是重点",
      strategies: ["策略1", "策略2"]
    },
    difficulties: {
      content: [...],
      reasoning: "为什么是难点",
      misconceptions: ["误解1", "误解2"],
      strategies: ["突破策略1", "突破策略2"]
    }
  }
}
```

#### 4. 生成开场白

```typescript
function generateOpening(lessonPlan: LessonPlan): string {
  // 基于 studentAnalysis 生成针对性开场
  // 包含：
  // 1. 问候语
  // 2. 课程主题介绍
  // 3. 联系学生已有知识
  // 4. 激发学习兴趣
  // 5. 明确学习目标

  return `
各位同学好！今天我们将要学习的是 ${lessonPlan.title}。

${generateContextConnection(lessonPlan.studentAnalysis)}

这节课结束时，我希望大家能够 ${convertObjectivesToStudentLanguage(lessonPlan.objectives)}。
  `
}
```

#### 5. 生成课堂管理提示

```typescript
function generateManagementTips(lessonPlan: LessonPlan): ManagementTips {
  // 基于 teachingMethods 和 materialsNeeded
  // 生成：
  // 1. 时间控制建议
  // 2. 材料准备清单
  // 3. 突发情况应对

  return {
    timeControl: generateTimeAllocation(lessonPlan.content, lessonPlan.durationMinutes),
    materials: generateMaterialsChecklist(lessonPlan.materialsNeeded),
    contingencies: generateContingencyPlans(lessonPlan.teachingMethods)
  }
}
```

---

## 输出到表单

### 双重同步：文本 + 文件

生成讲稿后，需要执行**两次输出**：

#### 1. 保存文本到 extraProperties（用于内联查看）

```typescript
await write_output({
  field: 'extraProperties',
  value: {
    ...existingExtraProperties,
    '讲稿': generatedScript
  },
  preview: '📝 教学讲稿 (2500字)'
})
```

#### 2. 保存文件并附加（用于下载）

```typescript
// 先保存为文件
await Write({
  file_path: '教学讲稿.md',
  content: generatedScript
})

// 然后附加文件
await attach_file({
  filePath: '教学讲稿.md',
  fileType: 'script',
  description: '教学讲稿 - 包含9个章节的完整授课指南'
})
```

**用户将看到两个同步按钮：**
1. "同步到表单" - 将文本同步到 extraProperties（可以在表单中直接查看）
2. "添加附件" - 将文件添加到 attachments（可以下载）

**推荐：** 用户应该点击两个按钮，这样既可以内联查看，又可以下载文件。

### 前端显示要求

前端应：
1. 检测 `extraProperties['讲稿']` 字段 - 显示内联内容
2. 检测 `attachments` 数组 - 显示下载按钮
3. 以 Markdown 格式渲染内容
4. 提供"生成音频"和"生成PPT"操作按钮

---

## 错误处理

### 缺少必填字段

```typescript
if (!lessonPlan.objectives || !lessonPlan.content) {
  return `
❌ **错误：缺少必填字段**

生成教学讲稿需要以下字段：
- ✅ 教学目标 (objectives)
- ✅ 学习过程 (content)

请先在教案表单中完善这些内容，然后再生成讲稿。

**建议**：
1. 填写清晰的教学目标（建议使用 ABCD 规范）
2. 详细描述教学过程的各个环节
3. 如果需要帮助，可以先使用"教案优化"功能完善教案
  `
}
```

### 教案上下文不存在

```typescript
if (!exists('.context/lesson-plan.json')) {
  return `
❌ **错误：未找到教案上下文**

请先创建或打开一个教案，然后再生成讲稿。

**操作步骤**：
1. 点击"新建备课方案"创建教案
2. 填写基本信息和教学内容
3. 再次请求生成讲稿
  `
}
```

### 教案数据格式错误

```typescript
try {
  const plan = JSON.parse(readFile('.context/lesson-plan.json'))
  validateLessonPlan(plan)
} catch (error) {
  return `
❌ **错误：教案数据格式不正确**

教案文件存在格式问题，请检查以下内容：
- 文件是否是有效的 JSON 格式
- 是否包含必要的字段
- 字段值是否符合预期类型

**建议**：尝试重新创建教案或联系技术支持。
  `
}
```

---

## 集成功能

### 1. 生成音频（NotebookLM）

当用户请求"生成音频"时：

```markdown
使用 Skill 工具调用 NotebookLM：

Skill: "notebooklm"
Args: "使用刚才生成的中文教学讲稿创建一个讲解音频。讲稿是简体中文，请生成中文音频。"

工作流程：
1. 创建 Notebook：教案_{title}_{date}
2. 上传讲稿作为文本源
3. 生成 Audio Overview
4. 下载到：.agent-workspace/sessions/{sessionId}/outputs/教学讲解音频.mp3
5. **附加文件到教案**
```

**重要：生成音频后必须附加文件**

```typescript
// NotebookLM 生成音频后，立即附加文件
await attach_file({
  filePath: 'outputs/教学讲解音频.mp3',  // NotebookLM 保存的路径
  fileType: 'audio',
  description: '教学讲解音频 - 基于教学讲稿生成的中文讲解'
})
```

**用户将看到：**
- "添加附件" 同步按钮
- 预览：📎 教学讲解音频.mp3 (8.2MB)

**语言要求**：
- 讲稿必须是**简体中文**
- NotebookLM 会继承讲稿语言生成中文音频

### 2. 生成 PPT

当用户请求"生成PPT"时：

```markdown
使用 Skill 工具调用 PPTX：

Skill: "example-skills:pptx"
Args: "创建一个中文教学PPT演示文稿。所有内容必须使用简体中文。"

幻灯片结构（基于讲稿章节）：
- Slide 1: 封面（课程基本信息）
- Slide 2: 教学目标
- Slide 3: 教学重难点
- Slide 4-N: 教学过程（每个环节一页）
- Slide N+1: 评价与检测
- Slide N+2: 课程总结
```

**重要：生成PPT后必须附加文件**

```typescript
// PPTX 技能生成PPT后，立即附加文件
await attach_file({
  filePath: '教学PPT.pptx',  // PPTX 技能保存的路径
  fileType: 'ppt',
  description: '教学PPT - 包含10页幻灯片，涵盖课程重点和互动环节'
})
```

**用户将看到：**
- "添加附件" 同步按钮
- 预览：📎 教学PPT.pptx (2.5MB)

### 3. 全套材料

当用户请求"全套材料"时：

```markdown
完整工作流程：

步骤 1: 生成教学讲稿
  1a. 生成讲稿内容
  1b. write_output → extraProperties（文本，用于内联查看）
  1c. Write → 保存为 .md 文件
  1d. attach_file → 附加讲稿文件（用于下载）

步骤 2: 生成教学音频
  2a. 调用 NotebookLM 技能生成音频
  2b. attach_file → 附加音频文件

步骤 3: 生成教学PPT
  3a. 调用 PPTX 技能生成幻灯片
  3b. attach_file → 附加PPT文件

用户将看到 4 个同步按钮：
1. "同步到表单" - 讲稿文本 → extraProperties
2. "添加附件" - 讲稿文件 → attachments
3. "添加附件" - 音频文件 → attachments
4. "添加附件" - PPT文件 → attachments

最终结果：
- extraProperties['讲稿'] = "markdown text..." (可内联查看)
- attachments = [
    { fileName: '教学讲稿.md', fileType: 'script', downloadUrl: '...' },
    { fileName: '教学讲解音频.mp3', fileType: 'audio', downloadUrl: '...' },
    { fileName: '教学PPT.pptx', fileType: 'ppt', downloadUrl: '...' }
  ]

输出目录：
.agent-workspace/sessions/{sessionId}/outputs/
├── 教学讲稿.md
├── 教学讲解音频.mp3
└── 教学PPT.pptx
```

---

## 使用示例

### 示例对话 1：基本生成

```
用户：生成讲稿

AI：
【读取教案上下文】
已读取教案：《分数的初步认识》

【生成教学讲稿】
正在生成教学讲稿...

✅ 已生成教学讲稿

【内容概览】
- 课程：三年级数学《分数的初步认识》
- 包含：开场白、教学目标、重难点、4个教学环节、评价指导、课堂管理、总结语
- 字数：约 2500 字

【已发送同步请求】
1. 文本已发送（extraProperties）- 用于内联查看
2. 文件已附加（教学讲稿.md）- 用于下载

【请点击同步按钮】
您将在聊天界面看到两个同步按钮：
- "同步到表单" - 将讲稿文本添加到表单中查看
- "添加附件" - 将讲稿文件添加到附件列表

推荐：点击两个按钮，这样既可以内联查看，又可以下载文件。

【后续操作】
- 如需生成音频，请说"生成音频"
- 如需生成PPT，请说"生成PPT"
- 如需完整材料包，请说"全套材料"
```

### 示例对话 2：生成音频

```
用户：生成音频

AI：
【调用 NotebookLM】
正在使用教学讲稿生成中文音频...

[调用 Skill tool: notebooklm]

✅ 音频生成成功

【文件信息】
- 文件名：教学讲解音频.mp3
- 时长：约 8 分钟
- 大小：8.2 MB
- 语言：简体中文
- 保存位置：.agent-workspace/sessions/{sessionId}/outputs/

【已发送同步请求】
文件已附加到教案

【请点击同步按钮】
您将在聊天界面看到同步按钮：
- "添加附件" - 将音频文件添加到教案附件列表

点击后，您可以在教案的"附件"部分看到音频文件，并可以下载用于备课或说课。
```

### 示例对话 3：全套材料

```
用户：全套材料

AI：
【生成完整教学材料包】

步骤 1/3：生成教学讲稿
✅ 已完成（文本 + 文件）

步骤 2/3：生成教学音频
[调用 NotebookLM]
✅ 已完成

步骤 3/3：生成教学PPT
[调用 PPTX 技能]
✅ 已完成

【材料清单】
📝 教学讲稿.md (15.3 KB)
🎵 教学讲解音频.mp3 (8.2 MB, 8分15秒)
📊 教学PPT.pptx (2.5 MB, 12页)

所有文件已保存到：
.agent-workspace/sessions/{sessionId}/outputs/

【请点击同步按钮】
您将在聊天界面看到 4 个同步按钮：
1. "同步到表单" - 讲稿文本（可内联查看）
2. "添加附件" - 讲稿文件（可下载）
3. "添加附件" - 音频文件（可下载）
4. "添加附件" - PPT文件（可下载）

推荐：全部点击，这样您可以：
- 在教案表单中直接查看讲稿内容
- 在"附件"部分下载所有3个文件

这些文件可用于备课、说课或教研活动。
```

---

## 注意事项

### 内容生成要求

1. **口语化**：使用自然的对话语言，避免书面语
2. **具体化**：提供具体的话术示例，而非抽象描述
3. **情境化**：结合实际课堂场景
4. **个性化**：基于 studentAnalysis 调整语言风格
5. **实用化**：确保教师可以直接使用

### 质量检查

生成讲稿后，检查：
- [ ] 是否包含完整的9个章节
- [ ] 教师话术是否自然流畅
- [ ] 过渡语是否合理
- [ ] 重难点分析是否深入
- [ ] 时间分配是否合理
- [ ] 应对策略是否具体可行

### 字数控制

- 总字数：2000-3000字（取决于课时长度）
- 每个教学环节：300-500字
- 避免过长导致教师无法快速阅读

### 格式规范

- 使用 Markdown 格式
- 清晰的层级结构
- 适当使用表格和列表
- 关键信息使用加粗或标记

---

## 参考文献

### 教学脚本研究
- [Improving teaching: scripting](https://awildsurmise.medium.com/improving-teaching-scripting-5950e1d15f54) - 教学脚本化方法论
- [Planning Scripted Instruction Guide](https://khsbpp.wordpress.com/2019/04/02/planning-scripted-instruction-a-sort-of-guide/) - 脚本化教学指南
- [Script Creation for Lesson Plans](https://www.learntechlib.org/primary/p/10787/) - 教案脚本创建研究

### AI 教学设计
- [如何利用生成式AI提升教学设计](https://www.wsp-publishing.com/rc-pub/front/front-article/download/118686389/) - 2025年最新研究
- [生成式AI赋能教学设计分析](https://openedu.sou.edu.cn/upload/qikanfile/202501211045308029.pdf) - AI教学设计方法
- [AI赋能教学开发](https://zhuanlan.zhihu.com/p/899411744) - 利用AI生成教案和讲义

### 教学策略
- [List of 107 Classroom Teaching Strategies](https://helpfulprofessor.com/teaching-strategies/) - 课堂教学策略大全
- 崔允漷《有效教学》- 教学理论基础
