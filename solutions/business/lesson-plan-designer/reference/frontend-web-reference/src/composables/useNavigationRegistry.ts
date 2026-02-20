import { useRouter, type Router } from 'vue-router'
import { useNavigationStore } from '../stores/core/uiStore'

/**
 * Target configuration for registration
 */
interface TargetConfig {
  /** Unique target ID (e.g., 'lessonPlan.learningObjectives') */
  id: string
  /** DOM element ID to scroll to */
  elementId: string
  /** Route pattern (e.g., '/lesson-plan/:id') */
  route?: string
  /** Custom scroll offset (overrides default) */
  scrollOffset?: number
  /** Callback when navigated to */
  onActivate?: (options: NavigationEventOptions) => void
  /** Callback when leaving */
  onDeactivate?: () => void
  /** Whether target supports edit mode */
  canEdit?: boolean
  /** How to enter edit mode */
  editAction?: () => void
}

/**
 * Registered target with metadata
 */
interface RegisteredTarget extends TargetConfig {
  registeredAt: number
}

/**
 * Navigation event options
 */
interface NavigationEventOptions {
  smooth: boolean
  highlight: boolean
  highlightDuration: number
  autoEdit: boolean
  delay: number
  params: Record<string, unknown>
  query?: Record<string, string>
  thenNavigate?: string
}

/**
 * Navigation event from store
 */
interface NavigationEvent {
  id: string
  targetId: string
  type: string
  options: NavigationEventOptions
  timestamp: number
  status: string
}

/**
 * Static route configuration
 */
interface StaticRouteConfig {
  path: string
}

/**
 * Singleton registry for navigation targets
 * Maps target IDs to their configurations
 */
const targetRegistry = new Map<string, RegisteredTarget>()

/**
 * Static route definitions for page-level navigation
 * These don't require component registration
 */
const staticRoutes: Record<string, StaticRouteConfig> = {
  // Lesson Plan routes
  'page.lessonPlan.list': { path: '/lesson-plan' },
  'page.lessonPlan.new': { path: '/lesson-plan/new' },
  'page.lessonPlan.detail': { path: '/lesson-plan/:id' },

  // Course routes
  'page.course.list': { path: '/course' },
  'page.course.new': { path: '/course/new' },
  'page.course.detail': { path: '/course/:id' },

  // Other pages
  'page.home': { path: '/home' },
  'page.projects': { path: '/projects' },
  'page.learningTasks': { path: '/learning-tasks' },
  'page.profile': { path: '/profile' },
  'page.aiAssistant': { path: '/ai-assistant' }
}

/**
 * Navigation Registry Return Type
 */
interface NavigationRegistryReturn {
  registerTarget: (config: TargetConfig) => void
  unregisterTarget: (id: string) => void
  getTarget: (id: string) => RegisteredTarget | undefined
  getAllTargets: () => [string, RegisteredTarget][]
  hasTarget: (id: string) => boolean
  executeNavigation: (event: NavigationEvent) => Promise<boolean>
  getStaticRoutes: () => [string, StaticRouteConfig][]
}

/**
 * Navigation Registry Composable
 * Provides target registration and navigation execution
 */
export function useNavigationRegistry(): NavigationRegistryReturn {
  const router: Router = useRouter()
  const navigationStore = useNavigationStore()

  /**
   * Register a navigation target
   * @param config - Target configuration
   */
  function registerTarget(config: TargetConfig): void {
    if (!config.id) {
      console.error('[NavigationRegistry] Target config must have an id')
      return
    }

    if (targetRegistry.has(config.id)) {
      console.warn(`[NavigationRegistry] Target "${config.id}" already registered, overwriting`)
    }

    targetRegistry.set(config.id, {
      ...config,
      registeredAt: Date.now()
    })
  }

  /**
   * Unregister a navigation target
   * @param id - Target ID to remove
   */
  function unregisterTarget(id: string): void {
    if (targetRegistry.has(id)) {
      targetRegistry.delete(id)
    }
  }

  /**
   * Get a registered target by ID
   * @param id - Target ID
   * @returns Target config or undefined
   */
  function getTarget(id: string): RegisteredTarget | undefined {
    return targetRegistry.get(id)
  }

  /**
   * Get all registered targets
   * @returns Array of [id, config] pairs
   */
  function getAllTargets(): [string, RegisteredTarget][] {
    return Array.from(targetRegistry.entries())
  }

  /**
   * Check if a target is registered
   * @param id - Target ID
   */
  function hasTarget(id: string): boolean {
    return targetRegistry.has(id)
  }

  /**
   * Execute a navigation event
   * @param event - Navigation event from the store
   * @returns Success status
   */
  async function executeNavigation(event: NavigationEvent): Promise<boolean> {
    // Check for static route first (page-level navigation)
    const staticRoute = staticRoutes[event.targetId]
    if (staticRoute) {
      return await executeStaticRouteNavigation(event, staticRoute)
    }

    // Check for registered target (element-level navigation)
    const target = targetRegistry.get(event.targetId)

    if (!target) {
      console.warn(`[NavigationRegistry] Target "${event.targetId}" not found in registry or static routes`)
      navigationStore.failEvent(event.id, 'Target not registered')
      return false
    }

    try {
      // Check if we need to navigate to a different route
      const needsRouteChange = await checkAndNavigateRoute(target, event)

      if (needsRouteChange) {
        // Cross-page navigation: route change will trigger the rest
        return true
      }

      // Same-page navigation: scroll and highlight
      const success = await scrollToElement(target, event)

      if (success) {
        // Apply highlight if enabled
        if (event.options.highlight) {
          await applyHighlight(target, event)
        }

        // Trigger edit mode if requested
        if (event.options.autoEdit && target.canEdit && target.editAction) {
          target.editAction()
        }

        // Call onActivate callback
        if (target.onActivate) {
          target.onActivate(event.options)
        }

        navigationStore.completeEvent(event.id)
        return true
      } else {
        navigationStore.failEvent(event.id, 'Element not found')
        return false
      }
    } catch (error) {
      console.error('[NavigationRegistry] Navigation failed:', error)
      navigationStore.failEvent(event.id, (error as Error).message)
      return false
    }
  }

  /**
   * Execute navigation to a static route (page-level)
   * @private
   */
  async function executeStaticRouteNavigation(event: NavigationEvent, staticRoute: StaticRouteConfig): Promise<boolean> {
    try {
      // Build the path with params
      let path = staticRoute.path
      if (event.options.params) {
        Object.entries(event.options.params).forEach(([key, value]) => {
          path = path.replace(`:${key}`, String(value))
        })
      }

      // Check if already on this route
      const currentPath = router.currentRoute.value.path
      if (currentPath === path) {
        navigationStore.completeEvent(event.id)
        return true
      }

      // Build query params
      const query: Record<string, string> = { ...event.options.query }

      // If there's a follow-up target after page load, add it to query
      if (event.options.thenNavigate) {
        query.nav = event.options.thenNavigate
        if (event.options.autoEdit) {
          query.edit = 'true'
        }
      }

      // Navigate to the route
      await router.push({ path, query: Object.keys(query).length > 0 ? query : undefined })

      navigationStore.completeEvent(event.id)
      return true
    } catch (error) {
      console.error('[NavigationRegistry] Static route navigation failed:', error)
      navigationStore.failEvent(event.id, (error as Error).message)
      return false
    }
  }

  /**
   * Check if route change is needed and navigate
   * @private
   */
  async function checkAndNavigateRoute(target: RegisteredTarget, event: NavigationEvent): Promise<boolean> {
    if (!target.route) {
      return false
    }

    // Build the target route path
    let targetPath = target.route
    if (event.options.params) {
      Object.entries(event.options.params).forEach(([key, value]) => {
        targetPath = targetPath.replace(`:${key}`, String(value))
      })
    }

    // Check if we're already on the correct route
    const currentPath = router.currentRoute.value.path
    if (currentPath === targetPath || currentPath.startsWith(targetPath.replace(/:\w+/g, ''))) {
      return false
    }

    // Navigate with query param for post-route navigation
    await router.push({
      path: targetPath,
      query: {
        nav: event.targetId,
        ...(event.options.autoEdit ? { edit: 'true' } : {})
      }
    })

    return true
  }

  /**
   * Scroll to target element with retry logic
   * @private
   */
  async function scrollToElement(target: RegisteredTarget, event: NavigationEvent): Promise<boolean> {
    const scrollOffset = target.scrollOffset ?? navigationStore.config.scrollOffset

    // Try to find element, with one retry
    let element = document.getElementById(target.elementId)

    if (!element) {
      // Retry once after 100ms (element might not be rendered yet)
      await new Promise(resolve => setTimeout(resolve, 100))
      element = document.getElementById(target.elementId)
    }

    if (!element) {
      console.warn(`[NavigationRegistry] Element "#${target.elementId}" not found`)
      return false
    }

    // Calculate scroll position
    const elementRect = element.getBoundingClientRect()
    const absoluteTop = elementRect.top + window.pageYOffset - scrollOffset

    // Perform scroll
    if (event.options.smooth) {
      window.scrollTo({
        top: absoluteTop,
        behavior: 'smooth'
      })
    } else {
      window.scrollTo(0, absoluteTop)
    }

    return true
  }

  /**
   * Apply highlight animation to element
   * @private
   */
  async function applyHighlight(target: RegisteredTarget, event: NavigationEvent): Promise<void> {
    const element = document.getElementById(target.elementId)
    if (!element) return

    const duration = event.options.highlightDuration ?? navigationStore.config.highlightDuration

    // Add highlight class
    element.classList.add('nav-highlight')

    // Remove after duration
    await new Promise(resolve => setTimeout(resolve, duration))
    element.classList.remove('nav-highlight')
  }

  /**
   * Get all static routes (page-level navigation targets)
   * @returns Array of [id, config] pairs
   */
  function getStaticRoutes(): [string, StaticRouteConfig][] {
    return Object.entries(staticRoutes)
  }

  return {
    registerTarget,
    unregisterTarget,
    getTarget,
    getAllTargets,
    hasTarget,
    executeNavigation,
    getStaticRoutes
  }
}
