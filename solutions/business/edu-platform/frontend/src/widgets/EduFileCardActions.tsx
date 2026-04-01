import type { WidgetComponentProps } from '@kedge-agentic/chat-interface'

interface FileItem {
  name: string
  meta?: string
  size?: string
  /** File extension (e.g. '.docx', '.pdf'). Auto-detected from name if omitted. */
  type?: string
}

interface ActionItem {
  label: string
  prompt: string
  primary?: boolean
  skill_hint?: string
}

interface EduFileCardActionsProps {
  files: FileItem[]
  actions?: ActionItem[]
  title?: string
}

/** Map file extension to semantic color classes per file-card-actions.html prototype */
function getFileColors(ext: string): { bg: string; text: string } {
  switch (ext) {
    case '.docx': return { bg: 'var(--info-bg)', text: 'var(--info-t)' }
    case '.pdf':  return { bg: 'var(--coral-bg)', text: 'var(--coral-t)' }
    case '.pptx': return { bg: 'var(--teal-bg)', text: 'var(--teal-t)' }
    case '.xlsx': return { bg: 'var(--purple-bg)', text: 'var(--purple-t)' }
    default:      return { bg: 'var(--info-bg)', text: 'var(--info-t)' }
  }
}

function detectExtension(fileName: string, typeHint?: string): string {
  if (typeHint && typeHint.startsWith('.')) return typeHint
  const dot = fileName.lastIndexOf('.')
  if (dot >= 0) return fileName.slice(dot)
  return '.file'
}

export function EduFileCardActions({
  props,
  onSubmit,
}: WidgetComponentProps<EduFileCardActionsProps>) {
  const files = props.files ?? []
  const actions = props.actions

  return (
    <div>
      {/* File cards */}
      {files.map((file, i) => {
        const ext = detectExtension(file.name, file.type)
        const colors = getFileColors(ext)

        return (
          <div
            key={i}
            className="flex items-center gap-3 px-3.5 py-3 border-[0.5px] border-[var(--b1)] rounded-[var(--r)] mb-2 bg-[var(--bg1)] cursor-pointer transition-all duration-150 hover:bg-[var(--bg2)] hover:border-[var(--b1-hover)]"
          >
            {/* Icon */}
            <div
              className="w-[38px] h-[38px] rounded-lg flex items-center justify-center text-[11px] font-semibold shrink-0"
              style={{ background: colors.bg, color: colors.text }}
            >
              {ext}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px] truncate">{file.name}</div>
              {file.meta && (
                <div className="text-[11px] text-[var(--t2)] mt-0.5">{file.meta}</div>
              )}
            </div>
            {/* Size */}
            {file.size && (
              <span className="text-[11px] text-[var(--t3)] shrink-0">{file.size}</span>
            )}
          </div>
        )
      })}

      {/* Next Actions */}
      {actions && actions.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-2.5">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onSubmit?.({ _action: 'suggest', prompt: action.prompt, skill_hint: action.skill_hint })}
              className={`text-[12px] px-3.5 py-1.5 rounded-[var(--r)] cursor-pointer border-[0.5px] transition-all duration-150 ${
                action.primary
                  ? 'bg-[var(--t1)] text-[var(--bg1)] border-[var(--t1)] hover:opacity-90'
                  : 'bg-[var(--bg1)] text-[var(--t2)] border-[var(--b1)] hover:bg-[var(--bg2)]'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
