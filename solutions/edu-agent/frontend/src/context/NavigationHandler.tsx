import { useEffect } from 'react'
import { useSessionContext, type ActiveTab } from './SessionContext'

const ROUTE_TO_TAB: Record<string, ActiveTab> = {
  '/': 'home',
  '/lesson-plan': 'lesson-plan',
  '/problem-explain': 'problem-explain',
}

/**
 * Intercepts output_update events with field === '__navigation__'
 * and switches the active tab to the specified route.
 */
export function NavigationHandler() {
  const { registerOutputHandler, setActiveTab } = useSessionContext()

  useEffect(() => {
    return registerOutputHandler((update) => {
      if (update.field === '__navigation__' && typeof update.value === 'string') {
        const tab = ROUTE_TO_TAB[update.value]
        if (tab) {
          console.log(`[NavigationHandler] Switching to tab: ${tab}`, update.preview)
          setActiveTab(tab)
        } else {
          console.warn(`[NavigationHandler] Invalid route: ${update.value}`)
        }
      }
    })
  }, [registerOutputHandler, setActiveTab])

  return null
}
