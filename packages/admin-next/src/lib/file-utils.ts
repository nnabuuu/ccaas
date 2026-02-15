import type { FileTreeNode } from '@/types/workspace'

/**
 * Filter file tree recursively by search query
 *
 * @param tree - File tree to filter
 * @param query - Search query (case-insensitive)
 * @returns Filtered tree with matching nodes and their ancestors
 */
export function filterTree(tree: FileTreeNode[], query: string): FileTreeNode[] {
  if (!query.trim()) {
    return tree
  }

  const lowerQuery = query.toLowerCase()

  const filterNode = (node: FileTreeNode): FileTreeNode | null => {
    const nameMatches = node.name.toLowerCase().includes(lowerQuery)
    const pathMatches = node.path.toLowerCase().includes(lowerQuery)

    if (node.type === 'file') {
      return nameMatches || pathMatches ? node : null
    }

    // For folders, recursively filter children
    const filteredChildren = node.children
      ?.map(filterNode)
      .filter((child): child is FileTreeNode => child !== null)

    // Include folder if it matches or has matching children
    if (nameMatches || pathMatches || (filteredChildren && filteredChildren.length > 0)) {
      return {
        ...node,
        children: filteredChildren,
      }
    }

    return null
  }

  return tree.map(filterNode).filter((node): node is FileTreeNode => node !== null)
}

/**
 * Sort file tree nodes (folders first, then alphabetically)
 *
 * @param tree - File tree to sort
 * @param sortBy - Sort field ('name' | 'size' | 'type')
 * @param order - Sort order ('asc' | 'desc')
 * @returns Sorted tree
 */
export function sortTree(
  tree: FileTreeNode[],
  sortBy: 'name' | 'size' | 'type' = 'name',
  order: 'asc' | 'desc' = 'asc'
): FileTreeNode[] {
  const sorted = [...tree].sort((a, b) => {
    // Always put folders before files
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1
    }

    let comparison = 0

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        break
      case 'size':
        comparison = (a.size || 0) - (b.size || 0)
        break
      case 'type':
        comparison = (a.mimeType || '').localeCompare(b.mimeType || '')
        break
    }

    return order === 'asc' ? comparison : -comparison
  })

  // Recursively sort children
  return sorted.map((node) => ({
    ...node,
    children: node.children ? sortTree(node.children, sortBy, order) : undefined,
  }))
}

/**
 * Get file icon emoji based on file extension or type
 *
 * @param node - File tree node
 * @returns Emoji icon
 */
export function getFileIcon(node: FileTreeNode): string {
  if (node.type === 'folder') {
    return '📁'
  }

  const ext = node.name.split('.').pop()?.toLowerCase()

  const iconMap: Record<string, string> = {
    // Code
    ts: '📘',
    tsx: '📘',
    js: '📙',
    jsx: '📙',
    py: '🐍',
    java: '☕',
    go: '🔷',
    rs: '🦀',
    rb: '💎',
    php: '🐘',
    c: '⚙️',
    cpp: '⚙️',
    cs: '🎯',
    swift: '🦅',
    kt: '🟣',

    // Web
    html: '🌐',
    css: '🎨',
    scss: '🎨',
    sass: '🎨',
    less: '🎨',
    vue: '💚',
    svelte: '🧡',

    // Data
    json: '📋',
    xml: '📋',
    yaml: '📋',
    yml: '📋',
    toml: '📋',
    csv: '📊',
    sql: '🗄️',

    // Documents
    md: '📝',
    txt: '📄',
    pdf: '📕',
    doc: '📘',
    docx: '📘',
    xls: '📗',
    xlsx: '📗',
    ppt: '📙',
    pptx: '📙',

    // Images
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    gif: '🖼️',
    svg: '🎨',
    ico: '🖼️',
    webp: '🖼️',

    // Archives
    zip: '📦',
    tar: '📦',
    gz: '📦',
    rar: '📦',
    '7z': '📦',

    // Config
    env: '⚙️',
    config: '⚙️',
    conf: '⚙️',
    ini: '⚙️',
    lock: '🔒',

    // Others
    gitignore: '🚫',
    dockerfile: '🐳',
    sh: '💻',
    bat: '💻',
    exe: '⚙️',
    dll: '⚙️',
  }

  return iconMap[ext || ''] || '📄'
}

/**
 * Format file size to human-readable string
 *
 * @param bytes - File size in bytes
 * @returns Formatted size string (e.g., "1.5 KB", "2.3 MB")
 */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

/**
 * Flatten file tree to array of files (for search/filter operations)
 *
 * @param tree - File tree to flatten
 * @returns Flat array of all file nodes
 */
export function flattenTree(tree: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = []

  const traverse = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      result.push(node)
      if (node.children) {
        traverse(node.children)
      }
    }
  }

  traverse(tree)
  return result
}

/**
 * Count total files and folders in tree
 *
 * @param tree - File tree
 * @returns Object with file and folder counts
 */
export function countTreeNodes(tree: FileTreeNode[]): { files: number; folders: number } {
  let files = 0
  let folders = 0

  const count = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') {
        files++
      } else {
        folders++
      }
      if (node.children) {
        count(node.children)
      }
    }
  }

  count(tree)
  return { files, folders }
}

/**
 * Get total size of all files in tree
 *
 * @param tree - File tree
 * @returns Total size in bytes
 */
export function getTotalSize(tree: FileTreeNode[]): number {
  let total = 0

  const sum = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file' && node.size) {
        total += node.size
      }
      if (node.children) {
        sum(node.children)
      }
    }
  }

  sum(tree)
  return total
}
