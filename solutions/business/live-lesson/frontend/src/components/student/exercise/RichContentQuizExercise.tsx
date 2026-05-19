import { useState, useContext, useCallback } from 'react'
import { SessionCtx } from '../TaskPanel'
import type { RichContentQuizPart } from '../task-data'
import type { ScaffoldHint } from '../ScaffoldPanel'
import type { SubmitResult } from '../../../hooks/useClassroom'
import { cacheSubmission } from '../../../hooks/useClassroom'
import { reportAttempt } from './gradeItemSet'
import { RenderMath } from '../../../utils/render-math'
import { ImageCaptureButton } from '../image-capture/ImageCaptureButton'
import { ImageGallery } from '../image-capture/ImageGallery'
import '../image-capture/image-capture.css'

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

  const [currentPartIdx, setCurrentPartIdx] = useState(0)
  const [partImages, setPartImages] = useState<Record<string, string[]>>({})
  const [partStatus, setPartStatus] = useState<Record<string, 'pending' | 'submitted' | 'retry' | 'done'>>({})
  const [submitting, setSubmitting] = useState(false)

  const currentPart = parts[currentPartIdx]
  const currentPartId = currentPart?.id
  const images = currentPartId ? (partImages[currentPartId] || []) : []
  const status = currentPartId ? (partStatus[currentPartId] || 'pending') : 'pending'
  const allPartsDone = parts.length > 0 && parts.every(p => partStatus[p.id] === 'done')

  const handleCapture = useCallback((dataUri: string) => {
    if (!currentPartId) return
    const partMax = maxImages
    if (partMax === 1) {
      setPartImages(prev => ({ ...prev, [currentPartId]: [dataUri] }))
    } else {
      setPartImages(prev => {
        const cur = prev[currentPartId] || []
        return { ...prev, [currentPartId]: [...cur, dataUri].slice(0, partMax) }
      })
    }
  }, [currentPartId, maxImages])

  const handleRemove = useCallback((index: number) => {
    if (!currentPartId) return
    setPartImages(prev => {
      const cur = prev[currentPartId] || []
      return { ...prev, [currentPartId]: cur.filter((_, i) => i !== index) }
    })
  }, [currentPartId])

  const handleSubmit = async () => {
    if (!currentPartId || submitting || images.length === 0) return
    if (stepIdx === undefined || !ctx.submit) return

    setSubmitting(true)
    try {
      const submitData = {
        images,
        partId: currentPartId,
        method: subType || 'rich-content-quiz',
      }
      const result: SubmitResult = await ctx.submit(stepIdx, submitData)

      // Cache for page-refresh recovery
      if (ctx.sessionCode) {
        cacheSubmission(ctx.sessionCode, stepIdx, submitData, result.score ?? null)
      }

      // Track attempt for analytics
      reportAttempt(taskId ?? 0, 0, 1, submitData, null, result.ok !== false)

      if (!result.ok) return

      if (result.scaffold) {
        onScaffoldPush?.(result.scaffold)
        setPartStatus(prev => ({ ...prev, [currentPartId]: 'retry' }))
        setPartImages(prev => ({ ...prev, [currentPartId]: [] }))
      } else if (result.nextPartId) {
        setPartStatus(prev => ({ ...prev, [currentPartId]: 'done' }))
        const nextIdx = parts.findIndex(p => p.id === result.nextPartId)
        if (nextIdx >= 0) setCurrentPartIdx(nextIdx)
      } else {
        // No scaffold, no next part — compute updated status synchronously
        const updatedStatus = { ...partStatus, [currentPartId]: 'done' as const }
        setPartStatus(updatedStatus)
        if (parts.every(p => updatedStatus[p.id] === 'done')) {
          onDone()
        } else {
          const nextIncomplete = parts.findIndex(p => updatedStatus[p.id] !== 'done')
          if (nextIncomplete >= 0) setCurrentPartIdx(nextIncomplete)
        }
      }
    } finally {
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
            const st = partStatus[p.id] || 'pending'
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

      {/* Image upload for current part */}
      {status !== 'done' && maxImages === 1 && (
        <div>
          {images.length > 0 ? (
            <div>
              <img src={images[0]} alt="作答"
                style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8 }} />
              <ImageCaptureButton onCapture={handleCapture} />
            </div>
          ) : (
            <ImageCaptureButton onCapture={handleCapture} />
          )}
        </div>
      )}

      {status !== 'done' && maxImages > 1 && (
        <ImageGallery
          images={images}
          maxImages={maxImages}
          onAdd={handleCapture}
          onRemove={handleRemove}
        />
      )}

      {/* Retry hint */}
      {status === 'retry' && (
        <div style={{ fontSize: 13, color: 'var(--amber, #f59e0b)', padding: '4px 0' }}>
          请查看右侧提示后重新作答
        </div>
      )}

      {/* Submit button */}
      {status !== 'done' && (
        <button
          className="stu-btn pri"
          style={(!images.length || submitting) ? { opacity: 0.35, cursor: 'default' } : undefined}
          onClick={images.length > 0 && !submitting ? handleSubmit : undefined}
        >
          {submitting ? '提交中...' : status === 'retry' ? '重新提交' : '提交'}
        </button>
      )}
    </div>
  )
}
