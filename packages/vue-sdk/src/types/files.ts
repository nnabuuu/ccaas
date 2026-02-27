/**
 * File Management Types
 *
 * Types for file CRUD, versioning, and preview.
 * Mirrors react-sdk/src/types.ts file management section.
 */

import type { Ref } from 'vue'
import type { UseAgentConnectionReturn } from './connection'

export interface FileMetadata {
  id: string
  filename: string
  originalPath: string
  mimeType: string | null
  size: number
  status: 'new' | 'modified' | 'synced'
  uploadedBy: 'agent' | 'user'
  currentVersion: string
  lastVersionAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FileVersion {
  id: string
  fileId: string
  version: string
  contentHash: string
  size: number
  mimeType: string | null
  changelog: string | null
  uploadedBy: 'agent' | 'user'
  createdAt: Date
}

export interface FilePreviewData {
  content: string
  truncated: boolean
  encoding: 'utf8' | 'base64'
  mimeType: string
  size: number
}

export interface UseFilesOptions {
  connection: UseAgentConnectionReturn
  sessionId: string
  enabled?: boolean
}

export interface UseFilesReturn {
  files: Ref<FileMetadata[]>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  newFilesCount: Ref<number>
  hasNewFiles: Ref<boolean>
  uploadFile: (file: File, targetPath?: string) => Promise<FileMetadata>
  downloadFile: (fileId: string) => Promise<void>
  deleteFile: (fileId: string) => Promise<void>
  markAsSynced: (fileId: string) => Promise<void>
  markAllSeen: () => Promise<void>
  refetch: () => Promise<void>
}

export interface UseFileVersionsOptions {
  connection: UseAgentConnectionReturn
  fileId: string
  enabled?: boolean
}

export interface UseFileVersionsReturn {
  versions: Ref<FileVersion[]>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  createVersion: (changelog?: string) => Promise<FileVersion>
  rollbackToVersion: (version: string) => Promise<void>
  compareVersions: (from: string, to: string) => Promise<{
    from: FileVersion
    to: FileVersion
    sizeDiff: number
    hashChanged: boolean
  }>
  downloadVersion: (version: string) => Promise<void>
  refetch: () => Promise<void>
}

export interface UseFilePreviewOptions {
  serverUrl: string
  fileId: string
  maxBytes?: number
  enabled?: boolean
}

export interface UseFilePreviewReturn {
  preview: Ref<FilePreviewData | null>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  refetch: () => Promise<void>
}
