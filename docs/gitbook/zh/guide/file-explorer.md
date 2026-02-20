# File Explorer

## 使用时机

核心问题：**你的 solution 会生成用户需要查看或下载的文件吗？**

**需要展示文件面板的场景：**
- Agent 生成了用户需要下载的产出物（报告、代码文件、数据文件）
- Solution 涉及文件创建或转换，用户需要查看结果
- 工作流中用户需要从 agent 的文件输出中做选择

**不需要文件面板的场景：**
- Agent 输出全部通过 `write_output` 同步进表单字段
- Agent 只产生 chat 文本回复
- 文件是实现细节（中间文件），用户不需要感知

如果你的测验分析器生成教师需要下载的 PDF 报告，添加 `FilePanel`。如果你的教案设计器直接填充教师可编辑的表单字段，跳过即可。

## 使用 React SDK 的 FilePanel

展示工作区文件的推荐方式是 `@kedge-agentic/react-sdk` 中的 `FilePanel` 组件。它开箱即用地处理文件列表、选择、预览和上传。

### 基本用法

```tsx
import { FilePanel } from '@kedge-agentic/react-sdk'

function MySolution() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'my-solution'
  })

  return (
    <div className="flex h-screen">
      {/* 聊天区域 */}
      <ChatPanel ... />

      {/* 文件面板 */}
      <FilePanel
        connection={connection}
        sessionId={connection.sessionId}
        className="w-80 border-l"
      />
    </div>
  )
}
```

### Props 说明

```typescript
interface FilePanelProps {
  connection: UseAgentConnectionReturn  // 必需：来自 useAgentConnection
  sessionId: string                      // 必需：当前会话 ID
  className?: string                     // 可选：额外 CSS 类名
  renderUploadButton?: (props: {
    onUpload: (file: File) => Promise<void>
  }) => React.ReactNode                  // 可选：自定义上传按钮
}
```

`FilePanel` 内部使用 `useFiles` hook，自动处理加载状态、错误显示、新文件角标和文件预览。

### 自定义上传按钮

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
      上传文件
    </button>
  )}
/>
```

### 直接使用 Hook

如果你需要比 `FilePanel` 提供的更多控制权，直接使用 `useFiles`：

```tsx
import { useFiles } from '@kedge-agentic/react-sdk'

function MyFileList({ connection, sessionId }) {
  const files = useFiles({ connection, sessionId, enabled: true })

  if (files.isLoading) return <div>加载中...</div>
  if (files.error) return <div>错误：{files.error.message}</div>

  return (
    <ul>
      {files.files.map(file => (
        <li key={file.id}>
          <span>{file.name}</span>
          {file.status === 'new' && <span className="badge">新</span>}
        </li>
      ))}
    </ul>
  )
}
```

## 后端 API 参考

文件面板会自动从这些端点读取数据——你不需要直接调用它们。

### 获取文件树

**端点：** `GET /api/v1/sessions/:sessionId/workspace`

**响应：**
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

### 下载文件

**端点：** `GET /api/v1/sessions/:sessionId/workspace/*`

**示例：** `GET /api/v1/sessions/abc123/workspace/scripts/test.txt`

**响应头：**
- `Content-Type`: 检测到的 MIME 类型
- `Content-Disposition`: `attachment; filename="test.txt"`
- `Content-Length`: 文件大小（字节）

## 故障排除

### 文件无法加载

1. 确认 `sessionId` 有效且会话处于活跃状态
2. 确认后端正在运行（`http://localhost:3001`）
3. 检查浏览器 Network 标签中 `/workspace` 端点的 fetch 错误
4. 如果需要认证，验证 API 密钥

### 文件显示为"新"但一直保持高亮

在用户确认文件后调用 `files.markAsSynced(file.id)`。`FilePanel` 在文件被选中时会自动执行此操作。
