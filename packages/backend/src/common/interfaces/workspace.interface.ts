/**
 * Workspace File Access Interfaces
 */

/**
 * File tree node for directory structure representation
 */
export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  mimeType?: string;
  children?: FileTreeNode[];
}

/**
 * Workspace file info for download
 */
export interface WorkspaceFileInfo {
  filename: string;
  absolutePath: string;
  mimeType: string;
  size: number;
}

/**
 * Workspace tree response
 */
export interface WorkspaceTreeResponse {
  tree: FileTreeNode[];
}
