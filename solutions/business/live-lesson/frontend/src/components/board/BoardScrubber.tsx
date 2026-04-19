import { useMemo } from 'react'
import type { RevealPointer, BoardBlock as BlockType } from '../../types/reading'

function revealKey(r: RevealPointer) { return r.step * 1000 + r.sub }

interface Props {
  blocks: BlockType[]
  steps: { idx: number; label: string }[]
  pointer: RevealPointer
  onPointerChange: (p: RevealPointer) => void
}

export default function BoardScrubber({ blocks, steps, pointer, onPointerChange }: Props) {
  const timeline = useMemo(() => {
    const seen = new Set<number>()
    const keys: RevealPointer[] = []
    for (const b of blocks) {
      const k = revealKey(b.reveal)
      if (!seen.has(k)) { seen.add(k); keys.push(b.reveal) }
    }
    keys.sort((a, b) => revealKey(a) - revealKey(b))
    return keys
  }, [blocks])

  const byStep = useMemo(() => {
    const map: Record<number, RevealPointer[]> = {}
    for (const t of timeline) {
      (map[t.step] ??= []).push(t)
    }
    return map
  }, [timeline])

  const currentIdx = timeline.findIndex(t => t.step === pointer.step && t.sub === pointer.sub)

  function prev() {
    if (currentIdx > 0) onPointerChange(timeline[currentIdx - 1])
  }
  function next() {
    if (currentIdx < timeline.length - 1) onPointerChange(timeline[currentIdx + 1])
  }
  function reset() { onPointerChange(timeline[0]) }
  function revealAll() { onPointerChange(timeline[timeline.length - 1]) }

  const stepNums = Object.keys(byStep).map(Number).sort((a, b) => a - b)

  return (
    <div className="scrub">
      <div className="scrub-label">{'\u63ED\u793A\u8FDB\u5EA6'}</div>
      <div className="scrub-steps">
        {stepNums.map((stepNum, si) => {
          const stepDef = steps.find(s => s.idx === stepNum)
          return (
            <div key={stepNum} style={{ display: 'contents' }}>
              <div className="scrub-step" title={`Step ${stepNum} \u00B7 ${stepDef?.label || '?'}`}>
                <span className="scrub-step-num">{stepNum}.</span>
                <div className="scrub-dots">
                  {byStep[stepNum].map(t => {
                    const k = revealKey(t)
                    const pk = revealKey(pointer)
                    let cls = 'scrub-dot'
                    if (k < pk) cls += ' done'
                    if (k === pk) cls += ' cur'
                    return (
                      <div
                        key={k}
                        className={cls}
                        onClick={() => onPointerChange(t)}
                      >
                        {t.sub}
                      </div>
                    )
                  })}
                </div>
              </div>
              {si < stepNums.length - 1 && <span className="scrub-divider">{'\u00B7'}</span>}
            </div>
          )
        })}
      </div>
      <div className="scrub-pos">
        {pointer.step}.{pointer.sub} ({currentIdx + 1}/{timeline.length})
      </div>
      <div className="scrub-ctrls">
        <button className="scrub-btn" onClick={prev}>{'\u2039 \u4E0A\u4E00'}</button>
        <button className="scrub-btn pri" onClick={next}>{'\u4E0B\u4E00 \u203A'}</button>
        <button className="scrub-btn" onClick={reset}>{'\u21BA \u91CD\u7F6E'}</button>
        <button className="scrub-btn" onClick={revealAll}>{'\u5168\u90E8\u5C55\u793A'}</button>
      </div>
    </div>
  )
}
