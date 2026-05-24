# SocraticDiscuss 组件规格文档

> 版本：v1.1 · 2026-05-01  
> 位置：`surfaces/socratic-discuss.jsx`  
> 演示：`surfaces/discuss-demo.html`

---

## 一、概述

`SocraticDiscuss` 是学生端课堂流中 **Discuss 阶段** 的核心组件。它通过苏格拉底式提问法（Socratic Method）引导学生自主思考并得出答案，而非直接告知。当学生在限定轮次或时间内未能达成学习目标时，组件自动降级为选择题兜底，确保每位学生都能完成学习闭环。

**核心设计原则：一切内容都在同一个聊天消息流中呈现。** 选择题、解释、庆祝、解锁通知都是聊天中的消息，不会跳出对话框。

---

## 二、User Stories

### US-1：苏格拉底对话
> 作为学生，我回答 AI 的引导性问题，AI 不会直接告诉我答案，而是通过追问帮我一步步想明白，这样我记得更牢。

### US-2：学习目标达成
> 作为学生，当我的回答展示了对学习目标的完整理解时，AI 在聊天中用 🎉 消息祝贺我，告诉我可以进入下一步了。

### US-3：超时/超轮兜底
> 作为学生，如果我讨论了很多轮还没想通，AI 在聊天中发一条消息，包含一道选择题让我作答。

### US-4：选错直接揭示
> 作为学生，如果我在兜底选择题中选错了，系统直接高亮正确答案并展示解释，不会让我反复猜。对/错均触发完成。

### US-5：完成后继续讨论
> 作为学生，看完解释后我可能还有疑问，我可以点击"继续讨论"按钮，和 AI 自由聊更多问题。

### US-6：中英文混合
> 作为中国高中生，我可以用中文或英文回答，AI 都能理解，但 AI 会用英文回复以帮助我练习。

### US-7：句型支架
> 作为学生，第一轮回答前我可以看到句型提示（scaffolds），点击后会填入输入框，帮我开始表达。

### US-8：解锁下一阶段
> 作为课堂流系统，当 Discuss 完成（无论通过对话达标还是选择题完成），`onDone` 回调被触发，解锁 Takeaway 阶段。聊天流底部显示 "✓ Discuss complete — next section unlocked" 分隔线通知。

---

## 三、交互流程

```
┌──────────────────────────────────────────────┐
│            CHAT MESSAGE STREAM               │
│                                              │
│  [AI] 苏格拉底引导问题                         │
│  [Student] 自由回答                            │
│  [AI] 追问 / 缩小范围 / 给线索                  │
│  … 循环 …                                     │
│                                              │
│  ── 路径 A：学生达标 ──                         │
│  [🎉] 庆祝消息 "Amazing! You figured it out!"  │
│  [AI] 解释总结 + Key Insight                   │
│  ── ✓ Discuss complete — next unlocked ──     │
│                                              │
│  ── 路径 B：超轮/超时 ──                        │
│  [AI] "Let me give you a question..."         │
│       ┌─ 选择题（嵌在气泡内）─┐                 │
│       │  ○ Option A           │               │
│       │  ○ Option B           │               │
│       │  ○ Option C           │               │
│       │  [Submit]             │               │
│       └───────────────────────┘               │
│  [AI] 解释 + Key Insight                      │
│  ── ✓ Discuss complete — next unlocked ──     │
│                                              │
│  💬 [继续讨论] (可选，不阻塞流程)                │
└──────────────────────────────────────────────┘
```

---

## 四、组件接口

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `taskId` | `number` | ✅ | 当前任务 ID（1-5），用于查找 `DISCUSS_CONFIGS` |
| `onDone` | `() => void` | ❌ | Discuss 阶段完成时的回调，用于解锁下一阶段 |

### 用法

```jsx
<SocraticDiscuss taskId={2} onDone={() => setDiscussDone(true)} />
```

### 全局导出

```js
window.SocraticDiscuss  // 组件
window.DISCUSS_CONFIGS  // 每个 task 的配置对象
```

---

## 五、配置结构 `DISCUSS_CONFIGS[taskId]`

```typescript
{
  // 学习目标（供 Claude system prompt 使用）
  goal: string;

  // 苏格拉底开场问题
  openingQ: string;
  openingQZh?: string;  // 中文翻译（帮助按钮）

  // 句型支架（首轮显示，点击填入输入框）
  scaffolds: string[];

  // 限制
  maxRounds: number;       // 学生最大发言轮数（默认 6）
  maxTimeSeconds: number;  // 最大讨论秒数（默认 300）

  // Claude system prompt（苏格拉底引导规则）
  systemPrompt: string;

  // 兜底选择题
  fallbackMC: {
    question: string;
    questionZh?: string;
    options: string[];
    correctIndex: number;
    explanation: string;      // 完整解释（对/错均展示）
    explanationZh?: string;
  };

  // 总结
  insight: string;
  insightZh?: string;
}
```

---

## 六、System Prompt 设计原则

每个 task 的 `systemPrompt` 遵循以下规则：

1. **明确学习目标** — 告诉 Claude 学生应该达到的理解
2. **禁止直接告知** — "NEVER state the answer directly"
3. **单问题原则** — 每轮只问一个聚焦问题，2-3 句以内
4. **渐进引导** — 学生部分正确时肯定再追问；卡住时缩小范围或给线索
5. **目标检测** — 当学生展示完整理解时，回复 `[GOAL_REACHED]` + 简短总结
6. **语言适配** — 用简单英文；理解中文输入但用英文回复
7. **温暖鼓励** — 友善、平等，不居高临下

### 关键信号词

| 信号 | 含义 |
|------|------|
| `[GOAL_REACHED]` | Claude 判断学生已达标，触发成功流程 |

---

## 七、状态机

```
      ┌───────┐
      │ chat  │ ← 初始状态
      └───┬───┘
          │
    ┌─────┴─────┐
    │           │
[GOAL_REACHED]  maxRounds/maxTime
    │           │
    ▼           ▼
 ┌──────┐  ┌──────────┐
 │ done │  │ fallback │
 └──────┘  └────┬─────┘
                │
           MC submitted
           (对/错均触发)
                │
                ▼
            ┌──────┐
            │ done │
            └──────┘
```

**状态说明：**
- `chat`：苏格拉底对话进行中，输入框可用
- `fallback`：选择题以 AI 气泡形式嵌在聊天流中，输入框隐藏
- `done`：解释 + insight + 解锁通知显示在聊天流中，`onDone()` 被调用，输入框隐藏

---

## 八、消息流中的特殊元素

所有特殊元素都在 `msgList` 内渲染，保持聊天体验的连贯性：

### 1. 兜底选择题（FallbackMC）
- 渲染为 AI 消息气泡，内嵌 MC 选项
- 提交后：正确选项高亮绿色，错误选项高亮红色
- **对/错均在 1.2s 后触发 `onComplete`**，不允许重试
- 选错时显示提示："Not quite. The correct answer is highlighted in green above."

### 2. 目标达成庆祝
- 🎉 头像的 AI 消息，绿色背景气泡
- 显示轮数和用时统计
- 文案：积极鼓励，如 "Amazing! You figured it out all by yourself!"

### 3. 解释 + Key Insight
- AI 消息气泡，包含：
  - 标题：达标时 "Here's a summary"，兜底时 "Full explanation"
  - 中英文解释
  - 嵌套的 Key Insight 卡片（amber 色）

### 4. 解锁通知
- 居中分隔线样式：`── ✓ Discuss complete — next section unlocked ──`
- 绿色药丸标签，两侧水平线

### 5. TypingIndicator
- 三个紫色圆点的打字动画，等待 Claude 响应时显示

---

## 九、布局设计

### 聊天区域
- **自适应高度**：聊天区域随内容自然增长，无固定 maxHeight
- 父容器（页面或 TaskView）负责整体滚动
- 避免长对话被截断，学生始终可以看到所有内容

### 消息样式
- AI 消息：左对齐，紫色圆形头像 "S"，浅色气泡
- 学生消息：右对齐，teal 色气泡，白色文字
- 特殊消息（庆祝）：绿色背景气泡，🎉 头像

### 状态栏
- 仅在 `chat` 阶段显示
- 轮数 + 时间双计数器
- 颜色渐变：< 50% 绿色 → 50-80% 黄色 → > 80% 红色
- 辅助文字 "Think deeply — no rush!" 缓解焦虑

### 色彩语义
| 颜色 | 用途 |
|------|------|
| `--purple` | AI 头像、对话标题、Socratic 主题色 |
| `--teal` | 学生消息气泡、选中状态 |
| `--green` | 正确、目标达成、解锁通知、庆祝气泡 |
| `--amber` | 兜底 MC 背景、Key Insight |
| `--red` | 错误选项、超时警告 |

---

## 十、子组件

### ContinueChat
- **位置**：chatArea 外部，phase === 'done' 时显示
- 默认折叠为按钮："💬 Still have questions? Keep discussing"
- 展开后独立聊天区域，maxHeight 260px
- AI 拥有先前对话上下文（最近 4 条消息）
- 不影响阶段解锁（`onDone` 已经触发）

---

## 十一、集成到 student-app.jsx

替换现有 `DiscussPhase` 组件：

```jsx
// 在 student.html 中添加脚本引用
<script type="text/babel" src="socratic-discuss.jsx"></script>

// 在 TaskView 中替换 DiscussPhase
practiceDone && React.createElement(SocraticDiscuss, {
  key: 'd' + task.id,
  taskId: task.id,
  onDone: onDiscussDone,
}),
```

### 依赖
- React 18.3.1 + ReactDOM + Babel（已在项目中）
- `window.claude.complete` API（内置）
- `colors_and_type.css` 中的 CSS 变量

---

## 十二、各 Task 配置摘要

| Task | 学习目标 | maxRounds | maxTime | MC 核心考点 |
|------|---------|-----------|---------|------------|
| 1: Predict | 识别冲突开头手法 + 核心问题 | 6 | 5min | 为什么用两个对立例子开头 |
| 2: Skim | 理解 History→Culture 的层递结构 | 6 | 5min | 为什么先历史后文化 |
| 3: Scan | 审美实践背后的文化深意 | 6 | 5min | 所有实践的共同点 |
| 4: Evaluate | 用证据论证"shallow"的含义 | 8 | 6min | 为什么说媒体审美肤浅 |
| 5: Wrap-up | 复盘 4 步阅读策略及迁移 | 5 | 4min | 策略正确顺序 |

---

## 十三、设计决策记录

### 为什么一切都在聊天流内？
学生的心智模型是"和 AI 聊天"。选择题、解释、通知如果跳出对话框，会打断沉浸感。把所有内容作为消息流的一部分，学生体验到的是一个连贯的对话过程，而非多个割裂的 UI 区块。

### 为什么聊天区域自适应高度？
固定高度 + 内部滚动会导致 MC 选择题和解释被截断，学生需要在嵌套滚动区域中操作，体验差。自适应高度让所有内容自然展开，由外层页面统一滚动。

### 为什么用苏格拉底式而非直接问答？
教育研究表明，通过引导性提问让学生自己"发现"答案，比直接告知的记忆留存率高 2-3 倍（生成效应）。对于高中英语阅读课，这种方法还能同时训练批判性思维和英语表达。

### 为什么兜底选择题选错后直接揭示？
- 避免学生在 MC 中反复猜测（排除法不是学习）
- 快速闭环，让学生把注意力放在理解解释上
- 继续讨论功能允许学生在看完答案后进一步探讨

### 为什么允许完成后继续讨论？
- 看到答案后产生的"恍然大悟"往往伴随新问题
- 自由讨论是深化理解的最佳时机
- 不阻塞流程（onDone 已触发，Takeaway 已解锁）

### 为什么状态栏显示轮数和时间？
- 轻度时间压力有助于保持注意力
- 但提示文字是 "Think deeply — no rush!" 以减轻焦虑
- 颜色渐变是温和的视觉暗示，不是强制催促

---

## 十四、数据上报（建议）

```yaml
event: discuss_complete
  taskId: number
  method: 'socratic' | 'fallback_mc'
  rounds: number
  elapsed_seconds: number
  goal_reached: boolean
  mc_correct: boolean | null
  continued_chat: boolean
  messages: array            # 完整对话记录
```

---

## 十五、后续扩展建议

1. **自适应轮数** — 根据学生历史表现动态调整 maxRounds
2. **语音输入** — 集成 Web Speech API，降低英文打字门槛
3. **表达质量评估** — 在对话中评估学生的英语表达质量
4. **多模态支架** — 允许在对话中引用/高亮文本段落
5. **教师仪表板** — 将对话日志和达标数据汇总到教师端
6. **A/B 测试** — 对比不同 systemPrompt 策略的达标率和平均轮数
