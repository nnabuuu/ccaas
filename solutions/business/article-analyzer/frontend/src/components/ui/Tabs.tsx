interface TabsProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-700">
      <nav className="-mb-px flex gap-4 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`whitespace-nowrap border-b-2 px-1 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-primary-600 text-primary-600 dark:border-primary-500 dark:text-primary-500'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
