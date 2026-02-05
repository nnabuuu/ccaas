# Attachment UI Implementation

## Overview

The AttachmentCard component and related UI updates have been successfully implemented to display and manage file attachments in lesson plans.

## Components Created/Updated

### 1. AttachmentCard Component

**File:** `src/components/AttachmentCard.tsx`

**Features:**
- Displays file metadata (name, size, type, upload date)
- Color-coded file type badges with icons
- Download button with icon
- Optional delete button (appears on hover)
- Responsive layout with hover effects
- Chinese localization

**File Type Support:**
| Type | Icon | Color Scheme | Label |
|------|------|--------------|-------|
| script | 📝 | Blue | 讲稿 |
| audio | 🎵 | Purple | 音频 |
| ppt | 📊 | Orange | PPT |
| pdf | 📄 | Red | PDF |
| other | 📎 | Gray | 其他 |

**Props Interface:**
```typescript
interface AttachmentCardProps {
  attachment: LessonPlanAttachment
  onRemove?: (id: string) => void  // Optional delete handler
}
```

**Usage Example:**
```tsx
<AttachmentCard
  attachment={{
    id: 'uuid',
    fileId: 'file-uuid',
    fileName: '教学讲稿.md',
    fileType: 'script',
    mimeType: 'text/markdown',
    size: 15360,
    downloadUrl: '/api/v1/files/file-uuid/download',
    uploadedAt: '2026-02-02T10:00:00Z',
    description: '教学讲稿 - 包含9个章节'
  }}
  onRemove={(id) => console.log('Remove', id)}
/>
```

### 2. SyncButton Component Updates

**File:** `src/components/SyncButton.tsx`

**Changes:**
- Added 'attachments' to FIELD_LABELS
- Special rendering for attachment sync buttons:
  - Different icon (paperclip instead of sync)
  - Different button text ("添加附件" instead of "同步到表单")
  - Different status messages ("已添加附件" instead of "已同步到...")
  - Different suggestion text ("待添加附件" instead of "建议更新")

**Visual Differences:**

**Regular Field:**
```
┌────────────────────────────────────────┐
│ 🔄 建议更新「学习目标」                  │
│ 2个学习目标                             │
│                    [🔄 同步到表单] [✕]  │
└────────────────────────────────────────┘
```

**Attachment Field:**
```
┌────────────────────────────────────────┐
│ 📎 待添加附件「附件」                    │
│ 📎 教学讲稿.md (15KB)                   │
│                    [📎 添加附件] [✕]    │
└────────────────────────────────────────┘
```

### 3. LessonPlanContent Component Updates

**File:** `src/components/LessonPlanContent.tsx`

**Changes:**
1. Imported AttachmentCard component
2. Added 'attachments' to OUTLINE_ITEMS (navigation)
3. Added attachments section rendering:
   - Only displays when attachments exist
   - Uses EditorSection wrapper for consistency
   - Maps over attachments array
   - Provides delete functionality via onChange
   - Space between cards for readability

**Attachments Section:**
```tsx
{lessonPlan.attachments && lessonPlan.attachments.length > 0 && (
  <EditorSection
    id="attachments"
    title="附件"
    isEditing={false}
    isSaving={false}
    isModified={false}
    canUndo={false}
    onStartEdit={() => {}}
    onSave={() => {}}
    onCancel={() => {}}
  >
    <div className="space-y-3">
      {lessonPlan.attachments.map((attachment) => (
        <AttachmentCard
          key={attachment.id}
          attachment={attachment}
          onRemove={(id) => {
            const updated = lessonPlan.attachments.filter((a) => a.id !== id)
            onChange('attachments', updated as never)
          }}
        />
      ))}
    </div>
  </EditorSection>
)}
```

## Visual Design

### AttachmentCard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ┌────┐  教学讲稿.md                            [下载]  [🗑] │
│ │ 📝 │  ┌──────┬────────┬─────────────────┐                │
│ │    │  │ 讲稿 │ 15 KB  │ 2026-02-02 10:00 │                │
│ └────┘  └──────┴────────┴─────────────────┘                │
│         教学讲稿 - 包含9个章节的完整授课指南                  │
└─────────────────────────────────────────────────────────────┘
```

**Hover State:**
- Card shadow increases
- Delete button becomes visible
- Download button color intensifies

### Color Schemes

**Script (Blue):**
- Background: `bg-blue-50`
- Text: `text-blue-700`
- Border: `border-blue-200`

**Audio (Purple):**
- Background: `bg-purple-50`
- Text: `text-purple-700`
- Border: `border-purple-200`

**PPT (Orange):**
- Background: `bg-orange-50`
- Text: `text-orange-700`
- Border: `border-orange-200`

**PDF (Red):**
- Background: `bg-red-50`
- Text: `text-red-700`
- Border: `border-red-200`

## Helper Functions

### formatBytes(bytes: number): string
Formats file size in human-readable format:
- < 1KB: "99 B"
- < 1MB: "15.3 KB"
- >= 1MB: "2.5 MB"

### formatDate(isoString: string): string
Formats ISO timestamp in Chinese format:
- Format: "YYYY/MM/DD HH:MM"
- Example: "2026/02/02 10:00"

### getFileIcon(fileType: string): string
Returns emoji icon for file type:
- script: 📝
- audio: 🎵
- ppt: 📊
- pdf: 📄
- other: 📎

### getFileTypeLabel(fileType: string): string
Returns Chinese label for file type:
- script: 讲稿
- audio: 音频
- ppt: PPT
- pdf: PDF
- other: 其他

## Integration with Sync Workflow

### Step-by-Step Flow

1. **Claude generates file:**
   ```typescript
   Write({ file_path: '教学讲稿.md', content: '...' })
   ```

2. **Claude attaches file:**
   ```typescript
   attach_file({
     filePath: '教学讲稿.md',
     fileType: 'script',
     description: '教学讲稿'
   })
   ```

3. **Frontend receives output_update event:**
   ```json
   {
     "field": "attachments",
     "value": [{ id, fileId, fileName, ... }],
     "preview": "📎 教学讲稿.md (15KB)"
   }
   ```

4. **SyncButton displays with special attachment styling:**
   - Shows "待添加附件「附件」"
   - Shows paperclip icon
   - Button says "添加附件"

5. **User clicks "添加附件":**
   - Calls `syncToForm('attachments', lessonPlan, setLessonPlan)`
   - Updates `lessonPlan.attachments` array
   - Marks field as synced

6. **AttachmentCard renders in lesson plan:**
   - Displays in new "附件" section
   - Shows file metadata and description
   - Provides download button
   - Provides delete button (on hover)

## Testing Checklist

### Component Rendering
- [x] AttachmentCard displays file name correctly
- [x] File icon matches file type
- [x] File size is formatted correctly (KB, MB)
- [x] Date is formatted in Chinese format
- [x] Color scheme matches file type
- [x] Description displays when provided
- [x] Description hidden when not provided

### Interactive Features
- [ ] Download button navigates to correct URL
- [ ] Delete button appears on hover
- [ ] Delete button removes attachment from list
- [ ] Hover effects work (shadow, button visibility)

### SyncButton Behavior
- [ ] Attachments field shows special icon
- [ ] Button text says "添加附件"
- [ ] Synced state shows "已添加附件"
- [ ] Re-sync button says "重新添加"

### Layout & Responsive
- [ ] Card layout works on mobile
- [ ] Long file names truncate properly
- [ ] Multiple attachments display with correct spacing
- [ ] Section only shows when attachments exist

### Edge Cases
- [ ] Empty attachments array doesn't render section
- [ ] Missing description doesn't break layout
- [ ] Very large file sizes format correctly
- [ ] Very long file names don't overflow
- [ ] Multiple attachments of same type display correctly

## Browser Compatibility

- **Modern Browsers:** Full support (Chrome, Firefox, Safari, Edge)
- **Tailwind CSS:** v3.x required
- **Icons:** Inline SVG (no external dependencies)
- **Emojis:** May vary by OS/browser

## Accessibility

- File type icons include `aria-label` attributes
- Download links are keyboard accessible
- Delete buttons have descriptive `title` attributes
- Color is not the only indicator (icons + text labels)
- Semantic HTML structure (h4 for file names)

## Performance Considerations

- Components use React.memo equivalent (functional components)
- No unnecessary re-renders
- Efficient list rendering with keys
- Minimal DOM nodes per card
- CSS transitions for smooth hover effects

## Future Enhancements

1. **Preview Support:**
   - PDF preview in modal
   - Image thumbnails
   - Markdown preview

2. **Batch Operations:**
   - Select multiple attachments
   - Download all as ZIP
   - Bulk delete

3. **Drag & Drop:**
   - Reorder attachments
   - Upload new files via drag & drop

4. **File Management:**
   - Replace existing attachments
   - Rename attachments
   - Add tags/categories

5. **Access Control:**
   - Share/permission settings
   - Public link generation
   - Expiration dates

## Build Verification

✅ Frontend builds successfully:
```bash
cd frontend
npm run build
# ✓ built in 856ms
```

## Dependencies

No new dependencies added. Uses existing:
- React (functional components)
- TypeScript (type safety)
- Tailwind CSS (styling)
- Inline SVG (icons)

## File Summary

**Created:**
- `src/components/AttachmentCard.tsx` (195 lines)

**Modified:**
- `src/components/SyncButton.tsx` (+30 lines)
- `src/components/LessonPlanContent.tsx` (+25 lines)

**Total Changes:** ~250 lines of code
