# Lesson Plan Attachment System - Quick Start Guide

**Date**: 2026-02-12
**For**: Developers testing the new attachment system

---

## Prerequisites

- Node.js 18+ installed
- npm 8+ installed
- Backend server running on port 3002
- CCAAS backend running (for file uploads)

---

## Installation

### 1. Install Dependencies

```bash
cd solutions/lesson-plan-designer/frontend
npm install
```

This will install:
- `lucide-react` (v0.460.0) - Icon library
- All other existing dependencies

### 2. Verify Installation

```bash
npm run build
```

Expected output:
```
✓ TypeScript compilation: SUCCESS
✓ Vite build: SUCCESS
✓ Bundle size: ~330 KB
```

---

## Starting the Application

### 1. Start Backend (Terminal 1)

```bash
cd solutions/lesson-plan-designer/backend
npm run start:dev
```

Expected output:
```
[Nest] INFO [NestApplication] Nest application successfully started
[Nest] INFO Listening on port 3002
```

### 2. Start Frontend (Terminal 2)

```bash
cd solutions/lesson-plan-designer/frontend
npm run dev
```

Expected output:
```
VITE v6.4.1  ready in 500 ms

➜  Local:   http://localhost:5280/
➜  Network: use --host to expose
```

### 3. Open Browser

Navigate to: `http://localhost:5280/`

---

## Testing the Feature

### Test 1: Upload File

1. **Create a new lesson plan**
   - Click "创建备课方案" button
   - Fill in basic info
   - Click "创建"

2. **Switch to Files tab**
   - In the chat panel (right sidebar)
   - Click "文件" tab
   - You should see empty state with upload prompt

3. **Upload a file**
   - Click "上传" button
   - Upload area appears
   - Drag a file or click to browse
   - Select a test file (e.g., sample.pdf)

4. **Verify file appears**
   - File should appear in the list immediately
   - File icon matches type (PDF = red FileText icon)
   - File shows "新" badge (red, indicates new)
   - File size displays correctly

### Test 2: Attach File to Lesson Plan

1. **Click "附加" button**
   - Button on the right side of each file
   - Button text changes to "附加中..."
   - Loading state shows

2. **Verify attachment success**
   - "新" badge clears from file
   - No visual error appears

3. **Check lesson plan content**
   - Scroll to "附件" section in main content area
   - AttachmentCard should appear
   - Card shows:
     - File icon (color-coded)
     - Filename
     - File type badge (e.g., "PDF")
     - Status badge: "[✓ 已附加]" (green)
     - File size and upload date
     - Download button
     - Delete button (on hover)

### Test 3: Download Attached File

1. **Click download button** on AttachmentCard
   - Blue button with download icon
   - File should download to browser's download folder
   - No errors in console

### Test 4: Remove Attachment

1. **Hover over AttachmentCard**
   - Delete button (trash icon) should appear on the right

2. **Click delete button**
   - Confirmation dialog may appear (depending on implementation)
   - AttachmentCard should disappear
   - File still visible in Files tab (not deleted, just detached)

### Test 5: Badge Counts

1. **Upload multiple files**
   - Upload 3 different files
   - Files tab badge should show "[文件 (3)]"
   - Each file has "新" badge

2. **Click "标记已读" button**
   - All "新" badges should clear
   - Files tab badge count should reset to 0

3. **Attach one file**
   - File's "新" badge should auto-clear after attach
   - Files tab badge count should decrement

---

## Test Files

Create these sample files for testing:

### 1. Audio File (test-audio.mp3)
- Any small MP3 file
- Expected icon: Purple Music icon
- Expected type badge: "音频"

### 2. PowerPoint File (test-slides.pptx)
- Any PPTX file
- Expected icon: Orange Presentation icon
- Expected type badge: "PPT"

### 3. PDF File (test-document.pdf)
- Any PDF file
- Expected icon: Red FileText icon
- Expected type badge: "PDF"

### 4. Text File (test-script.md)
- Any Markdown or text file
- Expected icon: Blue FileCode icon
- Expected type badge: "讲稿"

### 5. Other File (test-archive.zip)
- Any other file type
- Expected icon: Gray File icon
- Expected type badge: "其他"

---

## Common Test Scenarios

### Scenario 1: Happy Path
```
1. Create lesson plan
2. Upload file
3. Attach file
4. Verify AttachmentCard appears
5. Download file
6. Remove attachment
```

### Scenario 2: Multiple Files
```
1. Upload 5 files of different types
2. Verify all icons correct
3. Attach files one by one
4. Verify badge counts decrease
5. Verify all AttachmentCards appear
```

### Scenario 3: Error Handling
```
1. Disconnect backend
2. Try to attach file
3. Verify error message appears
4. Reconnect backend
5. Retry attach
6. Verify success
```

### Scenario 4: Badge Behavior
```
1. Upload 3 files
2. Verify badge shows (3)
3. Click "标记已读"
4. Verify badge clears
5. Upload 1 more file
6. Verify badge shows (1)
7. Attach that file
8. Verify badge clears automatically
```

---

## Verification Checklist

### Visual Checks

- [ ] Tab bar renders with proper styling
- [ ] Active tab has blue underline
- [ ] File icons color-coded correctly:
  - [ ] Audio = Purple Music
  - [ ] PPT = Orange Presentation
  - [ ] PDF = Red FileText
  - [ ] Script = Blue FileCode
  - [ ] Other = Gray File
- [ ] Status badges display:
  - [ ] Pending = Amber with Clock icon
  - [ ] Attached = Green with Check icon
- [ ] Buttons have correct Lucide icons:
  - [ ] Download = Download icon
  - [ ] Attach = Paperclip icon
  - [ ] Delete = Trash2 icon
- [ ] No emojis in AttachmentCard (replaced with icons)

### Functional Checks

- [ ] File upload works (drag & drop)
- [ ] File upload works (click to browse)
- [ ] File list updates immediately after upload
- [ ] "附加" button triggers loading state
- [ ] Attached files appear in lesson plan
- [ ] Download button works
- [ ] Delete button removes attachment
- [ ] Badge counts accurate
- [ ] "标记已读" clears badges
- [ ] Auto-clear badge after attach

### Layout Checks

- [ ] Default mode: 450px chat width
- [ ] Overlay mode: 450px minimum width
- [ ] Side-by-side mode: resizable panel
- [ ] No horizontal scroll
- [ ] Responsive on smaller screens

### Error Handling Checks

- [ ] Error message shows if backend down
- [ ] Error message shows if network error
- [ ] User-friendly error messages
- [ ] Retry works after error

---

## Browser Console Checks

### Expected Logs (Success)

```javascript
// File upload
File uploaded successfully: test-audio.mp3

// File attach
File test-audio.mp3 attached successfully
```

### Expected Logs (Error)

```javascript
// Attach error
Attach file error: Error: Network error
附加文件失败: Network error
```

### No Errors Expected

```javascript
// These should NOT appear:
✗ TypeError: ...
✗ Cannot read property '...' of undefined
✗ Warning: Can't perform a React state update...
```

---

## Network Tab Checks

### Expected API Calls

```
1. Upload File:
POST /api/v1/files/upload
Status: 200 OK
Response: { id: "file-123", filename: "test.pdf", ... }

2. Attach File:
POST /api/lesson-plans/:id/attachments
Status: 200 OK or 201 Created

3. Mark File Synced:
POST /api/v1/files/:id/mark-synced
Status: 200 OK

4. Download File:
GET /api/v1/files/:id/download
Status: 200 OK
```

---

## Performance Checks

### Bundle Size

```bash
npm run build
```

Expected:
- Total bundle: ~330 KB (gzipped: ~100 KB)
- Lucide icons: ~15 KB contribution
- No significant increase from baseline

### Load Time

- Initial page load: < 1 second
- Tab switch: < 100ms
- File upload: < 5 seconds for 10MB file
- File attach: < 500ms

### Memory Usage

```javascript
// Check in Chrome DevTools > Performance Monitor
Heap Size: < 50 MB (normal for React app)
No memory leaks after repeated uploads/attachments
```

---

## Troubleshooting

### Issue: Files don't appear after upload

**Check:**
1. Backend is running (`http://localhost:3002`)
2. Browser console for errors
3. Network tab for failed API calls
4. File size within limits

**Solution:**
```bash
# Restart backend
cd backend
npm run start:dev
```

### Issue: Icons not rendering

**Check:**
1. `lucide-react` installed
2. Browser console for import errors

**Solution:**
```bash
npm install lucide-react
npm run build
```

### Issue: Attach button doesn't work

**Check:**
1. `lessonPlanId` prop passed to ChatPanel
2. Browser console for errors
3. Network tab for API calls

**Solution:**
```typescript
// In App.tsx, verify:
lessonPlanId: lessonPlan?.id  // Should not be undefined
```

### Issue: Badge counts wrong

**Check:**
1. `useFiles` hook integrated correctly
2. `newFilesCount` prop passed to ChatPanel

**Solution:**
```typescript
// In useLessonPlanSession.ts, verify:
const files = useFiles({ connection, sessionId, enabled: true })
return { ...other, newFilesCount: files.newFilesCount }
```

---

## Testing with Backend Mock

If backend is not available, you can test with mock data:

```typescript
// In FilesView.tsx (for testing only)
const mockFiles = [
  {
    id: '1',
    filename: 'test-audio.mp3',
    mimeType: 'audio/mpeg',
    size: 2500000,
    status: 'new',
    uploadedAt: new Date().toISOString(),
  },
  {
    id: '2',
    filename: 'test-slides.pptx',
    mimeType: 'application/vnd.ms-powerpoint',
    size: 5200000,
    status: 'synced',
    uploadedAt: new Date().toISOString(),
  },
]
```

---

## Running Tests

### Unit Tests

```bash
npm test
```

Expected:
```
✓ 167 tests passing
Duration: ~2-3 seconds
```

### Integration Tests (if available)

```bash
npm run test:integration
```

### E2E Tests (if available)

```bash
npm run test:e2e
```

---

## Next Steps After Testing

1. **Report Issues**
   - Document any bugs found
   - Include screenshots
   - Include console logs
   - Include steps to reproduce

2. **Provide Feedback**
   - UI/UX improvements
   - Performance issues
   - Missing features

3. **Review Code**
   - Check code quality
   - Suggest improvements
   - Add tests if needed

---

## Support

**Questions?**
- Check `ATTACHMENT_SYSTEM_IMPLEMENTATION_COMPLETE.md` for full details
- Check `ATTACHMENT_SYSTEM_VISUAL_GUIDE.md` for visual reference
- Check browser console for errors
- Check backend logs for API issues

**Found a bug?**
- Document the issue
- Include reproduction steps
- Include browser/environment info

---

## Quick Reference

### Key Files

```
Frontend:
- components/ChatPanel.tsx         ← Tab system
- components/FilesView.tsx         ← File browser
- components/AttachmentCard.tsx    ← Attachment display
- hooks/useFileAttachment.ts       ← Attach logic
- hooks/useLessonPlanSession.ts    ← Integration
- types/index.ts                   ← Type definitions

Backend:
- lesson-plan.controller.ts        ← Attachment endpoints
- lesson-plan.service.ts           ← Business logic
```

### Key Components

```
<ChatPanel
  connection={connection}
  sessionId={sessionId}
  lessonPlanId={lessonPlanId}
  newFilesCount={newFilesCount}
  {...otherProps}
/>

<FilesView
  connection={connection}
  sessionId={sessionId}
  lessonPlanId={lessonPlanId}
/>

<AttachmentCard
  attachment={attachment}
  status="attached"
  onRemove={handleRemove}
/>
```

### Key Hooks

```typescript
const { attachFile, isAttaching, error } = useFileAttachment(lessonPlanId)

const { files, uploadFile, markAsSynced, newFilesCount } = useFiles({
  connection,
  sessionId,
  enabled: true,
})
```

---

## Conclusion

You're now ready to test the lesson plan attachment system! Follow the test scenarios above, verify the checklist items, and report any issues.

**Happy testing! 🧪**
