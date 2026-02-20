# Teaching Script Generator - Testing Guide

## Quick Test

### Prerequisites

1. Lesson Plan Designer solution is running
2. Backend: `cd backend && npm run start:dev` (port 3002)
3. Frontend: `cd frontend && npm run dev`

### Test Case 1: Basic Script Generation

**Setup:**
1. Create a new lesson plan with the following data:

```json
{
  "title": "分数的初步认识",
  "subject": "数学",
  "gradeLevel": 3,
  "durationMinutes": 45,
  "objectives": "1. 学生能够借助实物模型，理解分数的含义，认识分数的各部分名称。\n2. 学生能够在具体情境中，运用分数描述简单的等分情况。\n3. 学生能够体会数学与生活的联系，感受数学学习的乐趣。",
  "content": "环节一：情境导入（5分钟）\n教师活动：展示一个苹果，提问"如果要平均分给2个人，每人得到多少？"\n学生活动：思考并回答\n\n环节二：探索新知（20分钟）\n教师活动：引导学生用分数表示"一半"\n学生活动：小组讨论，尝试写出分数\n\n环节三：巩固练习（15分钟）\n教师活动：提供练习题\n学生活动：独立完成练习\n\n环节四：课堂小结（5分钟）\n教师活动：总结本课重点\n学生活动：分享收获",
  "studentAnalysis": "三年级学生已经掌握了整数的认识，但对分数概念较为陌生。学生在生活中有"一半"、"平均分"的直观经验，可以作为学习的起点。",
  "assessmentMethods": "课堂练习、小组互评、课后作业",
  "teachingMethods": "讲授法、讨论法、实践操作法",
  "materialsNeeded": "苹果模型、分数卡片、练习册"
}
```

2. Save the lesson plan (this creates `.context/lesson-plan.json`)

**Test Steps:**

1. In the chat, say: "生成讲稿"
2. Wait for the AI to generate the teaching script
3. Verify the output includes all 9 sections:
   - [ ] 课程基本信息
   - [ ] 开场白
   - [ ] 教学目标讲解
   - [ ] 教学重难点分析
   - [ ] 教学过程讲解 (4 phases)
   - [ ] 评价与检测说明
   - [ ] 课堂管理提示
   - [ ] 课程总结
   - [ ] 教学反思提示

4. Check that the script is saved to `extraProperties['讲稿']`

**Expected Output:**

The AI should:
- Read `.context/lesson-plan.json` first
- Generate a complete teaching script (2000-3000 words)
- Use conversational, oral language
- Include specific teacher dialogue examples
- Save to `extraProperties['讲稿']` via write_output tool
- Show preview: "已生成教学讲稿 (点击查看详情)"

### Test Case 2: Error Handling - Missing Required Fields

**Setup:**
1. Create a lesson plan with ONLY:
```json
{
  "title": "测试课程",
  "subject": "数学",
  "gradeLevel": 3
}
```

**Test Steps:**
1. Say: "生成讲稿"

**Expected Output:**
```
❌ 错误：缺少必填字段

生成教学讲稿需要以下字段：
- ✅ 教学目标 (objectives)
- ✅ 学习过程 (content)

请先在教案表单中完善这些内容，然后再生成讲稿。
```

### Test Case 3: Integration with NotebookLM

**Prerequisites:**
- NotebookLM skill is available
- User is logged into Google account

**Test Steps:**
1. Generate teaching script first (Test Case 1)
2. Say: "生成音频"
3. Verify NotebookLM skill is called
4. Check audio file is created in `.agent-workspace/sessions/{sessionId}/outputs/`

**Expected Output:**
- Audio file: `教学讲解音频.mp3`
- Audio language: Chinese (简体中文)
- Duration: ~8 minutes

### Test Case 4: Integration with PPTX

**Prerequisites:**
- PPTX skill is available

**Test Steps:**
1. Generate teaching script first (Test Case 1)
2. Say: "生成PPT"
3. Verify PPTX skill is called
4. Check PPTX file is created

**Expected Output:**
- File: `教学PPT.pptx`
- Slides: 8-12 slides
- All content in Chinese
- Structure matches script sections

### Test Case 5: Complete Material Package

**Test Steps:**
1. Generate teaching script first (Test Case 1)
2. Say: "全套材料"
3. Wait for all three generations to complete

**Expected Output:**
```
.agent-workspace/sessions/{sessionId}/outputs/
├── 教学讲稿_分数的初步认识.md
├── 教学讲解音频.mp3
└── 教学PPT.pptx
```

## Quality Checks

### Content Quality

Check the generated script for:

- [ ] **Natural language**: Uses conversational tone, not formal written language
- [ ] **Specific dialogue**: Includes actual phrases like "同学们，现在我们来..."
- [ ] **Transition phrases**: Smooth connections between phases
- [ ] **Pedagogical reasoning**: Explains WHY certain approaches are used
- [ ] **Classroom management**: Practical tips for time control and materials
- [ ] **Student-centered**: Focuses on student activities and understanding

### Structure Quality

- [ ] All 9 sections present
- [ ] Each teaching phase has:
  - Teacher script
  - Student guidance
  - Design rationale
  - Key tips
- [ ] Time allocations are reasonable
- [ ] Markdown formatting is correct

### Integration Quality

- [ ] Script saved to `extraProperties['讲稿']` successfully
- [ ] Frontend displays "教学讲稿" tab/button
- [ ] NotebookLM integration works (if tested)
- [ ] PPTX integration works (if tested)

## Debugging

### If skill doesn't trigger:

1. Check skill frontmatter has correct triggers
2. Verify `.context/lesson-plan.json` exists
3. Check backend logs for errors
4. Try explicit trigger: "使用 teaching-script-generator skill"

### If generation fails:

1. Read `.context/lesson-plan.json` to verify structure
2. Check if `objectives` and `content` fields exist
3. Verify fields are not empty strings
4. Check backend logs for write_output errors

### If output is incomplete:

1. Check token limits (script should be 2000-3000 words)
2. Verify all 9 sections are in the prompt
3. Check if AI truncated due to length

## Manual Verification

After generating a script, manually verify:

1. **Opening section** sounds natural and engaging
2. **Teacher dialogue** is realistic and practical
3. **Key points** analysis is accurate and insightful
4. **Time allocations** match lesson duration
5. **Reflection prompts** are helpful for teachers

## Performance Benchmarks

- Script generation: < 30 seconds
- Total word count: 2000-3000 characters
- Number of teacher dialogue examples: 15-20+
- Number of teaching phases: Matches lesson plan content

## Known Limitations

1. Quality depends on input lesson plan completeness
2. Dialogue may need teacher customization for specific contexts
3. Does not generate subject-specific pedagogical content (future enhancement)
4. No template customization per grade level (future enhancement)
