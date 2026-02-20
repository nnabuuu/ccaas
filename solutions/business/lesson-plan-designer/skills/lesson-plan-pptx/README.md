# lesson-plan-pptx Skill - 通用幻灯片生成器

基于教案内容生成演示文稿，使用NotebookLM AI自动分析和设计。

**重要说明**：无论用户说"生成PPT"、"生成PDF"还是"生成幻灯片"，本技能统一使用NotebookLM生成 **PDF格式** 的专业演示文稿。这是lesson-plan-designer的统一幻灯片生成方案。

## Quick Start

### Prerequisites

```bash
# 1. Install NotebookLM CLI
npm install -g notebooklm-cli

# 2. Login to NotebookLM
notebooklm login

# 3. Verify authentication
notebooklm auth check
```

### Basic Usage

1. **Create a lesson plan** with complete content:
   - 课题名称 (title)
   - 教学目标 (objectives)
   - 学习过程 (learningProcess)

2. **Trigger the skill** by saying any of:
   - "生成PPT" / "制作PPT"
   - "生成PDF" / "生成pdf"
   - "生成幻灯片" / "生成演示文稿"
   - "创建课件" / "制作课件"

   **所有触发词统一生成PDF格式幻灯片**

3. **Wait for generation** (5-15 minutes)
   - Process runs in background
   - You can continue other work
   - Notification when complete

4. **Click sync button** to add slides to lesson plan

## Features

✅ **Automatic Content Analysis** - NotebookLM AI analyzes lesson plan
✅ **PDF Output** - Universal format, works everywhere
✅ **Non-blocking** - Uses subagent for background execution
✅ **Auto-attach** - Automatically calls `attach_file` MCP tool
✅ **Error Handling** - Comprehensive error recovery
✅ **Bilingual** - Supports Chinese and English lesson plans

## Output

- **Format**: PDF
- **Pages**: 10-15 pages (auto-determined by content)
- **Structure**:
  - Cover page (lesson info)
  - Learning objectives (2-3 pages)
  - Teaching process (main content)
  - Assessment methods
  - Summary
- **Design**: Professional AI-generated layout

## Workflow

```
User: "生成PPT"
  ↓
Read lesson plan from .context/lesson-plan.json
  ↓
Create NotebookLM Notebook + Add source
  ↓
Generate slide-deck with AI instructions
  ↓
Launch subagent (5-15 min background processing)
  ↓
Download PDF + Call attach_file
  ↓
User sees [📎 添加附件] button
  ↓
Click to add slides to lesson plan
```

## Comparison

| Feature | lesson-plan-pptx | example-skills:pptx |
|---------|------------------|---------------------|
| Format | PDF | PPTX |
| Method | AI analysis | Template |
| Time | 5-15 min | 1-2 min |
| Quality | Professional AI design | Basic template |
| Auto-attach | ✅ Yes | ❌ No |
| Editable | ⚠️ Needs conversion | ✅ Yes |

## Error Handling

The skill handles common errors:

- ❌ **NotebookLM not authenticated** → Guides user to login
- ❌ **Missing required fields** → Lists missing fields
- ⚠️ **Processing timeout** → Provides manual check commands
- ⚠️ **Rate limit** → Suggests retry time
- ⚠️ **attach_file fails** → Provides manual attachment instructions

## Verification

Run the verification script to check setup:

```bash
cd solutions/lesson-plan-designer/skills/lesson-plan-pptx
./verify.sh
```

Expected output:
```
🎉 All checks passed! Ready to test.
```

## Testing

### Test 1: Basic Generation

```
1. Create lesson plan (complete content)
2. Say: "生成PPT"
3. Verify: "正在生成教学幻灯片,约 5-15 分钟"
4. Wait 5-15 minutes
5. Verify: [📎 添加附件] button appears
6. Click button to add slides
```

### Test 2: Missing Fields

```
1. Create lesson plan (incomplete, no objectives)
2. Say: "生成PPT"
3. Verify: Error message lists missing fields
4. Complete the lesson plan
5. Retry: "生成PPT"
```

### Test 3: Integration with teaching-script-generator

```
1. Create lesson plan (complete content)
2. Say: "生成全套材料"
3. Verify: Generates script, audio, AND slides
4. Verify: 4 sync buttons appear
```

## Debugging

### Check NotebookLM Status

```bash
notebooklm auth check              # Verify authentication
notebooklm list                    # List notebooks
```

### Check Artifact Status

```bash
notebooklm artifact get <artifactId> -n <notebookId>
```

### Manual Download

If auto-download fails:

```bash
notebooklm download slide-deck ./教学幻灯片.pdf -a <artifactId> -n <notebookId>
```

## Files

- `SKILL.md` - Complete skill definition (651 lines)
- `verify.sh` - Verification script
- `README.md` - This file

## Integration

### Used by teaching-script-generator

When user says "生成全套材料", teaching-script-generator calls this skill to generate slides.

### Uses attach_file MCP tool

The skill automatically calls `attach_file` to create a sync button in the chat interface.

## Limitations

1. **PDF format** - Not directly editable (needs conversion)
2. **Long generation time** - 5-15 minutes
3. **NotebookLM dependency** - Requires account and API access
4. **Rate limits** - Hourly generation limits
5. **Limited control** - Page count and style determined by AI

## Future Enhancements

- Style selection (teaching, minimalist, academic)
- Page count control
- Regeneration support
- PDF preview in frontend
- Batch generation
- PDF editing integration
- PDF → PPTX conversion

## Support

For issues or questions:

1. Check error message in chat
2. Run `./verify.sh` to check setup
3. Check NotebookLM authentication
4. Review SKILL.md for detailed workflow

## See Also

- `SKILL.md` - Complete skill documentation
- `../notebooklm/SKILL.md` - NotebookLM integration patterns
- `../ATTACHMENT_WORKFLOW_GUIDE.md` - attach_file workflow
- `../teaching-script-generator/SKILL.md` - Integration example
