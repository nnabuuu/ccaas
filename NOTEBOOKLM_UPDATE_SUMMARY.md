# NotebookLM Skill Update Summary

**Date:** 2026-02-02
**Update:** Added clarity on when to use NotebookLM vs PPTX skill, plus support for slides and video auto-attach

## Problem Addressed

**User feedback:** When asking to create PPT using NotebookLM, agent was refusing and using pptx skill instead.

**Root cause:**
1. NotebookLM DOES support slide generation (`generate slide-deck` → PDF output)
2. No clear guidance on when to use NotebookLM slides vs lesson-plan-pptx
3. Slides/video artifacts were not included in auto-attach logic

## Changes Made

### 1. Added "NotebookLM vs PPTX Skill - When to Use Which" Section

**Location:** After "When This Skill Activates" section (~line 83)

**Purpose:** Clear decision tree for choosing between NotebookLM and PPTX skills

**Key distinction:**

```
Use NotebookLM for slides when:
- Content-driven slides from existing sources/research
- Quick generation from documents/URLs
- PDF output is acceptable
- Example: "Generate slides from these research papers"

Use lesson-plan-pptx for slides when:
- Custom-designed slides with specific layout/branding
- Teaching-specific slides with interactive elements
- PowerPoint (.pptx) format required
- Example: "Create teaching PPT", "Design slides for this lesson"
```

**Default behavior in lesson plan context:**
- "生成PPT" / "创建课件" → Use **lesson-plan-pptx** (teaching-focused)
- "用NotebookLM生成幻灯片" → Use **NotebookLM** (content-driven)
- User has added sources + asks for slides → Use **NotebookLM**
- If unclear → Prefer **lesson-plan-pptx** for teaching context

### 2. Expanded "Lesson Plan Integration" Section

**Previous:** Only covered audio auto-attach

**Now:** Covers audio, video, and slides auto-attach

#### Audio (Podcast) - Existing

```typescript
notebooklm download audio ./教学讲解音频.mp3
attach_file({
  filePath: '教学讲解音频.mp3',
  fileType: 'audio',
  description: '教学讲解音频 - 基于教学讲稿生成的中文讲解'
})
```

#### Video - NEW

```typescript
notebooklm download video ./教学视频.mp4
attach_file({
  filePath: '教学视频.mp4',
  fileType: 'video',
  description: '教学视频 - 可视化讲解'
})
```

#### Slides (PDF) - NEW

```typescript
notebooklm download slide-deck ./教学幻灯片.pdf
attach_file({
  filePath: '教学幻灯片.pdf',
  fileType: 'pdf',
  description: '教学幻灯片 - NotebookLM自动生成'
})
```

### 3. Updated File Type Mappings

**Supported file types for attach_file:**
- `audio` - Audio files (.mp3, .wav)
- `video` - Video files (.mp4)
- `pdf` - PDF documents (.pdf)
- `image` - Images (.png, .jpg)
- `document` - Other documents (.md, .txt)

### 4. Enhanced Description Customization Guidelines

**Audio:**
- Mention duration if known (e.g., "约8分钟")
- Mention language (e.g., "中文讲解" or "English narration")

**Video:**
- Mention duration
- Content focus (e.g., "重点讲解方程解法")

**Slides:**
- Mention format (e.g., "PDF格式幻灯片")
- Page count if known

All descriptions kept under 50 characters.

## User Experience Improvements

### Before Update

```
User: "用NotebookLM生成幻灯片"
Agent: "I'll use the pptx skill instead"
Result: Wrong skill activated, confusion
```

### After Update

```
User: "用NotebookLM生成幻灯片"
Agent: Uses NotebookLM skill
Result:
1. Generates slides from sources as PDF
2. Downloads to ./教学幻灯片.pdf
3. Calls attach_file automatically
4. Sync button appears
5. User clicks → PDF in lesson plan attachments ✅
```

### Teaching Context Default

```
User: "生成PPT" (in lesson plan context)
Agent: Uses lesson-plan-pptx skill (default for teaching)
Result: Custom-designed .pptx file with teaching layout ✅

User: "Generate slides from my research" (has NotebookLM sources)
Agent: Uses NotebookLM skill (content-driven)
Result: PDF slides generated from sources ✅
```

## Complete Workflow Examples

### Example 1: Content-Driven Slides (NotebookLM)

```
User: "Add these documents as sources, then create slides"

Agent workflow:
1. notebooklm create "Lesson Content"
2. notebooklm source add ./textbook.pdf
3. notebooklm source add ./standards.pdf
4. Wait for sources to be ready
5. notebooklm generate slide-deck "Focus on key concepts"
6. notebooklm artifact wait <artifact_id>
7. notebooklm download slide-deck ./教学幻灯片.pdf
8. ✅ attach_file({ filePath: '教学幻灯片.pdf', fileType: 'pdf', ... })

Result: PDF slides + sync button
```

### Example 2: Custom Teaching Slides (lesson-plan-pptx)

```
User: "生成教学PPT"

Agent workflow:
1. Activate lesson-plan-pptx skill
2. Call example-skills:pptx
3. Create custom-designed PowerPoint
4. Save to ./教学PPT.pptx
5. ✅ attach_file({ filePath: '教学PPT.pptx', fileType: 'ppt', ... })

Result: PPTX slides + sync button
```

### Example 3: Complete Multimedia Package

```
User: "全套材料"

Agent workflow (teaching-script-generator orchestrates):
1. Generate teaching script → 2 sync buttons (text + .md file)
2. Call lesson-plan-pptx → 1 sync button (.pptx file)
3. Call NotebookLM for audio → 1 sync button (.mp3 file)
4. Optional: NotebookLM for video → 1 sync button (.mp4 file)
5. Optional: NotebookLM for slides → 1 sync button (.pdf file)

Result: Up to 6 sync buttons for complete multimedia package
```

## When NotebookLM Slides Are Better

**Use cases:**
1. **Research synthesis**: User has multiple papers/documents → NotebookLM analyzes and creates cohesive slides
2. **Quick generation**: Need slides fast from existing content → NotebookLM is faster (no design needed)
3. **Content accuracy**: Want slides that accurately reflect source material → NotebookLM ensures accuracy
4. **PDF is fine**: Don't need .pptx format or custom design → PDF output is acceptable

**Example request:**
```
User: "I have these 5 research papers on fractions. Create a slide deck summarizing the key findings."

Agent: Uses NotebookLM
1. Adds papers as sources
2. Generates slide-deck from sources
3. Downloads as PDF
4. Attaches to lesson plan

Result: Research-based slides in PDF format
```

## When lesson-plan-pptx Is Better

**Use cases:**
1. **Custom design**: Need specific colors, fonts, branding → PPTX skill provides design control
2. **Teaching layout**: Need interactive slides, activity prompts → PPTX skill optimized for teaching
3. **PowerPoint format**: School requires .pptx format → PPTX skill generates .pptx
4. **No sources**: Creating slides from scratch, not from documents → PPTX skill better for original content

**Example request:**
```
User: "创建教学PPT，包含学习目标、重点难点、互动环节"

Agent: Uses lesson-plan-pptx
1. Calls example-skills:pptx
2. Creates custom-designed teaching slides
3. Saves as .pptx
4. Attaches to lesson plan

Result: Teaching-optimized PowerPoint file
```

## Decision Tree for Agent

```
User asks for slides/PPT
│
├─ Explicit "用NotebookLM" or "用NotebookLM生成幻灯片"
│  └─> Use NotebookLM (content-driven, PDF)
│
├─ User has added sources to NotebookLM + asks for slides
│  └─> Use NotebookLM (content-driven, PDF)
│
├─ User says "生成PPT" / "创建课件" / "teaching slides"
│  └─> Use lesson-plan-pptx (teaching-focused, PPTX)
│
├─ User says "Generate slides from these documents/research"
│  └─> Use NotebookLM (content-driven, PDF)
│
└─ Unclear / ambiguous
   └─> In lesson plan context: Prefer lesson-plan-pptx
   └─> In research context: Prefer NotebookLM
```

## Technical Details

### NotebookLM Slide Generation Command

```bash
# Generate slide deck
notebooklm generate slide-deck "Focus on key concepts for teaching"

# With specific sources
notebooklm generate slide-deck "Emphasize standards alignment" -s src_id1 -s src_id2

# Get artifact ID
notebooklm generate slide-deck --json
# Returns: {"task_id": "abc123...", "status": "pending"}

# Wait for completion (in subagent)
notebooklm artifact wait <artifact_id> -n <notebook_id> --timeout 900

# Download as PDF
notebooklm download slide-deck ./slides.pdf -a <artifact_id> -n <notebook_id>
```

### File Type Detection

When calling `attach_file`, use correct file type based on extension:

| Extension | File Type Parameter |
|-----------|---------------------|
| .mp3, .wav | `audio` |
| .mp4 | `video` |
| .pdf | `pdf` |
| .png, .jpg | `image` |
| .pptx | `ppt` |
| .md, .txt | `document` |

## Testing Checklist

### Test 1: NotebookLM Slides with Sources
```
Commands:
1. "Add textbook.pdf as a source"
2. "Generate slides from this content"

Expected:
- NotebookLM skill activates ✅
- Slides generated as PDF ✅
- attach_file called ✅
- Sync button appears ✅
```

### Test 2: Teaching PPT (Default)
```
Command: "生成教学PPT"

Expected:
- lesson-plan-pptx skill activates ✅
- PPTX file generated ✅
- attach_file called ✅
- Sync button appears ✅
```

### Test 3: Explicit NotebookLM Request
```
Command: "用NotebookLM生成幻灯片"

Expected:
- NotebookLM skill activates ✅
- PDF slides generated ✅
- attach_file called ✅
- Sync button appears ✅
```

### Test 4: Video Generation
```
Command: "Generate a teaching video"

Expected:
- NotebookLM skill activates ✅
- Video generated as MP4 ✅
- attach_file called ✅
- Sync button appears ✅
```

### Test 5: Complete Multimedia Package
```
Command: "全套材料 + video + slides"

Expected:
- Teaching script: 2 sync buttons (text + .md)
- Teaching PPT: 1 sync button (.pptx)
- Audio: 1 sync button (.mp3)
- Video: 1 sync button (.mp4)
- Total: 5 sync buttons ✅
```

## Files Modified

**File:** `/Users/niex/.claude/skills/notebooklm/SKILL.md`

**Changes:**
1. Added "NotebookLM vs PPTX Skill" section (~30 lines)
2. Updated "Lesson Plan Integration" section (~100 lines)
3. Added video and slides auto-attach support
4. Enhanced description customization guidelines

**Total additions:** ~130 lines

## Backward Compatibility

✅ All existing workflows continue to work
✅ Audio auto-attach unchanged
✅ Teaching script generator unchanged
✅ No breaking changes to existing skills

## Summary

The NotebookLM skill now:
1. ✅ Clearly explains when to use it vs PPTX skill for slides
2. ✅ Supports auto-attach for slides (PDF), video, and audio
3. ✅ Provides decision logic for teaching context
4. ✅ Works seamlessly with lesson-plan-pptx skill

The agent will now correctly choose:
- **NotebookLM** for content-driven slides from sources (PDF output)
- **lesson-plan-pptx** for custom teaching slides (PPTX output)

This resolves the confusion and ensures users get the right tool for their needs.
