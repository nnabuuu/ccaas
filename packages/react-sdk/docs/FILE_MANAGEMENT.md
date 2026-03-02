# React SDK: File Management Guide

Complete guide for using file management hooks and components in the CCAAS React SDK.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Hooks](#hooks)
  - [useFiles](#usefiles)
  - [useFileVersions](#usefileversions)
  - [useFilePreview](#usefilepreview)
- [Components](#components)
  - [FilePanel](#filepanel)
  - [FileList](#filelist)
  - [FileListItem](#filelistitem)
  - [FilePreview](#filepreview)
  - [FileVersionHistory](#fileversionhistory)
  - [FileVersionCompare](#fileversioncompare)
- [Customization](#customization)
- [Examples](#examples)

---

## Quick Start

### Installation

The file management system is included in `@kedge-agentic/react-sdk`:

```bash
npm install @kedge-agentic/react-sdk
```

### Basic Usage

```tsx
import { FilePanel, useAgentConnection } from '@kedge-agentic/react-sdk';

function MyApp() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    tenantId: 'my-tenant',
  });

  return (
    <FilePanel
      connection={connection}
      sessionId="session-123"
    />
  );
}
```

That's it! The FilePanel includes:
- ✅ File list with badge indicators
- ✅ File preview with syntax highlighting
- ✅ Version history and comparison
- ✅ Upload/download functionality
- ✅ Real-time updates via SSE

---

## Hooks

### useFiles

Manage file operations and state.

#### Signature

```typescript
function useFiles(options: UseFilesOptions): UseFilesReturn

interface UseFilesOptions {
  connection: UseAgentConnectionReturn;
  sessionId: string;
  enabled?: boolean; // Default: true
}

interface UseFilesReturn {
  // State
  files: FileMetadata[];
  isLoading: boolean;
  error: Error | null;
  newFilesCount: number;
  hasNewFiles: boolean;

  // Operations
  uploadFile: (file: File, targetPath?: string) => Promise<FileMetadata>;
  downloadFile: (fileId: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  markAsSynced: (fileId: string) => Promise<void>;
  markAllSeen: () => Promise<void>;
  refetch: () => Promise<void>;
}
```

#### Example: Basic Usage

```tsx
import { useFiles, useAgentConnection } from '@kedge-agentic/react-sdk';

function FileManager() {
  const connection = useAgentConnection({ serverUrl, tenantId });
  const files = useFiles({ connection, sessionId });

  if (files.isLoading) return <div>Loading files...</div>;
  if (files.error) return <div>Error: {files.error.message}</div>;

  return (
    <div>
      <h2>Files ({files.files.length})</h2>
      {files.hasNewFiles && (
        <span className="badge">{files.newFilesCount} new</span>
      )}

      <ul>
        {files.files.map(file => (
          <li key={file.id}>
            {file.filename}
            {file.status === 'new' && <span className="badge">NEW</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### Example: Upload File

```tsx
function FileUploader() {
  const files = useFiles({ connection, sessionId });
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadedFile = await files.uploadFile(file, 'docs/');
      console.log('Uploaded:', uploadedFile);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleUpload} disabled={uploading} />
      {uploading && <span>Uploading...</span>}
    </div>
  );
}
```

#### Example: Real-time Updates

```tsx
function FileWatcher() {
  const files = useFiles({ connection, sessionId });

  // Files automatically update via SSE
  useEffect(() => {
    if (files.hasNewFiles) {
      console.log(`${files.newFilesCount} new files detected!`);
      // Show notification
    }
  }, [files.newFilesCount]);

  return (
    <div>
      {files.files.map(file => (
        <div key={file.id}>
          {file.filename}
          {file.status === 'new' && (
            <button onClick={() => files.markAsSynced(file.id)}>
              Mark as seen
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

#### Example: Badge Management

```tsx
function FileBadge() {
  const files = useFiles({ connection, sessionId });

  return (
    <div className="relative">
      <button>Files</button>
      {files.hasNewFiles && (
        <span className="absolute top-0 right-0 badge">
          {files.newFilesCount}
        </span>
      )}

      {/* Clear all badges when user opens file panel */}
      <button onClick={files.markAllSeen}>
        Clear all badges
      </button>
    </div>
  );
}
```

---

### useFileVersions

Manage file version history.

#### Signature

```typescript
function useFileVersions(options: UseFileVersionsOptions): UseFileVersionsReturn

interface UseFileVersionsOptions {
  connection: UseAgentConnectionReturn;
  fileId: string;
  enabled?: boolean; // Default: false
}

interface UseFileVersionsReturn {
  // State
  versions: FileVersion[];
  isLoading: boolean;
  error: Error | null;

  // Operations
  createVersion: (changelog?: string) => Promise<FileVersion>;
  rollbackToVersion: (version: string) => Promise<void>;
  compareVersions: (from: string, to: string) => Promise<VersionComparison>;
  downloadVersion: (version: string) => Promise<void>;
  deleteVersion: (version: string) => Promise<void>;
  refetch: () => Promise<void>;
}
```

#### Example: Version Timeline

```tsx
function VersionTimeline({ fileId }: { fileId: string }) {
  const connection = useAgentConnection({ serverUrl, tenantId });
  const versions = useFileVersions({
    connection,
    fileId,
    enabled: true, // Enable fetching
  });

  if (versions.isLoading) return <div>Loading versions...</div>;

  return (
    <div>
      <h3>Version History</h3>
      {versions.versions.map((version, index) => (
        <div key={version.id} className="version-item">
          <div className="version-badge">
            {index === 0 && <span>LATEST</span>}
            v{version.version}
          </div>
          <div>
            <p>{version.changelog || 'No description'}</p>
            <span>{formatFileDate(version.createdAt)}</span>
          </div>
          <div className="actions">
            <button onClick={() => versions.downloadVersion(version.version)}>
              Download
            </button>
            {index > 0 && (
              <button onClick={() => versions.rollbackToVersion(version.version)}>
                Rollback
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### Example: Create Version Before Changes

```tsx
function VersionedEditor({ fileId }: { fileId: string }) {
  const versions = useFileVersions({ connection, fileId, enabled: true });
  const [content, setContent] = useState('');

  const handleSave = async () => {
    // Create version before saving changes
    await versions.createVersion('Manual save by user');

    // Save content...
    await saveContent(fileId, content);

    // Refresh version list
    await versions.refetch();
  };

  return (
    <div>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      <button onClick={handleSave}>Save</button>
      <span>{versions.versions.length} versions</span>
    </div>
  );
}
```

#### Example: Compare Versions

```tsx
function VersionComparator({ fileId }: { fileId: string }) {
  const versions = useFileVersions({ connection, fileId, enabled: true });
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState(null);

  const handleCompare = async () => {
    if (selected.length === 2) {
      const result = await versions.compareVersions(selected[0], selected[1]);
      setComparison(result);
    }
  };

  return (
    <div>
      <div className="version-selector">
        {versions.versions.map(v => (
          <label key={v.version}>
            <input
              type="checkbox"
              checked={selected.includes(v.version)}
              onChange={() => toggleSelection(v.version)}
            />
            v{v.version}
          </label>
        ))}
      </div>

      <button
        onClick={handleCompare}
        disabled={selected.length !== 2}
      >
        Compare
      </button>

      {comparison && (
        <div className="comparison-result">
          <p>Size diff: {formatSizeDiff(comparison.sizeDiff)}</p>
          <p>Content: {comparison.hashChanged ? 'Changed' : 'Identical'}</p>
        </div>
      )}
    </div>
  );
}
```

---

### useFilePreview

Load and cache file preview content.

#### Signature

```typescript
function useFilePreview(options: UseFilePreviewOptions): UseFilePreviewReturn

interface UseFilePreviewOptions {
  connection: UseAgentConnectionReturn;
  fileId: string;
  enabled?: boolean; // Default: false
  maxBytes?: number; // Default: 100KB
}

interface UseFilePreviewReturn {
  preview: FilePreviewData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface FilePreviewData {
  content: string;
  encoding: 'utf8' | 'base64';
  truncated: boolean;
  mimeType: string;
  size: number;
}
```

#### Example: Text File Preview

```tsx
import { useFilePreview } from '@kedge-agentic/react-sdk';

function TextPreview({ fileId }: { fileId: string }) {
  const preview = useFilePreview({
    connection,
    fileId,
    enabled: true,
  });

  if (preview.isLoading) return <div>Loading preview...</div>;
  if (preview.error) return <div>Preview unavailable</div>;
  if (!preview.preview) return null;

  const { content, encoding, truncated } = preview.preview;

  return (
    <div>
      <pre>{content}</pre>
      {truncated && (
        <p className="warning">
          File truncated. Download to see full content.
        </p>
      )}
    </div>
  );
}
```

#### Example: Image Preview

```tsx
function ImagePreview({ fileId }: { fileId: string }) {
  const preview = useFilePreview({ connection, fileId, enabled: true });

  if (!preview.preview || preview.preview.encoding !== 'base64') {
    return null;
  }

  const src = `data:${preview.preview.mimeType};base64,${preview.preview.content}`;

  return (
    <img
      src={src}
      alt="File preview"
      style={{ maxWidth: '100%' }}
    />
  );
}
```

#### Example: Syntax Highlighting

```tsx
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function CodePreview({ fileId, language }: { fileId: string; language: string }) {
  const preview = useFilePreview({ connection, fileId, enabled: true });

  if (!preview.preview) return null;

  return (
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      showLineNumbers
    >
      {preview.preview.content}
    </SyntaxHighlighter>
  );
}
```

---

## Components

### FilePanel

Main container component with file list and preview.

#### Props

```typescript
interface FilePanelProps {
  connection: UseAgentConnectionReturn;
  sessionId: string;
  className?: string;
  renderUploadButton?: (props: FileUploadButtonProps) => React.ReactNode;
}
```

#### Example: Basic Usage

```tsx
import { FilePanel } from '@kedge-agentic/react-sdk';

function App() {
  return (
    <FilePanel
      connection={connection}
      sessionId="session-123"
      className="h-full"
    />
  );
}
```

#### Example: Custom Upload Button

```tsx
function CustomUploadPanel() {
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
    // Custom pre-upload logic
    console.log('Uploading:', file.name);

    // Call standard upload
    await onUpload(file);

    // Custom post-upload logic
    toast.success('File uploaded!');
  };

  return <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />;
}
```

---

### FileList

Display list of files with badges.

#### Props

```typescript
interface FileListProps {
  files: FileMetadata[];
  selectedFile?: FileMetadata;
  onFileSelect: (file: FileMetadata) => void;
  onFileDownload: (file: FileMetadata) => void;
  onFileDelete: (file: FileMetadata) => void;
  onVersionsClick: (file: FileMetadata) => void;
  className?: string;
}
```

#### Example

```tsx
import { FileList } from '@kedge-agentic/react-sdk';

function MyFileList() {
  const files = useFiles({ connection, sessionId });
  const [selected, setSelected] = useState(null);

  return (
    <FileList
      files={files.files}
      selectedFile={selected}
      onFileSelect={setSelected}
      onFileDownload={(file) => files.downloadFile(file.id)}
      onFileDelete={(file) => files.deleteFile(file.id)}
      onVersionsClick={(file) => showVersionHistory(file)}
    />
  );
}
```

---

### FileListItem

Individual file item with icon and badge.

#### Props

```typescript
interface FileListItemProps {
  file: FileMetadata;
  isSelected?: boolean;
  onClick: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata) => void;
  onVersions: (file: FileMetadata) => void;
  className?: string;
}
```

#### Example: Custom Item Rendering

```tsx
import { FileListItem } from '@kedge-agentic/react-sdk';

function CustomFileItem({ file }: { file: FileMetadata }) {
  return (
    <FileListItem
      file={file}
      onClick={(f) => console.log('Clicked:', f.filename)}
      onDownload={(f) => downloadFile(f.id)}
      onDelete={(f) => deleteFile(f.id)}
      onVersions={(f) => showVersions(f.id)}
      className="my-custom-class"
    />
  );
}
```

---

### FilePreview

Preview component with syntax highlighting.

#### Props

```typescript
interface FilePreviewProps {
  file: FileMetadata;
  connection: UseAgentConnectionReturn;
  className?: string;
}
```

#### Example

```tsx
import { FilePreview } from '@kedge-agentic/react-sdk';

function PreviewPanel({ selectedFile }: { selectedFile: FileMetadata }) {
  if (!selectedFile) {
    return <div>Select a file to preview</div>;
  }

  return (
    <FilePreview
      file={selectedFile}
      connection={connection}
      className="h-full"
    />
  );
}
```

---

### FileVersionHistory

Version timeline with actions.

#### Props

```typescript
interface FileVersionHistoryProps {
  file: FileMetadata;
  connection: UseAgentConnectionReturn;
  onCompare?: (fromVersion: string, toVersion: string) => void;
  className?: string;
}
```

#### Example

```tsx
import { FileVersionHistory } from '@kedge-agentic/react-sdk';

function VersionPanel({ file }: { file: FileMetadata }) {
  const [comparing, setComparing] = useState(null);

  return (
    <div>
      <FileVersionHistory
        file={file}
        connection={connection}
        onCompare={(from, to) => setComparing({ from, to })}
      />

      {comparing && (
        <FileVersionCompare
          file={file}
          connection={connection}
          fromVersion={comparing.from}
          toVersion={comparing.to}
          onClose={() => setComparing(null)}
        />
      )}
    </div>
  );
}
```

---

### FileVersionCompare

Side-by-side version comparison.

#### Props

```typescript
interface FileVersionCompareProps {
  file: FileMetadata;
  connection: UseAgentConnectionReturn;
  fromVersion: string;
  toVersion: string;
  onClose?: () => void;
  className?: string;
}
```

#### Example

```tsx
import { FileVersionCompare } from '@kedge-agentic/react-sdk';

function ComparisonModal({ file, from, to }: Props) {
  return (
    <div className="modal">
      <FileVersionCompare
        file={file}
        connection={connection}
        fromVersion={from}
        toVersion={to}
        onClose={() => closeModal()}
      />
    </div>
  );
}
```

---

## Customization

### Custom Upload Workflow

Override upload behavior for solution-specific needs:

```tsx
import { FilePanel, useFiles } from '@kedge-agentic/react-sdk';

function LessonPlanFilePanel() {
  const files = useFiles({ connection, sessionId });
  const { currentLessonPlan } = useLessonPlanSession();

  const handleCustomUpload = async (file: File) => {
    // 1. Upload to CCAAS (standard)
    const uploadedFile = await files.uploadFile(file);

    // 2. Sync to lesson plan as attachment (custom)
    await fetch(`/api/lesson-plans/${currentLessonPlan.id}/attachments`, {
      method: 'POST',
      body: JSON.stringify({
        fileId: uploadedFile.id,
        filename: uploadedFile.filename,
        pageId: currentLessonPlan.currentPageId,
      }),
    });

    // 3. Show success notification
    toast.success('File uploaded and attached to lesson plan');
  };

  return (
    <FilePanel
      connection={connection}
      sessionId={sessionId}
      renderUploadButton={(props) => (
        <CustomUploadButton
          {...props}
          onUpload={handleCustomUpload}
        />
      )}
    />
  );
}
```

### Custom Badge Styles

```tsx
import { FileListItem } from '@kedge-agentic/react-sdk';

function StyledFileItem({ file }: { file: FileMetadata }) {
  return (
    <div className="relative">
      <FileListItem
        file={file}
        {...handlers}
      />

      {/* Custom badge overlay */}
      {file.status === 'new' && (
        <div className="absolute top-0 right-0 px-2 py-1 bg-red-500 text-white text-xs rounded-full animate-bounce">
          NEW!
        </div>
      )}
    </div>
  );
}
```

### Custom Preview Rendering

```tsx
function CustomPreview({ file }: { file: FileMetadata }) {
  const preview = useFilePreview({ connection, fileId: file.id, enabled: true });

  if (!preview.preview) return null;

  // Custom rendering based on file type
  if (file.mimeType?.startsWith('application/json')) {
    return <JsonViewer data={JSON.parse(preview.preview.content)} />;
  }

  if (file.mimeType === 'text/csv') {
    return <CsvTable data={preview.preview.content} />;
  }

  // Default text preview
  return <pre>{preview.preview.content}</pre>;
}
```

---

## Examples

### Example 1: Complete File Manager

```tsx
import {
  FilePanel,
  useFiles,
  useAgentConnection,
} from '@kedge-agentic/react-sdk';

function FileManager() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    tenantId: 'my-tenant',
  });

  const files = useFiles({
    connection,
    sessionId: 'session-123',
  });

  return (
    <div className="h-screen flex flex-col">
      {/* Header with badge */}
      <header className="p-4 border-b">
        <h1>Files</h1>
        {files.hasNewFiles && (
          <span className="ml-2 px-2 py-1 bg-red-500 text-white rounded">
            {files.newFilesCount} new
          </span>
        )}
      </header>

      {/* File panel */}
      <div className="flex-1">
        <FilePanel
          connection={connection}
          sessionId="session-123"
        />
      </div>
    </div>
  );
}
```

### Example 2: File Watcher with Notifications

```tsx
import { useFiles, useAgentConnection } from '@kedge-agentic/react-sdk';
import { toast } from 'react-hot-toast';

function FileWatcher() {
  const connection = useAgentConnection({ serverUrl, tenantId });
  const files = useFiles({ connection, sessionId });
  const prevCountRef = useRef(0);

  useEffect(() => {
    // Detect new files
    if (files.newFilesCount > prevCountRef.current) {
      const diff = files.newFilesCount - prevCountRef.current;
      toast(`${diff} new file${diff > 1 ? 's' : ''} created!`);
    }
    prevCountRef.current = files.newFilesCount;
  }, [files.newFilesCount]);

  return <FilePanel connection={connection} sessionId={sessionId} />;
}
```

### Example 3: Version Control Dashboard

```tsx
function VersionDashboard({ fileId }: { fileId: string }) {
  const connection = useAgentConnection({ serverUrl, tenantId });
  const versions = useFileVersions({ connection, fileId, enabled: true });
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

  const handleRollback = async (version: string) => {
    if (confirm(`Rollback to version ${version}?`)) {
      await versions.rollbackToVersion(version);
      toast.success('Rolled back successfully');
      await versions.refetch();
    }
  };

  return (
    <div>
      <h2>Version History ({versions.versions.length})</h2>

      {versions.versions.map((v, i) => (
        <div key={v.id} className="version-card">
          <div className="version-header">
            <span className="version-number">v{v.version}</span>
            {i === 0 && <span className="badge">LATEST</span>}
          </div>

          <p className="changelog">{v.changelog || 'No description'}</p>

          <div className="metadata">
            <span>{formatFileSize(v.size)}</span>
            <span>{formatFileDate(v.createdAt)}</span>
            <span>by {v.uploadedBy}</span>
          </div>

          <div className="actions">
            <button onClick={() => versions.downloadVersion(v.version)}>
              Download
            </button>
            {i > 0 && (
              <button onClick={() => handleRollback(v.version)}>
                Rollback
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## TypeScript Types

### FileMetadata

```typescript
interface FileMetadata {
  id: string;
  sessionId: string;
  tenantId: string;
  messageId: string;
  filename: string;
  originalPath: string;
  storedPath: string;
  mimeType: string | null;
  size: number;
  status: 'new' | 'modified' | 'synced';
  currentVersion: string;
  lastVersionAt: Date | null;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  downloadedAt: Date | null;
}
```

### FileVersion

```typescript
interface FileVersion {
  id: string;
  fileId: string;
  version: string;
  contentHash: string;
  storedPath: string;
  size: number;
  mimeType: string | null;
  changelog: string | null;
  uploadedBy: string;
  createdAt: Date;
}
```

### VersionComparison

```typescript
interface VersionComparison {
  from: {
    version: string;
    size: number;
    contentHash: string;
  };
  to: {
    version: string;
    size: number;
    contentHash: string;
  };
  sizeDiff: number;
  hashChanged: boolean;
}
```

---

## Best Practices

1. **Enable preview only when needed**: Set `enabled: false` by default, enable when user selects file
2. **Cache preview data**: The SDK caches preview for 5 minutes automatically
3. **Handle errors gracefully**: Always check `error` state and provide fallback UI
4. **Clear badges on view**: Call `markAsSynced` when user views/downloads file
5. **Version before major changes**: Create version before destructive operations
6. **Provide changelog**: Always include meaningful changelog when creating versions
7. **Lazy load versions**: Only fetch versions when user opens history panel
8. **Real-time updates**: Rely on SSE events, avoid polling
9. **Responsive design**: Use provided components for mobile-friendly UI
10. **Accessibility**: Use provided components for keyboard navigation and ARIA labels

---

## See Also

- [Backend API Documentation](../../backend/docs/FILE_MANAGEMENT_API.md)
- [Component Reference](./COMPONENTS.md)
- [Type Definitions](../src/types.ts)
