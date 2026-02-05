# File Explorer 组件

File Explorer 是一个用于浏览和下载会话工作区文件的 React 组件。它以树形结构显示文件，支持搜索、排序、展开/折叠和下载功能。

## 功能特性

### 核心功能
- 📁 **树形视图**：以层级结构显示文件和文件夹
- 🔍 **实时搜索**：按文件名过滤（递归搜索）
- 🔄 **排序功能**：按名称、大小或类型排序
- ➕ **展开/折叠**：显示/隐藏文件夹内容
- ⬇️ **文件下载**：点击文件即可下载
- 🎨 **MIME 类型图标**：根据文件类型显示不同图标
- ⏳ **加载状态**：骨架屏和加载动画
- ❌ **错误处理**：清晰的错误提示和重试选项

### 设计系统
- **深色主题**：Slate 系列背景色（#0F172A - #334155）
- **强调色**：绿色 (#22C55E) 用于活动状态
- **字体**：JetBrains Mono（等宽，用于文件名）
- **过渡动画**：200-300ms 平滑过渡
- **SVG 图标**：Heroicons 风格的内联 SVG

### 无障碍支持
- ✅ 键盘导航（Tab、Enter）
- ✅ 焦点状态可见（绿色边框）
- ✅ ARIA 标签支持
- ✅ 屏幕阅读器兼容
- ✅ WCAG AA 对比度标准（4.5:1）
- ✅ 触摸目标最小 44x44px

## 组件架构

### 组件结构
```
src/components/FileExplorer/
├── FileExplorer.tsx              # 主容器（状态管理）
├── FileTree.tsx                  # 树形渲染器
├── FileTreeNode.tsx              # 单个节点组件（递归）
├── FileExplorerHeader.tsx        # 工具栏（搜索、排序）
└── FileIcon.tsx                  # MIME 类型图标
```

### Hooks
```
src/hooks/
├── useWorkspaceFiles.ts          # 从后端 API 获取文件树
└── useFileDownload.ts            # 处理文件下载
```

### 工具函数
```
src/utils/
└── fileUtils.ts                  # formatFileSize、filterTree、sortTree 等
```

## 使用方法

### 基本集成

```tsx
import { FileExplorer } from './components/FileExplorer/FileExplorer'

function App() {
  const [fileExplorerOpen, setFileExplorerOpen] = useState(false)

  return (
    <>
      <button onClick={() => setFileExplorerOpen(true)}>
        打开工作区文件
      </button>

      {fileExplorerOpen && (
        <div className="modal-overlay">
          <FileExplorer
            sessionId={session.sessionId}
            onFileSelect={(file) => {
              console.log('已选择文件:', file)
              setFileExplorerOpen(false)
            }}
          />
        </div>
      )}
    </>
  )
}
```

### Props 说明

```typescript
interface FileExplorerProps {
  sessionId: string                      // 必需：会话 ID
  className?: string                     // 可选：额外的 CSS 类
  onFileSelect?: (file: FileTreeNode) => void  // 可选：文件下载后的回调
}
```

## 后端 API 集成

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

## MIME 类型图标

| MIME 类型 | 图标 | 颜色 |
|----------|------|------|
| `image/*` | 照片图标 | slate-400 |
| `audio/*` | 音频图标 | slate-400 |
| `video/*` | 视频图标 | slate-400 |
| `*javascript*`, `*typescript*` | 代码图标 | slate-400 |
| `text/markdown`, `text/plain` | 文本图标 | slate-400 |
| `application/zip`, `application/x-tar` | 归档图标 | slate-400 |
| `application/pdf` | PDF 图标 | slate-400 |
| `application/json` | JSON 图标 | slate-400 |
| 文件夹 | 文件夹图标 | blue-400 |

## 工具函数

### formatFileSize
将字节转换为人类可读格式：

```typescript
formatFileSize(2048)      // "2.0 KB"
formatFileSize(1048576)   // "1.0 MB"
```

### filterTree
递归过滤文件树：

```typescript
const filtered = filterTree(tree, "test")
// 返回匹配 "test" 的节点及其父节点
```

### sortTree
递归排序文件树：

```typescript
const sorted = sortTree(tree, 'size', 'desc')
// 文件夹优先，然后按大小降序排列文件
```

## 性能优化

当前实现可高效处理最多 100 个文件：
- 搜索在 <100ms 内完成
- 60fps 流畅动画
- 树加载时间 <2 秒

### 未来增强（可选）
对于大型工作区（>100 文件）：
1. **虚拟化**：使用 `@tanstack/react-virtual`
2. **防抖搜索**：减少输入时的重渲染
3. **懒加载**：展开时加载文件夹内容

## 测试

所有测试通过：

```bash
npm test -- fileUtils.test.ts
✓ 17 个测试通过
```

### 测试覆盖
- formatFileSize: 4 个测试
- filterTree: 5 个测试
- sortTree: 5 个测试
- matchesSearch: 2 个测试
- flattenTree: 1 个测试

## 故障排除

### 文件无法加载
1. 检查会话 ID 是否有效
2. 验证后端 API 是否运行（`http://localhost:3001`）
3. 检查浏览器控制台的 fetch 错误
4. 如果需要认证，验证 API 密钥

### 下载失败
1. 检查文件路径是否正确
2. 验证后端可以访问工作区目录
3. 检查网络标签中的 Content-Disposition 头
4. 确保浏览器允许从 localhost 下载

## 相关文档

- [完整实现文档](../../implementation/file-explorer/)
- [后端 Session Workspace API](../../design/session-workspace-file-api.md)
- [前端集成指南](frontend.md)
