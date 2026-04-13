import React, { useState, useCallback } from 'react';

export type EditOperation =
  | { op: 'str_replace'; old_string: string; new_string: string }
  | { op: 'field_set'; field: string; value: any };

export interface ApplyActionProps {
  targetType: string;
  targetId: string;
  /** @deprecated Use operations instead */
  fieldPath?: string;
  /** @deprecated Use operations instead */
  suggestedValue?: unknown;
  operations?: EditOperation[];
  description: string;
  serverUrl: string;
  onApplied?: (result: { success: boolean; error?: string; document?: string }) => void;
}

export function ApplyActionBlock({
  targetType,
  targetId,
  fieldPath,
  suggestedValue,
  operations,
  description,
  serverUrl,
  onApplied,
}: ApplyActionProps) {
  const [status, setStatus] = useState<'pending' | 'loading' | 'applied' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);

  const handleApply = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      let data: { success: boolean; error?: string; document?: string };

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
          const text = await res.text();
          let msg: string;
          try { msg = JSON.parse(text).message ?? text; } catch { msg = text; }
          throw new Error(msg || `HTTP ${res.status}`);
        }
        return res.json();
      };

      if (operations) {
        // New edit API
        const res = await fetch(
          `${serverUrl}/context/entity/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}/edit`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operations, description }),
          },
        );
        data = await parseResponse(res);
      } else {
        // Legacy apply API (backward compat)
        const res = await fetch(`${serverUrl}/context/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_type: targetType,
            target_id: targetId,
            field_path: fieldPath,
            suggested_value: suggestedValue,
            action_description: description,
          }),
        });
        data = await parseResponse(res);
      }

      if (data.success) {
        setStatus('applied');
      } else {
        setStatus('error');
        setError(data.error ?? '操作失败');
      }

      onApplied?.(data);
    } catch (err: any) {
      setStatus('error');
      setError(err.message ?? '网络错误');
      onApplied?.({ success: false, error: err.message });
    }
  }, [targetType, targetId, fieldPath, suggestedValue, operations, description, serverUrl, onApplied]);

  return (
    <div
      data-testid="apply-action-block"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 6,
        border: '1px solid #e2e8f0',
        backgroundColor: status === 'applied' ? '#f0fdf4' : status === 'error' ? '#fef2f2' : '#ffffff',
      }}
    >
      <button
        data-testid="apply-action-button"
        onClick={handleApply}
        disabled={status === 'loading' || status === 'applied'}
        style={{
          cursor: status === 'loading' || status === 'applied' ? 'not-allowed' : 'pointer',
          padding: '4px 12px',
          borderRadius: 4,
          border: 'none',
          backgroundColor: status === 'applied' ? '#86efac' : '#3b82f6',
          color: status === 'applied' ? '#166534' : '#ffffff',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {status === 'loading' ? '应用中...' : status === 'applied' ? '已应用' : '应用'}
      </button>
      <span style={{ fontSize: 13, color: '#64748b' }}>{description}</span>
      {error && <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>}
    </div>
  );
}
