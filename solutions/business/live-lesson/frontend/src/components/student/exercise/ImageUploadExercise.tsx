import { RenderMath } from '../../../utils/render-math'
import { ImageCaptureButton } from '../image-capture/ImageCaptureButton'
import { ImageGallery } from '../image-capture/ImageGallery'
import { useReviewRestore, type ReviewData } from '../../../hooks/useReviewRestore'
import '../image-capture/image-capture.css'

interface RubricItem { id: string; label: string; weight: number }
interface PromptImage { url: string; alt?: string }

export function parseImageUploadReview(review: ReviewData) {
  const { data, checkItems } = review
  const ans = { images: data.images || [] }
  let feedback: string | null = null
  const rubricResults: Record<string, { score: number; hint?: string }> = {}
  checkItems?.forEach(it => {
    if (it.idx === '_llm') { feedback = it.hint ?? null; return }
    rubricResults[it.idx as string] = { score: it.score ?? 0, hint: it.hint }
  })
  return { state: { ans, feedback, rubricResults }, allDone: true }
}

export function ImageUploadExercise({
  prompt, promptImages, rubric, maxImages = 1,
  ans, setAns, allDone, feedback, rubricResults, reviewData,
}: {
  prompt: string
  promptImages?: PromptImage[]
  rubric: RubricItem[]
  maxImages?: number
  ans: Record<string, string | string[]>
  setAns: (updater: (prev: Record<string, string | string[]>) => Record<string, string | string[]>) => void
  allDone: boolean
  feedback?: string | null
  rubricResults?: Record<string, { score: number; hint?: string }>
  reviewData?: ReviewData
}) {
  const restored = useReviewRestore(reviewData, parseImageUploadReview)
  const effectiveAns = restored?.ans ?? ans
  const effectiveFeedback = restored?.feedback ?? feedback
  const effectiveRubricResults = restored?.rubricResults ?? rubricResults
  const effectiveAllDone = restored ? true : allDone

  // Single source of truth: derive from ans
  const images = (effectiveAns.images || []) as string[]

  const handleCapture = (dataUri: string) => {
    if (maxImages === 1) {
      setAns(prev => ({ ...prev, images: [dataUri] }))
    } else {
      setAns(prev => {
        const current = (prev.images || []) as string[]
        return { ...prev, images: [...current, dataUri].slice(0, maxImages) }
      })
    }
  }

  const handleRemove = (index: number) => {
    setAns(prev => {
      const current = (prev.images || []) as string[]
      return { ...prev, images: current.filter((_, i) => i !== index) }
    })
  }

  const isPendingReview = effectiveRubricResults && Object.values(effectiveRubricResults).some(r => r.score === -1)

  const scoreLabel = (score: number) => {
    if (score === 3) return { text: '优秀', color: '#22c55e' }
    if (score === 2) return { text: '良好', color: '#3b82f6' }
    if (score === 1) return { text: '基本', color: '#f59e0b' }
    return { text: '缺失', color: '#ef4444' }
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

      {/* Upload / Gallery */}
      {!effectiveAllDone && maxImages === 1 && (
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

      {!effectiveAllDone && maxImages > 1 && (
        <ImageGallery
          images={images}
          maxImages={maxImages}
          onAdd={handleCapture}
          onRemove={handleRemove}
        />
      )}

      {/* Single-image preview when done */}
      {effectiveAllDone && maxImages === 1 && images.length > 0 && (
        <div>
          <img src={images[0]} alt="作答"
            style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid var(--border)' }} />
        </div>
      )}

      {/* Multi-image preview when done */}
      {effectiveAllDone && maxImages > 1 && images.length > 0 && (
        <ImageGallery
          images={images}
          maxImages={maxImages}
          onAdd={() => {}}
          onRemove={() => {}}
          disabled
        />
      )}

      {/* Results */}
      {effectiveAllDone && isPendingReview && (
        <div style={{ padding: '12px 16px', background: '#fef3c7', borderRadius: 8, fontSize: 13 }}>
          AI 暂时无法批阅，已提交给老师审阅
        </div>
      )}

      {effectiveAllDone && effectiveRubricResults && !isPendingReview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rubric.map(r => {
            const result = effectiveRubricResults[r.id]
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
          {effectiveFeedback && (
            <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{'总评'}</div>
              <div style={{ color: 'var(--t2)' }}>{effectiveFeedback}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
