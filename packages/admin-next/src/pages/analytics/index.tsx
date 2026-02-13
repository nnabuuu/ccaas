import { useCustom } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartCard } from '@/components/shared/chart-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { formatTokens } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import {
  TokenAnalyticsResponseSchema,
  ApiKeysAnalyticsResponseSchema,
  type ApiKeyAnalytics,
  type TokenDataPoint,
} from '@/lib/api-schemas'
import { parseApiResponseSafe } from '@/lib/api-parser'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function AnalyticsPage() {
  const { selectedTenantId } = useTenantContext()
  const navigate = useNavigate()
  const query = selectedTenantId ? { tenantId: selectedTenantId } : undefined

  const { data: tokenData } = useCustom({
    url: '/admin/analytics/tokens',
    method: 'get',
    config: { query: { period: '7d', ...query } },
  })

  const { data: costData } = useCustom({
    url: '/admin/analytics/costs',
    method: 'get',
    config: { query },
  })

  const { data: apiKeyData } = useCustom({
    url: '/admin/analytics/api-keys',
    method: 'get',
    config: { query },
  })

  const { data: skillSummaryData } = useCustom({
    url: '/admin/analytics/skills',
    method: 'get',
    config: { query },
  })

  // Type-safe API response parsing with Zod schemas
  const tokenAnalytics = parseApiResponseSafe(
    TokenAnalyticsResponseSchema,
    tokenData?.data,
    'TokenAnalytics',
    { dataPoints: [] }
  )

  const tokenChart: TokenDataPoint[] = tokenAnalytics.dataPoints

  const costs = costData?.data as {
    byTenant?: Array<{ tenantName: string; totalCost: number }>
    byModel?: Array<{ model: string; totalCost: number }>
    totalEstimatedCost?: number
  } | undefined

  const rawApiKeys = parseApiResponseSafe(
    ApiKeysAnalyticsResponseSchema,
    apiKeyData?.data,
    'ApiKeysAnalytics',
    [] as ApiKeyAnalytics[]
  )

  // Transform backend data to match chart expectations
  const apiKeys = rawApiKeys.map(key => ({
    keyName: key.name || key.keyPrefix,
    requestCount: key.requestCount,
    totalTokens: 0, // Backend doesn't provide totalTokens, set to 0
  }))

  const skillSummary = skillSummaryData?.data as {
    totalExecutions?: number
    overallSuccessRate?: number
    skills?: Array<{ skillName: string; executionCount: number }>
  } | undefined

  const topSkills = (skillSummary?.skills ?? [])
    .sort((a, b) => b.executionCount - a.executionCount)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>

      <Tabs defaultValue="usage">
        <TabsList>
          <TabsTrigger value="usage">Token Usage</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <ChartCard title="Token Usage (7 Days)" description="Input and output tokens over time">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tokenChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tickFormatter={(v) => formatTokens(v)} />
                  <Tooltip formatter={(v: number) => formatTokens(v)} />
                  <Legend />
                  <Area type="monotone" dataKey="inputTokens" stackId="1" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.4} name="Input" />
                  <Area type="monotone" dataKey="outputTokens" stackId="1" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.4} name="Output" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Estimated Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">${((costs?.totalEstimatedCost ?? 0) / 100).toFixed(2)}</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Cost by Model">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costs?.byModel ?? []}
                      dataKey="totalCost"
                      nameKey="model"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {(costs?.byModel ?? []).map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `$${(v / 100).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Cost by Tenant">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costs?.byTenant ?? []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
                    <YAxis type="category" dataKey="tenantName" width={120} />
                    <Tooltip formatter={(v: number) => `$${(v / 100).toFixed(2)}`} />
                    <Bar dataKey="totalCost" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <ChartCard title="API Key Usage">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apiKeys}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="keyName" />
                  <YAxis yAxisId="left" tickFormatter={(v) => formatTokens(v)} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="totalTokens" fill={COLORS[0]} name="Total Tokens" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="requestCount" fill={COLORS[1]} name="Requests" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </TabsContent>

        <TabsContent value="skills" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Skill Executions</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">
                  {(skillSummary?.totalExecutions ?? 0).toLocaleString()}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overall Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">
                  {((skillSummary?.overallSuccessRate ?? 0) * 100).toFixed(1)}%
                </span>
              </CardContent>
            </Card>
          </div>

          <ChartCard
            title="Top Skills by Usage"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/analytics/skills')}>
                View Details
                <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            }
          >
            <div className="h-[300px]">
              {topSkills.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSkills}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="skillName" className="text-xs" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="executionCount" fill={COLORS[0]} name="Executions" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No skill usage data
                </div>
              )}
            </div>
          </ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
