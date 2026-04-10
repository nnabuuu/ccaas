import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import { useTheme } from '../hooks/useTheme';

interface ScoreChartProps {
  data: { iteration: number; score: number }[];
}

export default function ScoreChart({ data }: ScoreChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (data.length === 0) {
    return (
      <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">
        No score data yet
      </p>
    );
  }

  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const primaryColor = isDark ? '#3b82f6' : '#2563eb';
  const targetColor = isDark ? '#ef4444' : '#dc2626';

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={primaryColor} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="iteration"
          label={{ value: 'Iteration', position: 'insideBottom', offset: -5, fill: textColor }}
          tick={{ fontSize: 12, fill: textColor }}
          stroke={gridColor}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: textColor }}
          stroke={gridColor}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--color-text-primary)',
          }}
          formatter={(value: number) => [`${value.toFixed(1)}`, 'Score']}
        />
        <Legend
          verticalAlign="top"
          height={30}
          wrapperStyle={{ fontSize: '12px', color: textColor }}
        />
        <ReferenceLine
          y={85}
          stroke={targetColor}
          strokeDasharray="3 3"
          label={{
            value: 'Target (85)',
            position: 'insideTopRight',
            fill: targetColor,
            fontSize: 11,
          }}
        />
        <Area
          type="monotone"
          dataKey="score"
          name="Score"
          stroke={primaryColor}
          strokeWidth={2}
          fill="url(#scoreGradient)"
          dot={{ r: 4, fill: primaryColor }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
