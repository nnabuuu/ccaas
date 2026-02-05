# File Explorer Component

File Explorer is a React component for browsing and downloading session workspace files. It displays files in a tree structure with search, sort, expand/collapse, and download capabilities.

## Features

### Core Functionality
- 📁 **Tree View**: Hierarchical display of files and folders
- 🔍 **Real-time Search**: Filter by filename (recursive)
- 🔄 **Sort**: Order by name, size, or type
- ➕ **Expand/Collapse**: Show/hide folder contents
- ⬇️ **File Download**: Click files to download
- 🎨 **MIME Type Icons**: Visual file type indicators
- ⏳ **Loading States**: Skeleton screens and spinners
- ❌ **Error Handling**: Clear error messages with retry options

### Design System
- **Dark Theme**: Slate color palette (#0F172A - #334155)
- **Accent Color**: Green (#22C55E) for active states
- **Typography**: JetBrains Mono (monospace for file names)
- **Transitions**: 200-300ms smooth animations
- **SVG Icons**: Heroicons-style inline SVGs

### Accessibility
- ✅ Keyboard navigation (Tab, Enter)
- ✅ Visible focus states (green ring)
- ✅ ARIA labels support
- ✅ Screen reader compatible
- ✅ WCAG AA contrast (4.5:1)
- ✅ Touch targets 44x44px minimum

## Component Architecture

### Component Structure
```
src/components/FileExplorer/
├── FileExplorer.tsx              # Main container (state management)
├── FileTree.tsx                  # Tree renderer
├── FileTreeNode.tsx              # Individual node (recursive)
├── FileExplorerHeader.tsx        # Toolbar (search, sort)
└── FileIcon.tsx                  # MIME type icons
```

### Hooks
```
src/hooks/
├── useWorkspaceFiles.ts          # Fetch file tree from backend
└── useFileDownload.ts            # Handle file downloads
```

### Utilities
```
src/utils/
└── fileUtils.ts                  # formatFileSize, filterTree, sortTree, etc.
```

## Usage

### Basic Integration

```tsx
import { FileExplorer } from './components/FileExplorer/FileExplorer'

function App() {
  const [fileExplorerOpen, setFileExplorerOpen] = useState(false)

  return (
    <>
      <button onClick={() => setFileExplorerOpen(true)}>
        Open Workspace Files
      </button>

      {fileExplorerOpen && (
        <div className="modal-overlay">
          <FileExplorer
            sessionId={session.sessionId}
            onFileSelect={(file) => {
              console.log('File selected:', file)
              setFileExplorerOpen(false)
            }}
          />
        </div>
      )}
    </>
  )
}
```

### Props

```typescript
interface FileExplorerProps {
  sessionId: string                      // Required: Session ID
  className?: string                     // Optional: Additional CSS classes
  onFileSelect?: (file: FileTreeNode) => void  // Optional: Callback after download
}
```

## Backend API Integration

### Fetch File Tree

**Endpoint:** `GET /api/v1/sessions/:sessionId/workspace`

**Response:**
```json
{
  "tree": [
    {
      "id": "node-scripts",
      "name": "scripts",
      "type": "folder",
      "path": "scripts",
      "children": [
        {
          "id": "node-scripts-test.txt",
          "name": "test.txt",
          "type": "file",
          "path": "scripts/test.txt",
          "size": 2048,
          "mimeType": "text/plain"
        }
      ]
    }
  ]
}
```

### Download File

**Endpoint:** `GET /api/v1/sessions/:sessionId/workspace/*`

**Example:** `GET /api/v1/sessions/abc123/workspace/scripts/test.txt`

**Headers:**
- `Content-Type`: Detected MIME type
- `Content-Disposition`: `attachment; filename="test.txt"`
- `Content-Length`: File size in bytes

## MIME Type Icons

| MIME Type | Icon | Color |
|-----------|------|-------|
| `image/*` | Photo | slate-400 |
| `audio/*` | Audio | slate-400 |
| `video/*` | Video | slate-400 |
| `*javascript*`, `*typescript*` | Code | slate-400 |
| `text/markdown`, `text/plain` | Text | slate-400 |
| `application/zip`, `application/x-tar` | Archive | slate-400 |
| `application/pdf` | PDF | slate-400 |
| `application/json` | JSON | slate-400 |
| Folder | Folder | blue-400 |

## Utility Functions

### formatFileSize
Convert bytes to human-readable format:

```typescript
formatFileSize(2048)      // "2.0 KB"
formatFileSize(1048576)   // "1.0 MB"
```

### filterTree
Recursively filter file tree:

```typescript
const filtered = filterTree(tree, "test")
// Returns nodes matching "test" and their parents
```

### sortTree
Recursively sort file tree:

```typescript
const sorted = sortTree(tree, 'size', 'desc')
// Folders first, then files sorted by size descending
```

## Performance

Current implementation handles up to 100 files efficiently:
- Search completes in <100ms
- 60fps smooth animations
- Tree loads in <2 seconds

### Future Enhancements (Optional)
For large workspaces (>100 files):
1. **Virtualization**: Use `@tanstack/react-virtual`
2. **Debounced Search**: Reduce re-renders during typing
3. **Lazy Loading**: Load folder contents on expand

## Testing

All tests passing:

```bash
npm test -- fileUtils.test.ts
✓ 17 tests passing
```

### Test Coverage
- formatFileSize: 4 tests
- filterTree: 5 tests
- sortTree: 5 tests
- matchesSearch: 2 tests
- flattenTree: 1 test

## Troubleshooting

### Files Not Loading
1. Check session ID is valid
2. Verify backend API is running (`http://localhost:3001`)
3. Check browser console for fetch errors
4. Verify API key if authentication is required

### Download Fails
1. Check file path is correct
2. Verify backend can access workspace directory
3. Check Content-Disposition header in network tab
4. Ensure browser allows downloads from localhost

## Related Documentation

- [Full Implementation Docs](../../implementation/file-explorer/)
- [Backend Session Workspace API](../../design/session-workspace-file-api.md)
- [Frontend Integration Guide](frontend.md)
