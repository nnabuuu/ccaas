/**
 * File DTOs for file browser functionality
 */

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileTreeNode[];
  fileId?: string;
  mimeType?: string;
  size?: number;
  status?: 'new' | 'modified' | 'synced';
  uploadedBy?: 'agent' | 'user';
  createdAt?: Date;
}

export interface FilePreviewResponse {
  content: string;
  truncated: boolean;
  encoding: 'utf8' | 'base64';
  mimeType: string;
  size: number;
}

export interface UploadFileDto {
  sessionId: string;
  messageId: string;
  tenantId?: string;
  targetPath?: string; // Optional target path in virtual file system
}

export interface FileUploadResult {
  id: string;
  filename: string;
  originalPath: string;
  mimeType: string | null;
  size: number;
  status: 'new' | 'modified' | 'synced';
  uploadedBy: 'agent' | 'user';
  createdAt: Date;
}
