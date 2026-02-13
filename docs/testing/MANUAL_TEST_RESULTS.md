# FilesView Decoupling - Manual Test Results

## Server Status ✅

**Date**: 2026-02-12 11:20 AM
**Environment**: Local Development

### Backend Server
- **Status**: ✅ Running
- **Port**: 3002
- **API**: http://localhost:3002/api/lesson-plans
- **Response**: Successfully returns lesson plans with attachments

### Frontend Server
- **Status**: ✅ Running
- **Port**: 5281
- **URL**: http://localhost:5281
- **Title**: "AI备课设计器 - Lesson Plan Designer"

## Implementation Verification ✅

### Code Changes Deployed

1. **FilesView.tsx** (line 10):
   ```typescript
   onAttachFile?: (file: FileMetadata) => Promise<{ success: boolean }>
   ```
   ✅ Optional attachment prop exists

2. **ChatPanel.tsx** (line 238):
   ```typescript
   onAttachFile={lessonPlanId ? handleAttachFile : undefined}
   ```
   ✅ Conditional attachment handler passed

## Manual Testing Instructions

### Test 1: Basic Files Tab Access

**Steps**:
1. Open browser: http://localhost:5281
2. Click "新建备课方案" or select existing lesson plan
3. Navigate to "文件" (Files) tab

**Expected Results**:
- [ ] Files tab displays without errors
- [ ] Header shows "文件" title
- [ ] "上传" button visible
- [ ] File list displays (or "暂无文件" if empty)

**Console Check**:
```javascript
// Open Browser DevTools → Console
// Should see NO errors about:
// - Missing lessonPlanId
// - TypeError: Cannot read property
// - Prop type validation errors
```

---

### Test 2: Generic Mode (No Lesson Plan)

**Steps**:
1. Modify ChatPanel.tsx temporarily:
   ```typescript
   // Line 238 - Comment out onAttachFile
   <FilesView
     connection={connection}
     sessionId={sessionId}
     // onAttachFile={lessonPlanId ? handleAttachFile : undefined}
   />
   ```
2. Save file (Vite will hot-reload)
3. Check Files tab

**Expected Results**:
- [ ] Files tab still renders correctly
- [ ] "上传" and download buttons work
- [ ] **"附加" button NOT visible** ← Key test!
- [ ] No console errors

**Verification**:
```javascript
// In Browser Console:
document.querySelectorAll('button[title="附加到教案"]').length
// Should return: 0 (no attach buttons)
```

---

### Test 3: Attachment Mode (With Lesson Plan)

**Steps**:
1. Restore ChatPanel.tsx (uncomment onAttachFile)
2. Select a lesson plan with files:
   - "七年级数学 - 3.2 解一元一次方程" (has attachments)
3. Go to Files tab

**Expected Results**:
- [ ] Files list displays uploaded files
- [ ] Each file has "附加" button visible
- [ ] Button text is "附加" (not "附加到教案")
- [ ] Button has correct styling (blue bg)

**Verification**:
```javascript
// In Browser Console:
document.querySelectorAll('button').forEach(btn => {
  if (btn.textContent.includes('附加')) {
    console.log('Attach button:', btn.textContent, btn.disabled)
  }
})
// Should show attach buttons, disabled=false
```

---

### Test 4: File Upload

**Steps**:
1. Click "上传" button
2. Click "Upload File Mock" or drag file
3. Wait for upload to complete

**Expected Results**:
- [ ] Upload succeeds
- [ ] New file appears in list immediately
- [ ] File has "新" badge
- [ ] "附加" button available for new file
- [ ] No errors in console

**Network Check**:
```
DevTools → Network → Filter: XHR
POST /api/v1/files/upload
Status: 201 Created
```

---

### Test 5: File Attachment

**Steps**:
1. Click "附加" button on any file
2. Observe button state changes
3. Wait for completion

**Expected Results**:
- [ ] Button text changes to "附加中..."
- [ ] Button becomes disabled during operation
- [ ] Success feedback after completion
- [ ] Console log: "File [filename] attached successfully"

**Network Check**:
```
DevTools → Network
POST /api/lesson-plans/{lessonPlanId}/attachments
Request body includes:
{
  "fileId": "...",
  "fileName": "...",
  "fileType": "ppt"|"audio"|"pdf"|"other",
  "mimeType": "...",
  "size": number
}
Response: 201 Created
```

---

### Test 6: File Download

**Steps**:
1. Click download icon (arrow down) on any file
2. Check browser downloads

**Expected Results**:
- [ ] Download starts immediately
- [ ] File saved with correct name
- [ ] No CORS errors in console

**Network Check**:
```
GET /api/v1/files/{fileId}/download
Status: 200 OK
Content-Disposition: attachment; filename="..."
```

---

### Test 7: Mark as Seen

**Steps**:
1. If files have "新" badge, click "标记已读"
2. Observe badge disappears

**Expected Results**:
- [ ] Badge count updates
- [ ] "新" badges removed from files
- [ ] Button disappears after all marked

---

### Test 8: Error Handling

**Steps**:
1. Stop backend server: `pkill -f "nest start"`
2. Try to upload or attach file
3. Check error display

**Expected Results**:
- [ ] Error message displayed to user
- [ ] No silent failures
- [ ] App doesn't crash
- [ ] User can retry after backend restarts

---

### Test 9: Empty State

**Steps**:
1. Select lesson plan with no files
2. Go to Files tab

**Expected Results**:
- [ ] "暂无文件" message displays
- [ ] Empty folder icon visible
- [ ] Helpful text: "点击上传按钮添加课件、音频等资料"
- [ ] Upload button still available

---

### Test 10: WebSocket Events

**Steps**:
1. Open Browser Console
2. Monitor socket events:
   ```javascript
   // Copy-paste into console:
   window.socketEvents = []
   const originalEmit = io.Socket.prototype.emit
   io.Socket.prototype.emit = function(event, ...args) {
     if (event.includes('file')) {
       window.socketEvents.push({ event, args })
       console.log('📡 Socket event:', event, args)
     }
     return originalEmit.apply(this, [event, ...args])
   }
   ```
3. Upload a file
4. Check `window.socketEvents`

**Expected Results**:
- [ ] `file_created` event received
- [ ] File metadata in event payload
- [ ] UI updates immediately
- [ ] No lag or delay in display

---

## Performance Checks

### React DevTools Profiler

**Steps**:
1. Open React DevTools → Profiler
2. Start recording
3. Switch to Files tab
4. Stop recording

**Expected Results**:
- [ ] Minimal re-renders (<5 components)
- [ ] Fast render time (<100ms)
- [ ] No warning about slow components

---

## Regression Testing

### Verify No Breaking Changes

**Checklist**:
- [ ] Other tabs still work (消息, 任务)
- [ ] Chat functionality unaffected
- [ ] Lesson plan form still works
- [ ] Navigation between lesson plans works
- [ ] Session management works

---

## Known Issues (Expected)

### 1. Test Matcher Errors
**Status**: Pre-existing, not related to changes
**Impact**: None on runtime behavior
**Fix**: Separate task for testing library setup

### 2. Backend Port Conflict
**Status**: Port 3002 already in use
**Impact**: None - existing backend works fine
**Action**: No action needed

---

## Test Results Summary

Fill in after manual testing:

### Passing Tests
- [ ] Test 1: Basic Files Tab Access
- [ ] Test 2: Generic Mode (No Lesson Plan)
- [ ] Test 3: Attachment Mode (With Lesson Plan)
- [ ] Test 4: File Upload
- [ ] Test 5: File Attachment
- [ ] Test 6: File Download
- [ ] Test 7: Mark as Seen
- [ ] Test 8: Error Handling
- [ ] Test 9: Empty State
- [ ] Test 10: WebSocket Events

### Issues Found
(List any issues discovered during testing)

### Performance
- Render time: ___ ms
- Re-render count: ___
- Memory usage: OK / High / Leak detected

---

## Sign-Off

**Tested By**: _______________
**Date**: _______________
**Status**: ✅ Pass / ⚠️ Pass with Issues / ❌ Fail
**Notes**: _______________

---

## Next Actions

Based on test results:
1. If all pass → Commit changes and create PR
2. If issues found → Document in GitHub issue
3. If breaking changes → Rollback and reassess

---

**Created**: 2026-02-12 11:20 AM
**Servers**: Frontend (5281) ✅ | Backend (3002) ✅
**Implementation**: Deployed ✅
**Ready for Testing**: Yes
