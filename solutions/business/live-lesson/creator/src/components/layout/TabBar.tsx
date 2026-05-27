import { X } from 'lucide-react'

export interface WorkspaceTab {
  key: string
  label: string
  dotColor: string
}

export interface DynamicTabItem {
  id: string
  label: string
  kind: 'audit-report' | 'file-viewer'
}

interface Props {
  /** Fixed workspace tabs (plan / execution / skills). */
  workspaceTabs: readonly WorkspaceTab[]
  /** Currently-selected workspace tab key, or null when a dynamic tab is active. */
  activeWorkspace: string | null
  /** Open dynamic tabs (left-to-right). */
  dynamicTabs: readonly DynamicTabItem[]
  /** Currently-selected dynamic tab id, or null when workspace is active. */
  activeDynamic: string | null

  onSelectWorkspace: (key: string) => void
  onSelectDynamic: (id: string) => void
  onCloseDynamic: (id: string) => void
}

/**
 * Combined tab bar: workspace (left, fixed) + dynamic (right, closeable).
 *
 * Shape decisions:
 *   - Workspace tabs keep their colored dot + always-visible label.
 *   - Dynamic tabs get a small icon per kind + close × button (visible
 *     on hover or when active).
 *   - At most one tab is active at any time across both groups.
 */
export default function TabBar({
  workspaceTabs,
  activeWorkspace,
  dynamicTabs,
  activeDynamic,
  onSelectWorkspace,
  onSelectDynamic,
  onCloseDynamic,
}: Props) {
  return (
    <div className="flex items-center border-b border-gray-200 px-4 shrink-0 overflow-x-auto">
      {workspaceTabs.map((tab) => {
        const isActive = activeWorkspace === tab.key && activeDynamic === null
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelectWorkspace(tab.key)}
            className={`relative flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap ${
              isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${tab.dotColor}`} />
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gray-900 rounded-full" />
            )}
          </button>
        )
      })}

      {dynamicTabs.length > 0 && (
        // Vertical divider so workspace tabs are visually distinct
        // from on-demand tabs.
        <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />
      )}

      {dynamicTabs.map((tab) => {
        const isActive = activeDynamic === tab.id
        return (
          <div
            key={tab.id}
            className={`group relative flex items-center pl-3 pr-1.5 py-3 text-sm whitespace-nowrap ${
              isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectDynamic(tab.id)}
              className="flex items-center gap-1.5"
              title={tab.label}
            >
              <KindIcon kind={tab.kind} active={isActive} />
              <span className="max-w-[12rem] truncate font-medium">{tab.label}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCloseDynamic(tab.id)
              }}
              className={`ml-1.5 p-0.5 rounded transition-opacity ${
                isActive
                  ? 'opacity-100 hover:bg-gray-100'
                  : 'opacity-0 group-hover:opacity-100 hover:bg-gray-100'
              }`}
              aria-label={`关闭 ${tab.label}`}
              title="关闭"
            >
              <X size={12} className="text-gray-500" />
            </button>
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gray-900 rounded-full" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function KindIcon({
  kind,
  active,
}: {
  kind: DynamicTabItem['kind']
  active: boolean
}) {
  // Glyph-only differentiators kept small (12px) so they don't
  // out-compete the label. Active state slightly bolder color.
  const cls = active ? 'text-amber-500' : 'text-gray-400'
  if (kind === 'audit-report') {
    return (
      <span className={`text-[11px] ${cls}`} aria-hidden="true">
        ◇
      </span>
    )
  }
  return (
    <span className={`text-[11px] ${cls}`} aria-hidden="true">
      ▤
    </span>
  )
}
