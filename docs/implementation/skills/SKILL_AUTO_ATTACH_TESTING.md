# Skill Auto-Attach Testing Guide

## Quick Start

To test the new auto-attach functionality, use the Lesson Plan Designer solution with these test commands.

## Test Environment Setup

1. **Start Lesson Plan Designer:**
   ```bash
   cd solutions/lesson-plan-designer
   # Start backend and frontend (follow solution's README)
   ```

2. **Create a test lesson plan:**
   - Open the Lesson Plan Designer frontend
   - Create a new lesson plan
   - Enter basic information (title, subject, grade)
   - Save the lesson plan

3. **Start Claude Code with MCP:**
   ```bash
   # Make sure you're in the lesson plan designer context
   # The attach_file MCP tool should be available
   ```

## Test Cases

### Test 1: Direct NotebookLM Audio Generation

**User command:**
```
生成音频
```

**Expected behavior:**
1. Claude activates NotebookLM skill
2. Creates notebook with lesson plan content as source
3. Generates audio overview
4. Waits for artifact completion
5. Downloads audio to `./教学讲解音频.mp3`
6. ✅ **NEW:** Calls `attach_file` automatically
7. User sees "添加附件" (Add Attachment) sync button in chat
8. User clicks sync button
9. Audio appears in lesson plan's "附件" (Attachments) section

**Verify:**
- [ ] Sync button appears after audio download
- [ ] Clicking sync adds audio to attachments
- [ ] Attachment card shows:
  - Audio icon 🎵
  - File name: `教学讲解音频.mp3`
  - File size (e.g., "8.2 MB")
  - Description: "教学讲解音频 - 基于教学讲稿生成的中文讲解"
  - Download button works
  - Delete button appears on hover

### Test 2: Direct PPT Generation

**User command:**
```
生成教学PPT
```

**Expected behavior:**
1. Claude activates lesson-plan-pptx skill (new wrapper)
2. Calls example-skills:pptx to create presentation
3. Generates slides with appropriate design
4. Saves to `./教学PPT.pptx`
5. ✅ **NEW:** Calls `attach_file` automatically
6. User sees "添加附件" sync button in chat
7. User clicks sync button
8. PPT appears in lesson plan's "附件" section

**Verify:**
- [ ] Sync button appears after PPT generation
- [ ] Clicking sync adds PPT to attachments
- [ ] Attachment card shows:
  - PPT icon 📊
  - File name: `教学PPT.pptx`
  - File size (e.g., "2.5 MB")
  - Description includes slide count (e.g., "教学PPT - 包含12页幻灯片")
  - Download button works
  - Delete button appears on hover

### Test 3: Complete Materials Package (Teaching Script Generator)

**User command:**
```
全套材料
```

**Expected behavior:**
1. Claude activates teaching-script-generator skill
2. Generates teaching script content
3. Emits 2 output updates (text to extraProperties, markdown file to attachments)
4. Calls lesson-plan-pptx skill → generates PPT → calls attach_file
5. Calls NotebookLM skill → generates audio → calls attach_file
6. User sees **4 sync buttons** total:
   - Button 1: "同步到表单" (text content)
   - Button 2: "添加附件" (teaching script .md file)
   - Button 3: "添加附件" (audio .mp3 file) ← NEW
   - Button 4: "添加附件" (PPT .pptx file) ← NEW

**Verify:**
- [ ] 4 sync buttons appear
- [ ] All 4 buttons work correctly
- [ ] After syncing all:
  - [ ] Teaching script text in "教学讲稿" field
  - [ ] 3 attachments in "附件" section (script.md, audio.mp3, slides.pptx)
  - [ ] All download buttons work
  - [ ] All file metadata is correct

### Test 4: Context Isolation (NotebookLM Outside Lesson Plan)

**User command (in general Claude Code session, NOT in lesson plan context):**
```
Create a podcast about the history of AI
```

**Expected behavior:**
1. Claude activates NotebookLM skill
2. Creates notebook, adds sources, generates audio
3. Downloads audio file
4. ❌ **Does NOT call attach_file** (tool not available)
5. No sync button appears
6. Audio file is saved locally but not attached anywhere

**Verify:**
- [ ] Audio is generated successfully
- [ ] No sync button appears (correct behavior)
- [ ] No errors about missing attach_file tool
- [ ] Skill works normally in non-lesson-plan context

### Test 5: Custom File Paths

**User command:**
```
Generate audio and save it as my-custom-audio.mp3
```

**Expected behavior:**
1. NotebookLM downloads to `./my-custom-audio.mp3`
2. Calls `attach_file({ filePath: 'my-custom-audio.mp3', ... })`
3. Sync button appears
4. After sync, attachment has correct custom filename

**Verify:**
- [ ] attach_file uses exact custom path
- [ ] Sync button works
- [ ] Attachment card shows "my-custom-audio.mp3" (not default name)

### Test 6: Error Handling - PPT Generation Fails

**User command:**
```
生成教学PPT
```

**Simulate failure:** Let PPT generation fail (e.g., rate limit, error)

**Expected behavior:**
1. example-skills:pptx returns error
2. ❌ **attach_file is NOT called** (error occurred)
3. Error is reported to user
4. No sync button appears
5. User is offered retry or alternative approach

**Verify:**
- [ ] attach_file not called on error
- [ ] No sync button appears
- [ ] Error message is clear
- [ ] Retry option is offered

### Test 7: Error Handling - Audio Download Fails

**User command:**
```
生成音频
```

**Simulate failure:** Let audio download fail (e.g., artifact incomplete)

**Expected behavior:**
1. notebooklm download audio fails
2. ❌ **attach_file is NOT called** (download failed)
3. Error is reported to user
4. No sync button appears
5. User is offered retry or check status

**Verify:**
- [ ] attach_file not called on error
- [ ] No sync button appears
- [ ] Error message is clear
- [ ] Retry/check status options offered

## Regression Tests

### Verify Existing Functionality Still Works

1. **Teaching script generator (without audio/PPT):**
   - Command: "生成教学讲稿"
   - Expected: 2 sync buttons (text + file)
   - [ ] Text sync works
   - [ ] File sync works
   - [ ] No audio/PPT generated (correct)

2. **Manual attachment (attach_file direct call):**
   - Command: "Attach the file test.pdf to attachments"
   - Expected: Sync button appears
   - [ ] Sync button works
   - [ ] Attachment card displays correctly

3. **Lesson plan CRUD operations:**
   - [ ] Create lesson plan works
   - [ ] Update lesson plan works
   - [ ] Delete lesson plan works
   - [ ] List lesson plans works

## Performance Tests

### Test Long-Running Operations

1. **Audio generation (5-10 minutes):**
   - Monitor: Claude should use subagent pattern for `artifact wait`
   - [ ] Main conversation remains responsive
   - [ ] Artifact wait happens in background
   - [ ] attach_file called after completion

2. **PPT generation (1-2 minutes):**
   - Monitor: Synchronous operation is acceptable
   - [ ] User sees progress updates
   - [ ] attach_file called immediately after success

3. **Complete materials (15-20 minutes total):**
   - Monitor: Multiple parallel operations
   - [ ] Teaching script syncs immediately
   - [ ] Audio waits in background
   - [ ] PPT generates synchronously
   - [ ] All sync buttons appear as operations complete

## UI/UX Tests

### Attachment Card Display

After syncing files, verify attachment cards show:

1. **Audio attachment:**
   - [ ] 🎵 Audio icon
   - [ ] File name visible
   - [ ] File size formatted (e.g., "8.2 MB")
   - [ ] Upload timestamp shown
   - [ ] Description visible
   - [ ] Download button works
   - [ ] Delete button appears on hover
   - [ ] Delete confirmation works

2. **PPT attachment:**
   - [ ] 📊 PPT icon
   - [ ] File name visible
   - [ ] File size formatted (e.g., "2.5 MB")
   - [ ] Upload timestamp shown
   - [ ] Description with slide count
   - [ ] Download button works
   - [ ] Delete button appears on hover
   - [ ] Delete confirmation works

### Sync Button Behavior

1. **Button appearance:**
   - [ ] "添加附件" text is clear
   - [ ] Button is clickable
   - [ ] Preview shows file info

2. **Button interaction:**
   - [ ] Click triggers sync API call
   - [ ] Loading state shown during sync
   - [ ] Success feedback after sync
   - [ ] Button disappears after successful sync
   - [ ] Error message shown if sync fails

3. **Multiple buttons:**
   - [ ] Buttons are stacked vertically
   - [ ] Each button is independent
   - [ ] Clicking one doesn't affect others
   - [ ] All buttons can be synced in any order

## Debugging Tips

### Enable Verbose Logging

If tests fail, check logs:

```bash
# Backend logs
cd solutions/lesson-plan-designer/backend
npm run dev
# Watch for attach_file tool calls and output_update events

# Frontend logs
cd solutions/lesson-plan-designer/frontend
npm run dev
# Open browser console, watch for WebSocket events
```

### Verify MCP Tool Availability

In lesson plan chat:
```
Check if attach_file MCP tool is available
```

Expected response:
```
Yes, attach_file is available. I can attach files to the current lesson plan.
```

### Check Skill Activation

Ask Claude:
```
Which skills are loaded right now?
```

Expected to see:
- `lesson-plan-pptx` ✅
- `notebooklm` ✅
- `teaching-script-generator` ✅

## Known Issues

### Issue 1: Skill Not Triggering

**Symptom:** User says "生成PPT" but example-skills:pptx activates instead of lesson-plan-pptx

**Cause:** Trigger patterns may overlap

**Fix:** Be more explicit:
```
Use lesson-plan-pptx to generate teaching slides
```

### Issue 2: attach_file Not Called

**Symptom:** File generated but no sync button appears

**Possible causes:**
1. Not in lesson-plan-designer context (attach_file tool not available)
2. File generation failed (check error logs)
3. Skill didn't read the integration section

**Debug:**
1. Verify MCP tool availability
2. Check skill file was modified correctly
3. Review Claude's reasoning for why attach_file wasn't called

### Issue 3: File Path Mismatch

**Symptom:** attach_file called with wrong path, sync fails

**Cause:** File path in attach_file doesn't match actual generated file

**Fix:** Verify file exists before calling attach_file:
```bash
ls -lh ./教学讲解音频.mp3
```

## Success Metrics

### Quantitative

- [ ] 100% of direct audio generations trigger attach_file
- [ ] 100% of direct PPT generations trigger attach_file
- [ ] Complete materials package produces 4 sync buttons
- [ ] 0 errors in non-lesson-plan contexts
- [ ] 0 false positives (attach_file called when shouldn't be)

### Qualitative

- [ ] User experience is seamless (no manual attachment needed)
- [ ] Error messages are clear and actionable
- [ ] Sync buttons are intuitive to use
- [ ] Attachment cards display all necessary information
- [ ] Workflow feels natural and efficient

## Reporting Issues

If you encounter issues during testing, report with:

1. **Test case number** (e.g., "Test 2: Direct PPT Generation")
2. **User command** (exact text)
3. **Expected behavior** (from test case)
4. **Actual behavior** (what happened)
5. **Logs** (backend and frontend console output)
6. **Screenshots** (if UI issue)

Example issue report:
```
Test 2: Direct PPT Generation

User command: "生成教学PPT"

Expected: PPT generated, attach_file called, sync button appears

Actual: PPT generated, but no attach_file call, no sync button

Logs:
- Backend: No output_update event for attachment field
- Frontend: WebSocket received only 1 message (PPT generation complete)
- Claude reasoning: "PPT generated successfully" (no mention of attach_file)

Screenshot: [attach screenshot showing no sync button]
```

## Next Steps After Testing

1. **Gather user feedback** on multi-button UX
2. **Measure usage** of direct skill invocations vs teaching-script-generator
3. **Decide** whether to implement Part 2 (grouped sync with checkboxes)
4. **Document** any edge cases discovered during testing
5. **Update** skill documentation based on real-world usage
