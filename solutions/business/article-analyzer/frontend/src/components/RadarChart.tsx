import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { DimensionScore } from '../api';
import { useTheme } from '../hooks/useTheme';

interface RadarChartProps {
  dimensions: DimensionScore[] | null;
}

export default function RadarChart({ dimensions }: RadarChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!dimensions || dimensions.length === 0) {
    return (
      <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">
        No dimension data yet
      </p>
    );
  }

  const maxScore = Math.max(...dimensions.map((d) => d.score), 5);
  const chartData = dimensions.map((d) => ({
    dimension: d.name,
    score: d.score,
    weight: d.weight,
    fullMark: maxScore,
  }));

  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const primaryColor = isDark ? '#3b82f6' : '#2563eb';

  return (
    <ResponsiveContainer width="100%" height={250}>
      <RechartsRadarChart data={chartData}>
        <PolarGrid stroke={gridColor} />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 11, fill: textColor }}
        />
        <PolarRadiusAxis domain={[0, maxScore]} tick={{ fontSize: 10, fill: textColor }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--color-text-primary)',
          }}
          formatter={(value: number, _name: string, props: { payload?: { dimension?: string; weight?: number } }) => {
            const dim = props.payload?.dimension ?? '';
            const weight = props.payload?.weight ?? 0;
            return [`${value.toFixed(1)} (weight: ${weight})`, dim];
          }}
        />
        <Legend
          verticalAlign="top"
          height={30}
          wrapperStyle={{ fontSize: '12px', color: textColor }}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke={primaryColor}
          fill={primaryColor}
          fillOpacity={0.25}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
