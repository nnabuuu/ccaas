import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useCustom } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  ArrowLeft, Upload, Archive, RotateCcw, GitCompare,
  FileText, FolderOpen, Plus, Trash2, Save,
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Skill, SkillVersion } from '@kedge-agentic/common'

interface SkillFileMeta {
  id: string
  relativePath: string
  contentHash: string
}

interface SkillFileDetail {
  id: string
  relativePath: string
  content: string
  contentHash: string
}

interface SkillDetail extends Skill {
  enabled: boolean
  files?: SkillFileMeta[]
}

interface DiffLine {
  type: 'added' | 'removed' | 'context'
  content: string
  oldLine?: number
  newLine?: number
}

interface DiffResult {
  lines: DiffLine[]
  v1: number
  v2: number
}

// Virtual file node for the tree
type FileNode = {
  name: string
  path: string // full relative path
  type: 'file'
} | {
  name: string
  path: string
  type: 'directory'
  children: FileNode[]
}

function buildFileTree(files: SkillFileMeta[]): FileNode[] {
  const root: FileNode[] = []

  for (const file of files) {
    const parts = file.relativePath.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1

      if (isLast) {
        current.push({ name: part, path: file.relativePath, type: 'file' })
      } else {
        let dir = current.find(
          (n): n is Extract<FileNode, { type: 'directory' }> =>
            n.type === 'directory' && n.name === part,
        )
        if (!dir) {
          dir = { name: part, path: parts.slice(0, i + 1).join('/'), type: 'directory', children: [] }
          current.push(dir)
        }
        current = dir.children
      }
    }
  }

  return root
}

function FileTreeNode({
  node,
  selectedPath,
  onSelect,
  onDelete,
  depth = 0,
}: {
  node: FileNode
  selectedPath: string | null
  onSelect: (path: string) => void
  onDelete: (path: string) => void
  depth?: number
}) {
  if (node.type === 'directory') {
    return (
      <div>
        <div
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span>{node.name}/</span>
        </div>
        {node.children.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onDelete={onDelete}
            depth={depth + 1}
          />
        ))}
      </div>
    )
  }

  const isSelected = selectedPath === node.path
  return (
    <div
      className={`group flex items-center gap-1.5 px-2 py-1 text-sm cursor-pointer hover:bg-accent rounded-sm ${
        isSelected ? 'bg-accent text-accent-foreground' : ''
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => onSelect(node.path)}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{node.name}</span>
      <button
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(node.path)
        }}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

export function SkillEditorPage() {
  const { idOrSlug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tenantIdParam = searchParams.get('tenantId')

  // Diff state
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [compareVersions, setCompareVersions] = useState<{ v1: number; v2: number } | null>(null)

  // File editor state
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [fileLoading, setFileLoading] = useState(false)
  const [fileDirty, setFileDirty] = useState(false)
  const [savingFile, setSavingFile] = useState(false)

  // Main content editor state
  const [editingContent, setEditingContent] = useState(false)
  const [contentDraft, setContentDraft] = useState('')
  const [savingContent, setSavingContent] = useState(false)

  // New file dialog
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFilePath, setNewFilePath] = useState('')

  const { data: skillData, isLoading, refetch } = useCustom<SkillDetail>({
    url: `/admin/skills/${idOrSlug}`,
    method: 'get',
    config: {
      query: tenantIdParam ? { tenantId: tenantIdParam } : undefined,
    },
  })

  const { data: versionsData } = useCustom({
    url: `/admin/skills/${idOrSlug}/versions`,
    method: 'get',
    config: {
      query: tenantIdParam ? { tenantId: tenantIdParam } : undefined,
    },
  })

  const skill = skillData?.data as SkillDetail | undefined
  const versions = ((versionsData?.data as { versions?: SkillVersion[] })?.versions ?? versionsData?.data ?? []) as SkillVersion[]
  const files = skill?.files ?? []
  const fileTree = buildFileTree(files)

  // Load file content when a file is selected
  const loadFileContent = useCallback(
    async (filePath: string, fileId: string) => {
      setFileLoading(true)
      try {
        const res = await apiClient.get(`/admin/skills/${idOrSlug}/files/${fileId}`)
        const data = res.data as SkillFileDetail
        setFileContent(data.content)
        setFileDirty(false)
      } catch {
        setFileContent('')
      } finally {
        setFileLoading(false)
      }
    },
    [idOrSlug],
  )

  useEffect(() => {
    if (!selectedFilePath || !skill) return
    const fileMeta = files.find((f) => f.relativePath === selectedFilePath)
    if (!fileMeta) return
    loadFileContent(selectedFilePath, fileMeta.id)
  }, [selectedFilePath, skill?.id, files, loadFileContent])

  const handlePublish = async () => {
    await apiClient.post(`/admin/skills/${idOrSlug}/publish`)
    refetch()
  }

  const handleArchive = async () => {
    await apiClient.post(`/admin/skills/${idOrSlug}/archive`)
    refetch()
  }

  const handleRollback = async (version: number) => {
    await apiClient.post(`/admin/skills/${idOrSlug}/rollback/${version}`)
    refetch()
  }

  const handleToggleEnabled = async (checked: boolean) => {
    await apiClient.put(`/admin/skills/${idOrSlug}/toggle`, { enabled: checked })
    refetch()
  }

  const handleCompare = useCallback(async (v1: number, v2: number) => {
    setDiffLoading(true)
    setCompareVersions({ v1, v2 })
    try {
      const res = await apiClient.get(`/admin/skills/${idOrSlug}/diff`, {
        params: { v1, v2 },
      })
      setDiffResult(res.data as DiffResult)
    } catch {
      setDiffResult(null)
    } finally {
      setDiffLoading(false)
    }
  }, [idOrSlug])

  const handleCloseDiff = () => {
    setDiffResult(null)
    setCompareVersions(null)
  }

  // Save SKILL.md content
  const handleSaveContent = async () => {
    if (!skill) return
    setSavingContent(true)
    try {
      await apiClient.put(`/admin/skills/${idOrSlug}`, { content: contentDraft })
      setEditingContent(false)
      toast.success('Skill content saved')
      refetch()
    } catch (err) {
      toast.error(`Failed to save content: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSavingContent(false)
    }
  }

  // Save a reference file
  const handleSaveFile = async () => {
    if (!skill || !selectedFilePath) return
    setSavingFile(true)
    try {
      await apiClient.put(`/admin/skills/${idOrSlug}/files`, {
        files: [{ relativePath: selectedFilePath, content: fileContent }],
      })
      setFileDirty(false)
      toast.success(`Saved ${selectedFilePath}`)
      refetch()
    } catch (err) {
      toast.error(`Failed to save file: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSavingFile(false)
    }
  }

  // Create new file
  const handleCreateFile = async () => {
    if (!skill || !newFilePath.trim()) return
    const cleanPath = newFilePath.trim().replace(/^\.\//, '')
    setSavingFile(true)
    try {
      await apiClient.put(`/admin/skills/${idOrSlug}/files`, {
        files: [{ relativePath: cleanPath, content: '' }],
      })
      setShowNewFile(false)
      setNewFilePath('')
      setSelectedFilePath(cleanPath)
      setFileContent('')
      setFileDirty(false)
      toast.success(`Created ${cleanPath}`)
      refetch()
    } catch (err) {
      toast.error(`Failed to create file: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSavingFile(false)
    }
  }

  // Delete file
  const handleDeleteFile = async (relativePath: string) => {
    if (!skill) return
    try {
      await apiClient.delete(
        `/admin/skills/${idOrSlug}/files/${encodeURIComponent(relativePath)}`,
      )
      if (selectedFilePath === relativePath) {
        setSelectedFilePath(null)
        setFileContent('')
      }
      toast.success(`Deleted ${relativePath}`)
      refetch()
    } catch (err) {
      toast.error(`Failed to delete file: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  }

  if (!skill) {
    return <div className="text-center text-muted-foreground py-12">Skill not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/skills')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{skill.name}</h1>
            <StatusBadge status={skill.status} />
            <Badge variant="outline">{skill.type}</Badge>
            <span className="font-mono text-sm text-muted-foreground">v{skill.version}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Updated {formatDistanceToNow(new Date(skill.updatedAt), { addSuffix: true })}
            {files.length > 0 && ` \u00B7 ${files.length} file${files.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Enabled</span>
            <Switch
              checked={skill.enabled ?? true}
              onCheckedChange={handleToggleEnabled}
            />
          </div>
          {skill.status === 'draft' && (
            <Button size="sm" onClick={handlePublish}>
              <Upload className="mr-2 h-4 w-4" />
              Publish
            </Button>
          )}
          {skill.status === 'published' && (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="prompt">
        <TabsList>
          <TabsTrigger value="prompt">Prompt & Files</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="versions">Versions ({versions.length})</TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* Prompt & Files Tab */}
        {/* ============================================================ */}
        <TabsContent value="prompt">
          <div className="grid grid-cols-[240px_1fr] gap-4 min-h-[500px]">
            {/* Left: File Tree */}
            <Card className="overflow-hidden">
              <CardHeader className="py-3 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Files</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowNewFile(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-1 pb-2">
                {/* SKILL.md (always first) */}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 text-sm cursor-pointer hover:bg-accent rounded-sm ${
                    selectedFilePath === null ? 'bg-accent text-accent-foreground font-medium' : ''
                  }`}
                  onClick={() => {
                    if (fileDirty && !window.confirm('You have unsaved changes. Discard?')) return
                    setSelectedFilePath(null)
                    setFileDirty(false)
                  }}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span>SKILL.md</span>
                </div>

                {/* Additional files */}
                {fileTree.map((node) => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    selectedPath={selectedFilePath}
                    onSelect={(p) => {
                      if (fileDirty && !window.confirm('You have unsaved changes. Discard?')) return
                      setSelectedFilePath(p)
                      setFileDirty(false)
                    }}
                    onDelete={handleDeleteFile}
                  />
                ))}

                {/* New file input */}
                {showNewFile && (
                  <div className="px-2 py-1 space-y-1">
                    <Input
                      placeholder="references/file.md"
                      value={newFilePath}
                      onChange={(e) => setNewFilePath(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFile()
                        if (e.key === 'Escape') {
                          setShowNewFile(false)
                          setNewFilePath('')
                        }
                      }}
                      className="h-7 text-xs"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" className="h-6 text-xs" onClick={handleCreateFile}>
                        Create
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={() => { setShowNewFile(false); setNewFilePath('') }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right: Editor */}
            <Card>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-mono">
                  {selectedFilePath ?? 'SKILL.md'}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {selectedFilePath === null ? (
                    // SKILL.md editing controls
                    editingContent ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setEditingContent(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7"
                          onClick={handleSaveContent}
                          disabled={savingContent}
                        >
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                          {savingContent ? 'Saving...' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => {
                          setContentDraft(skill.content)
                          setEditingContent(true)
                        }}
                      >
                        Edit
                      </Button>
                    )
                  ) : (
                    // Reference file save
                    fileDirty && (
                      <Button
                        size="sm"
                        className="h-7"
                        onClick={handleSaveFile}
                        disabled={savingFile}
                      >
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        {savingFile ? 'Saving...' : 'Save'}
                      </Button>
                    )
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {selectedFilePath === null ? (
                  // SKILL.md content
                  editingContent ? (
                    <textarea
                      className="w-full min-h-[450px] p-4 font-mono text-sm bg-muted/50 resize-y border-t focus:outline-none"
                      value={contentDraft}
                      onChange={(e) => setContentDraft(e.target.value)}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm p-4 max-h-[500px] overflow-auto border-t">
                      {skill.content}
                    </pre>
                  )
                ) : fileLoading ? (
                  <div className="flex items-center justify-center h-[450px] text-muted-foreground text-sm">
                    Loading...
                  </div>
                ) : (
                  // Reference file editor
                  <textarea
                    className="w-full min-h-[450px] p-4 font-mono text-sm bg-muted/50 resize-y border-t focus:outline-none"
                    value={fileContent}
                    onChange={(e) => {
                      setFileContent(e.target.value)
                      setFileDirty(true)
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* Configuration Tab */}
        {/* ============================================================ */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Triggers</CardTitle>
            </CardHeader>
            <CardContent>
              {skill.triggers && skill.triggers.length > 0 ? (
                <div className="space-y-2">
                  {skill.triggers.map((trigger, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{trigger.type}</Badge>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{trigger.value}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No triggers configured</p>
              )}
            </CardContent>
          </Card>

          {skill.toolWhitelist && skill.toolWhitelist.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Tool Whitelist</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {skill.toolWhitelist.map((tool) => (
                    <Badge key={tool} variant="secondary">{tool}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* Versions Tab */}
        {/* ============================================================ */}
        <TabsContent value="versions">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {versions.map((v, idx) => (
                  <div key={v.version} className="flex items-center justify-between border-b pb-4 last:border-0">
                    <div>
                      <span className="font-mono font-medium">v{v.version}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                      </span>
                      {v.version === skill.version && (
                        <Badge variant="secondary" className="ml-2">current</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {idx < versions.length - 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCompare(versions[idx + 1].version, v.version)}
                        >
                          <GitCompare className="mr-2 h-3 w-3" />
                          Compare
                        </Button>
                      )}
                      {v.version !== skill.version && (
                        <Button variant="outline" size="sm" onClick={() => handleRollback(v.version)}>
                          <RotateCcw className="mr-2 h-3 w-3" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {versions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No version history</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Diff Viewer */}
          {compareVersions && (
            <Card className="mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Diff: v{compareVersions.v1} &rarr; v{compareVersions.v2}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleCloseDiff}>
                  Close
                </Button>
              </CardHeader>
              <CardContent>
                {diffLoading ? (
                  <div className="text-sm text-muted-foreground text-center py-8">Loading diff...</div>
                ) : diffResult ? (
                  <div className="font-mono text-sm rounded-lg border overflow-auto max-h-[500px]">
                    {diffResult.lines.map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.type === 'added'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : line.type === 'removed'
                              ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                              : 'text-muted-foreground'
                        }
                      >
                        <div className="flex">
                          <span className="w-12 shrink-0 text-right pr-2 select-none border-r text-xs leading-6 text-muted-foreground">
                            {line.oldLine ?? ''}
                          </span>
                          <span className="w-12 shrink-0 text-right pr-2 select-none border-r text-xs leading-6 text-muted-foreground">
                            {line.newLine ?? ''}
                          </span>
                          <span className="w-6 shrink-0 text-center select-none text-xs leading-6">
                            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                          </span>
                          <span className="flex-1 px-2 whitespace-pre-wrap leading-6">{line.content}</span>
                        </div>
                      </div>
                    ))}
                    {diffResult.lines.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">No changes between these versions</div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-8">Failed to load diff</div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
