import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCustom } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/status-badge'
import { SdkConnections } from '@/components/shared/sdk-connections'
import { TenantApiKeysTab } from '@/components/tenants/api-keys-tab'
import { EditQuotaModal } from '@/components/tenants/edit-quota-modal'
import { EditTenantModal } from '@/components/tenants/edit-tenant-modal'
import { EditConfigModal } from '@/components/tenants/edit-config-modal'
import { EditBundlesModal } from '@/components/tenants/edit-bundles-modal'
import { ArrowLeft, Pencil, Zap, Package } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'
import { formatTokens } from '@/lib/format'
import { toast } from 'sonner'

interface TenantDetail {
  id: string
  name: string
  slug: string
  description?: string
  status: string
  plan: string
  maxSessions: number
  maxSkills: number
  maxMcpServers: number
  billingEmail?: string
  sessionTtlMs?: number
  config?: {
    defaultModel?: string
    maxTokensPerRequest?: number
    enabledBundles?: string[]
    features?: Record<string, unknown> & {
      eventPersistence?: {
        enabled?: boolean
        excludeTypes?: string[]
      }
    }
    [key: string]: unknown
  }
  createdAt: string
  updatedAt: string
}

interface TenantSkill {
  id: string
  name: string
  slug: string
  type: string
  status: string
  enabled: boolean
}

interface TenantQuota {
  tokens: { used: number; limit: number }
  sessions: { used: number; limit: number }
  apiCalls: { used: number; limit: number }
  alertThreshold?: number
  period?: 'monthly' | 'daily'
}

function quotaPercent(used: number, limit: number): number {
  return limit > 0 ? Math.min((used / limit) * 100, 100) : 0
}

export function TenantDetailPage() {
  const { tenantId } = useParams()
  const navigate = useNavigate()
  const [skills, setSkills] = useState<TenantSkill[]>([])
  const [togglingSkillId, setTogglingSkillId] = useState<string | null>(null)
  const [showEditQuota, setShowEditQuota] = useState(false)
  const [showEditTenant, setShowEditTenant] = useState(false)
  const [showEditConfig, setShowEditConfig] = useState(false)
  const [showEditBundles, setShowEditBundles] = useState(false)

  const { data, isLoading, refetch: refetchTenant } = useCustom<TenantDetail>({
    url: `/admin/tenants/${tenantId}`,
    method: 'get',
    queryOptions: { enabled: !!tenantId },
  })

  const { data: skillsData, refetch: refetchSkills } = useCustom({
    url: `/admin/tenants/${tenantId}/skills`,
    method: 'get',
    queryOptions: { enabled: !!tenantId },
  })

  const { data: quotaData, refetch: refetchQuotas } = useCustom({
    url: `/admin/tenants/${tenantId}/quotas`,
    method: 'get',
    queryOptions: { enabled: !!tenantId },
  })

  const tenant = data?.data as TenantDetail | undefined
  const quotas = quotaData?.data as TenantQuota | undefined

  useEffect(() => {
    const raw = skillsData?.data
    const list = (Array.isArray(raw) ? raw : (raw as { skills?: TenantSkill[] })?.skills ?? []) as TenantSkill[]
    setSkills(list)
  }, [skillsData])

  const handleToggleSkill = async (skillId: string, enabled: boolean) => {
    if (!tenantId) return
    setTogglingSkillId(skillId)
    try {
      await apiClient.put(`/admin/tenants/${tenantId}/skills/${skillId}/toggle`, { enabled })
      refetchSkills()
    } catch {
      toast.error('Failed to toggle skill')
    } finally {
      setTogglingSkillId(null)
    }
  }

  if (!tenantId) {
    return <div className="text-center text-muted-foreground py-12">Invalid tenant ID</div>
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  }

  if (!tenant) {
    return <div className="text-center text-muted-foreground py-12">Tenant not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tenants')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <StatusBadge status={tenant.status} />
            <Badge variant="outline" className="capitalize">{tenant.plan}</Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{tenant.slug}</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="quotas">Quotas</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="sdk">SDK Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Tenant Info</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowEditTenant(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {tenant.description && (
                <div>
                  <span className="text-muted-foreground">Description</span>
                  <p className="mt-1">{tenant.description}</p>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Billing Email</span>
                <span>{tenant.billingEmail ?? 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDistanceToNow(new Date(tenant.createdAt), { addSuffix: true })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatDistanceToNow(new Date(tenant.updatedAt), { addSuffix: true })}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Max Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{tenant.maxSessions}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Max Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{tenant.maxSkills}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Max MCP Servers</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{tenant.maxMcpServers}</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Configuration</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowEditConfig(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Default Model</span>
                  <span className="font-mono">{tenant.config?.defaultModel ?? 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Tokens/Request</span>
                  <span className="font-mono">{tenant.config?.maxTokensPerRequest ?? 'Not set'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Features</CardTitle>
              </CardHeader>
              <CardContent>
                {tenant.config?.features ? (
                  <div className="space-y-2">
                    {Object.entries(tenant.config.features)
                      .filter(([key]) => key !== 'eventPersistence')
                      .map(([key, enabled]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{key}</span>
                          <Badge variant={enabled ? 'success' : 'secondary'}>
                            {enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                      ))}
                    {tenant.config.features.eventPersistence && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">eventPersistence</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={tenant.config.features.eventPersistence.enabled !== false ? 'success' : 'secondary'}>
                            {tenant.config.features.eventPersistence.enabled !== false ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {(tenant.config.features.eventPersistence.excludeTypes?.length ?? 0) > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Excluded: {tenant.config.features.eventPersistence.excludeTypes!.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No features configured</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Bundles
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowEditBundles(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              {tenant.config?.enabledBundles?.length ? (
                <div className="flex flex-wrap gap-2">
                  {tenant.config.enabledBundles.map((id) => (
                    <Badge key={id} variant="secondary">{id}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No bundles enabled</p>
              )}
            </CardContent>
          </Card>

          <EditTenantModal
            open={showEditTenant}
            onClose={() => setShowEditTenant(false)}
            onSuccess={() => refetchTenant()}
            tenant={tenant}
          />
          <EditConfigModal
            open={showEditConfig}
            onClose={() => setShowEditConfig(false)}
            onSuccess={() => refetchTenant()}
            tenantId={tenantId}
            currentConfig={tenant.config}
          />
          <EditBundlesModal
            open={showEditBundles}
            onClose={() => setShowEditBundles(false)}
            onSuccess={() => refetchTenant()}
            tenantId={tenantId}
          />
        </TabsContent>

        <TabsContent value="skills">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Skills
              </CardTitle>
              <Badge variant="outline">{skills.length} skills</Badge>
            </CardHeader>
            <CardContent>
              {skills.length > 0 ? (
                <div className="space-y-3">
                  {skills.map((skill) => (
                    <div key={skill.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/skills/${skill.slug}?tenantId=${tenantId}`}
                              className="font-medium text-sm text-primary hover:underline"
                            >
                              {skill.name}
                            </Link>
                            <StatusBadge status={skill.status} />
                            <Badge variant="outline" className="text-xs">{skill.type}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{skill.slug}</span>
                        </div>
                      </div>
                      <Switch
                        checked={skill.enabled}
                        disabled={togglingSkillId === skill.id}
                        onCheckedChange={(checked) => handleToggleSkill(skill.id, checked)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No skills assigned to this tenant</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Usage Quotas</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowEditQuota(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {quotas ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Tokens</span>
                      <span className="text-muted-foreground">
                        {formatTokens(quotas.tokens.used)} / {formatTokens(quotas.tokens.limit)}
                      </span>
                    </div>
                    <Progress value={quotaPercent(quotas.tokens.used, quotas.tokens.limit)} />
                    <p className="text-xs text-muted-foreground">
                      {quotaPercent(quotas.tokens.used, quotas.tokens.limit).toFixed(1)}% used
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Sessions</span>
                      <span className="text-muted-foreground">
                        {quotas.sessions.used.toLocaleString()} / {quotas.sessions.limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={quotaPercent(quotas.sessions.used, quotas.sessions.limit)} />
                    <p className="text-xs text-muted-foreground">
                      {quotaPercent(quotas.sessions.used, quotas.sessions.limit).toFixed(1)}% used
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">API Calls</span>
                      <span className="text-muted-foreground">
                        {quotas.apiCalls.used.toLocaleString()} / {quotas.apiCalls.limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={quotaPercent(quotas.apiCalls.used, quotas.apiCalls.limit)} />
                    <p className="text-xs text-muted-foreground">
                      {quotaPercent(quotas.apiCalls.used, quotas.apiCalls.limit).toFixed(1)}% used
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Quota data not available</p>
              )}
            </CardContent>
          </Card>
          <EditQuotaModal
            open={showEditQuota}
            onClose={() => setShowEditQuota(false)}
            onSuccess={() => refetchQuotas()}
            tenantId={tenantId}
            currentQuotas={quotas}
          />
        </TabsContent>

        <TabsContent value="api-keys">
          <TenantApiKeysTab tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="sdk">
          <SdkConnections tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
