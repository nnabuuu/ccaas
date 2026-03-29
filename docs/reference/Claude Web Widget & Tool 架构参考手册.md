# Claude Web Widget & Tool 架构参考手册

> **信息来源说明**：本文档的所有信息来自 Claude 在 claude.ai 环境中可见的 system prompt 和 tool 定义（JSON Schema）。前端实现细节为基于这些定义的合理工程推断。
>
> **用途**：供即见平台（Jijian）开发团队参考，指导构建类似的 LLM-driven interactive widget 系统。

---

## 1. 核心架构：Tool-as-Widget

Claude Web 把每个交互式 UI 组件抽象为标准的 **function calling tool**。LLM 负责决策"调用哪个 tool、传什么参数"，前端负责"根据 tool name 路由到对应 React 组件、用参数渲染 widget"。

整体链路：

```
User Message
  ↓
LLM（根据 system prompt 中的触发规则 + tool description 决定是否调用 tool）
  ↓
Tool Call: { name: "ask_user_input_v0", input: { questions: [...] } }
  ↓
SSE Stream → 前端收到 tool_use content block
  ↓
Frontend Router → 根据 tool name 匹配对应 React 组件
  ↓
Widget 渲染 → 用户交互
  ↓
用户操作结果作为 tool_result 注入对话历史 → LLM 继续推理
```

**关键设计原则**：

- **Tool Schema = UI 契约**。JSON Schema 的字段、类型、约束直接决定了前端能渲染什么
- **路由逻辑在 Prompt 层完成**。不需要额外的代码层做 tool 选择，模型本身就是 router
- **版本化命名**（`_v0`, `_v1`）支持渐进迭代 + 向后兼容

---

## 2. 完整 Tool 清单与分类

### 2.1 交互式 Widget Tools（渲染为 UI 组件）

#### `ask_user_input_v0` — 结构化用户输入

用途：把开放式提问转化为可点击的选择题，降低用户输入成本。

```typescript
// Schema 摘要
interface AskUserInput {
  questions: Array<{           // 1-3 个问题
    question: string;          // 问题文本
    options: string[];         // 2-4 个选项，短标签
    type?: 'single_select' | 'multi_select' | 'rank_priorities';
  }>;                          // maxItems: 3, minItems: 1
}
```

触发规则（写在 tool description 中）：
- **USE**：有限离散选项、需要澄清才能继续、排序/优先级、推荐类问题需要收窄范围
- **SKIP**：开放式问题（名字、描述、反馈）、用户在发泄情绪、上下文已经很清楚、用户要求用文字讨论

行为指令（写在 system prompt 中）：
- 在使用 tool 之前，**必须先写一段简短的对话文字**，不能直接静默地弹出选项
- 优先用 multi_select 而非 single_select
- 选项标签要短，只在真正需要时加描述
- 尽量一次收集所有信息，而非分多轮
- 优先 1-3 个问题，每个最多 4 个选项

#### `visualize:show_widget` — 内联可视化渲染

用途：在对话流中直接渲染 SVG 图表、流程图、架构图、交互式 HTML widget。

```typescript
interface ShowWidget {
  title: string;               // snake_case 标识符，兼做下载文件名
                               // 要求具体且可区分（如 'oauth_login_flow' 而非 'diagram'）
  loading_messages: string[];  // 1-4 条加载提示，每条约 5 个词
                               // 严肃话题→无聊措辞；轻松话题→俏皮/双关/拟人
  widget_code: string;         // SVG 或 HTML 代码
                               // SVG: 以  开头
                               // HTML: 不含 DOCTYPE/html/head/body 标签
                               // 支持 CSS variables 做主题适配
                               // 脚本在 streaming 完成后执行
}
```

配套工具 `visualize:read_me`：加载设计规范模块，共 6 个模块：
- `diagram` — SVG 流程图、结构图
- `mockup` — UI 模型、表单、卡片、仪表盘
- `interactive` — 带交互控件的说明器
- `chart` — Chart.js 图表
- `data_viz` — 数据可视化
- `art` — 插图和生成艺术

**关键设计细节**：

1. **`sendPrompt(text)` 全局函数**：HTML widget 内部可以调用此函数，把用户在 widget 中的交互转化为一条新的对话消息。这巧妙地避免了定义 widget→LLM 的专用通信协议——所有交互都走自然语言回路。

2. **多次调用、交错排列**：一个 response 中可以多次调用 show_widget，必须和文字段落交替出现（text → widget → text → widget），不能连续堆叠，也不能嵌入到文字段落中间。

3. **模型复杂度门控**：
    - Opus：无上限，可做复杂 D3/Three.js 可视化
    - Sonnet：中等复杂度，标准图表 + 简洁 SVG
    - Haiku：最简，静态 SVG + 基本图表

#### `recipe_display_v0` — 交互式食谱

```typescript
interface RecipeDisplay {
  title: string;
  description?: string;
  base_servings?: number;          // 默认 4
  ingredients: Array<{
    id: string;                    // 4 字符唯一 ID，如 '0001'
    name: string;
    amount: number;
    unit?: 'g'|'kg'|'ml'|'l'|'tsp'|'tbsp'|'cup'|'fl_oz'|'oz'|'lb'|'pinch'|'piece'|'';
  }>;
  steps: Array<{
    id: string;
    title: string;                 // 步骤简称，用作计时器标签
    content: string;               // 正文，用 {ingredient_id} 引用食材量
    timer_seconds?: number;        // 涉及等待/烹饪时必须设置
  }>;
  notes?: string;
}
```

亮点：
- 用户调节份数时，所有食材量按比例缩放
- 步骤正文中用 `{0001}` 语法引用食材，实现食材量的 inline 联动更新
- `timer_seconds` 字段让前端可以内置倒计时功能

#### `message_compose_v1` — 消息撰写器

```typescript
interface MessageCompose {
  kind: 'email' | 'textMessage' | 'other';  // 决定 UI 样式和行动按钮
  summary_title: string;
  variants: Array<{                          // ≥1 个策略变体
    label: string;                           // 2-4 词目标导向标签
    body: string;
    subject?: string;                        // 仅 email
  }>;
}
```

设计哲学：**不是给一个"好的回复"，而是给出 2-3 个不同策略**，每个策略导向不同的结果。例如"委婉拒绝" vs "直接推回" vs "建议替代方案"。标签是目标导向的（如 'Hold firm', 'Suggest alternative'）而非情绪导向的。

#### `places_map_display_v0` — 地图展示

```typescript
interface PlacesMapDisplay {
  // 模式 A：简单标记
  locations?: Array;
  // 模式 B：行程规划
  days?: Array;
  }>;
  title?: string;
  narrative?: string;                    // 导游式介绍
  travel_mode?: 'driving'|'walking'|'transit'|'bicycling';
  show_route?: boolean;
}

interface MapLocation {
  name: string;
  latitude: number;
  longitude: number;
  place_id?: string;     // 从 places_search 获取，前端用它调 Google Places API 拿详情
  notes?: string;        // 导游式小贴士
  address?: string;
}
```

配套工具 `places_search`：支持单次调用传入多个查询，结果自动去重。设计为**数据获取与渲染分离**——先 search 拿 place_id，再 display 渲染地图。

#### `weather_fetch` — 天气卡片

```typescript
interface WeatherFetch {
  latitude: number;
  longitude: number;
  location_name: string;  // 人类可读的地名
}
```

#### `fetch_sports_data` — 体育数据

```typescript
interface FetchSportsData {
  data_type: 'scores' | 'standings' | 'game_stats';
  league: 'nfl'|'nba'|'nhl'|'mlb'|'wnba'|'epl'|...;
  team?: string;
  game_id?: string;  // game_stats 时必须，从 scores 结果中获取
}
```

#### `image_search` — 图片搜索

```typescript
interface ImageSearch {
  query: string;
  max_results?: number;  // 默认 3，范围 3-5
}
```

规则：每次调用至少返回 3 张图，图片搜索要 inline 放置，不能攒到回复末尾。

### 2.2 工具类 Tools（非 widget，但参与协作）

| Tool | 用途 |
|------|------|
| `web_search` | 搜索引擎，返回 top 10 结果 |
| `web_fetch` | 获取指定 URL 完整内容 |
| `conversation_search` | 搜索历史对话（关键词） |
| `recent_chats` | 按时间获取最近对话 |
| `memory_user_edits` | 管理跨对话记忆（view/add/remove/replace） |
| `present_files` | 把文件暴露给前端渲染 |
| `places_search` | Google Places 搜索，为 map display 提供数据 |
| `search_mcp_registry` | 搜索可用的 MCP connector |
| `suggest_connectors` | 向用户展示可连接的 MCP 服务 |

### 2.3 计算机使用 Tools（文件系统操作）

| Tool | 用途 |
|------|------|
| `bash_tool` | 执行 bash 命令（Ubuntu 24 容器） |
| `create_file` | 创建文件 |
| `str_replace` | 精确字符串替换编辑 |
| `view` | 查看文件/目录/图片 |

---

## 3. 路由体系：四层优先级

Claude Web 对"如何选择工具"有一个严格的 4 步 checklist，按优先级从高到低：

```
Step 0: 是否真的需要视觉输出？（大多数问题用文字就够了）
  ↓ 是
Step 1: 是否有已连接的 MCP tool 可以处理？→ 用 MCP tool，到此为止
  ↓ 没有
Step 2: 用户是否明确要求 Artifact/文件？→ 创建文件，到此为止
  ↓ 没有
Step 3: 是否有 first-party widget 匹配？（天气/地图/体育/食谱）→ 用 widget
  ↓ 没有
Step 4: 用 Visualizer（inline SVG/HTML）
```

**关键规则**：
- 用户提到 "Artifact" 或 "file" 等词 → 强制走文件路径，即使内容适合 Visualizer
- 用户点名某个 MCP 服务（"use Figma"）→ 强制走该 MCP，不做风格对比
- MCP 工具的优先级基于**类别匹配**，不基于风格偏好（"Figma 的流程图不够好看"不是绕过它的理由）
- 路由决策过程**不暴露给用户**，不说"根据我的路由规则..."

---

## 4. Prompt 层行为控制模式

### 4.1 触发规则模式

每个 tool 的 description 中都包含明确的 USE / SKIP 规则：

```
USE THIS TOOL WHEN:
- 有限离散选项
- 需要澄清
- ...

SKIP THIS TOOL WHEN:
- 开放式问题
- 上下文已足够
- ...
```

这种模式让 LLM 能自主判断何时触发，无需外部路由代码。

### 4.2 交错排列规则（Interleaving）

Visualizer 有严格的"三明治"规则：

```
✓ 正确：文字 → widget → 文字 → widget → 文字
✗ 错误：文字 → widget → widget（连续堆叠）
✗ 错误：文字中间嵌入 widget（中断段落）
```

### 4.3 "先读后做"模式（Skill System）

Claude Web 有一套 Skill 系统（`/mnt/skills/`），要求在执行任务之前先用 `view` 工具读取对应的 SKILL.md 文件。这是一种**运行时知识注入**模式：

```
用户请求 "做一个 PPT"
  → Claude 先 view /mnt/skills/public/pptx/SKILL.md
  → 读取最佳实践
  → 然后才开始创建
```

这对应了即见平台的 Skill 系统设计（SKILL.md + YAML frontmatter + progressive disclosure）。

### 4.4 记忆系统集成

Claude Web 的记忆系统通过 `<userMemories>` 标签注入 system prompt，配合 `memory_user_edits` tool 做 CRUD。关键设计：

- 记忆是**单向注入**的——LLM 能读到但不能直接修改，修改要走 tool
- 有严格的**应用规则**：简单问候只用名字、技术问题匹配专业水平、敏感属性只在必要时引用
- 有明确的**禁用短语**：永远不说"I can see..."、"Based on your memories..."
- 有**边界意识**：明确提醒 Claude 不要因为有记忆就假装和用户有深厚关系

### 4.5 版权合规系统

搜索结果的引用有严格的硬限制：
- 每个来源最多引用一次，且少于 15 个词
- 默认用改述（paraphrase）而非直接引用
- 永远不复制歌词、诗歌、文章段落

---

## 5. 文件系统与 Artifact 架构

### 5.1 三层目录结构

```
/mnt/user-data/uploads/    ← 用户上传文件（只读）
/home/claude/              ← 工作目录（临时，用户不可见）
/mnt/user-data/outputs/    ← 最终交付物（用户可见，可下载）
```

### 5.2 Artifact 渲染规则

放到 `/mnt/user-data/outputs/` 的特定扩展名文件会在前端特殊渲染：

| 扩展名 | 渲染方式 |
|--------|----------|
| `.md` | Markdown 渲染 |
| `.html` | HTML 渲染 |
| `.jsx` | React 组件渲染（支持 Tailwind、lucide-react、recharts、d3、three.js、shadcn/ui 等） |
| `.mermaid` | Mermaid 图渲染 |
| `.svg` | SVG 渲染 |
| `.pdf` | PDF 查看 |

### 5.3 React Artifact 限制

- **禁止 localStorage/sessionStorage**——必须用 React state 或内存变量
- **有持久化存储 API**：`window.storage` 提供 key-value 存储（get/set/delete/list），支持 personal 和 shared 两种作用域
- 单文件输出（HTML/CSS/JS 合一）
- 可导入的库有明确白名单（见上表）

### 5.4 Anthropic API in Artifacts（"Claude in Claude"）

React Artifact 内部可以调用 Anthropic API：

```typescript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: "Your prompt here" }],
    // 可选：MCP servers、web search tool
    mcp_servers: [{ type: "url", url: "https://mcp.asana.com/sse", name: "asana" }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  })
});
```

不需要传 API key（由平台处理）。这允许构建"AI-powered Artifacts"——前端组件本身就能调用 LLM。

---

## 6. MCP 集成架构

### 6.1 已知 MCP Partner Servers

Figma（设计/图表）、Canva（图形）、BioRender（科学插图）、Amplitude（产品分析）、Hex（数据分析）、Salesforce（CRM）、Asana/Atlassian/Monday（项目管理）、Slack（消息）、Shopify（电商）、ElevenLabs（语音合成）等。

### 6.2 MCP 发现与连接流程

```
用户提到 "check my Asana tasks"
  → Claude 调用 search_mcp_registry(["asana", "tasks", "todo"])
  → 返回可用 connector 列表（含 connected 状态）
  → 如果未连接，调用 suggest_connectors 展示 "Connect" 按钮
  → 用户连接后，直接使用 MCP tool
```

### 6.3 MCP 失败处理

- 工具调用失败时，报告失败并询问如何继续
- **不静默降级**到 Visualizer 或内置替代方案
- 认证错误时，通过 `suggest_connectors` 传入 server UUID 让用户重新认证

---

## 7. 对即见平台的架构启发

### 7.1 直接可借鉴的模式

1. **Tool Schema = UI 契约**：前端 widget 库与 tool schema 一一对应，新增 widget = 新增 tool 定义
2. **`sendPrompt(text)` 桥接**：widget 内交互统一转化为自然语言消息，不需要 engine-specific 的通信协议。特别适合即见的 pluggable engine 架构（Claude Code / Opencode / 自实现引擎）
3. **路由逻辑下沉到 prompt 层**：USE/SKIP 触发规则 + 优先级 checklist，利用 LLM 理解能力做路由
4. **数据获取与渲染分离**：`places_search` → `places_map_display` 模式，避免耦合
5. **版本化 tool 命名**：`_v0` / `_v1` 后缀，支持渐进迭代
6. **Skill 系统的"先读后做"**：与即见的 SKILL.md + progressive disclosure 设计高度一致
