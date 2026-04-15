import React, { useEffect, useCallback, useRef } from 'react';
import { useMentionContext } from './MentionContext.js';
import { AtPicker } from '@kedge-agentic/context-layer-react';
import type { EntityRef, ContextEntityRef } from '@kedge-agentic/context-layer-react';
import { ContextLayerClient } from '@kedge-agentic/context-layer/client';

interface MentionPickerProps {
  baseUrl: string;
  sessionId?: string;
  sessionTemplate?: string;
  contextEntity?: ContextEntityRef;
  autoRef?: boolean;
}

/**
 * MentionPicker integrates the @ picker with chat-interface.
 * It renders the AtPicker overlay when pickerOpen is true, and reference pills.
 *
 * Usage: wrap your chat input area with <MentionProvider> and render <MentionPicker>.
 */
export function MentionPicker({ baseUrl, sessionId, sessionTemplate, contextEntity, autoRef }: MentionPickerProps) {
  const { refs, addRef, removeRef, pickerOpen, closePicker, initialDrillType } = useMentionContext();
  const autoRefAppliedRef = useRef<string | null>(null);
  const clientRef = useRef<ContextLayerClient | null>(null);
  const clientBaseUrlRef = useRef<string>('');
  if (!clientRef.current || clientBaseUrlRef.current !== baseUrl) {
    clientRef.current = new ContextLayerClient(baseUrl);
    clientBaseUrlRef.current = baseUrl;
  }

  // Auto-add contextEntity as a reference when autoRef is enabled
  useEffect(() => {
    if (!autoRef || !contextEntity) return;
    const key = `${contextEntity.entityType}:${contextEntity.entityId}`;
    if (autoRefAppliedRef.current === key) return;
    autoRefAppliedRef.current = key; // set synchronously to prevent duplicate async calls
    const client = clientRef.current!;
    client.resolve(contextEntity.entityType, contextEntity.entityId).then(resolved => {
      addRef({
        entityType: contextEntity.entityType,
        entityId: contextEntity.entityId,
        displayName: contextEntity.displayName,
        icon: contextEntity.icon || '📄',
        data: resolved.data,
        summary: resolved.displayName || contextEntity.displayName,
      });
    }).catch(() => {
      addRef({
        entityType: contextEntity.entityType,
        entityId: contextEntity.entityId,
        displayName: contextEntity.displayName,
        icon: contextEntity.icon || '📄',
      });
    });
  }, [autoRef, contextEntity, addRef, baseUrl]);

  const handleSelect = useCallback((entity: EntityRef) => {
    addRef({
      entityType: entity.entityType,
      entityId: entity.entityId,
      displayName: entity.displayName,
      icon: entity.icon,
      data: entity.data,
      summary: entity.summary,
    });
  }, [addRef]);

  // Escape key to close picker
  useEffect(() => {
    if (!pickerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pickerOpen, closePicker]);

  return (
    <>
      {/* AtPicker overlay */}
      {pickerOpen && (
        <div style={{ position: 'relative' }}>
          <AtPicker
            baseUrl={baseUrl}
            sessionId={sessionId}
            sessionTemplate={sessionTemplate}
            open={pickerOpen}
            onClose={closePicker}
            onSelect={handleSelect}
            initialDrillType={initialDrillType}
            contextEntity={contextEntity}
          />
        </div>
      )}

      {/* Reference pills */}
      {refs.length > 0 && (
        <div
          data-testid="mention-refs"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '4px 8px',
          }}
        >
          {refs.map((ref, i) => (
            <span
              key={`${ref.entityType}:${ref.entityId}`}
              data-testid="ref-pill"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                background: '#e8f0fe',
                borderRadius: '12px',
                fontSize: '13px',
                color: '#1a73e8',
                border: '1px solid #c5d9f7',
              }}
            >
              <span>{ref.icon}</span>
              <span data-testid="ref-pill-name">{ref.displayName}</span>
              <button
                data-testid="ref-pill-remove"
                onClick={() => removeRef(i)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '0 2px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
          <div style={{ fontSize: '11px', color: '#888', width: '100%', marginTop: '2px' }}>
            {refs.length} 个实体已引用 · 发送时注入上下文
          </div>
        </div>
      )}
    </>
  );
}
