import { Outlet, Link, useLocation } from 'react-router-dom'
import { Panel, Group, Separator } from 'react-resizable-panels'
import {
  FileText,
  Lightning,
  GraduationCap,
  ChartBar,
  WarningCircle,
  UploadSimple,
} from '@phosphor-icons/react'
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
    { path: '/quizzes', label: '题目列表', Icon: FileText },
    { path: '/import', label: '数据导入', Icon: UploadSimple },
    { path: '/batch', label: '批量分析', Icon: Lightning },
    { path: '/knowledge-points', label: '知识点', Icon: GraduationCap },
    { path: '/analytics', label: '数据分析', Icon: ChartBar },
    { path: '/error-patterns', label: '错误分析', Icon: WarningCircle },
  ]

  return (
    <div className="flex min-h-screen bg-ck-bg2">
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-ck-bg1 border-r border-ck-b1 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-ck-b1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-ck-lg bg-ck-t1 flex items-center justify-center">
              <GraduationCap weight="regular" className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ck-t1">Quiz Analyzer</h2>
            </div>
          </div>
          <p className="text-sm text-ck-t3 ml-13">教育题目智能分析</p>
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
                      flex items-center gap-3 px-4 py-3 rounded-ck-lg font-medium
                      transition-all duration-200 ease-claude cursor-pointer
                      ${
                        active
                          ? 'bg-ck-accent/10 text-ck-accent shadow-composer'
                          : 'text-ck-t2 hover:bg-ck-bg2 hover:text-ck-t1'
                      }
                    `}
                  >
                    <Icon weight="regular" className="w-5 h-5" />
                    <span>{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-ck-b1">
          <div className="px-4 py-2 bg-ck-bg2 rounded-ck">
            <p className="text-xs text-ck-t3">Version 1.0.0</p>
            <p className="text-xs text-ck-t3 mt-1">Built with React + Vite</p>
          </div>
        </div>
      </nav>

      {/* Main Content + Chatbox */}
      {mode === 'default' && (
        <>
          <main className="flex-1 overflow-auto ck-scrollbar">
            <div className="p-8">
              <Outlet />
            </div>
          </main>

          {!isCollapsed && (
            <aside className="w-[400px] border-l border-ck-b1 bg-ck-bg1 flex-shrink-0">
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
            <main className="h-full overflow-auto ck-scrollbar">
              <div className="p-8">
                <Outlet />
              </div>
            </main>
          </Panel>

          <Separator className="w-1 bg-ck-b1 hover:bg-ck-accent transition-colors duration-200 ease-claude" />

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
        <main className="flex-1 relative overflow-auto ck-scrollbar">
          <div className="p-8">
            <Outlet />
          </div>

          {!isCollapsed && (
            <div
              className="absolute right-0 top-0 bottom-0 shadow-composer-hover bg-ck-bg1 z-10"
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
                className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-ck-accent transition-colors duration-200 ease-claude ${
                  isResizing ? 'bg-ck-accent' : 'bg-ck-b1'
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
