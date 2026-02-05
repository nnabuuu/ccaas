 # Teaching Script Generator Skill

## Overview

The **teaching-script-generator** skill transforms structured lesson plans into conversational, oral presentation scripts for teachers. It converts procedural teaching designs into natural teacher dialogue and classroom guidance.

## Status

✅ **Implementation Complete** (2025-02-02)

## Files

- `SKILL.md` - Complete skill implementation (21KB, ~650 lines)
- `TESTING.md` - Comprehensive testing guide with 5 test cases
- `README.md` - This file

## What is a Teaching Script?

A teaching script is an **oral presentation guide** that transforms a written lesson plan into conversational, teacher-facing content:

| Feature | Lesson Plan | Teaching Script |
|---------|-------------|-----------------|
| Language | Formal, procedural | Conversational, oral |
| Audience | Administrators, peers | Teacher delivering lesson |
| Content | Objectives, activities, assessments | Teacher dialogue, transitions, explanations |
| Purpose | Documentation | Classroom delivery guide |

## Key Features

### 1. Conversational Language

Transforms:
- "教师讲解概念" → "同学们，今天我们要学习的这个概念是..."
- "组织讨论" → "现在请大家分成小组，讨论一下..."
- "提问学生" → "谁能告诉我，为什么...？"

### 2. Complete Script Structure (9 sections)

1. **课程基本信息** - Basic course info
2. **开场白** - Opening remarks (customized based on student analysis)
3. **教学目标讲解** - Objectives explanation in student-friendly language
4. **教学重难点分析** - Key points and difficulties with breakthrough strategies
5. **教学过程讲解** - Teaching phases with teacher dialogue scripts
6. **评价与检测说明** - Assessment implementation guidance
7. **课堂管理提示** - Classroom management tips (time, materials, contingencies)
8. **课程总结** - Closing remarks and homework assignment
9. **教学反思提示** - Post-lesson reflection prompts

### 3. Integration Features

- **NotebookLM**: Generate audio narration from script (Chinese voice)
- **PPTX**: Create presentation slides aligned with script structure
- **Complete Package**: Script + Audio + PPT in one command

## Triggers

The skill activates when users say:

- "生成讲稿"
- "生成教学脚本"
- "将教案转化为讲稿"
- "创建教学讲稿"

## Requirements

### Required Lesson Plan Fields

- ✅ `title` - Course title
- ✅ `subject` - Subject area
- ✅ `gradeLevel` - Grade level (1-12)
- ✅ `objectives` - **CORE**: Learning objectives
- ✅ `content` - **CORE**: Teaching process/phases

### Optional but Recommended

- `studentAnalysis` - Improves opening and customization
- `assessmentMethods` - Enhances assessment section
- `teachingMethods` - Adds classroom management tips
- `materialsNeeded` - Provides preparation guidance
- `durationMinutes` - Enables time allocation suggestions

## Output

### 1. Markdown Script

Generated script is saved to `extraProperties['讲稿']` with:
- 2000-3000 Chinese characters
- 15-20+ teacher dialogue examples
- Practical classroom management tips
- Pedagogical reasoning for each phase

### 2. Optional Audio (NotebookLM)

- Format: MP3
- Language: 简体中文
- Duration: ~8 minutes for 45-minute lesson
- Path: `.agent-workspace/sessions/{sessionId}/outputs/教学讲解音频.mp3`

### 3. Optional PPT (PPTX)

- Format: .pptx
- Slides: 8-12 slides
- Language: 简体中文
- Structure: Matches script sections
- Path: `.agent-workspace/sessions/{sessionId}/outputs/教学PPT.pptx`

## Usage Examples

### Basic Generation

```
User: 生成讲稿

AI: [Reads .context/lesson-plan.json]
    [Generates complete teaching script]
    ✅ 已生成教学讲稿 (点击查看详情)
```

### Generate Audio

```
User: 生成音频

AI: [Calls NotebookLM skill with Chinese script]
    ✅ 音频生成成功
    文件：教学讲解音频.mp3 (8分15秒)
```

### Complete Package

```
User: 全套材料

AI: [Generates script + audio + PPT]
    ✅ 已生成完整材料包
    📄 教学讲稿.md
    🎵 教学讲解音频.mp3
    📊 教学PPT.pptx
```

## Quality Standards

Generated scripts must:
- ✅ Use natural, conversational Chinese
- ✅ Include specific teacher dialogue (not generic descriptions)
- ✅ Provide pedagogical reasoning for design choices
- ✅ Offer practical classroom management strategies
- ✅ Include smooth transition phrases between phases
- ✅ Be directly usable in classroom without major editing

## Error Handling

### Missing Required Fields

```
❌ 错误：缺少必填字段

生成教学讲稿需要以下字段：
- ✅ 教学目标 (objectives)
- ✅ 学习过程 (content)

请先在教案表单中完善这些内容，然后再生成讲稿。
```

### No Context File

```
❌ 错误：未找到教案上下文

请先创建或打开一个教案，然后再生成讲稿。
```

## Testing

See `TESTING.md` for:
- 5 comprehensive test cases
- Quality check criteria
- Integration testing procedures
- Debugging guidelines
- Performance benchmarks

## Architecture

### Algorithm Flow

```
1. Read .context/lesson-plan.json
2. Validate required fields (objectives, content)
3. Query curriculum standards (optional)
4. Query textbook chapters (optional)
5. Generate 9 script sections:
   - Basic info
   - Opening remarks
   - Objectives explanation
   - Key points & difficulties
   - Teaching phases (parse content)
   - Assessment guidance
   - Classroom management
   - Closing summary
   - Reflection prompts
6. Format as Markdown
7. Save to extraProperties['讲稿'] via write_output
```

### Key Functions

- `parseContentToScript()` - Parse teaching phases from content
- `generateTeacherDialogue()` - Convert activities to oral scripts
- `extractKeyPointsAndDifficulties()` - Analyze objectives for key/difficult points
- `generateOpening()` - Create customized opening based on student analysis
- `generateManagementTips()` - Create time/material/contingency guidance

## Theoretical Foundation

Based on recent pedagogical research:

1. **AI-Enhanced Teaching Design** (2025-2026)
   - Backward design: objectives → assessment → content
   - AI can match instructional structures to teaching objectives
   - Generate knowledge graphs and teaching materials

2. **Teaching Script Methodology**
   - Scripted instruction for new teachers
   - Solidifies classroom routines
   - Improves explanations of complex concepts
   - Provides conscious language choice

Sources:
- [如何利用生成式AI提升教学设计](https://www.wsp-publishing.com/rc-pub/front/front-article/download/118686389/) (2025)
- [Improving teaching: scripting](https://awildsurmise.medium.com/improving-teaching-scripting-5950e1d15f54)
- [Planning Scripted Instruction Guide](https://khsbpp.wordpress.com/2019/04/02/)

## Future Enhancements

Potential improvements:
- [ ] Subject-specific templates (math, science, language arts)
- [ ] Grade-level language customization
- [ ] Multi-lesson unit script generation
- [ ] Interactive script editing workflow
- [ ] Template library for common lesson types
- [ ] Student worksheet generation aligned with script

## Related Skills

- **lesson-plan-designer** - Core lesson plan creation and optimization
- **notebooklm** - Audio generation from teaching scripts
- **example-skills:pptx** - Presentation slide generation

## License

Part of the Claude Code as a Service (CCAAS) project.

## Version History

- **v1.0** (2025-02-02) - Initial implementation
  - Complete 9-section script structure
  - Integration with NotebookLM and PPTX
  - Comprehensive error handling
  - Full Chinese language support
