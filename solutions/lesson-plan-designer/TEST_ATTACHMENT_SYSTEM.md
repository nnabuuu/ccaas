# Test the File Attachment System - Step by Step

**Date**: 2026-02-12
**Status**: Ready to test
**URL**: http://localhost:5280/

---

## ✅ Pre-Test Verification

- [x] Backend running on port 3002
- [x] Frontend running on port 5280
- [x] All 167 tests passing
- [x] Build successful

---

## Test Scenario 1: Upload and Attach File (5 minutes)

### Step 1: Open Application
1. Open browser: http://localhost:5280/
2. Expected: See "开始您的备课" page
3. Click "创建备课方案" button

### Step 2: Create Lesson Plan
1. Fill in form:
   - 课程名称: "Test Lesson"
   - 学科: "数学" (Math)
   - 年级: "3年级"
   - 课时: "45"
2. Click "创建" button
3. Expected: Lesson plan editor appears

### Step 3: Switch to Files Tab
1. Look at right sidebar (chat panel)
2. See two tabs: "消息" and "文件"
3. Click "文件" tab
4. Expected:
   - ✅ Tab switches to Files view
   - ✅ Empty state shows: "暂无文件"
   - ✅ Upload button visible in top right
   - ✅ Tab has blue underline (active indicator)

### Step 4: Upload a File
1. Click "上传" button in top right
2. Expected: Upload area expands
3. Create a test file or use existing file:
   ```bash
   echo "Test lecture script" > ~/Desktop/test-script.md
   ```
4. Drag the file to upload area OR click to browse
5. Expected:
   - ✅ File appears in list immediately
   - ✅ File shows red "新" badge
   - ✅ Icon matches file type (test-script.md = blue FileCode icon)
   - ✅ File size displays (e.g., "20 B")
   - ✅ Download button (↓) visible
   - ✅ "附加" button visible

### Step 5: Attach File to Lesson Plan
1. Click "附加" button next to the file
2. Expected during attach:
   - ✅ Button text changes to "附加中..."
   - ✅ Button disabled
3. Expected after attach (1-2 seconds):
   - ✅ "新" badge disappears
   - ✅ Button re-enabled with text "附加"
   - ✅ No error message

### Step 6: Verify Attachment in Lesson Plan
1. Scroll down in main content area
2. Find "附件" (Attachments) section
3. Expected:
   - ✅ AttachmentCard appears
   - ✅ Shows blue FileCode icon (not emoji)
   - ✅ Shows filename: "test-script.md"
   - ✅ Shows file type badge: "讲稿" (script)
   - ✅ Shows status badge: "[✓ 已附加]" (green with check icon)
   - ✅ Shows file size: "20 B"
   - ✅ Shows upload date/time
   - ✅ Blue "下载" button visible
   - ✅ Trash icon on hover (delete button)

### Step 7: Download Attached File
1. Click "下载" button on AttachmentCard
2. Expected:
   - ✅ File downloads to browser's download folder
   - ✅ No errors in console

---

## Test Scenario 2: Multiple File Types (3 minutes)

### Upload Different File Types

Create test files:
```bash
cd ~/Desktop
echo "Audio test" > test-audio.mp3
echo "PPT test" > test-slides.pptx
echo "PDF test" > test-document.pdf
echo "Script test" > test-script.md
echo "Other test" > test-archive.zip
```

Upload each file and verify icons:

| File | Expected Icon | Expected Color | Expected Type Badge |
|------|--------------|----------------|---------------------|
| test-audio.mp3 | Music (🎵) | Purple | 音频 |
| test-slides.pptx | Presentation (📊) | Orange | PPT |
| test-document.pdf | FileText (📄) | Red | PDF |
| test-script.md | FileCode (📝) | Blue | 讲稿 |
| test-archive.zip | File (📎) | Gray | 其他 |

**Verify:**
- ✅ Each file shows correct icon
- ✅ Each file has correct color
- ✅ Files tab badge shows count: "文件 (5)"
- ✅ Each file has "新" badge

---

## Test Scenario 3: Badge System (2 minutes)

### Test "Mark All Seen" Feature

1. With multiple files uploaded (all showing "新" badge)
2. Click "标记已读" button in Files tab header
3. Expected:
   - ✅ All "新" badges disappear from files
   - ✅ Files tab badge count resets to 0
   - ✅ Files still visible in list

### Test Auto-Clear Badge on Attach

1. Upload a new file (shows "新" badge)
2. Click "附加" button
3. Expected:
   - ✅ "新" badge disappears after successful attach
   - ✅ Files tab badge count decrements by 1

---

## Test Scenario 4: Tab Navigation (1 minute)

### Switch Between Tabs

1. Click "消息" tab
   - ✅ Chat messages view appears
   - ✅ "消息" tab has blue underline
   - ✅ "文件" tab inactive (gray)

2. Click "文件" tab
   - ✅ Files view appears
   - ✅ "文件" tab has blue underline
   - ✅ "消息" tab inactive (gray)

3. Send a message in Messages tab
   - ✅ Message appears in chat
   - ✅ Tab switching works smoothly

---

## Test Scenario 5: Layout Modes (2 minutes)

The chat panel should work in different layout modes:

### Default Mode (Current)
- ✅ Chat panel: 450px fixed width
- ✅ Files list readable
- ✅ No horizontal scroll

### Test Resize
1. Try different browser window sizes
2. Verify layout adapts properly

---

## Visual Verification Checklist

### Icons (No Emojis!)
- ✅ All file type icons are Lucide React components (not emojis)
- ✅ Download button uses Download icon (not emoji)
- ✅ Attach button uses Paperclip icon
- ✅ Status badges use Check/Clock icons

### Colors
- ✅ Primary actions: Blue (#3B82F6)
- ✅ New badges: Red
- ✅ Files tab badge: Amber
- ✅ Pending status: Amber with Clock
- ✅ Attached status: Green with Check
- ✅ File type colors match spec:
  - Audio: Purple
  - PPT: Orange
  - PDF: Red
  - Script: Blue
  - Other: Gray

### Typography
- ✅ Tab text: 14px, medium weight
- ✅ File names: 14px, medium weight
- ✅ File sizes: 12px, regular weight
- ✅ Badge text: 12px, medium weight

---

## Error Scenarios to Test

### Test 1: Backend Down
1. Stop backend server: `pkill -f "lesson-plan-designer/backend"`
2. Try to attach a file
3. Expected:
   - ✅ Error message appears
   - ✅ User-friendly error text
   - ✅ File remains in "new" state

### Test 2: Large File
1. Create large file: `dd if=/dev/zero of=~/Desktop/large.bin bs=1M count=100`
2. Try to upload (if size limit exists)
3. Expected:
   - ✅ Appropriate error or success
   - ✅ Progress indicator if supported

---

## Browser Console Checks

Open browser DevTools (F12) → Console tab

### Expected Logs (Success)
```javascript
File uploaded successfully: test-script.md
File test-script.md attached successfully
```

### No Errors Expected
```javascript
// These should NOT appear:
✗ TypeError: ...
✗ Cannot read property '...' of undefined
✗ 404 errors
✗ CORS errors
```

---

## Network Tab Checks

Open browser DevTools (F12) → Network tab

### Expected API Calls

**File Upload:**
```
POST /api/v1/files/upload
Status: 200 OK
```

**File Attach:**
```
POST /api/lesson-plans/:id/attachments
Status: 200 OK or 201 Created
```

**Mark Synced:**
```
POST /api/v1/files/:id/mark-synced
Status: 200 OK
```

---

## Performance Checks

### Timing
- ✅ Tab switch: < 100ms
- ✅ File upload (10MB): < 5 seconds
- ✅ File attach: < 500ms
- ✅ UI responsive throughout

### Bundle Size
```bash
npm run build
# Expected: ~330 KB total bundle (gzipped: ~100 KB)
```

---

## Accessibility Checks

### Keyboard Navigation
1. Press Tab key repeatedly
   - ✅ Focus moves through all interactive elements
   - ✅ Focus ring visible on all elements

2. Press Enter on tab buttons
   - ✅ Tabs switch correctly

3. Press Space on "附加" button
   - ✅ File attaches

### Screen Reader (Optional)
If you have VoiceOver (Mac) or NVDA (Windows):
1. Enable screen reader
2. Navigate to Files tab
3. Expected announcements:
   - "Files tab selected"
   - "test-script.md, new file"
   - "Attach button"

---

## Success Criteria

All checkboxes above should be ✅. If any are ❌:

1. Check browser console for errors
2. Check Network tab for failed requests
3. Check backend logs
4. Verify servers are running
5. Try refreshing the page

---

## Known Limitations

1. **No File Preview** - Files must be downloaded to preview (future enhancement)
2. **No Bulk Actions** - Attach files one at a time (future enhancement)
3. **No Search** - Simple list only (future enhancement)

---

## Cleanup After Testing

```bash
# Stop servers
pkill -f "lesson-plan-designer/backend"
pkill -f "lesson-plan-designer/frontend"

# Remove test files
rm ~/Desktop/test-*
```

---

## Report Issues

If you find bugs:

1. **Document the issue:**
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots if possible
   - Browser console logs
   - Network tab requests

2. **Check logs:**
   - Backend: Check terminal output
   - Frontend: Check browser console

3. **File location:**
   - Create issue in GitHub repository
   - Or add to project documentation

---

## Test Results Template

```markdown
## Test Results - [Date]

**Tester**: [Your Name]
**Browser**: [Chrome/Firefox/Safari] [Version]
**OS**: [macOS/Windows/Linux]

### Scenario 1: Upload and Attach
- [ ] Step 1-7 completed successfully
- Issues: [None / Describe]

### Scenario 2: Multiple File Types
- [ ] All file types display correctly
- Issues: [None / Describe]

### Scenario 3: Badge System
- [ ] Badge behavior correct
- Issues: [None / Describe]

### Scenario 4: Tab Navigation
- [ ] Tab switching works
- Issues: [None / Describe]

### Visual Verification
- [ ] Icons correct (no emojis)
- [ ] Colors match design system
- [ ] Typography correct
- Issues: [None / Describe]

### Performance
- Tab switch speed: [< 100ms / slower]
- File upload speed (10MB): [< 5s / slower]
- File attach speed: [< 500ms / slower]

### Overall Assessment
- [ ] Feature works as expected
- [ ] Ready for production
- [ ] Needs fixes (list below)

**Notes:**
[Additional comments]
```

---

## Quick Visual Test

If you just want a quick visual check:

1. Open http://localhost:5280/
2. Create a lesson plan
3. Click "文件" tab → Upload a file → Click "附加"
4. Check AttachmentCard appears with Lucide icons (not emojis)
5. Done! ✅

**Estimated time: 2 minutes**

---

## Conclusion

This test guide covers all major functionality of the file attachment system. Complete testing should take approximately **15-20 minutes** for full coverage, or **2 minutes** for quick smoke testing.

**Ready to test! 🧪**
