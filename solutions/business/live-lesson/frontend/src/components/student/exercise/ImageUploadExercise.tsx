import { useState, useRef } from 'react'
import { RenderMath } from '../../../utils/render-math'
import { compressImage } from '../../../utils/compress-image'

interface RubricItem { id: string; label: string; weight: number }
interface PromptImage { url: string; alt?: string }

export function ImageUploadExercise({
  prompt, promptImages, rubric,
  ans, setAns, allDone, feedback, rubricResults,
}: {
  prompt: string
  promptImages?: PromptImage[]
  rubric: RubricItem[]
  ans: Record<string, string | string[]>
  setAns: (updater: (prev: Record<string, string | string[]>) => Record<string, string | string[]>) => void
  allDone: boolean
  feedback?: string | null
  rubricResults?: Record<string, { score: number; hint?: string }>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>((ans.images || []) as string[])
  const [compressing, setCompressing] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setCompressing(true)
    try {
      const compressed = await compressImage(files[0])
      const newImages = [compressed]
      setPreviews(newImages)
      setAns(prev => ({ ...prev, images: newImages }))
    } finally {
      setCompressing(false)
    }
  }

  const isPendingReview = rubricResults && Object.values(rubricResults).some(r => r.score === -1)

  const scoreLabel = (score: number) => {
    if (score === 3) return { text: '\u4F18\u79C0', color: '#22c55e' }
    if (score === 2) return { text: '\u826F\u597D', color: '#3b82f6' }
    if (score === 1) return { text: '\u57FA\u672C', color: '#f59e0b' }
    return { text: '\u7F3A\u5931', color: '#ef4444' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Prompt */}
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
        <RenderMath text={prompt} />
      </div>

      {/* Prompt images */}
      {promptImages && promptImages.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {promptImages.map((img, i) => (
            <img key={i} src={img.url} alt={img.alt || ''}
              style={{ maxWidth: 300, borderRadius: 8, border: '1px solid var(--border)' }} />
          ))}
        </div>
      )}

      {/* Upload area */}
      {!allDone && (
        <div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            onChange={handleFile} style={{ display: 'none' }} />
          <button className="stu-btn sec" onClick={() => fileRef.current?.click()}
            disabled={compressing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {compressing ? '\u538B\u7F29\u4E2D...' : previews.length > 0 ? '\u91CD\u65B0\u62CD\u7167' : '\uD83D\uDCF7 \u62CD\u7167/\u4E0A\u4F20'}
          </button>
        </div>
      )}

      {/* Preview */}
      {previews.length > 0 && (
        <div>
          <img src={previews[0]} alt="\u4F5C\u7B54"
            style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid var(--border)' }} />
        </div>
      )}

      {/* Results */}
      {allDone && isPendingReview && (
        <div style={{ padding: '12px 16px', background: '#fef3c7', borderRadius: 8, fontSize: 13 }}>
          AI \u6682\u65F6\u65E0\u6CD5\u6279\u9605\uFF0C\u5DF2\u63D0\u4EA4\u7ED9\u8001\u5E08\u5BA1\u9605
        </div>
      )}

      {allDone && rubricResults && !isPendingReview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rubric.map(r => {
            const result = rubricResults[r.id]
            if (!result) return null
            const sl = scoreLabel(result.score)
            return (
              <div key={r.id} style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>{r.label}</span>
                  <span style={{ color: sl.color, fontWeight: 600 }}>{result.score}/3 {sl.text}</span>
                </div>
                {result.hint && <div style={{ color: 'var(--t3)', marginTop: 4 }}>{result.hint}</div>}
              </div>
            )
          })}
          {feedback && (
            <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{'\u603B\u8BC4'}</div>
              <div style={{ color: 'var(--t2)' }}>{feedback}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
