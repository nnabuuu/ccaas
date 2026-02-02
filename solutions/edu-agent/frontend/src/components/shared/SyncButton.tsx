import { ArrowDownToLine, Check, Undo2, X } from 'lucide-react'

interface SyncButtonProps {
  field: string
  preview: string
  synced?: boolean
  canUndo?: boolean
  onSync: () => void
  onDiscard: () => void
  onUndo?: () => void
}

export function SyncButton({ preview, synced, canUndo, onSync, onDiscard, onUndo }: SyncButtonProps) {
  if (synced) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium">
        <Check size={14} strokeWidth={2} />
        <span>已同步: {preview}</span>
        {canUndo && onUndo && (
          <button
            onClick={onUndo}
            className="ml-1 p-0.5 rounded hover:bg-success/20 transition-colors"
            title="撤销同步"
          >
            <Undo2 size={12} strokeWidth={2} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1 my-1">
      <button
        onClick={onSync}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors duration-button"
      >
        <ArrowDownToLine size={14} strokeWidth={2} />
        同步: {preview}
      </button>
      <button
        onClick={onDiscard}
        className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-tertiary transition-colors duration-button"
        title="忽略"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  )
}
