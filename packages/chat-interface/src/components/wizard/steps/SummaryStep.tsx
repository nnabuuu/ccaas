/**
 * SummaryStep — Read-only summary of all wizard step selections
 * Supports clicking on a step summary to jump back for editing.
 */
import type { StepProps, WizardStep } from '../types';

interface SummaryStepProps extends StepProps {
  allSteps: WizardStep[];
  onJumpTo?: (stepIndex: number) => void;
}

export function SummaryStep({ allSteps, allAnswers, onJumpTo }: SummaryStepProps) {
  const nonSummarySteps = allSteps.filter((s) => s.type !== 'summary');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>
        请确认以下选择，点击可返回修改
      </div>
      {nonSummarySteps.map((s) => {
        const answer = allAnswers[s.id];
        const stepIndex = allSteps.findIndex((st) => st.id === s.id);
        const canJump = onJumpTo && stepIndex >= 0;
        return (
          <div
            key={s.id}
            onClick={() => canJump && onJumpTo!(stepIndex)}
            style={{
              padding: '8px 10px',
              background: 'var(--bg2)',
              borderRadius: 'var(--r, 8px)',
              border: '0.5px solid var(--b1)',
              cursor: canJump ? 'pointer' : 'default',
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={checkBadge}>✓</span>
                <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 500 }}>{s.title}</div>
              </div>
              {canJump && (
                <span style={{ fontSize: 10, color: 'var(--t3)' }}>修改 ›</span>
              )}
            </div>
            <div style={{ paddingLeft: 26 }}>
              {s.type === 'form' && s.fields ? (
                <FormSummary fields={s.fields} values={answer as Record<string, string> | undefined} />
              ) : (
                <div style={{ fontSize: 12, color: 'var(--t1)' }}>
                  {formatAnswer(answer)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FormSummary({ fields, values }: { fields: { key: string; label: string }[]; values?: Record<string, string> }) {
  if (!values) return <div style={{ fontSize: 12, color: 'var(--t3)' }}>未填写</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
      {fields.map(f => {
        const v = values[f.key];
        return (
          <div key={f.key} style={{ fontSize: 11, color: 'var(--t2)' }}>
            <span style={{ color: 'var(--t3)' }}>{f.label}: </span>
            <span style={{ color: 'var(--t1)', fontWeight: 500 }}>{v || '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatAnswer(val: unknown): string {
  if (val == null) return '未填写';
  if (typeof val === 'string') return val || '未填写';
  if (Array.isArray(val)) return val.length > 0 ? `${val.length} 项已选` : '未选择';
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    // Handle { ids: string[], labels: Record<string, string> } from tree-select/data-review
    if (Array.isArray(obj.ids) && obj.labels && typeof obj.labels === 'object') {
      const ids = obj.ids as string[];
      const labels = obj.labels as Record<string, string>;
      if (ids.length === 0) return '未选择';
      const names = ids.map(id => labels[id] || id);
      return names.join('、');
    }
    const entries = Object.entries(obj).filter(([, v]) => v);
    return entries.length > 0
      ? entries.map(([, v]) => String(v)).join(', ')
      : '未填写';
  }
  return String(val);
}

const checkBadge: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: 'var(--success-t)',
  color: 'var(--bg1)',
  fontSize: 11,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
