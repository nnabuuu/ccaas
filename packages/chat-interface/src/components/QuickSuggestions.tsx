import type { QuickSuggestion } from '@/types/chat'

interface QuickSuggestionsProps {
  suggestions: QuickSuggestion[]
  onSelect: (suggestion: QuickSuggestion) => void
}

export function QuickSuggestions({ suggestions, onSelect }: QuickSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="flex gap-1.5 px-4 pb-2.5 flex-wrap">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className="text-[12px] px-3 py-1.5 rounded-full border border-ck-b1 bg-transparent text-ck-t2 hover:bg-ck-bg3 hover:text-ck-t1 font-inherit cursor-pointer transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
