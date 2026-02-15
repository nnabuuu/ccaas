import { useState, useMemo, useCallback } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useWorkspaceFiles } from '@/hooks/use-workspace-files'
import { useFileDownload } from '@/hooks/use-file-download'
import { WorkspaceFileTreeHeader } from './workspace-file-tree-header'
import { FileTree } from './file-tree'
import { filterTree, sortTree, countTreeNodes, getTotalSize, formatFileSize } from '@/lib/file-utils'
import type { FileTreeNode } from '@/types/workspace'

interface WorkspaceExplorerProps {
  sessionId: string
  className?: string
}

/**
 * WorkspaceExplorer - Main container for session workspace file explorer
 *
 * Displays workspace files in a tree structure with search, sort, and download functionality
 */
export function WorkspaceExplorer({ sessionId, className = '' }: WorkspaceExplorerProps) {
  const { tree, loading, error, refetch } = useWorkspaceFiles({ sessionId, enabled: true })
  const { downloadFile, downloading, error: downloadError } = useFileDownload({ sessionId })

  // State
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name')
  const [sortOrder] = useState<'asc' | 'desc'>('asc')

  // Toggle folder expand/collapse
  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }, [])

  // Expand all folders
  const expandAll = useCallback(() => {
    const allFolderIds = new Set<string>()
    const collectFolderIds = (nodes: FileTreeNode[]) => {
      nodes.forEach((node) => {
        if (node.type === 'folder') {
          allFolderIds.add(node.id)
          if (node.children) {
            collectFolderIds(node.children)
          }
        }
      })
    }
    collectFolderIds(tree)
    setExpandedFolders(allFolderIds)
  }, [tree])

  // Collapse all folders
  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set())
  }, [])

  // Handle file click (download)
  const handleFileClick = useCallback(
    async (file: FileTreeNode) => {
      if (file.type === 'file') {
        try {
          await downloadFile(file.path, file.name)
        } catch (err) {
          console.error('Failed to download file:', err)
        }
      }
    },
    [downloadFile]
  )

  // Filter and sort tree
  const processedTree = useMemo(() => {
    let result = tree
    if (searchQuery) {
      result = filterTree(result, searchQuery)
    }
    result = sortTree(result, sortBy, sortOrder)
    return result
  }, [tree, searchQuery, sortBy, sortOrder])

  // Calculate stats
  const stats = useMemo(() => {
    const counts = countTreeNodes(tree)
    const totalSize = getTotalSize(tree)
    return { ...counts, totalSize }
  }, [tree])

  return (
    <div className={`workspace-explorer flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Workspace Files</h3>
          <div className="text-xs text-muted-foreground">
            {stats.files} files, {stats.folders} folders
            {stats.totalSize > 0 && ` • ${formatFileSize(stats.totalSize)}`}
          </div>
        </div>
        <WorkspaceFileTreeHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onRefresh={refetch}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Loading workspace files...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load workspace files</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">{error.message}</p>
              <Button variant="outline" size="sm" onClick={refetch}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Download Error Alert */}
        {downloadError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Download failed</AlertTitle>
            <AlertDescription>{downloadError.message}</AlertDescription>
          </Alert>
        )}

        {/* File Tree */}
        {!loading && !error && (
          <FileTree
            nodes={processedTree}
            expandedFolders={expandedFolders}
            onToggleFolder={toggleFolder}
            onFileClick={handleFileClick}
            searchQuery={searchQuery}
          />
        )}
      </div>

      {/* Footer - Download Status */}
      {downloading && (
        <div className="border-t p-3 bg-muted/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Downloading file...</span>
          </div>
        </div>
      )}
    </div>
  )
}
