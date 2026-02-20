# File Upload Customization Guide

Guide for solution builders on customizing file upload behavior in CCAAS applications.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Override Patterns](#override-patterns)
- [Use Cases](#use-cases)
- [Examples](#examples)
- [Best Practices](#best-practices)

---

## Overview

The CCAAS File Management system provides a standard file upload workflow, but solution builders often need custom behavior:

- **Sync files to domain-specific storage** (e.g., lesson plan attachments)
- **Trigger workflows** (e.g., notify team members)
- **Add metadata** (e.g., tag files with project IDs)
- **Validate before upload** (e.g., check file permissions)
- **Transform files** (e.g., resize images, convert formats)

The SDK provides the `renderUploadButton` prop pattern to enable these customizations **without modifying SDK code**.

---

## Architecture

### Standard Upload Flow

```
User selects file
    ↓
FileUploadButton
    ↓
POST /api/v1/files/upload
    ↓
File stored in CCAAS
    ↓
Socket.io event: file.created
    ↓
UI updates with new file
```

### Custom Upload Flow

```
User selects file
    ↓
CustomUploadButton (your code)
    ↓
1. Pre-upload validation
    ↓
2. POST /api/v1/files/upload (standard)
    ↓
3. Custom post-processing
    ↓
4. Sync to domain storage (your API)
    ↓
5. Trigger workflows
    ↓
6. Show custom notifications
    ↓
UI updates
```

---

## Override Patterns

### Pattern 1: Render Prop Override

**Use when**: You need full control over upload UI and logic

```tsx
import { FilePanel } from '@kedge-agentic/react-sdk';

function MySolution() {
  return (
    <FilePanel
      connection={connection}
      sessionId={sessionId}
      renderUploadButton={(props) => (
        <CustomUploadButton {...props} />
      )}
    />
  );
}

function CustomUploadButton({ onUpload }: FileUploadButtonProps) {
  const handleUpload = async (file: File) => {
    // Your custom logic
    await onUpload(file);
  };

  return <input type="file" onChange={...} />;
}
```

**Pros**:
- Full control over UI
- Can intercept upload at any stage
- Access to all FilePanel context

**Cons**:
- Must handle UI/UX yourself
- Must implement drag-drop if needed

---

### Pattern 2: Hook Composition

**Use when**: You need custom logic but standard UI

```tsx
import { useFiles, FileUploadButton } from '@kedge-agentic/react-sdk';

function MySolution() {
  const files = useFiles({ connection, sessionId });

  const customUpload = async (file: File) => {
    // Pre-upload
    await validateFile(file);

    // Standard upload
    const uploaded = await files.uploadFile(file);

    // Post-upload
    await syncToDomainStorage(uploaded);

    return uploaded;
  };

  return (
    <FileUploadButton
      onUpload={customUpload}
    />
  );
}
```

**Pros**:
- Reuses standard UI components
- Minimal custom code
- Easy to maintain

**Cons**:
- Less control over UI
- Must work within SDK constraints

---

### Pattern 3: Wrapper Component

**Use when**: You need reusable custom behavior across multiple pages

```tsx
// components/DomainFileUpload.tsx
export function DomainFileUpload({ domainEntityId }: Props) {
  const files = useFiles({ connection, sessionId });

  const handleUpload = async (file: File) => {
    // Standard upload
    const uploaded = await files.uploadFile(file);

    // Domain-specific logic
    await attachToDomainEntity(domainEntityId, uploaded.id);

    return uploaded;
  };

  return <FileUploadButton onUpload={handleUpload} />;
}

// Usage in multiple pages
<DomainFileUpload domainEntityId={lessonPlan.id} />
<DomainFileUpload domainEntityId={project.id} />
```

**Pros**:
- Reusable across solution
- Encapsulates domain logic
- Easy to test

**Cons**:
- Extra component layer
- May need prop drilling

---

## Use Cases

### Use Case 1: Lesson Plan Attachments

**Requirement**: Files uploaded should automatically attach to current lesson plan page.

**Solution**:

```tsx
// solutions/lesson-plan-designer/components/LessonPlanFileUpload.tsx

import { useFiles } from '@kedge-agentic/react-sdk';
import { useLessonPlanSession } from '../hooks/useLessonPlanSession';

export function LessonPlanFileUpload() {
  const files = useFiles({ connection, sessionId });
  const { currentLessonPlan } = useLessonPlanSession();

  const handleUpload = async (file: File) => {
    // 1. Upload to CCAAS (standard storage)
    const uploadedFile = await files.uploadFile(file, 'attachments/');

    // 2. Attach to current lesson plan page (domain logic)
    await fetch(`/api/lesson-plans/${currentLessonPlan.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: uploadedFile.id,
        filename: uploadedFile.filename,
        pageId: currentLessonPlan.currentPageId,
        uploadedBy: 'teacher',
      }),
    });

    // 3. Update lesson plan state
    currentLessonPlan.addAttachment({
      fileId: uploadedFile.id,
      filename: uploadedFile.filename,
      pageId: currentLessonPlan.currentPageId,
    });

    // 4. Show success notification
    toast.success(`Attached ${file.name} to page ${currentLessonPlan.currentPageId}`);

    return uploadedFile;
  };

  return (
    <div>
      <h3>Lesson Plan Attachments</h3>
      <p>Upload files to attach to current page</p>
      <FileUploadButton onUpload={handleUpload} />
    </div>
  );
}
```

**Integration**:

```tsx
// FilePanel with custom upload
<FilePanel
  connection={connection}
  sessionId={sessionId}
  renderUploadButton={() => <LessonPlanFileUpload />}
/>
```

---

### Use Case 2: Project Document Versioning

**Requirement**: All file uploads should create initial version with project metadata.

**Solution**:

```tsx
// solutions/project-manager/components/ProjectFileUpload.tsx

export function ProjectFileUpload({ projectId }: Props) {
  const files = useFiles({ connection, sessionId });
  const versions = useFileVersions({ connection, fileId: '', enabled: false });

  const handleUpload = async (file: File) => {
    // 1. Upload file
    const uploaded = await files.uploadFile(file, `projects/${projectId}/`);

    // 2. Create initial version with project context
    await fetch(`/api/v1/files/${uploaded.id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: '1.0.0',
        changelog: `Initial upload to project ${projectId}`,
        metadata: {
          projectId,
          department: currentUser.department,
          uploadedBy: currentUser.email,
        },
      }),
    });

    // 3. Tag file in project database
    await db.projectFiles.create({
      projectId,
      fileId: uploaded.id,
      category: detectCategory(file),
      tags: extractTags(file.name),
    });

    return uploaded;
  };

  return <FileUploadButton onUpload={handleUpload} />;
}
```

---

### Use Case 3: Image Optimization

**Requirement**: Images should be resized and optimized before upload.

**Solution**:

```tsx
// solutions/portfolio/components/OptimizedImageUpload.tsx

export function OptimizedImageUpload() {
  const files = useFiles({ connection, sessionId });
  const [optimizing, setOptimizing] = useState(false);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      // Non-images: standard upload
      return files.uploadFile(file);
    }

    setOptimizing(true);
    try {
      // 1. Resize image
      const resized = await resizeImage(file, { maxWidth: 1920, maxHeight: 1080 });

      // 2. Compress
      const compressed = await compressImage(resized, { quality: 0.85 });

      // 3. Upload optimized version
      const uploaded = await files.uploadFile(compressed, 'images/');

      // 4. Store original if needed
      if (shouldKeepOriginal(file)) {
        await files.uploadFile(file, 'images/originals/');
      }

      toast.success(
        `Optimized ${file.name}: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`
      );

      return uploaded;
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <FileUploadButton
      onUpload={handleUpload}
      disabled={optimizing}
      accept="image/*"
    >
      {optimizing ? 'Optimizing...' : 'Upload Image'}
    </FileUploadButton>
  );
}
```

---

### Use Case 4: Team Notifications

**Requirement**: Notify team members when files are uploaded to shared projects.

**Solution**:

```tsx
// solutions/team-workspace/components/TeamFileUpload.tsx

export function TeamFileUpload({ workspaceId }: Props) {
  const files = useFiles({ connection, sessionId });
  const { workspace, members } = useWorkspace(workspaceId);

  const handleUpload = async (file: File) => {
    // 1. Standard upload
    const uploaded = await files.uploadFile(file, `workspaces/${workspaceId}/`);

    // 2. Notify team members
    await fetch(`/api/workspaces/${workspaceId}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'file_uploaded',
        title: 'New file uploaded',
        message: `${currentUser.name} uploaded ${file.name}`,
        fileId: uploaded.id,
        recipients: members.map(m => m.userId),
      }),
    });

    // 3. Post to activity feed
    await workspace.addActivity({
      type: 'file_upload',
      userId: currentUser.id,
      fileId: uploaded.id,
      filename: file.name,
      timestamp: new Date(),
    });

    // 4. Send webhook (if configured)
    if (workspace.webhookUrl) {
      await fetch(workspace.webhookUrl, {
        method: 'POST',
        body: JSON.stringify({
          event: 'file.uploaded',
          workspace: workspaceId,
          file: uploaded,
          user: currentUser,
        }),
      });
    }

    return uploaded;
  };

  return <FileUploadButton onUpload={handleUpload} />;
}
```

---

### Use Case 5: Pre-upload Validation

**Requirement**: Check file permissions and quotas before upload.

**Solution**:

```tsx
// solutions/enterprise/components/ValidatedFileUpload.tsx

export function ValidatedFileUpload() {
  const files = useFiles({ connection, sessionId });
  const { quota, permissions } = useUserContext();

  const handleUpload = async (file: File) => {
    // 1. Check file type permissions
    if (!permissions.allowedFileTypes.includes(file.type)) {
      toast.error(`File type ${file.type} not allowed`);
      throw new Error('File type not allowed');
    }

    // 2. Check size quota
    const remainingQuota = quota.limit - quota.used;
    if (file.size > remainingQuota) {
      toast.error(`Insufficient quota: ${formatFileSize(remainingQuota)} remaining`);
      throw new Error('Quota exceeded');
    }

    // 3. Virus scan (async)
    const scanResult = await scanFile(file);
    if (scanResult.infected) {
      toast.error('File contains malware and cannot be uploaded');
      throw new Error('Malware detected');
    }

    // 4. Check filename policy
    if (!isValidFilename(file.name)) {
      toast.error('Filename contains invalid characters');
      throw new Error('Invalid filename');
    }

    // 5. Standard upload (all checks passed)
    const uploaded = await files.uploadFile(file);

    // 6. Update quota
    await updateQuota(quota.used + file.size);

    return uploaded;
  };

  return (
    <div>
      <FileUploadButton onUpload={handleUpload} />
      <QuotaBar used={quota.used} limit={quota.limit} />
    </div>
  );
}
```

---

## Examples

### Example 1: Complete Custom Upload Flow

```tsx
// Custom upload with full workflow
import { FilePanel, useFiles } from '@kedge-agentic/react-sdk';
import { toast } from 'react-hot-toast';

function CustomFilePanel() {
  const files = useFiles({ connection, sessionId });

  const customUpload = async (file: File) => {
    // 1. Pre-upload validation
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10MB)');
      throw new Error('File too large');
    }

    // 2. Show progress toast
    const toastId = toast.loading(`Uploading ${file.name}...`);

    try {
      // 3. Standard upload to CCAAS
      const uploaded = await files.uploadFile(file, 'custom/');

      // 4. Custom post-processing
      await fetch('/api/my-solution/files', {
        method: 'POST',
        body: JSON.stringify({
          ccaasFileId: uploaded.id,
          filename: uploaded.filename,
          customMetadata: {
            department: 'engineering',
            project: 'alpha',
          },
        }),
      });

      // 5. Success notification
      toast.success(`${file.name} uploaded successfully`, { id: toastId });

      return uploaded;
    } catch (error) {
      // 6. Error handling
      toast.error(`Upload failed: ${error.message}`, { id: toastId });
      throw error;
    }
  };

  return (
    <FilePanel
      connection={connection}
      sessionId={sessionId}
      renderUploadButton={(props) => (
        <CustomButton {...props} onUpload={customUpload} />
      )}
    />
  );
}

function CustomButton({ onUpload }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={handleChange}
        disabled={uploading}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className={`btn ${uploading ? 'btn-disabled' : 'btn-primary'}`}
      >
        {uploading ? 'Uploading...' : 'Upload File'}
      </label>
    </div>
  );
}
```

---

### Example 2: Drag-and-Drop with Custom Logic

```tsx
// Custom drag-and-drop upload
function DragDropUpload() {
  const files = useFiles({ connection, sessionId });
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);

    for (const file of droppedFiles) {
      try {
        // Custom validation
        if (!isAllowedType(file.type)) {
          toast.error(`${file.name}: File type not allowed`);
          continue;
        }

        // Upload with custom logic
        const uploaded = await files.uploadFile(file);

        // Custom post-processing
        await processUploadedFile(uploaded);

        toast.success(`${file.name} uploaded`);
      } catch (error) {
        toast.error(`${file.name} failed: ${error.message}`);
      }
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
      `}
    >
      <p>Drag and drop files here</p>
      <p className="text-sm text-gray-500">or click to browse</p>
    </div>
  );
}
```

---

### Example 3: Batch Upload with Progress

```tsx
// Batch upload with progress tracking
function BatchUpload() {
  const files = useFiles({ connection, sessionId });
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const handleBatchUpload = async (selectedFiles: File[]) => {
    const results = await Promise.allSettled(
      selectedFiles.map(async (file) => {
        // Track progress
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

        // Custom upload with progress
        const uploaded = await uploadWithProgress(file, (progress) => {
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        });

        // Mark as complete
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

        return uploaded;
      })
    );

    // Show summary
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    toast.success(`Uploaded ${succeeded} files`);
    if (failed > 0) {
      toast.error(`${failed} files failed`);
    }
  };

  return (
    <div>
      <input
        type="file"
        multiple
        onChange={(e) => handleBatchUpload(Array.from(e.target.files))}
      />

      {/* Progress bars */}
      {Object.entries(uploadProgress).map(([filename, progress]) => (
        <div key={filename} className="progress-bar">
          <span>{filename}</span>
          <div className="progress" style={{ width: `${progress}%` }} />
        </div>
      ))}
    </div>
  );
}
```

---

## Best Practices

### 1. Preserve Standard Flow

Always call the standard upload method even when adding custom logic:

```tsx
// ✅ Good: Standard upload + custom logic
const handleUpload = async (file: File) => {
  const uploaded = await files.uploadFile(file);
  await customPostProcessing(uploaded);
  return uploaded;
};

// ❌ Bad: Completely bypass standard upload
const handleUpload = async (file: File) => {
  await customUploadAPI(file);
  // Lost: versioning, badge updates, real-time events
};
```

### 2. Error Handling

Handle errors at each stage:

```tsx
const handleUpload = async (file: File) => {
  try {
    // Validation errors
    await validateFile(file);
  } catch (error) {
    toast.error(`Validation failed: ${error.message}`);
    throw error;
  }

  try {
    // Upload errors
    const uploaded = await files.uploadFile(file);
  } catch (error) {
    toast.error(`Upload failed: ${error.message}`);
    throw error;
  }

  try {
    // Post-processing errors
    await customProcessing(uploaded);
  } catch (error) {
    // Upload succeeded but processing failed
    toast.warn('File uploaded but processing failed');
    // Don't throw - file is already uploaded
  }
};
```

### 3. User Feedback

Provide clear feedback at each stage:

```tsx
const handleUpload = async (file: File) => {
  const toastId = toast.loading('Preparing upload...');

  toast.loading('Uploading to server...', { id: toastId });
  const uploaded = await files.uploadFile(file);

  toast.loading('Processing file...', { id: toastId });
  await customProcessing(uploaded);

  toast.success('Upload complete!', { id: toastId });
};
```

### 4. Quota Management

Check quotas before upload to avoid wasted bandwidth:

```tsx
const handleUpload = async (file: File) => {
  // Check BEFORE uploading
  const quota = await checkQuota();
  if (file.size > quota.remaining) {
    toast.error('Quota exceeded');
    return;
  }

  const uploaded = await files.uploadFile(file);

  // Update quota AFTER upload
  await updateQuota(file.size);
};
```

### 5. Async Operations

Don't block UI on slow operations:

```tsx
const handleUpload = async (file: File) => {
  // Fast: Standard upload
  const uploaded = await files.uploadFile(file);
  toast.success('File uploaded');

  // Slow: Background processing
  processFileInBackground(uploaded.id).then(() => {
    toast.success('Processing complete');
  }).catch((error) => {
    toast.error('Processing failed');
  });
};
```

### 6. Transaction Safety

If custom logic fails, consider cleanup:

```tsx
const handleUpload = async (file: File) => {
  const uploaded = await files.uploadFile(file);

  try {
    await criticalCustomLogic(uploaded);
  } catch (error) {
    // Custom logic failed - cleanup
    await files.deleteFile(uploaded.id);
    toast.error('Upload cancelled due to processing error');
    throw error;
  }
};
```

### 7. Testing

Test custom upload logic thoroughly:

```typescript
describe('CustomUpload', () => {
  it('should upload and process file', async () => {
    const file = new File(['content'], 'test.pdf');

    // Mock standard upload
    mockFilesHook.uploadFile.mockResolvedValue(mockFile);

    // Mock custom API
    mockCustomAPI.process.mockResolvedValue({ success: true });

    await customUpload(file);

    expect(mockFilesHook.uploadFile).toHaveBeenCalledWith(file);
    expect(mockCustomAPI.process).toHaveBeenCalledWith(mockFile.id);
  });

  it('should handle upload errors', async () => {
    mockFilesHook.uploadFile.mockRejectedValue(new Error('Network error'));

    await expect(customUpload(file)).rejects.toThrow('Network error');
    expect(mockCustomAPI.process).not.toHaveBeenCalled();
  });
});
```

---

## Troubleshooting

### Issue: Files not appearing in UI after custom upload

**Cause**: Not returning the uploaded file from custom handler

**Solution**:

```tsx
// ❌ Bad: Don't return uploaded file
const handleUpload = async (file: File) => {
  const uploaded = await files.uploadFile(file);
  await customLogic(uploaded);
  // Missing return!
};

// ✅ Good: Return uploaded file
const handleUpload = async (file: File) => {
  const uploaded = await files.uploadFile(file);
  await customLogic(uploaded);
  return uploaded; // ← Important!
};
```

### Issue: Badge not clearing after custom upload

**Cause**: Not marking file as synced

**Solution**:

```tsx
const handleUpload = async (file: File) => {
  const uploaded = await files.uploadFile(file);

  // Mark as synced if user is viewing it immediately
  await files.markAsSynced(uploaded.id);

  return uploaded;
};
```

### Issue: Version not created after upload

**Cause**: Version creation is manual, not automatic

**Solution**:

```tsx
import { useFileVersions } from '@kedge-agentic/react-sdk';

const handleUpload = async (file: File) => {
  const uploaded = await files.uploadFile(file);

  // Create initial version manually
  await fetch(`/api/v1/files/${uploaded.id}/versions`, {
    method: 'POST',
    body: JSON.stringify({
      version: '1.0.0',
      changelog: 'Initial upload',
    }),
  });

  return uploaded;
};
```

---

## See Also

- [React SDK Documentation](../../packages/react-sdk/docs/FILE_MANAGEMENT.md)
- [Backend API Reference](../../packages/backend/docs/FILE_MANAGEMENT_API.md)
- [Component Reference](../../packages/react-sdk/docs/COMPONENTS.md)
