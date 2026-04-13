import React, { createContext, useContext, useState, useCallback } from 'react';

export interface MentionRef {
  entityType: string;
  entityId: string;
  displayName: string;
  icon: string;
  data?: unknown;
  summary?: string;
}

interface MentionContextValue {
  refs: MentionRef[];
  addRef: (ref: MentionRef) => void;
  removeRef: (index: number) => void;
  clearRefs: () => void;
  pickerOpen: boolean;
  openPicker: (initialDrillType?: string) => void;
  closePicker: () => void;
  initialDrillType: string | undefined;
}

const MentionCtx = createContext<MentionContextValue | null>(null);

export function useMentionContext(): MentionContextValue {
  const ctx = useContext(MentionCtx);
  if (!ctx) throw new Error('useMentionContext must be used within MentionProvider');
  return ctx;
}

interface MentionProviderProps {
  children: React.ReactNode;
  initialRefs?: MentionRef[];
}

export function MentionProvider({ children, initialRefs }: MentionProviderProps) {
  const [refs, setRefs] = useState<MentionRef[]>(initialRefs ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [initialDrillType, setInitialDrillType] = useState<string | undefined>();

  const addRef = useCallback((ref: MentionRef) => {
    setRefs(prev => {
      // Avoid duplicates
      if (prev.some(r => r.entityType === ref.entityType && r.entityId === ref.entityId)) return prev;
      return [...prev, ref];
    });
  }, []);

  const removeRef = useCallback((index: number) => {
    setRefs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearRefs = useCallback(() => {
    setRefs([]);
  }, []);

  const openPicker = useCallback((drillType?: string) => {
    setInitialDrillType(drillType);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setInitialDrillType(undefined);
  }, []);

  return (
    <MentionCtx.Provider value={{ refs, addRef, removeRef, clearRefs, pickerOpen, openPicker, closePicker, initialDrillType }}>
      {children}
    </MentionCtx.Provider>
  );
}
