interface HeaderProps {
  connected: boolean
}

export function Header({ connected }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 shrink-0">
      <span className="text-xl mr-2">📚</span>
      <h1 className="text-lg font-semibold text-gray-800">精准教学平台</h1>
      <span className="ml-3 text-sm text-gray-500">备课助手</span>
      <div className="ml-auto flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-300'}`} />
        <span className="text-xs text-gray-400">{connected ? '已连接' : '连接中...'}</span>
      </div>
    </header>
  )
}
