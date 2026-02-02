import { useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useCustom } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/status-badge'
import { ArrowLeft, Upload, Archive, RotateCcw, GitCompare } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'
import type { Skill, SkillVersion } from '@ccaas/common'

interface SkillDetail extends Skill {
  enabled: boolean
}

type SkillVersionWithMeta = SkillVersion & {
  publishedBy?: string
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

export function SkillEditorPage() {
  const { idOrSlug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tenantIdParam = searchParams.get('tenantId')
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [compareVersions, setCompareVersions] = useState<{ v1: number; v2: number } | null>(null)

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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  }

  if (!skill) {
    return <div className="text-center text-muted-foreground py-12">Skill not found</div>
  }

  return (
    <div className="space-y-6">
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
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="versions">Versions ({versions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt">
          <Card>
            <CardContent className="pt-6">
              <pre className="whitespace-pre-wrap text-sm bg-muted rounded-lg p-4 max-h-[600px] overflow-auto">
                {skill.content}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

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
                      <code className="text-xs bg-muted px-2 py-1 rounded">{trigger.pattern}</code>
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
