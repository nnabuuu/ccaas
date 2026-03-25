import { useMemo } from 'react'
import { ChatInterface } from '@/components/ChatInterface'
import type { SessionContextChip } from '@/types/session-context'
import type { QuickSuggestion } from '@/types/chat'

function getUrlParam(key: string): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get(key)
}

export default function App() {
  const tenantId = getUrlParam('tenant') ?? 'default'
  const template = getUrlParam('template') ?? undefined
  const serverUrl = getUrlParam('server') ?? 'http://localhost:3001'

  // Demo context chips — in production these come from session template
  const contextChips = useMemo<SessionContextChip[]>(() => {
    const chips = getUrlParam('chips')
    if (chips) {
      try {
        return JSON.parse(chips) as SessionContextChip[]
      } catch {
        // fall through to defaults
      }
    }
    return [
      { key: 'class', label: 'Class A', active: true },
      { key: 'subject', label: 'Math' },
      { key: 'school', label: 'Demo School' },
    ]
  }, [])

  // Demo suggestions — in production these come from session template
  const quickSuggestions = useMemo<QuickSuggestion[]>(() => {
    const suggestions = getUrlParam('suggestions')
    if (suggestions) {
      try {
        return JSON.parse(suggestions) as QuickSuggestion[]
      } catch {
        // fall through to defaults
      }
    }
    return [
      { label: 'Weekly Report', prompt: 'Generate this week\'s report', category: 'daily', score: 10 },
      { label: 'Analysis', prompt: 'Analyze current status', category: 'daily', score: 8 },
      { label: 'Planning', prompt: 'Help me plan', category: 'teaching', score: 6 },
      { label: 'Review', prompt: 'Review recent activities', category: 'admin', score: 4 },
    ]
  }, [])

  return (
    <div className="min-h-screen flex justify-center p-5">
      <ChatInterface
        serverUrl={serverUrl}
        tenantId={tenantId}
        sessionTemplate={template}
        contextChips={contextChips}
        quickSuggestions={quickSuggestions}
      />
    </div>
  )
}
