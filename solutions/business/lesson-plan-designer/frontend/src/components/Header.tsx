interface HeaderProps {
  title: string
  connected: boolean
  saving: boolean
  hasChanges: boolean
  autoSync?: boolean
  onToggleAutoSync?: () => void
  onSave: () => void
  onNew: () => void
}

export function Header({ title, connected, saving, hasChanges, autoSync, onToggleAutoSync, onSave, onNew }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {title || 'AI备课设计器'}
        </h1>

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-500">
            {connected ? '已连接' : '未连接'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Auto-Sync Toggle */}
        {onToggleAutoSync && (
          <button
            onClick={onToggleAutoSync}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors ${
              autoSync
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
            title={autoSync ? '自动同步已开启' : '自动同步已关闭'}
          >
            <span className={`w-2 h-2 rounded-full transition-colors ${autoSync ? 'bg-blue-500' : 'bg-gray-300'}`} />
            <span>自动同步</span>
          </button>
        )}
        {/* New Button */}
        <button
          onClick={onNew}
          className="btn-secondary"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建
        </button>

        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={saving || !hasChanges}
          className="btn-primary"
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              保存中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              保存
            </>
          )}
        </button>
      </div>
    </header>
  )
}

export default Header
