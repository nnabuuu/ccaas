interface Tab {
  key: string
  label: string
  dotColor: string
}

interface TabBarProps {
  tabs: readonly Tab[]
  activeTab: string
  onTabChange: (key: string) => void
}

export default function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex items-center border-b border-gray-200 px-4 shrink-0">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`relative flex items-center gap-2 px-3 py-3 text-sm font-medium ${
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
    </div>
  )
}
