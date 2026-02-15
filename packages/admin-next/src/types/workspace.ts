/**
 * Workspace types for session file browser
 *
 * Matches backend interfaces from:
 * packages/backend/src/common/interfaces/workspace.interface.ts
 */

/**
 * File tree node for directory structure representation
 */
export interface FileTreeNode {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  size?: number
  mimeType?: string
  children?: FileTreeNode[]
}

/**
 * Workspace file info for download
 */
export interface WorkspaceFileInfo {
  filename: string
  absolutePath: string
  mimeType: string
  size: number
}

/**
 * Workspace tree response from GET /sessions/:id/workspace
 */
export interface WorkspaceTreeResponse {
  tree: FileTreeNode[]
}
