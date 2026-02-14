import { useCustom } from '@refinedev/core'
import { useMemo } from 'react'
import { Activity, MessageSquare, Coins, AlertTriangle, Key, Zap, Cable } from 'lucide-react'
import {
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, Legend, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { StatCard } from '@/components/shared/stat-card'
import { ChartCard } from '@/components/shared/chart-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { useSdkDistribution } from '@/components/shared/sdk-connections'
import { formatNumber, formatTokens } from '@/lib/format'
import { useTenantContext } from '@/hooks/use-tenant-context'
import {
  TokenAnalyticsResponseSchema,
  RecentSessionsResponseSchema,
  DashboardSummarySchema,
  ErrorRateTrendSchema,
  type TokenDataPoint,
  type RecentSession,
  type DashboardSummary,
  type ErrorRateTrend,
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

  const { data: errorRateData } = useCustom({
    url: '/admin/analytics/error-rate-trend',
    method: 'get',
    config: {
      query: {
        days: 7,
        ...(selectedTenantId ? { tenantId: selectedTenantId } : {}),
      },
    },
  })

  // Type-safe API response parsing with Zod schemas (memoized to prevent re-computation)
  const summary = useMemo(
    () => parseApiResponseSafe(
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
    ),
    [summaryData?.data]
  )

  const recentSessions = useMemo(
    () => parseApiResponseSafe(
      RecentSessionsResponseSchema,
      recentData?.data,
      'RecentSessions',
      [] as RecentSession[]
    ),
    [recentData?.data]
  )

  const tokenAnalytics = useMemo(
    () => parseApiResponseSafe(
      TokenAnalyticsResponseSchema,
      tokenData?.data,
      'TokenAnalytics',
      { dataPoints: [] }
    ),
    [tokenData?.data]
  )

  const errorRateTrend = useMemo(
    () => parseApiResponseSafe(
      ErrorRateTrendSchema,
      errorRateData?.data,
      'ErrorRateTrend',
      { dataPoints: [], summary: { avgErrorRate: 0, maxErrorRate: 0, trend: 'stable' as const } }
    ),
    [errorRateData?.data]
  )

  const tokenChart: TokenDataPoint[] = tokenAnalytics.dataPoints

  // Calculate session status distribution
  const sessionStatusDistribution = useMemo(() => {
    const statusCounts = recentSessions.reduce(
      (acc, session) => {
        acc[session.status] = (acc[session.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }))
  }, [recentSessions])

  // Calculate duration distribution
  const durationDistribution = useMemo(() => {
    const buckets = [
      { name: '0-5min', min: 0, max: 5, count: 0 },
      { name: '5-10min', min: 5, max: 10, count: 0 },
      { name: '10-30min', min: 10, max: 30, count: 0 },
      { name: '30-60min', min: 30, max: 60, count: 0 },
      { name: '>60min', min: 60, max: Infinity, count: 0 },
    ]

    recentSessions.forEach((session) => {
      const durationMs = new Date(session.lastActivity).getTime() - new Date(session.createdAt).getTime()
      const durationMin = durationMs / (1000 * 60)

      const bucket = buckets.find((b) => durationMin >= b.min && durationMin < b.max)
      if (bucket) bucket.count++
    })

    return buckets.map(({ name, count }) => ({ name, count }))
  }, [recentSessions])

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

        <ChartCard
          title="Error Rate Trend (7 days)"
          description={`Avg: ${(errorRateTrend.summary.avgErrorRate * 100).toFixed(2)}% | Trend: ${errorRateTrend.summary.trend}`}
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorRateTrend.dataPoints}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                  className="text-xs"
                  domain={[0, 'auto']}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'Error Rate') return `${(value * 100).toFixed(2)}%`
                    return value
                  }}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-medium text-sm mb-2">
                            {new Date(data.timestamp).toLocaleDateString()}
                          </p>
                          <div className="space-y-1 text-xs">
                            <p>Error Count: {data.errorCount}</p>
                            <p>Total Messages: {data.totalMessages}</p>
                            <p className="font-semibold">
                              Error Rate: {(data.errorRate * 100).toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="errorRate"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Error Rate"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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

      {/* Session Status Distribution and Duration Histogram */}
      {(sessionStatusDistribution.length > 0 || durationDistribution.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {sessionStatusDistribution.length > 0 && (
            <ChartCard title="Session Status Distribution" description="Breakdown of sessions by status">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sessionStatusDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {sessionStatusDistribution.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {durationDistribution.length > 0 && (
            <ChartCard title="Session Duration Distribution" description="Sessions grouped by duration">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={durationDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => [`${value} sessions`, 'Count']}
                      labelFormatter={(label) => `Duration: ${label}`}
                    />
                    <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}
        </div>
      )}

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
