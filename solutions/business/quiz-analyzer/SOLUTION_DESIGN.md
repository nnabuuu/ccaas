# Quiz Analyzer — Solution 设计与构建手册

> 面向 Solution Builder：记录我们如何思考、设计和构建这个 Solution，供构建类似 Solution 时参考。

## 1. 问题定义

**核心场景**：教师拿到一道题，需要快速了解这道题考什么知识点、难度如何、怎么讲解给学生。

**传统做法的痛点**：
- 手动查知识点大纲，31,000+ 节点找起来慢
- 难度评估靠经验，缺乏结构化依据
- 备课时每道题都要写解题思路，重复劳动大

**Solution 要解决的事**：粘贴一道题 → 自动产出结构化分析 + 分步讲解，全程 5-10 秒。

## 2. 设计决策

### 2.1 为什么用 CDBT 而不是直接搜索？

**问题**：知识点树有 31,000+ 节点，模糊搜索返回的往往是中间节点（如"方程"），但教师需要的是叶节点（如"一元二次方程的求根公式"）。

**方案对比**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| 直接模糊搜索 | 快、简单 | 常返回非叶节点，粒度不够 |
| LLM 自由选择 | 灵活 | 不可控，不同模型结果差异大 |
| **CDBT 多步验证** | 精准、可解释、可控 | 多几次工具调用（5-8 次） |

**选择 CDBT 的理由**：
1. **可解释性** — 每步决策有 trace，教师能看到"为什么选这个知识点"
2. **一致性** — 同样的题目，不同时间分析结果稳定
3. **精度** — 通过兄弟验证 + 上溯验证确保不选错分支

**CDBT 流程**：
```
模糊搜索 → 锚点
    ↓
get_path → 获取 parentId, grandparentId
    ↓
get_children(parentId) → 兄弟节点列表
    ↓
置信度 ≥ 0.85? ──是──→ 确认（叶→完成，非叶→drill down）
    │
    否
    ↓
get_children(grandparentId) → 上溯验证
    ↓
切换到更好的分支 or 确认当前
```

### 2.2 为什么两阶段而不是一次性输出？

**阶段 1（分析）**：知识点 → 题目解析 → 难度 → 时间
**阶段 2（讲解）**：正确答案 → 分步解题

**理由**：
1. **渐进渲染** — 阶段 1 完成时用户已经能看到题目结构和知识点，不用干等
2. **依赖关系** — 阶段 2 的解题步骤依赖阶段 1 确认的知识点上下文
3. **可中断** — 如果只需要知识点标签（如批量打标），阶段 1 就够了

### 2.3 为什么富化 DifficultyAssessment 和 TimeAssessment？

**之前**：`difficulty: 3`、`timeEstimate: "约5分钟"` — 一个数字 + 一个字符串，没有解释。

**问题**：教师看到"难度 3"会问"为什么是 3？"，看到"5 分钟"会问"怎么估的？"

**现在**：
```typescript
// 难度评估
{
  score: 3,
  pitfalls: ["忘记讨论分母为零", "绝对值不等式方向搞反"],
  reasoning: "涉及两个知识点交叉，需要分类讨论"
}

// 时间评估
{
  estimate: "约 5-7 分钟",
  reasoning: "需要画辅助线 + 两次角度计算"
}
```

**设计原则**：AI 的每个结论都应该附带推理依据，让用户能判断是否合理。

### 2.4 展示顺序：为什么把知识点放最后？

**之前的顺序**：知识点 → 题目结构 → 答案 → 步骤

**问题**：这是"AI 工作流"的顺序（先搜知识点），不是"用户阅读"的顺序。教师拿到分析结果，第一想看的是题目结构和答案，知识点匹配详情是辅助信息。

**现在的顺序**（学生思考流）：
1. 题目结构 + 难度 + 时间 — "这道题长什么样"
2. 正确答案 — "答案是什么"
3. 分步解题 — "怎么做出来的"
4. 知识点详情 — "背后考什么知识"（教师专属）

**关键**：AI 工作流顺序不变（仍然先搜知识点），只改前端展示顺序。

### 2.5 教师/学生视图怎么做到轻量？

**方案对比**：

| 方案 | 工作量 | 维护成本 |
|------|--------|----------|
| 两套独立页面 | 大 | 改一处要改两处 |
| 完全不同的组件 | 中 | 组件分裂 |
| **同组件 + viewMode prop** | 小 | 一处改动 |

**选择 prop 控制**：
- `SolutionStepsPanel` 接受 `viewMode` prop，teacher 视图显示每步 KP 标签
- `QuizAnalyzePage` 根据 `viewMode` 决定是否渲染 `KpResultPanel`
- `ParsedContentPanel` 中的 KP 快速标签保留给两个视图（紧凑预览）

差异不大时不要拆组件，一个 prop 解决。

## 3. 架构设计

### 3.1 整体数据流

```
用户输入题目
    ↓
React Hook (useQuizAnalyze)
    ↓ SSE
CCAAS Backend → 选择 session template → 加载 Skill prompt
    ↓
Skill 按 prompt 调用 MCP 工具
    ↓ 每步调用 write_output
SSE 事件流 → OutputUpdate
    ↓
React Hook 更新 state → 组件重渲染
```

**关键设计**：
- Skill 在每个主要步骤后立即调用 `write_output`，不等全部完成
- 前端 Hook 监听 `OutputUpdate` 事件，逐字段更新 state
- 组件根据 state 是否为 null 决定是否渲染（渐进出现）

### 3.2 类型系统三层同构

```
MCP Server types.ts  ←── 权威来源
        ↓ 手动同步
Frontend types/index.ts
        ↓ 手动同步
MCP Server schemas.ts (Zod 运行时验证)
```

**教训**：三处类型定义需要手动保持一致。加新字段时必须同时改三处。未来可考虑抽到 `@kedge-agentic/common`，但目前 Solution 级别的类型共享机制还没建立。

**改一个字段的 checklist**：
1. `mcp-server/src/common/types.ts` — 接口 + SYNC_FIELDS 数组
2. `mcp-server/src/common/schemas.ts` — Zod schema + FieldSchemas 对象
3. `frontend/src/types/index.ts` — 前端接口
4. `frontend/src/hooks/useQuizAnalyze.ts` — Hook 的 result 接口 + handler
5. `skills/*/SKILL.md` — Skill prompt 中的工具调用示例
6. `mcp-server/src/index.ts` — write_output 工具描述中的字段文档

### 3.3 Skill Prompt 设计

Skill 是纯 prompt（`type: prompt`），不是代码。核心设计原则：

**1. 输出纪律**：
```
❌ 禁止在对话文本中输出答案、分析、步骤
✅ 所有内容通过 write_output 工具调用输出
```
原因：前端从 tool events 渲染结果，如果 AI 在对话中输出，会导致重复显示。

**2. 阶段关卡**：
```
阶段 1 全部完成 → 才允许进入阶段 2
```
原因：阶段 2 依赖阶段 1 的知识点上下文。

**3. Anti-Patterns 明示**：
```
WRONG: fuzzy_search → 直接输出 kpRefinementResult   （跳过 CDBT 验证）
WRONG: 不调用 parse_quiz_content 直接输出 parsedContent （必须使用工具）
```
原因：LLM 容易走捷径，明确写出"不能这么做"比"应该这么做"更有效。

**4. 工具调用序列总结**：
在 prompt 末尾列出完整的工具调用序列，帮助 LLM 规划执行顺序。

### 3.4 MCP Server 设计

**定位**：Solution 级别的工具服务器，提供领域专属工具。

**工具分类**：

| 类型 | 工具 | 说明 |
|------|------|------|
| 输出 | `write_output` | 将结果同步到前端 |
| 解析 | `parse_quiz_content` | 题目文本 → 结构化数据 |
| 搜索 | `fuzzy_search_knowledge_points` | 模糊匹配知识点 |
| 导航 | `get_knowledge_point_path` | 获取节点到根的路径 |
| 验证 | `get_knowledge_point_children` | 获取子节点（兄弟/叔伯验证） |
| 下钻 | `get_leaf_nodes` | 非叶节点钻到叶节点 |

**数据策略**：知识点树（31,000+ 节点）在 MCP Server 启动时加载到内存 JSON，搜索 < 100ms。数据库只用于持久化分析结果。

**Schema 验证**：每个 SYNC_FIELD 都有 Zod schema。`write_output` 工具在写入前验证数据结构，拒绝不合规的输出。这约束了 LLM 的输出格式。

## 4. 前端实现要点

### 4.1 渐进渲染模式

```tsx
// 每个面板独立判断是否渲染
{result.parsedContent && <ParsedContentPanel ... />}
{result.correctAnswer && <CorrectAnswerBlock ... />}
{result.solutionSteps?.length > 0 && <SolutionStepsPanel ... />}
{viewMode === 'teacher' && result.kpRefinementResult && <KpResultPanel ... />}
```

面板出现时带 `animate-fade-in` 过渡。

### 4.2 Hook 设计（useQuizAnalyze）

```typescript
// 核心结构
const [result, setResult] = useState<AnalyzeExplainResult>(EMPTY_RESULT)

const handleOutputUpdate = useCallback((update: OutputUpdate) => {
  switch (update.field) {
    case 'kpRefinementResult':
      setResult(prev => ({ ...prev, kpRefinementResult: update.value as KpRefinementResult }))
      break
    case 'timeAssessment':
      setResult(prev => ({ ...prev, timeAssessment: update.value as TimeAssessment }))
      break
    // ...每个字段一个 case
  }
}, [])
```

**为什么不用通用 mapper**：显式 switch 保持类型安全，每个字段的 cast 类型明确。字段数量有限（< 10），switch 不会太长。

### 4.3 自动交互

- **新分析开始**：清空上次结果 (`setResult(EMPTY_RESULT)`)
- **分析完成**：Process 面板自动折叠 + 页面滚动到结果顶部
- **新分析开始时**：Process 面板自动展开

### 4.4 向后兼容

富化字段（如 `timeAssessment`）和旧字段（如 `timeEstimate`）并存：

```tsx
// ParsedContentPanel 中：优先用新字段，fallback 到旧字段
{timeAssessment?.estimate || timeEstimate}
```

Hook 中两个字段都监听：
```typescript
case 'timeAssessment':
  setResult(prev => ({ ...prev, timeAssessment: update.value as TimeAssessment }))
  break
case 'timeEstimate':  // 旧 Skill 仍可能输出这个
  setResult(prev => ({ ...prev, timeEstimate: update.value as string }))
  break
```

## 5. 关键文件索引

### 定义层

| 文件 | 内容 |
|------|------|
| `solution.json` | Solution 配置：session templates、MCP server 注册、触发词 |
| `mcp-server/src/common/types.ts` | SYNC_FIELDS 定义 + 所有数据接口（权威来源） |
| `mcp-server/src/common/schemas.ts` | Zod 验证 schema（与 types 一一对应） |
| `frontend/src/types/index.ts` | 前端类型定义（与 MCP types 手动同步） |

### Skill 层

| 文件 | 内容 |
|------|------|
| `skills/quiz-analyze-explain/SKILL.md` | 两阶段分析 + 讲解 prompt |
| `skills/unified-kp-search/SKILL.md` | CDBT 知识点精化 prompt |
| `skills/three-column-analysis/SKILL.md` | 三栏完整分析 prompt |
| `skills/analyze-student-answer/SKILL.md` | 学生答案错误分析 prompt |

### 工具层

| 文件 | 内容 |
|------|------|
| `mcp-server/src/index.ts` | 所有 MCP 工具定义 + REST 端点 |
| `mcp-server/src/data-loader.ts` | 知识点树内存加载 |

### 前端层

| 文件 | 内容 |
|------|------|
| `frontend/src/hooks/useQuizAnalyze.ts` | 两阶段分析 Hook |
| `frontend/src/hooks/useQuizSession.ts` | 三栏分析 Hook |
| `frontend/src/hooks/useKpMatch.ts` | 知识点匹配 Hook |
| `frontend/src/pages/QuizAnalyzePage.tsx` | 两栏分析页 |
| `frontend/src/pages/KpMatchPage.tsx` | 知识点匹配页 |
| `frontend/src/App.tsx` | 三栏分析页（主入口） |
| `frontend/src/components/ParsedContentPanel.tsx` | 题目结构 + 难度 + 时间面板 |
| `frontend/src/components/SolutionStepsPanel.tsx` | 分步解题面板 |
| `frontend/src/components/KpResultPanel.tsx` | 知识点匹配详情面板 |
| `frontend/src/components/ViewModeToggle.tsx` | 教师/学生视图切换 |
| `frontend/src/components/ProcessPanel.tsx` | 工具调用过程面板 |

## 6. 构建类似 Solution 的 Checklist

如果你要构建一个类似的分析型 Solution，以下是经验总结：

### Step 1: 定义 SYNC_FIELDS

先想清楚 AI 要输出哪些字段、每个字段的类型。这决定了整个数据流。

```
问自己：用户看到的每个面板对应哪个字段？
每个字段是 string、number、还是 object/array？
```

### Step 2: 写 Skill Prompt

从用户体验倒推：
1. 用户提交输入后，屏幕上应该依次出现什么？
2. 每个输出需要 AI 做什么工具调用？
3. 工具调用之间有没有依赖关系？

然后把这个序列写成 Skill Prompt 的工作流步骤。

### Step 3: 实现 MCP 工具

每个工具做一件事。`write_output` 是必须的（将结果同步到前端）。其他工具按领域需要添加。

### Step 4: 前端 Hook + 组件

```
一个 Hook 管理所有 SYNC_FIELD state
    ↓
每个字段对应一个 case in handleOutputUpdate
    ↓
每个面板组件检查对应字段是否非 null
    ↓
非 null → 渲染，null → 不渲染（渐进出现）
```

### Step 5: 向后兼容

富化字段时保留旧字段的 handler。前端用 `新字段 || 旧字段` fallback。等旧 Skill prompt 全部迁移后再移除旧字段。

### 常见坑

| 坑 | 表现 | 解法 |
|----|------|------|
| serverUrl 为空 | 请求发到前端端口 | 必须用绝对 URL |
| 类型三处不同步 | 前端收到数据但渲染异常 | 改字段时查 checklist |
| Skill 输出纪律 | AI 在对话中输出答案 | prompt 中明确禁止 |
| write_output 描述缺字段 | AI 不知道新字段的 schema | 改 index.ts 工具描述 |
| 展示顺序 = AI 工作流顺序 | 用户体验违反直觉 | 分离工作流顺序和展示顺序 |
