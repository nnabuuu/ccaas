import type { QuickSuggestion } from '@/types/chat'

/** Extended suggestion with optional group title for the first item in a new category */
interface ExtendedSuggestion extends QuickSuggestion {
  groupTitle?: string
}

interface QuickSuggestionsProps {
  suggestions: QuickSuggestion[]
  onSelect: (suggestion: QuickSuggestion) => void
}

const CHIP_CLASS =
  'text-[11px] px-2.5 py-1 rounded-xl border-[0.5px] border-ck-b1 bg-transparent text-ck-t2 hover:bg-ck-bg2 hover:text-ck-t1 font-inherit cursor-pointer transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent min-h-[36px] sm:min-h-0'

export function QuickSuggestions({ suggestions, onSelect }: QuickSuggestionsProps) {
  if (suggestions.length === 0) return null

  // Group suggestions by category, preserving insertion order
  const groups: Array<{ title?: string; items: QuickSuggestion[] }> = []
  let currentCategory: string | null = null

  for (const s of suggestions) {
    const ext = s as ExtendedSuggestion
    if (s.category !== currentCategory) {
      currentCategory = s.category
      groups.push({ title: ext.groupTitle, items: [s] })
    } else {
      groups[groups.length - 1].items.push(s)
    }
  }

  // Single group → flat layout (backward compatible)
  if (groups.length <= 1) {
    return (
      <div data-ck="quick-suggestions" className="flex gap-1.5 px-3 sm:px-4 pb-2.5 flex-wrap">
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => onSelect(s)} className={CHIP_CLASS}>
            {s.label}
          </button>
        ))}
      </div>
    )
  }

  // Multiple groups → grouped layout with optional subtitles
  return (
    <div data-ck="quick-suggestions" className="px-3 sm:px-4 pb-2.5">
      {groups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? 'mt-2.5' : ''}>
          {group.title && (
            <div className="text-[11px] text-ck-t3 mb-2">{group.title}</div>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {group.items.map((s, i) => (
              <button key={i} onClick={() => onSelect(s)} className={CHIP_CLASS}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
