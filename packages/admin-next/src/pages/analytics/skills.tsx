import { useCustom } from '@refinedev/core'
import { type ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartCard } from '@/components/shared/chart-card'
import { DataTable } from '@/components/shared/data-table'
import { StatCard } from '@/components/shared/stat-card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { formatTokens } from '@/lib/format'
import { Zap, TrendingUp, CheckCircle, Coins } from 'lucide-react'

interface SkillUsage {
  skillId: string
  skillName: string
  slug: string
  executionCount: number
  successCount: number
  failureCount: number
  successRate: number
  avgTokens: number
  totalTokens: number
  totalCost: number
}

interface SkillAnalyticsSummary {
  totalExecutions: number
  overallSuccessRate: number
  totalTokens: number
  totalCost: number
  skills: SkillUsage[]
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

const columns: ColumnDef<SkillUsage>[] = [
  {
    accessorKey: 'skillName',
    header: 'Skill',
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.skillName}</span>
        <div className="text-xs text-muted-foreground font-mono">{row.original.slug}</div>
      </div>
    ),
  },
  {
    accessorKey: 'executionCount',
    header: 'Executions',
    cell: ({ row }) => (
      <span className="font-mono">{row.original.executionCount.toLocaleString()}</span>
    ),
  },
  {
    accessorKey: 'successRate',
    header: 'Success Rate',
    cell: ({ row }) => {
      const rate = row.original.successRate
      return (
        <Badge variant={rate >= 0.95 ? 'success' : rate >= 0.8 ? 'outline' : 'destructive'}>
          {(rate * 100).toFixed(1)}%
        </Badge>
      )
    },
  },
  {
    accessorKey: 'avgTokens',
    header: 'Avg Tokens',
    cell: ({ row }) => (
      <span className="font-mono text-sm">{formatTokens(row.original.avgTokens)}</span>
    ),
  },
  {
    accessorKey: 'totalTokens',
    header: 'Total Tokens',
    cell: ({ row }) => (
      <span className="font-mono text-sm">{formatTokens(row.original.totalTokens)}</span>
    ),
  },
  {
    accessorKey: 'totalCost',
    header: 'Cost',
    cell: ({ row }) => (
      <span className="font-mono text-sm">${(row.original.totalCost / 100).toFixed(2)}</span>
    ),
  },
]

export function SkillAnalyticsPage() {
  const { selectedTenantId } = useTenantContext()
  const query = selectedTenantId ? { tenantId: selectedTenantId } : undefined

  const { data, isLoading } = useCustom({
    url: '/admin/analytics/skills',
    method: 'get',
    config: { query },
  })

  const analytics = data?.data as SkillAnalyticsSummary | undefined
  const skills = analytics?.skills ?? []

  // Top 10 skills by usage for the bar chart
  const chartData = [...skills]
    .sort((a, b) => b.executionCount - a.executionCount)
    .slice(0, 10)
    .map((s) => ({
      name: s.skillName.length > 15 ? s.skillName.slice(0, 15) + '...' : s.skillName,
      executions: s.executionCount,
      successRate: +(s.successRate * 100).toFixed(1),
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Skill Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Usage metrics and performance across all skills</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Executions"
          value={(analytics?.totalExecutions ?? 0).toLocaleString()}
          icon={Zap}
        />
        <StatCard
          title="Success Rate"
          value={`${((analytics?.overallSuccessRate ?? 0) * 100).toFixed(1)}%`}
          icon={CheckCircle}
        />
        <StatCard
          title="Total Tokens"
          value={formatTokens(analytics?.totalTokens ?? 0)}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Cost"
          value={`$${((analytics?.totalCost ?? 0) / 100).toFixed(2)}`}
          icon={Coins}
        />
      </div>

      <ChartCard title="Top Skills by Usage" description="Execution count for the most active skills">
        <div className="h-[350px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={130} className="text-xs" />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'executions' ? value.toLocaleString() : `${value}%`
                  }
                />
                <Bar dataKey="executions" fill={COLORS[0]} radius={[0, 4, 4, 0]} name="Executions" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No skill usage data available
            </div>
          )}
        </div>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={skills} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}
