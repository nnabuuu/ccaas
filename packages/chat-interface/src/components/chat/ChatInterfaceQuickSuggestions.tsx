import type { QuickSuggestion } from '@/types/chat'
import { QuickSuggestions } from '@/components/QuickSuggestions'
import { useChatCore } from '@/context/ChatCoreContext'

export interface ChatInterfaceQuickSuggestionsProps {
  /** Override suggestions — defaults to quickSuggestions from context */
  suggestions?: QuickSuggestion[]
}

export function ChatInterfaceQuickSuggestions({
  suggestions,
}: ChatInterfaceQuickSuggestionsProps) {
  const { messages, quickSuggestions, handleSuggestionSelect } = useChatCore()

  // Only show after first message (empty state shows card-style suggestions instead)
  if (messages.length === 0) return null

  return (
    <div className="max-w-3xl mx-auto w-full">
      <QuickSuggestions
        suggestions={suggestions ?? quickSuggestions}
        onSelect={handleSuggestionSelect}
      />
    </div>
  )
}
