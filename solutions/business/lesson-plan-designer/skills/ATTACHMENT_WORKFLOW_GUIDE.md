# File Attachment Workflow Guide

## Overview

This guide explains how generated files (teaching scripts, audio, PPT) are automatically attached to lesson plans using the `attach_file` tool.

---

## Complete Workflow

### User Request: "生成讲稿" (Generate Teaching Script)

**What Claude Does:**

```typescript
// Step 1: Generate teaching script content
const scriptContent = generateTeachingScript(lessonPlan)

// Step 2: Send text to extraProperties (for inline viewing)
await write_output({
  field: 'extraProperties',
  value: { '讲稿': scriptContent },
  preview: '📝 教学讲稿 (2500字)'
})

// Step 3: Save as file
await Write({
  file_path: '教学讲稿.md',
  content: scriptContent
})

// Step 4: Attach file to lesson plan
await attach_file({
  filePath: '教学讲稿.md',
  fileType: 'script',
  description: '教学讲稿 - 包含9个章节的完整授课指南'
})
```

**What User Sees:**

TWO sync buttons appear in the chat:

```
┌────────────────────────────────────────┐
│ 📝 建议更新「其他属性」                  │
│ 📝 教学讲稿 (2500字)                    │
│                    [🔄 同步到表单] [✕]  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 📎 待添加附件「附件」                    │
│ 📎 教学讲稿.md (15KB)                   │
│                    [📎 添加附件] [✕]    │
└────────────────────────────────────────┘
```

**User Actions:**

1. **Click "同步到表单"** → Text syncs to `extraProperties['讲稿']`
   - Can view inline in the form
   - Searchable and editable

2. **Click "添加附件"** → File syncs to `attachments` array
   - Can download as .md file
   - Portable and shareable

**Recommended:** Click both buttons for maximum flexibility!

---

### User Request: "生成音频" (Generate Audio)

**What Claude Does:**

```typescript
// Step 1: Call NotebookLM skill to generate audio
await Skill({
  skill: 'notebooklm',
  args: '使用刚才生成的中文教学讲稿创建一个讲解音频'
})

// Step 2: NotebookLM saves audio to: outputs/教学讲解音频.mp3

// Step 3: Attach audio file to lesson plan
await attach_file({
  filePath: 'outputs/教学讲解音频.mp3',
  fileType: 'audio',
  description: '教学讲解音频 - 基于教学讲稿生成的中文讲解'
})
```

**What User Sees:**

ONE sync button appears:

```
┌────────────────────────────────────────┐
│ 📎 待添加附件「附件」                    │
│ 🎵 教学讲解音频.mp3 (8.2MB)            │
│                    [📎 添加附件] [✕]    │
└────────────────────────────────────────┘
```

**User Actions:**

1. **Click "添加附件"** → Audio file syncs to `attachments` array
   - Shows in "附件" section with purple badge
   - Can download and play
   - ~8 minutes of Chinese narration

---

### User Request: "生成PPT" (Generate PowerPoint)

**What Claude Does:**

```typescript
// Step 1: Call PPTX skill to generate slides
await Skill({
  skill: 'example-skills:pptx',
  args: '创建一个中文教学PPT演示文稿'
})

// Step 2: PPTX skill saves to: 教学PPT.pptx

// Step 3: Attach PPT file to lesson plan
await attach_file({
  filePath: '教学PPT.pptx',
  fileType: 'ppt',
  description: '教学PPT - 包含12页幻灯片，涵盖课程重点和互动环节'
})
```

**What User Sees:**

ONE sync button appears:

```
┌────────────────────────────────────────┐
│ 📎 待添加附件「附件」                    │
│ 📊 教学PPT.pptx (2.5MB)                │
│                    [📎 添加附件] [✕]    │
└────────────────────────────────────────┘
```

**User Actions:**

1. **Click "添加附件"** → PPT file syncs to `attachments` array
   - Shows in "附件" section with orange badge
   - Can download and present
   - Contains 10-12 slides

---

### User Request: "全套材料" (Complete Materials Package)

**What Claude Does:**

```typescript
// Step 1: Generate teaching script (text + file)
const script = generateTeachingScript()
await write_output({ field: 'extraProperties', value: { '讲稿': script }, ... })
await Write({ file_path: '教学讲稿.md', content: script })
await attach_file({ filePath: '教学讲稿.md', fileType: 'script', ... })

// Step 2: Generate audio
await Skill({ skill: 'notebooklm', ... })
await attach_file({ filePath: 'outputs/教学讲解音频.mp3', fileType: 'audio', ... })

// Step 3: Generate PPT
await Skill({ skill: 'example-skills:pptx', ... })
await attach_file({ filePath: '教学PPT.pptx', fileType: 'ppt', ... })
```

**What User Sees:**

FOUR sync buttons appear:

```
┌────────────────────────────────────────┐
│ 📝 建议更新「其他属性」                  │
│ 📝 教学讲稿 (2500字)                    │
│                    [🔄 同步到表单] [✕]  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 📎 待添加附件「附件」                    │
│ 📎 教学讲稿.md (15KB)                   │
│                    [📎 添加附件] [✕]    │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 📎 待添加附件「附件」                    │
│ 🎵 教学讲解音频.mp3 (8.2MB)            │
│                    [📎 添加附件] [✕]    │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 📎 待添加附件「附件」                    │
│ 📊 教学PPT.pptx (2.5MB)                │
│                    [📎 添加附件] [✕]    │
└────────────────────────────────────────┘
```

**User Actions:**

1. Click all 4 buttons to sync everything
2. Result:
   - `extraProperties['讲稿']` = full markdown text (view inline)
   - `attachments` = [script.md, audio.mp3, slides.pptx] (download files)

---

## After Syncing: Lesson Plan View

Once user clicks all sync buttons, the lesson plan displays:

### In "其他" Section (Other Properties)

```
┌─────────────────────────────────────────────┐
│ 📝 讲稿                                      │
│ ════════════════════════════════════════    │
│ # 教学讲稿：分数的初步认识                   │
│                                             │
│ ## 一、课程基本信息                          │
│ - 学科：数学                                 │
│ - 年级：三年级                               │
│ - 课时：45 分钟                              │
│                                             │
│ ## 二、开场白                                │
│ 各位同学好！今天我们将要学习...              │
│ ...                                         │
└─────────────────────────────────────────────┘
```

### In "附件" Section (Attachments)

```
┌─────────────────────────────────────────────────────┐
│ 10. 附件                                             │
│ ═══════════════════════════════════════════════     │
│                                                     │
│ ┌───────────────────────────────────────────┐     │
│ │ 📝  教学讲稿.md              [下载] [🗑]   │     │
│ │     讲稿 • 15 KB • 2026/02/02 10:00       │     │
│ │     教学讲稿 - 包含9个章节的完整授课指南   │     │
│ └───────────────────────────────────────────┘     │
│                                                     │
│ ┌───────────────────────────────────────────┐     │
│ │ 🎵  教学讲解音频.mp3         [下载] [🗑]   │     │
│ │     音频 • 8.2 MB • 2026/02/02 10:30      │     │
│ │     教学讲解音频 - 基于教学讲稿生成       │     │
│ └───────────────────────────────────────────┘     │
│                                                     │
│ ┌───────────────────────────────────────────┐     │
│ │ 📊  教学PPT.pptx            [下载] [🗑]   │     │
│ │     PPT • 2.5 MB • 2026/02/02 11:00       │     │
│ │     教学PPT - 包含12页幻灯片              │     │
│ └───────────────────────────────────────────┘     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## File Type Summary

| Material | Text Sync? | File Sync? | Sync Buttons | Use Case |
|----------|-----------|-----------|--------------|----------|
| **教学讲稿** (Teaching Script) | ✅ Yes (extraProperties) | ✅ Yes (attachments) | 2 buttons | View inline + Download |
| **教学音频** (Audio) | ❌ No | ✅ Yes (attachments) | 1 button | Download only |
| **教学PPT** (Slides) | ❌ No | ✅ Yes (attachments) | 1 button | Download only |

---

## Technical Flow

### MCP Tool: attach_file

```typescript
// Input
{
  filePath: 'outputs/教学讲解音频.mp3',
  fileType: 'audio',
  description: '教学讲解音频 - 基于教学讲稿生成'
}

// Output (sent to frontend via output_update event)
{
  data: {
    field: 'attachments',
    value: [{
      id: 'uuid',
      fileId: 'placeholder-uuid',
      fileName: '教学讲解音频.mp3',
      fileType: 'audio',
      mimeType: 'audio/mpeg',
      size: 8589934,
      downloadUrl: '/api/v1/files/placeholder-uuid/download',
      uploadedAt: '2026-02-02T10:30:00Z',
      description: '教学讲解音频 - 基于教学讲稿生成',
      _originalPath: 'outputs/教学讲解音频.mp3'
    }],
    preview: '🎵 教学讲解音频.mp3 (8.2MB)'
  },
  status: 'success'
}
```

### Frontend: SyncButton Display

```tsx
// Attachments field gets special rendering
if (field === 'attachments') {
  buttonLabel = '添加附件'    // Instead of '同步到表单'
  icon = <PaperclipIcon />    // Instead of <SyncIcon />
  message = '待添加附件「附件」' // Instead of '建议更新「附件」'
}
```

### Backend: File Persistence (Future)

When user clicks sync, backend should:

```typescript
if (field === 'attachments') {
  for (const att of value) {
    if (att._originalPath) {
      // Copy file from session workspace to persistent storage
      const agentFile = await filesService.copyFromWorkspace({
        sessionId,
        workspacePath: att._originalPath,
        messageId,
        tenantId,
      })

      // Update with real file ID
      att.fileId = agentFile.id
      att.downloadUrl = `/api/v1/files/${agentFile.id}/download`
      att.size = agentFile.size
      delete att._originalPath
    }
  }
}
```

---

## Skill Updates Required

### ✅ Updated: teaching-script-generator

The skill documentation has been updated to include:
- Dual sync workflow for teaching scripts (text + file)
- `attach_file` calls after NotebookLM generates audio
- `attach_file` calls after PPTX generates slides
- Updated example dialogues showing sync buttons

### File Location

`solutions/lesson-plan-designer/skills/teaching-script-generator/SKILL.md`

**Key Sections Updated:**
- "输出到表单" - Added dual sync explanation
- "生成音频（NotebookLM）" - Added attach_file call
- "生成 PPT" - Added attach_file call
- "全套材料" - Updated with complete 4-button workflow
- All example dialogues - Updated to show sync button UX

---

## Benefits

### For Teachers

1. **Flexibility**: View content inline OR download files
2. **Portability**: Download all materials as files
3. **Organization**: All files organized in one place
4. **Sharing**: Easy to share files with colleagues
5. **Backup**: Files persist independently of form data

### For Platform

1. **Separation of Concerns**: Text vs. files handled separately
2. **Scalability**: Large files don't bloat database text fields
3. **Bandwidth**: Files served via efficient download endpoint
4. **Storage**: Files can be moved to object storage (S3, etc.)
5. **Versioning**: Can track file versions separately

---

## FAQ

### Q: Why two sync buttons for teaching scripts?

**A:** Teaching scripts serve dual purposes:
- **Inline viewing**: Teachers want to read the script in the form
- **File download**: Teachers want to save/print/share the file

By syncing both, teachers get maximum flexibility.

### Q: Can I sync just the file without the text?

**A:** Yes! The sync buttons are independent. You can:
- Sync only text (no file attachment)
- Sync only file (no inline text)
- Sync both (recommended)
- Sync neither (ignore both)

### Q: What happens if I ignore a sync button?

**A:** Nothing! The file stays in the session workspace but isn't attached to the lesson plan. You can regenerate materials later if needed.

### Q: Can I delete attachments after syncing?

**A:** Yes! Each attachment card has a delete button (🗑) that appears on hover. Click to remove the attachment from the lesson plan.

### Q: Do files expire?

**A:** Session workspace files are cleaned up after 24 hours. But once synced to attachments, files are copied to persistent storage and remain available indefinitely.

---

## Summary

With the updated skill and `attach_file` tool integration:

✅ **Teaching scripts** → dual sync (text + file)
✅ **Audio files** → automatic attachment after NotebookLM
✅ **PPT files** → automatic attachment after PPTX skill
✅ **Complete materials** → 4 sync buttons (1 text + 3 files)
✅ **Attachment UI** → color-coded cards with download buttons
✅ **User workflow** → click sync buttons → download from "附件" section

**Next time user asks for NotebookLM audio or PPTX slides, they will automatically be attached to the lesson plan! 🎉**
