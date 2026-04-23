import { useEffect, Fragment } from 'react'
import type { ReadingManifest } from '../../types/reading'
import { useStudentTask, TaskColumn, TASKS, SessionCtx } from './TaskPanel'
import TextPanel from './TextPanel'
import AiPanel from './AiPanel'

interface Props {
  manifest: ReadingManifest
  embed?: boolean
  sessionCode?: string
  studentId?: string
}

export default function StudentShell({ manifest, embed, sessionCode, studentId }: Props) {
  const { taskId, task, currentFocus, doneSet, screen, setScreen, completeTask } = useStudentTask()

  // Signal ready to parent
  useEffect(() => {
    try { window.parent?.postMessage({ type: 'ready', role: 'student' }, window.location.origin) } catch { /* noop */ }
  }, [])

  // Convert focus numbers to paragraph IDs
  const focusIds = currentFocus.map(n => `p${n}`)

  return (
    <div className="stu-root">
      {/* Top bar */}
      {!embed && (
        <div className="stu-top">
          <div className="stu-top-title">{manifest.article.title}</div>
          <div className="stu-top-sub">Senior High English · AI 1-on-1</div>
          {task && (
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              Task {task.id}: {task.name}
              <span style={{ color: 'var(--t3)', fontWeight: 400, marginLeft: 6 }}>{task.time}</span>
            </div>
          )}
        </div>
      )}

      {/* Progress dots */}
      <div className="stu-prog-row">
        {TASKS.map((t, i) => {
          const isAct = taskId === t.id
          const isDone = doneSet.has(t.id)
          const canClick = isDone || isAct || t.id === 1 || doneSet.has(t.id - 1)
          return (
            <Fragment key={t.id}>
              <div
                className="stu-prog-item"
                style={{ cursor: canClick ? 'pointer' : 'default' }}
                onClick={canClick ? () => setScreen(String(t.id)) : undefined}
              >
                <div className={`stu-prog-dot${isAct ? ' active' : ''}${isDone ? ' done' : ''}`}>
                  {isDone ? '✓' : t.id}
                </div>
                <div className={`stu-prog-name${isAct ? ' active' : ''}`}>{t.name}</div>
              </div>
              {i < TASKS.length - 1 && <div className="stu-prog-line" />}
            </Fragment>
          )
        })}
      </div>

      {/* Main area: left col (tasks) + right col (text) */}
      <SessionCtx.Provider value={{ sessionCode, studentId }}>
        <div className="stu-main-wrap">
          <TaskColumn screen={screen} setScreen={setScreen} task={task} completeTask={completeTask} />
          <TextPanel
            title={manifest.article.title}
            paragraphs={manifest.article.paragraphs}
            focusIds={focusIds}
          />
          <AiPanel taskId={taskId || 1} />
        </div>
      </SessionCtx.Provider>
    </div>
  )
}
