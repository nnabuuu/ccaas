# Block Types — 实体文档序列化参考

`@kedge-agentic/entity-document` 包负责将业务实体的 block 数据结构与 Markdown 文本之间做双向转换。本文档描述所有预定义 block type 及其序列化格式。

---

## 文档格式总览

实体文档序列化为 **YAML frontmatter + Markdown body**：

```markdown
---
title: 12.2 三角形全等的判定
subject: 数学
lesson_type: 新授课
duration: 45
---

## 教学目标

- 掌握SSS判定
- 通过对比归纳

## 教学过程

<!-- type:timeline -->
| 时段 | 时长 | 内容 |
| --- | --- | --- |
| 0-5' | 5 min | 导入新课 |
| 5-25' | 20 min | 新课讲授 |

> 学情备注：八(2)班 SSS 判定错误率 42%
```

- **Frontmatter**：实体元数据（标题、科目、课型等），YAML 格式
- **Body**：由多个 block 组成，每个 block 之间空行分隔

---

## Block Types

### 1. `section` — 章节标题

二级标题，用于分隔文档结构。

| 方向 | 格式 |
|------|------|
| 数据结构 | `{ type: "section", content: { text: "教学目标" } }` |
| Markdown | `## 教学目标` |
| 识别规则 | 以 `## ` 开头（二级标题） |

```
## 教学目标
```

---

### 2. `text` — 纯文本段落

通用文本块，作为所有未匹配类型的 fallback。

| 方向 | 格式 |
|------|------|
| 数据结构 | `{ type: "text", content: { text: "段落内容" } }` |
| Markdown | 普通段落文本 |
| 识别规则 | 不匹配其他任何 block type 时使用 |

```
这是一段教学说明文本，支持多行内容。
第二行会合并为同一个 text block。
```

**多行处理**：连续的非空行合并为一个 text block，`content.text` 中用 `\n` 分隔。

---

### 3. `list` — 列表

支持有序和无序两种形式。

| 方向 | 格式 |
|------|------|
| 数据结构 | `{ type: "list", content: { items: ["项目一", "项目二"], ordered: false } }` |
| Markdown (无序) | `- 项目一`<br>`- 项目二` |
| Markdown (有序) | `1. 项目一`<br>`2. 项目二` |
| 识别规则 | 以 `- ` 或 `数字. ` 开头 |

**无序列表：**
```
- 掌握SSS判定
- 通过对比归纳
- 培养逻辑推理
```

**有序列表：**
```
1. 复习旧知
2. 引入新概念
3. 练习巩固
```

---

### 4. `table` — 表格

GFM (GitHub Flavored Markdown) 风格的表格。

| 方向 | 格式 |
|------|------|
| 数据结构 | `{ type: "table", content: { headers: ["姓名", "分数"], rows: [["张三", "95"], ["李四", "88"]] } }` |
| Markdown | GFM table |
| 识别规则 | 以 `\|` 开头，且第二行为 `\| --- \|` 分隔行 |

```
| 姓名 | 分数 |
| --- | --- |
| 张三 | 95 |
| 李四 | 88 |
```

---

### 5. `timeline` — 时间线

教学环节时间安排，序列化为带 HTML 注释标记的表格。

| 方向 | 格式 |
|------|------|
| 数据结构 | `{ type: "timeline", content: { items: [{ time: "0-5'", duration: "5 min", desc: "导入新课" }] } }` |
| Markdown | `<!-- type:timeline -->` + 固定三列 GFM table |
| 识别规则 | 以 `<!-- type:timeline -->` HTML 注释开头 |

```
<!-- type:timeline -->
| 时段 | 时长 | 内容 |
| --- | --- | --- |
| 0-5' | 5 min | 导入新课 |
| 5-25' | 20 min | 新课讲授 |
| 25-40' | 15 min | 课堂练习 |
| 40-45' | 5 min | 小结作业 |
```

**固定列**：时段 (`time`)、时长 (`duration`)、内容 (`desc`)

---

### 6. `callout` — 提示/备注框

引用块，用于补充说明、学情备注等。

| 方向 | 格式 |
|------|------|
| 数据结构 | `{ type: "callout", content: { text: "备注内容" } }` |
| Markdown | `> 备注内容` |
| 识别规则 | 以 `> ` 开头 |

```
> 学情备注：八(2)班 SSS 判定错误率 42%
```

**多行：**
```
> 第一行备注
> 第二行备注
```

**Attributes（不参与序列化）**：`color` — 提示框颜色（如 `"blue"`, `"yellow"`）。在序列化时从 `content` 移至 `attributes`，存储时合并回 `content`。

---

### 7. `image` — 图片

Markdown 图片语法。

| 方向 | 格式 |
|------|------|
| 数据结构 | `{ type: "image", content: { src: "https://example.com/img.png" } }` |
| Markdown | `![image](https://example.com/img.png)` |
| 识别规则 | 匹配 `![...](...)` 模式 |

```
![image](https://example.com/diagram.png)
```

---

## Attributes 机制

Block 的 `attributes` 字段存储**不参与 Markdown 序列化**的元数据。

### 当前支持的 attributes

| Block Type | Attribute | 说明 |
|------------|-----------|------|
| `callout` | `color` | 提示框颜色 |

### 处理流程

```
DB block (content 含 color)
  ↓ splitBlockForDocument()
EntityDocument block (color 移至 attributes)
  ↓ serialize()
Markdown 文本 (无 color 信息)
  ↓ deserialize()
EntityDocument block (无 color)
  ↓ str_replace 时按 index 保留原 attributes
EntityDocument block (attributes 恢复)
  ↓ mergeBlockForStorage()
DB block (color 回到 content)
```

- **serialize** 时：attributes 被忽略，不写入 Markdown
- **str_replace** 时：未变化的 block 按 index 保留原始 attributes
- **存储** 时：`mergeBlockForStorage()` 将 attributes 合并回 content

---

## 检测优先级

反序列化时，按以下优先级匹配 block type（越靠前越优先）：

1. `section` — `## ` 开头
2. `timeline` — `<!-- type:timeline -->` 开头
3. `table` — `|` 开头 + 分隔行
4. `list` — `- ` 或 `数字. ` 开头
5. `callout` — `> ` 开头
6. `image` — `![...](...) ` 模式
7. `text` — fallback，匹配所有其他内容

---

## 自定义 Block Type

通过 `TransformRegistry`，Solution 可以注册自定义 block type，无需修改 `entity-document` 包本身。

### 创建 Registry

```typescript
import { TransformRegistry } from '@kedge-agentic/entity-document';

// 以 7 个内置 transform 为基础创建 registry
const registry = TransformRegistry.withDefaults();

// 注册自定义 block type
registry.register('quiz', {
  type: 'quiz',
  detect: (lines) => lines[0].startsWith('<!-- type:quiz -->'),
  serialize: (content) => {
    const rows = content.questions.map((q: string) => `- [ ] ${q}`);
    return `<!-- type:quiz -->\n${rows.join('\n')}`;
  },
  deserialize: (lines) => {
    const questions = lines.slice(1).map((l: string) => l.replace(/^- \[.\] /, ''));
    return { questions };
  },
});
```

### 检测优先级

自定义 type 的 `register()` 会将其插入到 `text`（fallback）**之前**，与内置 type 一同参与优先级匹配。最终顺序为：

1. 所有内置 type（section → timeline → table → list → callout → image）
2. 自定义 type（按注册顺序）
3. `text` — 始终最后

### 传入 registry

`serialize()` / `deserialize()` / `strReplace()` 均接受可选的 `registry` 参数。不传时使用内置 `defaultRegistry`（仅含 7 个内置 type）：

```typescript
import { serialize, deserialize, strReplace } from '@kedge-agentic/entity-document';

const markdown = serialize(doc, registry);
const doc2 = deserialize(markdown, registry);
const result = strReplace(doc, oldStr, newStr, registry);
```

### BlockTransform 接口

每个自定义 transform 必须实现 `BlockTransform`：

```typescript
interface BlockTransform {
  type: string;                                          // block type 标识
  serialize(content: Record<string, any>): string;       // content → markdown
  deserialize(lines: string[]): Record<string, any> | null; // markdown lines → content
  detect(lines: string[]): boolean;                      // 是否匹配这组 lines
}
```

---

## str_replace 编辑

通过 `strReplace(doc, old_string, new_string)` 在文档上执行文本替换：

1. 将 EntityDocument 序列化为 Markdown 文本
2. 验证 `old_string` 在文本中**存在且唯一**
3. 执行文本替换
4. 将新文本反序列化回 EntityDocument
5. 按 block index 尽量保留未变 block 的 attributes

**约束**：
- `old_string` 不存在 → 返回错误
- `old_string` 出现多次 → 返回错误
- 替换可以跨 block 边界（跨 block 替换后，受影响 block 的 attributes 会丢失）
