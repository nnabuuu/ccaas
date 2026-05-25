import TextPanel, { type TextOverlay } from '../../components/student/TextPanel'
import BoardInline from '../../components/student/BoardInline'
import { renderMd, renderHtmlWithMath } from '../../components/student/renderMd'
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

  const stepDef = findStep(manifest, spec.step)

  // Article wins only if the current step is reading-oriented (has
  // focusParagraphs or is explicitly typed 'reading'). A math lesson that
  // happens to ship an article block elsewhere shouldn't hide its board /
  // studentView under it.
  const stepUsesArticle = !!stepDef && (
    (Array.isArray(stepDef.focusParagraphs) && stepDef.focusParagraphs.length > 0)
      || stepDef.type === 'reading'
      || manifest?.lessonType === 'reading'
  )

  if (
    stepUsesArticle
    && article
    && Array.isArray(article.paragraphs)
    && article.paragraphs.length > 0
  ) {
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

  if (stepDef?.studentView) {
    return <InstructionPanel sv={stepDef.studentView} />
  }

  return null
}

/** Predicate the layout uses to decide whether to allocate a 2nd grid column.
 *  Must match the dispatch in <RightPanel> exactly — keep them in sync. */
export function hasRightPanelContent(spec: ExerciseSpec): boolean {
  const manifest = spec.manifest as any
  const stepDef = findStep(manifest, spec.step)
  const article = manifest?.article
  const stepUsesArticle = !!stepDef && (
    (Array.isArray(stepDef.focusParagraphs) && stepDef.focusParagraphs.length > 0)
      || stepDef.type === 'reading'
      || manifest?.lessonType === 'reading'
  )
  if (stepUsesArticle && article && Array.isArray(article.paragraphs) && article.paragraphs.length > 0) return true
  if (manifest?.boardData?.blocks?.some?.((b: any) => b?.reveal?.step === spec.step)) return true
  if (stepDef?.studentView) return true
  return false
}

/** Returns the readingStep config for the current step. */
function findStep(manifest: any, step: number): any | null {
  const steps = manifest?.readingSteps ?? []
  return steps.find((s: any) => s?.idx === step) ?? null
}

/** Maps step.focusParagraphs into the TextPanel `focusIds` prop.
 *  focusParagraphs entries already start with "p" (e.g. ["p1","p2"]) —
 *  pass through as strings. Earlier this added another "p" prefix and
 *  produced "pp1" which never matched TextPanel's data-para lookup. */
function getFocusIds(spec: ExerciseSpec): string[] {
  const fp = findStep(spec.manifest, spec.step)?.focusParagraphs
  if (!Array.isArray(fp)) return []
  return fp.map((p: unknown) => String(p))
}

function InstructionPanel({ sv }: { sv: { title?: string; body?: string; keyPoints?: string[] } }) {
  // Mirrors production TaskPanel.tsx:73-79:
  //   title / keyPoints → renderMd (markdown-lite + inline katex, returns JSX)
  //   body              → renderHtmlWithMath + dangerouslySetInnerHTML
  //                       (body contains real HTML like <p>, <strong>,
  //                       <span class="hl">, especially in reading lessons —
  //                       renderMd has no HTML parser and would print tags
  //                       as literal text)
  return (
    <div className="stu-instr-card" style={{ margin: '24px 28px', padding: 20, overflow: 'auto', maxHeight: 'calc(100% - 48px)' }}>
      {sv.title && (
        <div className="stu-instr-title" style={{ marginBottom: 12 }}>
          {renderMd(sv.title, { math: true })}
        </div>
      )}
      {sv.body && (
        <div
          className="stu-instr-body"
          dangerouslySetInnerHTML={{ __html: renderHtmlWithMath(sv.body) }}
        />
      )}
      {Array.isArray(sv.keyPoints) && sv.keyPoints.length > 0 && (
        <div className="stu-instr-kp">
          <ul>
            {sv.keyPoints.map((k, i) => <li key={i}>{renderMd(k, { math: true })}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
