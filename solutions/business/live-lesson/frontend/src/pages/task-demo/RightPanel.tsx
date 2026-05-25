import TextPanel, { type TextOverlay } from '../../components/student/TextPanel'
import BoardInline from '../../components/student/BoardInline'
import { renderMd } from '../../components/student/renderMd'
import type { ExerciseSpec } from './useTaskDemoApi'

/**
 * RightPanel — picks which production right-panel surface to render based
 * on what the (sanitized) lesson manifest carries.
 *
 * Priority (loosely mirrors StudentShell's `rightMode` dispatch):
 *   1. `manifest.article` → TextPanel — most reading-comp lessons
 *   2. `manifest.boardData` w/ blocks for this step → BoardInline — math
 *      lessons where the "blackboard" is the primary visual.
 *   3. studentView only → InstructionPanel — listen-phase intro text
 *   4. fallback: nothing
 *
 * The exercise's `onOverlayChange` is wired up so select-evidence's token
 * picks light up the matching text in the article.
 */
export function RightPanel({
  spec,
  overlay,
}: {
  spec: ExerciseSpec
  overlay: TextOverlay | null
}) {
  const manifest = spec.manifest as any
  const article = manifest?.article
  const boardData = manifest?.boardData

  if (article && Array.isArray(article.paragraphs) && article.paragraphs.length > 0) {
    return (
      <TextPanel
        title={article.title}
        paragraphs={article.paragraphs}
        focusIds={getFocusIds(spec)}
        lessonId={spec.lessonId}
        overlay={overlay}
        locale="zh"
      />
    )
  }

  if (boardData?.blocks?.some?.((b: any) => b?.reveal?.step === spec.step)) {
    return (
      <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%' }}>
        <BoardInline taskId={spec.step} boardData={boardData} />
      </div>
    )
  }

  const studentView = findStep(manifest, spec.step)?.studentView
  if (studentView) {
    return <InstructionPanel sv={studentView} />
  }

  return null
}

/** Returns the readingStep config for the current step. */
function findStep(manifest: any, step: number): any | null {
  const steps = manifest?.readingSteps ?? []
  return steps.find((s: any) => s?.idx === step) ?? null
}

/** Maps step.focusParagraphs into the TextPanel `focusIds` prop. */
function getFocusIds(spec: ExerciseSpec): string[] {
  const fp = findStep(spec.manifest, spec.step)?.focusParagraphs
  if (!Array.isArray(fp)) return []
  return fp.map((p: unknown) => `p${String(p)}`)
}

function InstructionPanel({ sv }: { sv: { title?: string; body?: string; keyPoints?: string[] } }) {
  // renderMd returns JSX (array of React nodes), NOT an HTML string —
  // it walks each line and produces <span>/<strong>/KaTeX nodes inline.
  return (
    <div
      style={{
        padding: '24px 28px',
        overflow: 'auto',
        height: '100%',
        fontSize: 14,
        lineHeight: 1.7,
        color: 'var(--t1, #1c1c1a)',
      }}
    >
      {sv.title && (
        <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 18, margin: '0 0 14px' }}>
          {renderMd(sv.title, { math: true })}
        </h3>
      )}
      {sv.body && <div style={{ marginBottom: 12 }}>{renderMd(sv.body, { math: true })}</div>}
      {Array.isArray(sv.keyPoints) && sv.keyPoints.length > 0 && (
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {sv.keyPoints.map((k, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {renderMd(k, { math: true })}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
