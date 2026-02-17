# File Explorer

## When to Use This

The core question: **does your solution produce files that users need to see or download?**

**Show a file panel when:**
- The agent generates artifacts users need to download (reports, code files, data files)
- The solution involves file creation or conversion and users need to view the result
- Users need to select from the agent's file outputs as part of the workflow

**Skip the file panel when:**
- Agent output is entirely synchronized into form fields via `write_output`
- The agent only produces chat text responses
- Files are implementation details (intermediate files) that users don't need to see

If your quiz analyzer generates a PDF report the teacher downloads, add `FilePanel`. If your lesson plan designer populates form fields the teacher edits directly, skip it.

## Using FilePanel from the React SDK

The recommended way to display workspace files is the `FilePanel` component from `@ccaas/react-sdk`. It handles file listing, selection, preview, and upload out of the box.

### Basic Usage

```tsx
import { FilePanel } from '@ccaas/react-sdk'

function MySolution() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'my-solution'
  })

  return (
    <div className="flex h-screen">
      {/* Chat area */}
      <ChatPanel ... />

      {/* File panel */}
      <FilePanel
        connection={connection}
        sessionId={connection.sessionId}
        className="w-80 border-l"
      />
    </div>
  )
}
```

### Props

```typescript
interface FilePanelProps {
  connection: UseAgentConnectionReturn  // Required: from useAgentConnection
  sessionId: string                      // Required: active session ID
  className?: string                     // Optional: additional CSS classes
  renderUploadButton?: (props: {
    onUpload: (file: File) => Promise<void>
  }) => React.ReactNode                  // Optional: custom upload button
}
```

`FilePanel` uses the `useFiles` hook internally. It handles loading states, error display, new-file badges, and file preview automatically.

### Custom Upload Button

```tsx
<FilePanel
  connection={connection}
  sessionId={connection.sessionId}
  renderUploadButton={({ onUpload }) => (
    <button
      className="btn-primary"
      onClick={() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) onUpload(file)
        }
        input.click()
      }}
    >
      Upload File
    </button>
  )}
/>
```

### Using the Hook Directly

If you need more control than `FilePanel` provides, use `useFiles` directly:

```tsx
import { useFiles } from '@ccaas/react-sdk'

function MyFileList({ connection, sessionId }) {
  const files = useFiles({ connection, sessionId, enabled: true })

  if (files.isLoading) return <div>Loading...</div>
  if (files.error) return <div>Error: {files.error.message}</div>

  return (
    <ul>
      {files.files.map(file => (
        <li key={file.id}>
          <span>{file.name}</span>
          {file.status === 'new' && <span className="badge">New</span>}
        </li>
      ))}
    </ul>
  )
}
```

## Backend API Reference

The file panel reads from these endpoints automatically — you don't need to call them directly.

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

**Response headers:**
- `Content-Type`: Detected MIME type
- `Content-Disposition`: `attachment; filename="test.txt"`
- `Content-Length`: File size in bytes

## Troubleshooting

### Files Not Loading

1. Verify the `sessionId` is valid and the session is active
2. Confirm the backend is running (`http://localhost:3001`)
3. Check the browser Network tab for fetch errors on the `/workspace` endpoint
4. Verify your API key if authentication is required

### File Shows as "New" but Stays Highlighted

Call `files.markAsSynced(file.id)` after the user acknowledges the file. `FilePanel` does this automatically when a file is selected.
