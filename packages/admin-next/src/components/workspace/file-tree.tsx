import { FolderOpen } from 'lucide-react'
import { FileTreeNodeComponent } from './file-tree-node'
import type { FileTreeNode } from '@/types/workspace'

interface FileTreeProps {
  nodes: FileTreeNode[]
  expandedFolders: Set<string>
  onToggleFolder: (id: string) => void
  onFileClick: (node: FileTreeNode) => void
  searchQuery: string
}

/**
 * FileTree - Recursive tree renderer for workspace files
 */
export function FileTree({
  nodes,
  expandedFolders,
  onToggleFolder,
  onFileClick,
  searchQuery,
}: FileTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FolderOpen className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-sm">
          {searchQuery ? 'No files match your search' : 'No files in workspace'}
        </p>
      </div>
    )
  }

  return (
    <div className="file-tree space-y-0.5">
      {nodes.map((node) => (
        <FileTreeNodeComponent
          key={node.id}
          node={node}
          level={0}
          isExpanded={expandedFolders.has(node.id)}
          expandedFolders={expandedFolders}
          onToggle={() => onToggleFolder(node.id)}
          onFileClick={onFileClick}
          onToggleFolder={onToggleFolder}
        />
      ))}
    </div>
  )
}
