/**
 * File DTOs for file browser functionality
 */

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileTreeNode[];

  // File-specific fields
  fileId?: string;
  mimeType?: string;
  size?: number;
  status?: 'new' | 'modified' | 'synced';
  uploadedBy?: 'agent' | 'user';
  createdAt?: Date;

  // Message linking (for 跳转)
  messageId?: string | null;
  messagePreview?: string;
  messageCreatedAt?: Date;

  // Version history
  currentVersion?: string;
  versionCount?: number;
  lastModifiedAt?: Date | null;
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

// ==========================================
// VERSION CONTROL DTOs
// ==========================================

export interface CreateFileVersionDto {
  version?: string;
  bumpType?: 'major' | 'minor' | 'patch';
  changelog?: string;
}

export interface FileVersionResponse {
  id: string;
  fileId: string;
  version: string;
  contentHash: string;
  size: number;
  mimeType: string | null;
  changelog: string | null;
  uploadedBy: 'agent' | 'user';
  createdAt: Date;
}

export interface RollbackFileDto {
  targetVersion: string;
}

export interface CompareVersionsResponse {
  from: FileVersionResponse;
  to: FileVersionResponse;
  sizeDiff: number;
  hashChanged: boolean;
}

export interface NewFilesCountResponse {
  count: number;
  files: {
    id: string;
    filename: string;
    createdAt: Date;
  }[];
}

// Database entity type (matches better-sqlite3 schema)
export interface AgentFile {
  id: string;
  message_id: string | null;
  session_id: string;
  tenant_id: string | null;
  original_path: string;
  stored_path: string;
  filename: string;
  mime_type: string | null;
  size: number;
  status: 'new' | 'modified' | 'synced';
  downloaded_at: string | null;
  uploaded_by: 'agent' | 'user';
  current_version: string;
  last_version_at: string | null;
  created_at: string;
  updated_at: string;
}
