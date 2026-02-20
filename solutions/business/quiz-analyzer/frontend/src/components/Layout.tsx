import { Outlet, Link, useLocation } from 'react-router-dom'
import { Panel, Group, Separator } from 'react-resizable-panels'
import {
  DocumentTextIcon,
  BoltIcon,
  AcademicCapIcon,
  ChartBarIcon,
  ExclamationCircleIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'
import { useChatLayout } from '../hooks/useChatLayout'
import { useQuizSession } from '../hooks/useQuizSession'
import ChatSection from './ChatSection'
import CollapsedChatTab from './CollapsedChatTab'

export default function Layout() {
  const location = useLocation()

  // Chat layout state
  const {
    mode,
    setMode,
    isCollapsed,
    setCollapsed,
    overlayWidth,
    isResizing,
    overlayResizeProps,
  } = useChatLayout()

  // Quiz session
  const session = useQuizSession()

  const isActive = (path: string) => {
    return location.pathname.startsWith(path)
  }

  const navItems = [
    { path: '/quizzes', label: '题目列表', Icon: DocumentTextIcon },
    { path: '/import', label: '数据导入', Icon: ArrowUpTrayIcon },
    { path: '/batch', label: '批量分析', Icon: BoltIcon },
    { path: '/knowledge-points', label: '知识点', Icon: AcademicCapIcon },
    { path: '/analytics', label: '数据分析', Icon: ChartBarIcon },
    { path: '/error-patterns', label: '错误分析', Icon: ExclamationCircleIcon },
  ]

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <AcademicCapIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary-900">Quiz Analyzer</h2>
            </div>
          </div>
          <p className="text-sm text-slate-500 ml-13">教育题目智能分析</p>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map(({ path, label, Icon }) => {
              const active = isActive(path)
              return (
                <li key={path}>
                  <Link
                    to={path}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl font-medium
                      transition-all duration-200 cursor-pointer
                      ${
                        active
                          ? 'bg-primary-50 text-primary-700 shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200">
          <div className="px-4 py-2 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Version 1.0.0</p>
            <p className="text-xs text-slate-400 mt-1">Built with React + Vite</p>
          </div>
        </div>
      </nav>

      {/* Main Content + Chatbox */}
      {mode === 'default' && (
        <>
          <main className="flex-1 overflow-auto">
            <div className="p-8">
              <Outlet />
            </div>
          </main>

          {!isCollapsed && (
            <aside className="w-[400px] border-l border-slate-200 bg-white flex-shrink-0">
              <ChatSection
                mode={mode}
                isCollapsed={isCollapsed}
                onModeChange={setMode}
                onToggleCollapse={() => setCollapsed(!isCollapsed)}
                session={session}
              />
            </aside>
          )}

          {isCollapsed && (
            <CollapsedChatTab onClick={() => setCollapsed(false)} />
          )}
        </>
      )}

      {mode === 'side-by-side' && (
        <Group orientation="horizontal">
          <Panel defaultSize={65} minSize={40}>
            <main className="h-full overflow-auto">
              <div className="p-8">
                <Outlet />
              </div>
            </main>
          </Panel>

          <Separator className="w-1 bg-slate-200 hover:bg-primary-500 transition-colors" />

          <Panel
            defaultSize={35}
            minSize={20}
            maxSize={60}
            collapsible
          >
            {!isCollapsed && (
              <ChatSection
                mode={mode}
                isCollapsed={isCollapsed}
                onModeChange={setMode}
                onToggleCollapse={() => setCollapsed(!isCollapsed)}
                session={session}
              />
            )}
          </Panel>

          {isCollapsed && (
            <CollapsedChatTab onClick={() => setCollapsed(false)} />
          )}
        </Group>
      )}

      {mode === 'overlay' && (
        <main className="flex-1 relative overflow-auto">
          <div className="p-8">
            <Outlet />
          </div>

          {!isCollapsed && (
            <div
              className="absolute right-0 top-0 bottom-0 shadow-2xl bg-white z-10"
              style={{ width: `${overlayWidth}px` }}
            >
              <ChatSection
                mode={mode}
                isCollapsed={isCollapsed}
                onModeChange={setMode}
                onToggleCollapse={() => setCollapsed(!isCollapsed)}
                session={session}
              />
              {/* Resize handle */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary-500 transition-colors ${
                  isResizing ? 'bg-primary-500' : 'bg-slate-300'
                }`}
                {...overlayResizeProps}
              />
            </div>
          )}

          {isCollapsed && (
            <CollapsedChatTab onClick={() => setCollapsed(false)} />
          )}
        </main>
      )}
    </div>
  )
}
