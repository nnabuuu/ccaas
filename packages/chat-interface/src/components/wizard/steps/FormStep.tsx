/**
 * FormStep — Multi-field form (dropdowns, text inputs, numbers)
 */
import { useEffect } from 'react';
import type { StepProps, FormFieldConfig } from '../types';

export function FormStep({ step, value, onChange, sessionContext }: StepProps) {
  const fields = step.fields || [];
  const formValue = (value as Record<string, string>) || {};

  // Auto-fill from sessionContext on mount
  useEffect(() => {
    const autoFilled: Record<string, string> = {};
    let hasAutoFill = false;
    for (const field of fields) {
      if (field.contextKey && sessionContext?.[field.contextKey] && !formValue[field.key]) {
        autoFilled[field.key] = String(sessionContext[field.contextKey]);
        hasAutoFill = true;
      } else if (field.defaultValue && !formValue[field.key]) {
        autoFilled[field.key] = field.defaultValue;
        hasAutoFill = true;
      }
    }
    if (hasAutoFill) {
      onChange({ ...formValue, ...autoFilled });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFieldChange = (key: string, val: string) => {
    onChange({ ...formValue, [key]: val });
  };

  // Count filled vs total for progress hint
  const filledCount = fields.filter(f => formValue[f.key]?.length > 0).length;
  const allFilled = filledCount === fields.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {fields.map((field) => (
        <FieldRow
          key={field.key}
          field={field}
          value={formValue[field.key] || ''}
          onChange={(val) => handleFieldChange(field.key, val)}
          showRequired={!formValue[field.key]}
        />
      ))}
      {!allFilled && fields.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
          已填 {filledCount} / {fields.length} 项
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  showRequired,
}: {
  field: FormFieldConfig;
  value: string;
  onChange: (val: string) => void;
  showRequired?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 3 }}>
        {field.label}
        {showRequired && <span style={{ color: 'var(--error-t)', fontSize: 11 }}>*</span>}
      </label>
      {field.type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={selectStyle}
        >
          <option value="">请选择...</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.type === 'number' ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          placeholder={`输入${field.label}...`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          placeholder={`输入${field.label}...`}
        />
      )}
    </div>
  );
}

const baseInput: React.CSSProperties = {
  padding: '8px 10px',
  border: '0.5px solid var(--b1)',
  borderRadius: 'var(--r, 8px)',
  fontSize: 13,
  color: 'var(--t1)',
  background: 'var(--bg1)',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  width: '100%',
};

const inputStyle: React.CSSProperties = { ...baseInput };
const selectStyle: React.CSSProperties = {
  ...baseInput,
  cursor: 'pointer',
  appearance: 'auto',
};
