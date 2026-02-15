import { describe, it, expect } from 'vitest'
import {
  filterTree,
  sortTree,
  getFileIcon,
  formatFileSize,
  flattenTree,
  countTreeNodes,
  getTotalSize,
} from '@/lib/file-utils'
import type { FileTreeNode } from '@/types/workspace'

describe('file-utils', () => {
  const mockTree: FileTreeNode[] = [
    {
      id: '1',
      name: 'src',
      type: 'folder',
      path: 'src',
      children: [
        { id: '2', name: 'index.ts', type: 'file', path: 'src/index.ts', size: 1024 },
        { id: '3', name: 'App.tsx', type: 'file', path: 'src/App.tsx', size: 2048, mimeType: 'text/typescript' },
      ],
    },
    {
      id: '4',
      name: 'package.json',
      type: 'file',
      path: 'package.json',
      size: 512,
      mimeType: 'application/json',
    },
  ]

  describe('filterTree', () => {
    it('should return all nodes when query is empty', () => {
      const result = filterTree(mockTree, '')
      expect(result).toEqual(mockTree)
    })

    it('should filter by file name', () => {
      const result = filterTree(mockTree, 'index')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('src')
      expect(result[0].children).toHaveLength(1)
      expect(result[0].children?.[0].name).toBe('index.ts')
    })

    it('should filter by path', () => {
      const result = filterTree(mockTree, 'src/App')
      expect(result).toHaveLength(1)
      expect(result[0].children?.[0].name).toBe('App.tsx')
    })

    it('should be case-insensitive', () => {
      const result = filterTree(mockTree, 'PACKAGE')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('package.json')
    })

    it('should include parent folders when child matches', () => {
      const result = filterTree(mockTree, 'App.tsx')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('src')
      expect(result[0].children).toHaveLength(1)
    })
  })

  describe('sortTree', () => {
    it('should sort by name ascending (default)', () => {
      const result = sortTree(mockTree, 'name', 'asc')
      expect(result[0].name).toBe('src') // folders first
      expect(result[1].name).toBe('package.json')
    })

    it('should sort by name descending', () => {
      const unsorted: FileTreeNode[] = [
        { id: '1', name: 'zebra.txt', type: 'file', path: 'zebra.txt' },
        { id: '2', name: 'apple.txt', type: 'file', path: 'apple.txt' },
      ]
      const result = sortTree(unsorted, 'name', 'desc')
      expect(result[0].name).toBe('zebra.txt')
      expect(result[1].name).toBe('apple.txt')
    })

    it('should sort by size ascending', () => {
      const result = sortTree(mockTree, 'size', 'asc')
      const files = result.filter((n) => n.type === 'file')
      expect(files[0].size).toBe(512)
    })

    it('should always put folders before files', () => {
      const result = sortTree(mockTree, 'name', 'asc')
      expect(result[0].type).toBe('folder')
    })

    it('should recursively sort children', () => {
      const result = sortTree(mockTree, 'name', 'desc')
      const srcFolder = result.find((n) => n.name === 'src')
      expect(srcFolder?.children?.[0].name).toBe('index.ts')
      expect(srcFolder?.children?.[1].name).toBe('App.tsx')
    })
  })

  describe('getFileIcon', () => {
    it('should return folder icon for folders', () => {
      const node: FileTreeNode = { id: '1', name: 'src', type: 'folder', path: 'src' }
      expect(getFileIcon(node)).toBe('📁')
    })

    it('should return TypeScript icon for .ts files', () => {
      const node: FileTreeNode = { id: '1', name: 'index.ts', type: 'file', path: 'index.ts' }
      expect(getFileIcon(node)).toBe('📘')
    })

    it('should return JSON icon for .json files', () => {
      const node: FileTreeNode = { id: '1', name: 'package.json', type: 'file', path: 'package.json' }
      expect(getFileIcon(node)).toBe('📋')
    })

    it('should return Python icon for .py files', () => {
      const node: FileTreeNode = { id: '1', name: 'script.py', type: 'file', path: 'script.py' }
      expect(getFileIcon(node)).toBe('🐍')
    })

    it('should return default icon for unknown extensions', () => {
      const node: FileTreeNode = { id: '1', name: 'file.unknown', type: 'file', path: 'file.unknown' }
      expect(getFileIcon(node)).toBe('📄')
    })
  })

  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 B')
    })

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500.0 B')
    })

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB')
      expect(formatFileSize(2621440)).toBe('2.5 MB')
    })

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1.0 GB')
    })

    it('should handle undefined', () => {
      expect(formatFileSize(undefined)).toBe('0 B')
    })
  })

  describe('flattenTree', () => {
    it('should flatten tree to array', () => {
      const result = flattenTree(mockTree)
      expect(result).toHaveLength(4) // src folder + 2 children + package.json
      expect(result.map((n) => n.name)).toEqual(['src', 'index.ts', 'App.tsx', 'package.json'])
    })

    it('should preserve node structure', () => {
      const result = flattenTree(mockTree)
      const srcFolder = result[0]
      expect(srcFolder.children).toBeDefined()
      expect(srcFolder.children).toHaveLength(2)
    })
  })

  describe('countTreeNodes', () => {
    it('should count files and folders correctly', () => {
      const result = countTreeNodes(mockTree)
      expect(result.files).toBe(3) // index.ts, App.tsx, package.json
      expect(result.folders).toBe(1) // src
    })

    it('should handle empty tree', () => {
      const result = countTreeNodes([])
      expect(result.files).toBe(0)
      expect(result.folders).toBe(0)
    })

    it('should handle nested folders', () => {
      const tree: FileTreeNode[] = [
        {
          id: '1',
          name: 'root',
          type: 'folder',
          path: 'root',
          children: [
            {
              id: '2',
              name: 'sub',
              type: 'folder',
              path: 'root/sub',
              children: [
                { id: '3', name: 'file.txt', type: 'file', path: 'root/sub/file.txt' },
              ],
            },
          ],
        },
      ]
      const result = countTreeNodes(tree)
      expect(result.files).toBe(1)
      expect(result.folders).toBe(2)
    })
  })

  describe('getTotalSize', () => {
    it('should sum all file sizes', () => {
      const result = getTotalSize(mockTree)
      expect(result).toBe(3584) // 1024 + 2048 + 512
    })

    it('should handle files without size', () => {
      const tree: FileTreeNode[] = [
        { id: '1', name: 'file1.txt', type: 'file', path: 'file1.txt', size: 100 },
        { id: '2', name: 'file2.txt', type: 'file', path: 'file2.txt' }, // no size
      ]
      const result = getTotalSize(tree)
      expect(result).toBe(100)
    })

    it('should handle empty tree', () => {
      const result = getTotalSize([])
      expect(result).toBe(0)
    })

    it('should recursively sum nested files', () => {
      const result = getTotalSize(mockTree)
      expect(result).toBeGreaterThan(0)
    })
  })
})
