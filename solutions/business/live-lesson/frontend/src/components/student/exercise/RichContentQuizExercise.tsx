import { useState, useContext, useCallback, useRef } from 'react'
import { SessionCtx } from '../TaskPanel'
import type { RichContentQuizPart } from '../task-data'
import type { ScaffoldHint } from '../ScaffoldPanel'
import type { SubmitResult } from '../../../hooks/useClassroom'
import { cacheSubmission } from '../../../hooks/useClassroom'
import { reportAttempt } from './gradeItemSet'
import { RenderMath } from '../../../utils/render-math'
import { HandwritingCanvas } from '../image-capture/HandwritingCanvas'
import type { HandwritingCanvasHandle } from '../image-capture/HandwritingCanvas'

type PartPhase = 'work' | 'wrong' | 'retry' | 'wrong2' | 'done'

interface Props {
  parts: RichContentQuizPart[]
  subType?: string
  prompt?: string
  promptImages?: Array<{ url: string; alt?: string }>
  maxImages?: number
  stepIdx?: number
  taskId?: number
  onScaffoldPush?: (hint: ScaffoldHint) => void
  onDone: () => void
}

export function RichContentQuizExercise({
  parts, subType, prompt, promptImages, maxImages = 1,
  stepIdx, taskId, onScaffoldPush, onDone,
}: Props) {
  const ctx = useContext(SessionCtx)
  const canvasRef = useRef<HandwritingCanvasHandle>(null)
  const busyRef = useRef(false)

  const [currentPartIdx, setCurrentPartIdx] = useState(0)
  const [partImages, setPartImages] = useState<Record<string, string[]>>({})
  const [partPhase, setPartPhase] = useState<Record<string, PartPhase>>({})
  const [submitting, setSubmitting] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [lastFeedback, setLastFeedback] = useState('')

  const currentPart = parts[currentPartIdx]
  const currentPartId = currentPart?.id
  const images = currentPartId ? (partImages[currentPartId] || []) : []
  const phase: PartPhase = currentPartId ? (partPhase[currentPartId] || 'work') : 'work'
  const allPartsDone = parts.length > 0 && parts.every(p => partPhase[p.id] === 'done')

  const handlePagesChange = useCallback((dataUris: string[]) => {
    if (!currentPartId) return
    setPartImages(prev => ({ ...prev, [currentPartId]: dataUris }))
  }, [currentPartId])

  const handleContentStatusChange = useCallback((has: boolean) => {
    setHasContent(has)
  }, [])

  const advanceToNext = (updatedPhases: Record<string, PartPhase>, result: SubmitResult) => {
    if (result.nextPartId) {
      const nextIdx = parts.findIndex(p => p.id === result.nextPartId)
      if (nextIdx >= 0) {
        setCurrentPartIdx(nextIdx)
        setHasContent(false)
      }
    } else {
      if (parts.every(p => updatedPhases[p.id] === 'done')) {
        onDone()
      } else {
        const nextIncomplete = parts.findIndex(p => updatedPhases[p.id] !== 'done')
        if (nextIncomplete >= 0) {
          setCurrentPartIdx(nextIncomplete)
          setHasContent(false)
        }
      }
    }
  }

  const handleSubmit = async () => {
    if (!currentPartId || busyRef.current) return
    if (stepIdx === undefined || !ctx.submit) return

    const freshImages = canvasRef.current?.exportPages() || images
    if (freshImages.length === 0) return

    busyRef.current = true
    setSubmitting(true)
    try {
      const submitData = {
        images: freshImages,
        partId: currentPartId,
        method: subType || 'rich-content-quiz',
      }
      const result: SubmitResult = await ctx.submit(stepIdx, submitData)

      if (ctx.sessionCode) {
        cacheSubmission(ctx.sessionCode, stepIdx, submitData, result.score ?? null)
      }

      reportAttempt(taskId ?? 0, 0, 1, submitData, null, result.ok !== false)

      if (!result.ok) return

      if (result.scaffold) {
        onScaffoldPush?.(result.scaffold)
        const feedback = (result.score as Record<string, unknown>)?.llmFeedback as string | undefined
        setLastFeedback(feedback || '答案不正确，请参考右侧提示修改后重新提交。')
        if (result.scaffold.canRetry) {
          setPartPhase(prev => ({ ...prev, [currentPartId]: 'wrong' }))
        } else {
          setPartPhase(prev => ({ ...prev, [currentPartId]: 'wrong2' }))
        }
      } else {
        const updated = { ...partPhase, [currentPartId]: 'done' as const }
        setPartPhase(updated)
        advanceToNext(updated, result)
      }
    } finally {
      busyRef.current = false
      setSubmitting(false)
    }
  }

  const handleRetry = () => {
    if (!currentPartId) return
    setPartPhase(prev => ({ ...prev, [currentPartId]: 'retry' }))
    setPartImages(prev => ({ ...prev, [currentPartId]: [] }))
    setHasContent(false)
  }

  const handlePass = async () => {
    if (!currentPartId || busyRef.current) return
    if (stepIdx === undefined || !ctx.submit) return

    busyRef.current = true
    setSubmitting(true)
    try {
      const submitData = { partId: currentPartId, _pass: true, images: [], method: 'pass' }
      const result: SubmitResult = await ctx.submit(stepIdx, submitData)

      if (!result.ok) return

      const updated = { ...partPhase, [currentPartId]: 'done' as const }
      setPartPhase(updated)
      advanceToNext(updated, result)
    } finally {
      busyRef.current = false
      setSubmitting(false)
    }
  }

  if (parts.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--t3)' }}>No parts configured</div>
  }

  if (allPartsDone) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {prompt && (
          <div style={{ fontSize: 14, lineHeight: 1.6 }}><RenderMath text={prompt} /></div>
        )}
        <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>✓</span>所有题目已完成
        </div>
      </div>
    )
  }

  const showCanvas = phase === 'work' || phase === 'retry'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Top-level prompt */}
      {prompt && (
        <div style={{ fontSize: 14, lineHeight: 1.6 }}><RenderMath text={prompt} /></div>
      )}
      {promptImages && promptImages.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {promptImages.map((img, i) => (
            <img key={i} src={img.url} alt={img.alt || ''}
              style={{ maxWidth: 300, borderRadius: 8, border: '1px solid var(--border)' }} />
          ))}
        </div>
      )}

      {/* Part indicator */}
      {parts.length > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {parts.map((p, i) => {
            const st = partPhase[p.id] || 'work'
            const isCurrent = i === currentPartIdx
            return (
              <div
                key={p.id}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600,
                  background: st === 'done' ? 'var(--green, #22c55e)' : isCurrent ? 'var(--teal, #14b8a6)' : 'var(--bg2, #f0f0f0)',
                  color: st === 'done' || isCurrent ? '#fff' : 'var(--t3)',
                }}
              >
                {st === 'done' ? '✓' : i + 1}
              </div>
            )
          })}
          <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 4 }}>
            第 {currentPartIdx + 1} / {parts.length} 题
          </span>
        </div>
      )}

      {/* Current part prompt */}
      {currentPart?.prompt && (
        <div style={{ fontSize: 14, lineHeight: 1.7, padding: '8px 0' }}>
          <RenderMath text={currentPart.prompt} />
        </div>
      )}

      {/* Checking status card */}
      {submitting && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px', borderRadius: 10,
          background: 'rgba(109,89,214,.08)', border: '1px solid rgba(109,89,214,.15)',
          fontSize: 13, fontWeight: 500, color: '#6d59d6', marginBottom: 4,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#6d59d6',
            animation: 'rcq-pulse 1.2s infinite',
          }} />
          AI 助教正在批改…
        </div>
      )}

      {/* Wrong result card (red) — canRetry, first scaffold */}
      {phase === 'wrong' && !submitting && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '14px 18px', borderRadius: 10,
          background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(239,68,68,.12)', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, marginTop: 1,
          }}>✗</div>
          <div>
            <div style={{ fontWeight: 600, color: '#ef4444', fontSize: 13 }}>答案不正确</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2, lineHeight: 1.5 }}>{lastFeedback}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>请参考右侧提示修改后重新提交</div>
          </div>
        </div>
      )}

      {/* Wrong2 result card (amber) — last scaffold, show pass */}
      {phase === 'wrong2' && !submitting && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '14px 18px', borderRadius: 10,
          background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(245,158,11,.12)', color: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, marginTop: 1,
          }}>→</div>
          <div>
            <div style={{ fontWeight: 600, color: '#f59e0b', fontSize: 13 }}>已展示完整解答</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2, lineHeight: 1.5 }}>
              请仔细阅读右侧解题过程，理解后继续下一题。
            </div>
          </div>
        </div>
      )}

      {/* Handwriting canvas + photo unified input */}
      {showCanvas && !submitting && (
        <HandwritingCanvas
          key={currentPartId}
          ref={canvasRef}
          maxPages={Math.max(maxImages, 5)}
          onPagesChange={handlePagesChange}
          onContentStatusChange={handleContentStatusChange}
        />
      )}

      {/* Retry button */}
      {phase === 'wrong' && !submitting && (
        <button className="stu-btn pri" onClick={handleRetry}>
          修改答案，再试一次
        </button>
      )}

      {/* Pass button */}
      {phase === 'wrong2' && !submitting && (
        <button className="stu-btn pri" onClick={handlePass}>
          已理解，继续下一题 →
        </button>
      )}

      {/* Submit button — only when there is content, in work/retry phase, not submitting */}
      {hasContent && showCanvas && !submitting && (
        <button className="stu-btn pri" onClick={handleSubmit}>
          {phase === 'retry' ? '重新提交' : '提交'}
        </button>
      )}
    </div>
  )
}
