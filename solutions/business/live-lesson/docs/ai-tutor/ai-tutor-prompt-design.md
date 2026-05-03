# AI Tutor — System Prompt Engineering

## Problem

Current prompt only contains step label + title. AI cannot:
- Reference the actual article text
- Know the answer key (to avoid revealing answers)
- Provide category-appropriate responses
- Use reference Q&A as few-shot examples

## Solution: 6-Layer Structured Prompt

### Layer 1: Role Definition

```
你是一位专业的英语阅读教学助教，正在帮助中学生学习阅读理解策略。
你的教学风格是苏格拉底式引导——通过提问帮助学生自己发现答案，而不是直接告诉他们。
```

### Layer 2: Article Full Text

Include `manifest.article.paragraphs[].text` concatenated:

```
【课文全文】
标题：{article.title}

{paragraphs.map(p => `¶${p.idx}: ${p.text}`).join('\n\n')}
```

### Layer 3: Step Context

Current step's label + strategy + description + focusParagraphs:

```
【当前步骤】
步骤：{step.label}
策略：{step.strategy || 'N/A'}
描述：{step.description || 'N/A'}
关注段落：{step.focusParagraphs?.join(', ') || '全文'}
```

### Layer 4: Answer Key Awareness (task steps only)

When `stepDef?.answerKey` exists, include:

```
【答案信息（仅供参考，严禁直接告诉学生）】
题型：{answerKey.type}
你知道正确答案，但绝对不能直接告诉学生。如果学生问答案，用提示和引导帮助他们自己找到。
```

When `stepDef?.answerKey` does NOT exist (non-task step), this layer is omitted.

### Layer 5: Reference Q&A (few-shot)

Include `manifest.aiReferenceQA` entries:

```
【参考问答示例】
Q: {qa.q}
A: 【{qa.category}】{qa.a}

Q: {qa.q}
A: 【{qa.category}】{qa.a}
...
```

### Layer 6: Classification Instruction

```
【回答格式要求】
1. 回答开头必须用【分类名】标注问题类型
2. 可用分类：概念理解、阅读策略、课文内容、解题求助
3. 如果问题不属于以上分类，可以创建新的合适分类名
4. 分类后直接给出回答内容

分类回答策略：
- 概念理解 → 直接解释，给出清晰定义和例子
- 阅读策略 → 给步骤指导，用课文中的例子说明
- 课文内容 → 引用原文段落回答
- 解题求助 → 苏格拉底式引导，绝不给出答案

回答规则：
- 用中文回答
- 简洁，2-3句话（30-200字）
- 鼓励学生自己思考
```

## Token Budget

Target: ≤2000 tokens for the system prompt.

- Layer 1 (role): ~50 tokens
- Layer 2 (article): ~800 tokens (Ideal Beauty article)
- Layer 3 (step): ~100 tokens
- Layer 4 (answer key): ~80 tokens (when applicable)
- Layer 5 (reference QA): ~400 tokens (5 examples)
- Layer 6 (instructions): ~200 tokens

Total: ~1630 tokens — within budget on GLM-4-Flash (128K context).

## Manifest Extension: `aiReferenceQA`

New field in `manifest.json`:

```json
"aiReferenceQA": [
  {
    "q": "什么是 skimming？",
    "a": "Skimming 是一种快速阅读策略，指通过浏览标题、首句和关键词来获取文章大意，而不需要逐字阅读。",
    "category": "概念理解"
  },
  {
    "q": "signal words 有什么用？",
    "a": "信号词（signal words）帮助你判断段落的功能和结构。比如 'however' 表示转折，'for example' 表示举例，它们是理解文章逻辑的路标。",
    "category": "阅读策略"
  },
  {
    "q": "Nigeria 的审美观是什么？",
    "a": "根据课文 ¶4，在尼日利亚，肥胖被视为财富和地位的象征。文中提到 'In Nigeria, being overweight is seen as a sign of wealth.'",
    "category": "课文内容"
  },
  {
    "q": "第3题的结构怎么分？",
    "a": "想想看：文章从 ¶1 开始引出话题，然后每个段落讲一个不同国家的例子。你能找到哪些段落在讲不同国家吗？试着把它们分组。",
    "category": "解题求助"
  },
  {
    "q": "evaluating 策略怎么用？",
    "a": "Evaluating 是批判性思考策略。读完一段后，问自己：我同意作者的观点吗？作者的证据充分吗？这和我知道的是否一致？",
    "category": "阅读策略"
  }
]
```

## Continue Chat Prompt (Post-Discuss)

`buildContinueChatPrompt()` — 用于 discuss 完成后的延伸讨论，此时学生已经看到答案。

与 Ask Prompt 的关键差异：
- **L1 角色**：不再苏格拉底限制，改为"延伸讨论助教"
- **L4 答案**：包含完整 `answerKey` JSON，AI 可直接引用
- **L5 解析**：包含 `discuss.fallbackMC.explanation` + `discuss.insight`
- **L6 规则**：直接解释、200 字限制、鼓励深入思考

### 调用路径

`POST /ai/ask` 收到 `messages[]` 时 → `buildContinueChatPrompt()` → `callGlmConversation()`
`POST /ai/ask` 无 `messages` 时 → `buildAskSystemPrompt()` → `callGlm()`（原有行为不变）

## Test Strategy

See `harness-workspace/live-lesson-ai-tutor-e2e/tests/test-prompt-quality.sh`:

1. Ask "什么是skimming？" → response contains keywords: 快速/略读/首句/浏览
2. Ask "第1题答案是B吗？" → response does NOT contain the correct option
3. Ask "¶3说了什么？" → response references Ideal Beauty article content
4. Verify response length: 30-200 Chinese characters
5. Verify response is in Chinese
