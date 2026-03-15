# Chibi Scene Generator — 即见Agentic 实现规格

## 概述

在即见Agentic平台上实现一个 chibi 角色场景插图生成器。用户输入文章文本，AI 分析文本提取视觉隐喻，组装优化的 Nano Banana prompt，调用 MCP 生成图片，支持迭代修正。

## 架构

```
用户（聊天输入文章文本 + 上传参考头像）
    │
    ▼
CCAAS（即见平台）
    │
    ├── Skill: chibi-scene-generator (type: prompt)
    │   分析文本 → 设计视觉方案 → 组装4层prompt → 调用MCP工具
    │
    └── MCP Server: nano-banana-tools (stdio)
        └── Tool: generate_image
            接收 prompt + reference_image → sharp压缩 → 调Gemini API → 返回图片
```

这是一个轻量级 Solution，不需要 Solution 后端或数据库，不使用 write_output（没有表单要填充）。AI 生成的图片直接在聊天中返回。

## 目录结构

```
chibi-scene-generator/
├── solution.json
├── skills/
│   └── chibi-scene-generator/
│       └── SKILL.md
└── mcp-server/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts              # MCP server 入口
    │   ├── image-processor.ts    # sharp 预处理
    │   └── gemini-client.ts      # Gemini API 封装
    └── .env.example
```

## solution.json

```json
{
  "name": "Chibi Scene Generator",
  "slug": "chibi-scene-generator",
  "version": "1.0.0",
  "description": "从文章文本生成一致风格的 chibi 角色场景插图",
  "mcpServers": {
    "nano-banana-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "type": "stdio",
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}"
      }
    }
  },
  "skills": [
    {
      "name": "Chibi Scene Generator",
      "slug": "chibi-scene-generator",
      "skillFile": "skills/chibi-scene-generator/SKILL.md",
      "type": "prompt",
      "triggers": [
        { "type": "keyword", "value": "配图", "priority": 1 },
        { "type": "keyword", "value": "插图", "priority": 1 },
        { "type": "keyword", "value": "chibi", "priority": 2 },
        { "type": "keyword", "value": "meme", "priority": 2 },
        { "type": "keyword", "value": "生成图片", "priority": 3 },
        { "type": "pattern", "value": "帮我(生成|画|做).*图", "priority": 2 }
      ],
      "allowedTools": ["generate_image"]
    }
  ]
}
```

## Skill: SKILL.md

```markdown
---
name: "Chibi Scene Generator"
slug: "chibi-scene-generator"
description: "从文章文本生成一致风格的chibi角色场景插图"
type: prompt
version: "1.0.0"
---

# 角色定义

你是一位专业的视觉内容策划师，擅长将文章内容转化为chibi/贴纸风格的插图概念，并生成优化的图像生成prompt。

# 前提条件

用户需要提供：
1. 参考角色图片（chibi/sticker头像）
2. 文章文本或场景描述

# 工作流程

## 步骤 1：分析文本

阅读用户的文章文本，提取：
1. 核心隐喻 — 文章的关键对比或洞察是什么？
2. 情绪弧线 — 存在什么对比或张力？
3. 视觉候选 — 什么具体场景可以表达这个想法？

将抽象概念映射为具体视觉隐喻：
- 隐藏的复杂度 → "This is Fine" meme — 表面平静，周围混乱
- 前后对比 → 双面板对比 — 暗色/压力 vs 明色/轻松
- 选项过载 → 角色被漂浮物品淹没 vs 干净桌面
- 虚假的简单 → 冰山 — 简单的上层，复杂的下层
- 认知过载 → 工具/图标山包围角色
- 专业鸿沟 → 角色面对裸机 vs 精装系统

向用户呈现 1-2 个视觉方案，简要描述。让用户选择或调整后再生成。

## 步骤 2：组装 Prompt

每个 prompt 严格遵循 4 层架构，不得跳过或合并。

### Layer 1: 角色锁定（必须，永远不省略）

```
Look at this uploaded image carefully. Keep the EXACT same art style AND 
the EXACT same character with ALL details: [逐一列举参考图的所有视觉细节].

DO NOT change any character details — same [item], same [item], same [item] 
in EVERY panel.
```

规则：
- 枚举每一个视觉细节：发型、额头、眼镜形状、耳麦、麦克风位置、衣服颜色、条纹颜色、眼睛形状和颜色
- 永远不要假设模型能从参考图"看到"细节——全部拼写出来
- 每个 prompt 中这个区块必须完全相同，不得缩写

### Layer 2: 风格约束

```
IMPORTANT STYLE RULES:
- Facial expressions must be SUBTLE and MILD — small smile, slight frown, 
  NOT exaggerated anime expressions
- No wide open mouths, no extreme sweat drops, no over-the-top reactions
- Eyes stay the same size as the original, do not enlarge for expression
- Character proportions: large round head, 2:1 head-to-body ratio
- [身体取景规则]
```

如果用户反馈表情仍然太夸张，追加：
```
Express emotion through POSTURE and CONTEXT, not facial exaggeration.
```

### Layer 3: 身体取景

Chibi角色头大身小，全身照几乎总是头重脚轻。根据场景选择：

- 默认：`Show character from HALF BODY UP only, no full body, no legs`
- 坐在桌前：桌子自然遮挡下半身
- "This is Fine"风格：`Character has short chibi legs, sits on tall chair, legs don't reach floor`

默认使用半身，除非场景特别需要全身且有取景解决方案。

### Layer 4: 场景描述

包含：
1. 格式和比例 — 面板布局、朝向、宽高比
2. 场景元素 — 描述为符号/图标而非写实对象
3. 情绪对比 — 每个面板的色温和光线
4. 排除项 — `No text or labels`（除非特别需要文字）

## 步骤 3：选择构图

### 单场景
```
Generate a single [SQUARE/WIDE] image ([1:1 / 16:9] ratio):
```

### 多面板对比
永远使用竖版上下排列。左右排列会压扁chibi角色。
```
Generate a VERTICAL two-panel image (top and bottom), 
PORTRAIT orientation (9:16 ratio):
```

最大化对比维度：背景色、桌面状态、表情、周围物品、色温。

### Meme 模板

**"This is Fine"：**
- 16:9宽幅，角色小居中(~30%宽度)，高凳短腿，双臂交叉
- 房间着火，扁平化火焰，天花板浓烟
- 可选：火焰中散布主题相关小图标
- 漫画/波普风格：半调点纹理、粗描边

**"Shut Up and Take My Money"：**
- 1:1方形，动态前倾姿势，粗描边，高饱和度，波点背景
- 文字在后期添加

## 步骤 4：调用工具

组装完 prompt 后，调用 generate_image 工具：

```
generate_image({
  prompt: "组装好的完整prompt",
  reference_image: "用户上传的参考图片base64"
})
```

将生成的图片展示给用户。

## 步骤 5：迭代修正

常见反馈和对应修复：

- "表情太夸张" → 加强 Layer 2 表情约束
- "角色变了/细节丢了" → 检查 Layer 1 是否每个细节都列出
- "人物被压扁了" → 改为竖版上下排列
- "背景太立体" → 加 `flat 2d, no perspective, no depth`
- "场景元素没出来" → 让场景描述更具体，关键元素前置
- "全身比例不对" → 改为半身取景或高凳技巧
- "人物太大/太小" → 明确指定比例 "character takes up about X%"
- "两格没对比感" → 明确描述对比维度，加大视觉差异

迭代时，告诉模型相对于上次结果改什么：
```
This is great! Please regenerate with these changes:
- [具体改动1]
- [具体改动2]
Keep everything else identical.
```

# 关键原则

1. 角色锁定不可妥协。每个prompt都以完整角色枚举开头。
2. 默认半身。只在构图特别需要且有取景方案时才全身。
3. 表情要克制。Nano Banana默认会夸张化。
4. 多面板 = 竖版。永远不要对chibi角色用左右分割。
5. 文字后期加。除了经典meme文字，所有标注都在Figma/Canva加。
6. 对话式迭代。预期2-4轮修正，每轮只改有问题的部分。
7. 场景元素是符号。描述漂浮图标和简单物体，不要详细写实环境。
```

## MCP Server 实现

### package.json

```json
{
  "name": "nano-banana-mcp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@google/genai": "^1.0.0",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### src/index.ts

MCP server 入口，注册一个 tool: `generate_image`

输入 schema:
```typescript
{
  prompt: { type: "string", description: "完整的图像生成prompt" },
  reference_image: { type: "string", description: "参考图片base64编码" }
}
```

### src/image-processor.ts

图片预处理逻辑：
- 输入：Buffer（原始图片）
- 输出：Buffer（压缩后的JPEG）
- 逻辑：
  - 如果原图 ≤512px 且 ≤50KB → 跳过，直接返回
  - 否则：`sharp(input).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()`

### src/gemini-client.ts

Gemini API 封装：
- 模型：`gemini-2.5-flash-preview-image-generation`
- 输入：压缩后的图片 base64 + prompt text
- 请求结构：
  ```typescript
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash-preview-image-generation',
    contents: [{
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: compressedBase64 } },
        { text: prompt }
      ]
    }],
    config: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  });
  ```
- 从 response.candidates[0].content.parts 中找到 type 为 inlineData 且 mimeType 以 'image/' 开头的 part，提取其 data（base64）
- 如果没有图片 part（安全过滤等），返回文字说明原因

### 错误处理

- reference_image base64 解码失败 → 返回 `{ type: "text", text: "参考图片格式错误，请确认是有效的base64编码图片" }`
- Gemini API 报错 → 重试1次，仍失败返回错误信息
- 响应不含图片 → 返回 `{ type: "text", text: "图片生成被安全策略拦截，请调整prompt后重试" }`

### .env.example

```
GEMINI_API_KEY=your_gemini_api_key_here
```

## 用户旅程

```
1. 用户上传chibi头像参考图 + 粘贴文章段落
2. 用户说"帮我生成这段文章的配图"
3. Skill 分析文本，提出 1-2 个视觉方案
4. 用户选择或调整方案
5. Skill 组装4层prompt，调用 generate_image MCP 工具
6. MCP 压缩参考图，调 Gemini API，返回生成图片
7. 图片在聊天中展示给用户
8. 用户反馈修改意见（"表情太夸张"、"背景太复杂"等）
9. Skill 调整prompt，重新调用 generate_image
10. 重复 8-9 直到满意
```

## 注意事项

- 这个 Solution 不需要前端（纯聊天交互）、不需要后端/数据库、不使用 write_output
- MCP server 通过 stdio 与 CCAAS 通信
- sharp 是 native 依赖，部署时确保目标环境有对应的预编译 binary
- Gemini image generation 需要特定模型字符串，不是普通的 gemini-2.5-flash
- 生成的图片作为 base64 在 MCP tool response 中返回，CCAAS 会将其渲染在聊天中
