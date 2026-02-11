/**
 * File icon utility - Returns appropriate icon based on MIME type
 * Uses Lucide icons for consistent, professional appearance
 */

import type { LucideIcon } from 'lucide-react'

// Icon type definitions (user should install lucide-react)
export type FileIconType = {
  icon: string // Icon name from lucide-react
  color: string // Tailwind color class
}

/**
 * Get file icon and color based on MIME type
 */
export function getFileIcon(mimeType: string | null): FileIconType {
  if (!mimeType) {
    return { icon: 'File', color: 'text-slate-500' }
  }

  // Images
  if (mimeType.startsWith('image/')) {
    return { icon: 'Image', color: 'text-purple-500' }
  }

  // Videos
  if (mimeType.startsWith('video/')) {
    return { icon: 'Video', color: 'text-red-500' }
  }

  // Audio
  if (mimeType.startsWith('audio/')) {
    return { icon: 'Music', color: 'text-pink-500' }
  }

  // Documents
  if (mimeType.includes('pdf')) {
    return { icon: 'FileText', color: 'text-red-600' }
  }

  if (mimeType.includes('word') || mimeType.includes('document')) {
    return { icon: 'FileText', color: 'text-blue-600' }
  }

  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return { icon: 'Sheet', color: 'text-green-600' }
  }

  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
    return { icon: 'Presentation', color: 'text-orange-600' }
  }

  // Code files
  if (
    mimeType === 'application/json' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/typescript' ||
    mimeType === 'text/javascript' ||
    mimeType === 'text/typescript'
  ) {
    return { icon: 'Code', color: 'text-yellow-500' }
  }

  if (mimeType === 'text/html' || mimeType === 'text/xml') {
    return { icon: 'Code', color: 'text-orange-500' }
  }

  if (mimeType === 'text/css') {
    return { icon: 'Palette', color: 'text-blue-500' }
  }

  // Archives
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z')
  ) {
    return { icon: 'Archive', color: 'text-amber-600' }
  }

  // Text files
  if (mimeType.startsWith('text/')) {
    return { icon: 'FileText', color: 'text-slate-600' }
  }

  // Default
  return { icon: 'File', color: 'text-slate-500' }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Format date for display (relative or absolute)
 */
export function formatFileDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  // Use absolute date for older files
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
