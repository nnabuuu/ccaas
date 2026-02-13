import { useCustom } from '@refinedev/core'
import { Activity, MessageSquare, Coins, AlertTriangle, Key, Zap, Cable } from 'lucide-react'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { StatCard } from '@/components/shared/stat-card'
import { ChartCard } from '@/components/shared/chart-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { useSdkDistribution } from '@/components/shared/sdk-connections'
import { formatNumber, formatTokens } from '@/lib/utils'
import { useTenantContext } from '@/hooks/use-tenant-context'
import {
  TokenAnalyticsResponseSchema,
  RecentSessionsResponseSchema,
  DashboardSummarySchema,
  type TokenDataPoint,
  type RecentSession,
  type DashboardSummary,
} from '@/lib/api-schemas'
import { parseApiResponseSafe } from '@/lib/api-parser'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function DashboardPage() {
  const { selectedTenantId } = useTenantContext()
  const { total: sdkTotal, distribution: sdkDistribution } = useSdkDistribution()

  const { data: summaryData, isLoading } = useCustom<DashboardSummary>({
    url: '/admin/dashboard/summary',
    method: 'get',
    config: {
      query: selectedTenantId ? { tenantId: selectedTenantId } : undefined,
    },
  })

  const { data: recentData } = useCustom({
    url: '/admin/dashboard/recent-sessions',
    method: 'get',
    config: {
      query: selectedTenantId ? { tenantId: selectedTenantId } : undefined,
    },
  })

  const { data: tokenData } = useCustom({
    url: '/admin/analytics/tokens',
    method: 'get',
    config: {
      query: {
        period: '24h',
        ...(selectedTenantId ? { tenantId: selectedTenantId } : {}),
      },
    },
  })

  // Type-safe API response parsing with Zod schemas
  const summary = parseApiResponseSafe(
    DashboardSummarySchema,
    summaryData?.data,
    'DashboardSummary',
    {
      activeSessions: 0,
      totalSessions: 0,
      totalMessages24h: 0,
      totalTokens24h: { input: 0, output: 0, total: 0 },
      errorRate24h: 0,
      activeApiKeys: 0,
      totalSkills: 0,
      publishedSkills: 0,
    }
  )

  const recentSessions = parseApiResponseSafe(
    RecentSessionsResponseSchema,
    recentData?.data,
    'RecentSessions',
    [] as RecentSession[]
  )

  const tokenAnalytics = parseApiResponseSafe(
    TokenAnalyticsResponseSchema,
    tokenData?.data,
    'TokenAnalytics',
    { dataPoints: [] }
  )

  const tokenChart: TokenDataPoint[] = tokenAnalytics.dataPoints

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Sessions"
          value={summary?.activeSessions ?? 0}
          description={`${summary?.totalSessions ?? 0} total`}
          icon={Activity}
        />
        <StatCard
          title="Messages (24h)"
          value={formatNumber(summary?.totalMessages24h ?? 0)}
          icon={MessageSquare}
        />
        <StatCard
          title="Tokens (24h)"
          value={formatTokens(summary?.totalTokens24h?.total ?? 0)}
          description={`${formatTokens(summary?.totalTokens24h?.input ?? 0)} in / ${formatTokens(summary?.totalTokens24h?.output ?? 0)} out`}
          icon={Coins}
        />
        <StatCard
          title="Error Rate (24h)"
          value={`${((summary?.errorRate24h ?? 0) * 100).toFixed(1)}%`}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="API Keys"
          value={summary?.activeApiKeys ?? 0}
          description="Active"
          icon={Key}
        />
        <StatCard
          title="Skills"
          value={`${summary?.publishedSkills ?? 0}/${summary?.totalSkills ?? 0}`}
          description="Published / Total"
          icon={Zap}
        />
        <StatCard
          title="SDK Connections"
          value={sdkTotal}
          description={sdkDistribution.map((d) => `${d.name}: ${d.value}`).join(', ') || 'None'}
          icon={Cable}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Token Usage (24h)" description="Input and output tokens over time">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tokenChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  className="text-xs"
                />
                <YAxis tickFormatter={(v) => formatTokens(v)} className="text-xs" />
                <Tooltip
                  formatter={(value: number) => formatTokens(value)}
                  labelFormatter={(label) => new Date(label).toLocaleString()}
                />
                <Area type="monotone" dataKey="inputTokens" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.4} name="Input" />
                <Area type="monotone" dataKey="outputTokens" stackId="1" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.4} name="Output" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Recent Sessions">
          <div className="space-y-3">
            {recentSessions.slice(0, 8).map((session) => (
              <div key={session.sessionId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge status={session.status} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {session.sessionId.slice(0, 8)}...
                  </span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>{session.messageCount} msgs</span>
                  <span>{new Date(session.lastActivity).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
            {recentSessions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent sessions</p>
            )}
          </div>
        </ChartCard>
      </div>

      {/* SDK Distribution */}
      {sdkDistribution.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="SDK Distribution" description="Connected clients by SDK type">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sdkDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {sdkDistribution.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  )
}
