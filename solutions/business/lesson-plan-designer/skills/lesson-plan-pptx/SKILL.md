---
name: lesson-plan-pptx
description: 基于教案生成演示文稿(PDF格式),使用NotebookLM AI将教案内容转化为专业幻灯片。支持"生成PPT"和"生成PDF"等多种表述
---

# lesson-plan-pptx - 通用幻灯片生成器

**统一说明**：无论用户说"生成PPT"、"生成PDF"还是"生成幻灯片"，本技能统一使用 **NotebookLM** 生成 **PDF格式** 的专业演示文稿。

**为什么是PDF**：
- NotebookLM生成的是高质量PDF幻灯片
- PDF格式通用，无需PowerPoint
- AI自动设计，质量优于模板填充的PPTX
- 支持所有平台查看和打印

## 功能概述

基于教案内容生成PDF格式的教学演示文稿，使用NotebookLM AI自动分析教案并创建专业可视化幻灯片。

---

## ⚠️ 重要：统一幻灯片生成方案

**本技能是lesson-plan-designer的唯一幻灯片生成方案**

无论用户说：
- ✅ "生成PPT" / "制作PPT"
- ✅ "生成PDF" / "生成pdf"
- ✅ "生成幻灯片" / "生成演示文稿"
- ✅ "创建课件" / "制作课件"

**都统一执行本技能，生成PDF格式幻灯片**

不要使用 `example-skills:pptx` 或其他PPTX生成技能。

---

## 功能说明

**输入**: 从 `.context/lesson-plan.json` 读取教案内容
**输出**: PDF格式的教学演示文稿 (10-15页)
**生成时间**: 5-15分钟 (后台执行)
**自动附加**: 完成后自动调用 `attach_file` 添加到教案

## 核心工作流程

### Phase 1: 准备教案内容 (1-2分钟)

#### Step 1: 读取教案上下文

使用 `Read` 工具读取教案数据:

```typescript
Read({
  file_path: '.context/lesson-plan.json'
})
```

#### Step 2: 验证必填字段

检查教案数据是否包含必需字段:

**必填字段**:
- `title` - 课题名称
- `objectives` - 教学目标
- `content.learningProcess` - 学习过程

**可选字段**:
- `gradeLevel` - 年级 (用于生成指令)
- `subject` - 学科 (用于生成指令)
- `teachingDuration` - 教学时长
- `keyPoints` - 教学重点
- `difficulties` - 教学难点

**如果缺少必填字段**:
```
❌ 错误: 教案数据不完整

缺少以下必填字段:
- objectives (教学目标)
- content.learningProcess (学习过程)

请先完善教案内容,然后再生成幻灯片。
```

#### Step 3: 格式化教案内容为 Markdown

将教案数据转换为结构化的 Markdown 文本:

```markdown
# 教案: {title}

## 基本信息
- 学科: {subject}
- 年级: {gradeLevel}
- 课时: {teachingDuration}

## 教学目标
{objectives}

## 教学重点
{keyPoints}

## 教学难点
{difficulties}

## 学习过程
{learningProcess 转换为有序列表}

环节1: {环节标题}
- {环节内容}

环节2: {环节标题}
- {环节内容}

...

## 评价方法
{evaluationMethods}
```

#### Step 4: 保存临时文件

使用 `Write` 工具保存为临时 Markdown 文件:

```typescript
Write({
  file_path: './lesson-plan-content.md',
  content: formattedContent
})
```

### Phase 2: 创建 NotebookLM 资源 (30秒-2分钟)

#### Step 1: 创建 Notebook

```bash
notebooklm create "教案课件_${title}" --json
```

**解析响应获取**:
- `notebookId` - Notebook ID

**示例响应**:
```json
{
  "id": "abc123xyz",
  "title": "教案课件_分数的初步认识"
}
```

#### Step 2: 添加教案源文件

```bash
notebooklm source add ./lesson-plan-content.md -n ${notebookId} --json
```

**解析响应获取**:
- `sourceId` - Source ID

#### Step 3: 等待源处理完成

```bash
notebooklm source wait ${sourceId} -n ${notebookId} --timeout 120
```

**如果超时**:
```
⚠️ 源文件处理超时 (2分钟)

请检查 NotebookLM 状态:
notebooklm source get ${sourceId} -n ${notebookId}

如果状态为 "processing",请稍后重试。
```

### Phase 3: 生成幻灯片 (5-15分钟, 使用 subagent)

#### Step 1: 构建生成指令

根据教案语言和内容构建本地化的 NotebookLM 指令:

**中文教案**:
```
用中文生成教学幻灯片,包含12-15页,涵盖教学目标、教学过程、评价方法,清晰简洁的视觉设计,适合${gradeLevel}学生理解
```

**英文教案**:
```
Generate teaching slides in English, containing 12-15 pages, covering learning objectives, teaching process, and assessment methods, with clear and concise visual design suitable for ${gradeLevel} students
```

**指令模板**:
- 语言: 检测 `title` 字段是否包含中文字符
- 页数: 12-15页 (根据内容复杂度调整)
- 结构: 教学目标 → 教学过程 → 评价方法
- 设计: 清晰简洁、适合年级
- 互动性: 适当的问题和活动提示

#### Step 2: 触发幻灯片生成

```bash
notebooklm generate slide-deck "${instructions}" -n ${notebookId} --json
```

**解析响应获取**:
- `artifactId` - Artifact ID (用于等待和下载)

#### Step 3: 启动 Subagent 等待和下载

使用 `Task` 工具启动 subagent 处理长时间生成:

```typescript
Task({
  subagent_type: 'general-purpose',
  description: `生成教学幻灯片 - ${title}`,
  prompt: `
等待 NotebookLM 生成完成并下载 PDF 幻灯片:

1. 等待 artifact 完成:
notebooklm artifact wait ${artifactId} -n ${notebookId} --timeout 900

2. 下载 PDF 文件:
notebooklm download slide-deck ./教学幻灯片_${sanitizedTitle}.pdf -a ${artifactId} -n ${notebookId}

3. 调用 attach_file MCP 工具:
attach_file({
  filePath: '教学幻灯片_${sanitizedTitle}.pdf',
  fileType: 'pdf',
  description: '教学幻灯片 - ${title} (PDF格式, NotebookLM生成)'
})

如果任何步骤失败,报告错误详情。
`
})
```

**告知用户**:
```
✅ 正在生成教学幻灯片...

预计时间: 5-15 分钟
生成完成后会自动附加到教案

您可以继续其他工作,完成后会收到通知。
```

### Phase 4: 下载和附加 (由 subagent 执行)

**Subagent 执行的步骤**:

#### Step 1: 等待 artifact 生成完成

```bash
notebooklm artifact wait ${artifactId} -n ${notebookId} --timeout 900
```

**超时处理**:
```
❌ 生成超时 (15分钟)

可能原因:
- NotebookLM 服务繁忙
- 内容过长导致生成时间延长

请手动检查状态:
notebooklm artifact get ${artifactId} -n ${notebookId}

如果状态为 "in_progress",可以继续等待:
notebooklm artifact wait ${artifactId} -n ${notebookId} --timeout 300
```

#### Step 2: 下载 PDF 文件

```bash
notebooklm download slide-deck ./教学幻灯片_${sanitizedTitle}.pdf -a ${artifactId} -n ${notebookId}
```

**文件命名规则**:
- 格式: `教学幻灯片_{sanitizedTitle}.pdf`
- `sanitizedTitle`: 移除特殊字符 (`:`, `/`, `\`, `*`, `?`, `"`, `<`, `>`, `|`)
- 示例: `教学幻灯片_分数的初步认识.pdf`

#### Step 3: 调用 attach_file MCP 工具

**CRITICAL**: 这是 lesson-plan-designer 的专有工具,**必须调用**:

```typescript
attach_file({
  filePath: '教学幻灯片_${sanitizedTitle}.pdf',
  fileType: 'pdf',
  description: '教学幻灯片 - ${title} (PDF格式, NotebookLM生成)'
})
```

**文件类型**: `'pdf'` (不是 `'ppt'` 或 `'pptx'`)

**Description 模板**:
```
教学幻灯片 - {课题名称} (PDF格式, NotebookLM生成)
```

#### Step 4: 报告完成

Subagent 完成后,用户会看到:

```
✅ 教学幻灯片生成完成!

📎 待添加附件「附件」
📊 教学幻灯片_分数的初步认识.pdf (约2-4MB)
                    [📎 添加附件] [✕]

点击"添加附件"按钮将幻灯片添加到教案。
```

## 错误处理

### 1. NotebookLM 未认证

**症状**:
```
Error: Not authenticated with NotebookLM
```

**解决方案**:
```
❌ NotebookLM 未认证

请执行以下命令登录:
notebooklm login

然后重新生成幻灯片。
```

### 2. 教案数据不完整

**症状**:
- `.context/lesson-plan.json` 文件不存在
- 缺少必填字段

**解决方案**:
```
❌ 教案数据不完整

缺少以下必填字段:
- title (课题名称)
- objectives (教学目标)

请先完善教案内容,然后再生成幻灯片。

在前端填写教案表单后,可以说"生成PPT"重试。
```

### 3. 源处理超时

**症状**:
```
Error: Source processing timeout after 120s
```

**解决方案**:
```
⚠️ 源文件处理超时

这通常是暂时性的网络问题。

请检查源状态:
notebooklm source get ${sourceId} -n ${notebookId}

如果状态为 "processing",可以继续等待:
notebooklm source wait ${sourceId} -n ${notebookId} --timeout 180

如果状态为 "ready",请重新生成幻灯片。
```

### 4. 生成超时 (15分钟)

**症状**:
```
Error: Artifact generation timeout after 900s
```

**解决方案**:
```
⚠️ 幻灯片生成超时

NotebookLM 生成大型幻灯片时可能需要更长时间。

请手动检查生成状态:
notebooklm artifact get ${artifactId} -n ${notebookId}

如果状态为 "in_progress",可以继续等待:
notebooklm artifact wait ${artifactId} -n ${notebookId} --timeout 300

如果状态为 "ready",可以手动下载:
notebooklm download slide-deck ./教学幻灯片.pdf -a ${artifactId} -n ${notebookId}
```

### 5. 速率限制

**症状**:
```
Error: Rate limit exceeded
```

**解决方案**:
```
⚠️ NotebookLM API 速率限制

请等待 5-10 分钟后重试。

NotebookLM 限制:
- 每小时最多 10 次 notebook 创建
- 每小时最多 5 次 artifact 生成

您可以稍后说"生成PPT"重试。
```

### 6. attach_file 失败

**症状**:
```
Error: Failed to call attach_file
```

**解决方案**:
```
⚠️ 附加文件失败

幻灯片已生成,但自动附加失败。

文件路径: ./教学幻灯片_${title}.pdf

您可以手动下载并上传到教案的"附件"部分。

如果需要帮助,请告诉我。
```

## 使用示例

### 示例 1: 基本使用 - "生成PPT"

**用户**:
```
生成PPT
```

**AI 执行**:
1. 读取 `.context/lesson-plan.json`
2. 验证必填字段
3. 创建 NotebookLM Notebook
4. 添加教案内容作为源
5. 生成 slide-deck（PDF格式）
6. 启动 subagent 等待和下载
7. 告知用户: "正在使用NotebookLM生成PDF幻灯片,约 5-15 分钟"

**5-15 分钟后**:
- Subagent 下载 PDF
- 调用 `attach_file`
- 用户看到同步按钮

### 示例 1b: 基本使用 - "生成PDF"

**用户**:
```
生成PDF
```

**AI 执行**:
完全相同的流程 - 统一使用NotebookLM生成PDF幻灯片

### 示例 2: 与 teaching-script-generator 集成

**用户**:
```
生成全套材料
```

**AI 执行**:
1. 生成讲稿 (teaching-script-generator)
2. 生成音频 (notebooklm)
3. 生成幻灯片 (lesson-plan-pptx)

**最终结果**:
- 4 个同步按钮:
  - 讲稿文本 (extraProperties)
  - 讲稿文件 (.md)
  - 音频文件 (.mp3)
  - 幻灯片文件 (.pdf)

### 示例 3: 处理不完整教案

**用户**:
```
生成PPT
```

**AI 检测**:
```
❌ 教案数据不完整

缺少以下必填字段:
- objectives (教学目标)
- content.learningProcess (学习过程)

请先完善教案内容,然后再生成幻灯片。
```

**用户填写表单后**:
```
生成PPT
```

**AI**:
```
✅ 正在生成教学幻灯片...
```

## 技术细节

### NotebookLM CLI 命令

**Authentication**:
```bash
notebooklm login              # 登录
notebooklm auth check         # 检查认证状态
```

**Notebook Management**:
```bash
notebooklm create "Title"     # 创建 notebook
notebooklm list               # 列出所有 notebooks
```

**Source Management**:
```bash
notebooklm source add <file>  # 添加源文件
notebooklm source wait <id>   # 等待源处理
notebooklm source get <id>    # 获取源状态
```

**Artifact Generation**:
```bash
notebooklm generate slide-deck "instructions"  # 生成幻灯片
notebooklm artifact wait <id>                  # 等待生成完成
notebooklm artifact get <id>                   # 获取 artifact 状态
```

**Download**:
```bash
notebooklm download slide-deck <output-path>  # 下载 PDF
```

### attach_file MCP 工具

**Tool Signature**:
```typescript
interface AttachFileInput {
  filePath: string      // 文件路径 (相对或绝对)
  fileType: string      // 文件类型: 'pdf' | 'audio' | 'video' | 'image' | 'document' | 'ppt'
  description: string   // 文件描述 (显示在同步按钮中)
}
```

**Supported File Types**:
- `'pdf'` - PDF 文档 (.pdf)
- `'audio'` - 音频文件 (.mp3, .wav)
- `'video'` - 视频文件 (.mp4)
- `'image'` - 图像文件 (.png, .jpg)
- `'document'` - 文档文件 (.md, .txt)
- `'ppt'` - PowerPoint 文件 (.pptx)

**文件类型选择**:
- NotebookLM slide-deck → `'pdf'` (不是 `'ppt'`)
- 原因: NotebookLM 生成的是 PDF 格式
- 前端已支持 PDF 附件展示

### Subagent 模式

**为什么使用 subagent**:
- NotebookLM slide-deck 生成需要 5-15 分钟
- 主对话不应该阻塞
- 用户可以继续其他工作
- Subagent 在后台等待并完成后续操作

**Subagent 职责**:
1. 等待 artifact 生成完成 (最多 15 分钟)
2. 下载 PDF 文件
3. 调用 `attach_file` MCP 工具
4. 报告完成或错误

### 文件命名规则

**Sanitize Title**:
- 移除特殊字符: `:` `/` `\` `*` `?` `"` `<` `>` `|`
- 保留中文字符
- 替换空格为下划线

**示例**:
```
原标题: "分数的初步认识 (第一课时)"
文件名: "教学幻灯片_分数的初步认识_第一课时.pdf"

原标题: "解一元一次方程: 合并同类项"
文件名: "教学幻灯片_解一元一次方程_合并同类项.pdf"
```

## 与 example-skills:pptx 的对比

| 特征 | lesson-plan-pptx (NotebookLM) | example-skills:pptx |
|------|------------------------------|---------------------|
| 输出格式 | PDF | PPTX |
| 生成方式 | AI 分析内容自动生成 | 模板填充 |
| 生成时间 | 5-15 分钟 | 1-2 分钟 |
| 内容适配 | 自动提炼重点 | 需要明确指定 |
| 自动附加 | ✅ 是 | ❌ 需手动 |
| 可编辑性 | ❌ PDF (需转换) | ✅ PPTX |
| 通用性 | ✅ 所有平台 | ⚠️ 需 PowerPoint |
| 设计质量 | 🎨 NotebookLM 专业设计 | 📋 基础模板 |

## 局限性

1. **不可编辑**: PDF 格式,需要转换工具才能编辑
2. **生成时间长**: 5-15 分钟,不适合快速迭代
3. **依赖 NotebookLM**: 需要 NotebookLM 账号和 API 访问
4. **速率限制**: 每小时有生成次数限制
5. **无法精确控制**: 页数和样式由 NotebookLM 决定

## 最佳实践

1. **提前准备**: 确保教案内容完整再生成
2. **清晰目标**: 在教学目标中明确重点
3. **结构化内容**: 学习过程应分环节描述
4. **合理预期**: 了解 PDF 格式的限制
5. **检查质量**: 生成后检查内容准确性

## 未来增强

**可能的改进**（不在当前实现范围）:

1. **样式选择**: 教学风格、简约风格、学术风格
2. **页数控制**: 允许用户指定页数范围
3. **重新生成**: 支持对结果不满意时重新生成
4. **预览功能**: 生成后在前端显示 PDF 预览
5. **批量生成**: 一次为多个教案生成幻灯片
6. **PDF 编辑**: 集成 PDF 编辑工具
7. **PPTX 转换**: 提供 PDF → PPTX 转换选项

## 调试命令

**检查 NotebookLM 认证**:
```bash
notebooklm auth check
```

**查看 Notebook 列表**:
```bash
notebooklm list
```

**查看源状态**:
```bash
notebooklm source get <sourceId> -n <notebookId>
```

**查看 Artifact 状态**:
```bash
notebooklm artifact get <artifactId> -n <notebookId>
```

**手动下载 (如果自动失败)**:
```bash
notebooklm download slide-deck ./教学幻灯片.pdf -a <artifactId> -n <notebookId>
```
