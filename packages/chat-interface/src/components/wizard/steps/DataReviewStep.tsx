/**
 * DataReviewStep — Tabular data display with emphasis toggles
 *
 * Fetches analysis data from dataEndpoint, displays as a table,
 * and allows toggling emphasis on specific rows.
 * Falls back to mock data when API unavailable.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { StepProps } from '../types';

interface DataRow {
  id: string;
  label: string;
  value: number | string;
  detail?: string;
}

const MOCK_DATA: DataRow[] = [
  { id: 'kp1', label: '有理数的加减法', value: 85, detail: '掌握较好' },
  { id: 'kp2', label: '有理数的乘除法', value: 72, detail: '部分同学有困难' },
  { id: 'kp3', label: '整式的概念', value: 90, detail: '掌握优秀' },
  { id: 'kp4', label: '合并同类项', value: 58, detail: '需要重点复习' },
  { id: 'kp5', label: '一元一次方程的解法', value: 45, detail: '普遍较弱，建议强化' },
  { id: 'kp6', label: '方程应用题', value: 62, detail: '审题能力需提升' },
];

export function DataReviewStep({ step, value, onChange, allAnswers, apiBaseUrl }: StepProps) {
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const fetchAttempted = useRef(false);

  // Value format: { ids: string[], labels: Record<string, string> }
  // Backward compat: also accept plain string[]
  const valueObj = value as { ids?: string[]; labels?: Record<string, string> } | string[] | undefined;
  const emphasized: string[] = Array.isArray(valueObj) ? valueObj : (valueObj?.ids || []);

  // Build ID→label map from current data
  const buildLabelMap = useCallback((ids: string[], items: DataRow[]): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const item of items) {
      if (ids.includes(item.id)) map[item.id] = item.label;
    }
    return map;
  }, []);

  // Auto-emphasize weak items (score < 60) so the step has a valid value for navigation
  const autoEmphasize = useCallback((items: DataRow[]) => {
    if (emphasized.length > 0) return; // user already has selections
    const weak = items.filter(r => typeof r.value === 'number' && r.value < 60).map(r => r.id);
    if (weak.length > 0) onChange({ ids: weak, labels: buildLabelMap(weak, items) });
  }, [emphasized.length, onChange, buildLabelMap]);

  const loadData = useCallback(async () => {
    if (!step.dataEndpoint) {
      setData(MOCK_DATA);
      setUsingMock(true);
      autoEmphasize(MOCK_DATA);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(allAnswers)) {
        if (val != null) params.set(key, typeof val === 'string' ? val : JSON.stringify(val));
      }
      const base = apiBaseUrl || '';
      const url = `${base}${step.dataEndpoint}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const items = Array.isArray(result) ? result : result.items || result.data || [];
      if (items.length === 0) throw new Error('Empty data');
      setData(items);
      setUsingMock(false);
      autoEmphasize(items);
    } catch (err) {
      // Fallback to mock data
      setData(MOCK_DATA);
      setUsingMock(true);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      autoEmphasize(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, [step.dataEndpoint, apiBaseUrl, allAnswers, autoEmphasize]);

  useEffect(() => {
    if (fetchAttempted.current) return;
    fetchAttempted.current = true;
    loadData();
  }, [loadData]);

  const toggleEmphasis = (rowId: string) => {
    const nextIds = emphasized.includes(rowId)
      ? emphasized.filter((id) => id !== rowId)
      : [...emphasized, rowId];
    onChange({ ids: nextIds, labels: buildLabelMap(nextIds, data) });
  };

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>加载学情数据中...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Error banner with retry */}
      {error && usingMock && (
        <div style={{
          fontSize: 11,
          color: 'var(--warning-t)',
          background: 'var(--warning-bg)',
          padding: '6px 10px',
          borderRadius: 'var(--r, 8px)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>使用示例数据（{error}）</span>
          <button
            onClick={() => { fetchAttempted.current = false; loadData(); }}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              border: '0.5px solid var(--warning-t)',
              background: 'transparent',
              color: 'var(--warning-t)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            重试
          </button>
        </div>
      )}

      <div style={{ maxHeight: 280, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <th style={thStyle}>知识点</th>
              <th style={{ ...thStyle, textAlign: 'center', width: 80 }}>掌握度</th>
              <th style={{ ...thStyle, textAlign: 'center', width: 60 }}>重点</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isEmphasized = emphasized.includes(row.id);
              return (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '0.5px solid var(--b1)',
                    background: isEmphasized ? 'var(--warning-bg)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <td style={tdStyle}>
                    <div>{row.label}</div>
                    {row.detail && (
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{row.detail}</div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <ProgressBar value={typeof row.value === 'number' ? row.value : 0} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      onClick={() => toggleEmphasis(row.id)}
                      style={{
                        background: isEmphasized ? 'var(--warning-t)' : 'var(--bg2)',
                        color: isEmphasized ? 'var(--bg1)' : 'var(--t3)',
                        border: 'none',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}
                    >
                      {isEmphasized ? '已标记' : '标记'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {emphasized.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8, padding: '0 4px' }}>
          已标记 {emphasized.length} 个重点知识点
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 80 ? 'var(--success-t)' : pct >= 50 ? 'var(--warning-t)' : 'var(--error-t)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
      <div style={{ width: 40, height: 4, background: 'var(--b1)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--t2)', minWidth: 28 }}>{pct}%</span>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--t3)',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  color: 'var(--t1)',
};
