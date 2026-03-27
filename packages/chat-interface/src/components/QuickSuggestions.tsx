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
          className="text-[11px] px-2.5 py-2 rounded-xl border border-ck-b1 bg-transparent text-ck-t2 hover:bg-ck-bg2 font-inherit cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
