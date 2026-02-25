import { ChevronRight, Folder, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFileSize, getFileIcon } from '@/lib/file-utils'
import type { FileTreeNode } from '@/types/workspace'

interface FileTreeNodeProps {
  node: FileTreeNode
  level: number
  isExpanded: boolean
  expandedFolders: Set<string>
  onToggle: () => void
  onFileClick: (node: FileTreeNode) => void
  onToggleFolder: (id: string) => void
}

/**
 * FileTreeNode - Renders a single file or folder with expand/collapse
 */
export function FileTreeNodeComponent({
  node,
  level,
  isExpanded,
  expandedFolders,
  onToggle,
  onFileClick,
  onToggleFolder,
}: FileTreeNodeProps) {
  const isFolder = node.type === 'folder'
  const icon = getFileIcon(node)

  return (
    <div className="file-tree-node">
      <button
        onClick={isFolder ? onToggle : () => onFileClick(node)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm',
          'hover:bg-accent transition-colors',
          'rounded-sm',
          isFolder ? 'cursor-pointer' : 'cursor-pointer hover:bg-primary/5'
        )}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        aria-label={
          isFolder
            ? `${isExpanded ? 'Collapse' : 'Expand'} folder ${node.name}`
            : `View file ${node.name}`
        }
      >
        {isFolder ? (
          <>
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform text-muted-foreground',
                isExpanded && 'rotate-90'
              )}
            />
            <Folder className="h-4 w-4 text-blue-600" />
          </>
        ) : (
          <>
            <div className="w-4" /> {/* Spacer for alignment */}
            <span className="text-base" role="img" aria-label="file icon">
              {icon}
            </span>
          </>
        )}

        <span className="flex-1 font-mono truncate">{node.name}</span>

        {!isFolder && node.size !== undefined && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatFileSize(node.size)}
          </span>
        )}
      </button>

      {isFolder && isExpanded && node.children && node.children.length > 0 && (
        <div className="folder-children">
          {node.children.map((child) => (
            <FileTreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              isExpanded={expandedFolders.has(child.id)}
              expandedFolders={expandedFolders}
              onToggle={() => onToggleFolder(child.id)}
              onFileClick={onFileClick}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}
