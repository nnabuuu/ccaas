import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import type { DemoConfig, DemoMapping, DemoSolutionLine } from '../task-data'
import './example-demo.css'

/** Compute stage thresholds from config steps. Stage 0 is always idle. */
function computeStageLayout(steps: DemoConfig['steps']) {
  const stepStart: number[] = []
  let cursor = 1 // stage 0 is idle
  for (const step of steps) {
    stepStart.push(cursor)
    if (step.solutionLines) cursor += step.solutionLines.length
    else if (step.mapping) cursor += 2
    else cursor += 1 // description
  }
  return { stepStart, totalStages: cursor }
}

export interface ExampleDemoCardProps {
  config: DemoConfig
  onDone: () => void
  /** Skip animation and show final state (e.g. on revisit) */
  skipAnimation?: boolean
  /** Label for the primary action button; defaults to "我来练习" */
  confirmLabel?: string
}

export default function ExampleDemoCard({ config, onDone, skipAnimation = false, confirmLabel }: ExampleDemoCardProps) {
  const { stepStart, totalStages } = useMemo(() => computeStageLayout(config.steps), [config.steps])
  const [stage, setStage] = useState(skipAnimation ? totalStages - 1 : 0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const delays = config.delays

  // Auto-advance stages
  useEffect(() => {
    if (stage >= totalStages - 1) return
    timerRef.current = setTimeout(() => setStage(s => s + 1), delays[stage] ?? 1200)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [stage, delays, totalStages])

  const replay = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setStage(0)
  }

  const mappingIdx = config.steps.findIndex(s => !!s.mapping)
  const mappingTokens = mappingIdx >= 0 ? config.steps[mappingIdx].mapping!.tokens : undefined

  // Which step is currently active (for header badge)
  const activeStepIdx = useMemo(() => {
    for (let i = stepStart.length - 1; i >= 0; i--) {
      if (stage >= stepStart[i]) return i
    }
    return -1
  }, [stage, stepStart])

  return (
    <div className="demo-card">
      <ExpressionCard
        expression={config.expression}
        tokens={mappingTokens}
        sameStage={mappingIdx >= 0 ? stepStart[mappingIdx] : -1}
        oppStage={mappingIdx >= 0 ? stepStart[mappingIdx] + 1 : -1}
        stage={stage}
      />

      <div className="demo-walkthrough">
        <div className="demo-hd">
          <span className="demo-avatar">✦</span>
          <span className="demo-title">AI 示范解题</span>
          {activeStepIdx >= 0 && (
            <span className="demo-stage">{activeStepIdx + 1}/{config.steps.length}</span>
          )}
        </div>

        <div className="demo-body">
          <div className="demo-steps">
            {config.steps.map((step, i) => {
              const start = stepStart[i]
              const isVis = stage >= start
              const isActive = isVis && (i === config.steps.length - 1 || stage < stepStart[i + 1])
              const cls = 'demo-step' + (isVis ? ' vis' : '') + (isActive ? ' active' : '')

              return (
                <div key={step.id} className={cls}>
                  <span className="demo-step-tag">{step.label}</span>
                  <div className="demo-step-body">
                    {step.mapping ? (
                      <DemoMap mapping={step.mapping} localStage={stage - start} />
                    ) : step.solutionLines ? (
                      <DemoSolution lines={step.solutionLines} localStage={stage - start} />
                    ) : step.description ? (
                      <span className="demo-step-desc">{step.description}</span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <div className={'demo-actions' + (stage >= totalStages - 1 ? ' vis' : '')}>
            <button className="stu-btn ghost" onClick={replay} type="button">
              &#8635; 重新演示
            </button>
            <button className="stu-btn pri" onClick={onDone} type="button">
              {confirmLabel ?? '我来练习'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══ Expression Card ═══ */

function ExpressionCard({ expression, tokens, sameStage, oppStage, stage }: {
  expression: string
  tokens?: DemoMapping['tokens']
  sameStage: number
  oppStage: number
  stage: number
}) {
  const renderTokens = tokens ?? parseExpressionFallback(expression)
  const hasMapping = sameStage >= 0

  return (
    <div className="demo-expr-card">
      <div className="demo-expr-label">题目</div>
      <div className="demo-expr-tokens">
        {renderTokens.map((tok, i) => {
          const isSame = tok.type === 'same'
          const isOpp = tok.type === 'opposite'
          const hlSame = hasMapping && isSame && stage >= sameStage
          const hlOpp = hasMapping && isOpp && stage >= oppStage
          const cls = 'demo-tok'
            + (tok.type === 'op' ? ' demo-tok-op' : ' demo-tok-var')
            + (hlSame ? ' demo-hl-same' : '')
            + (hlOpp ? ' demo-hl-opp' : '')
          return (
            <span key={i} className={cls}>
              {tok.text}
              {hasMapping && isSame && <AnnotationSame visible={stage >= sameStage} />}
              {hasMapping && isOpp && <AnnotationOpp visible={stage >= oppStage} />}
            </span>
          )
        })}
      </div>
      {hasMapping && (
        <div className="demo-legend">
          <span className={'demo-legend-chip same' + (stage >= sameStage ? ' vis' : '')}>
            相同项
          </span>
          <span className={'demo-legend-chip opp' + (stage >= oppStage ? ' vis' : '')}>
            相反项
          </span>
        </div>
      )}
    </div>
  )
}

function AnnotationSame({ visible }: { visible: boolean }) {
  return (
    <span className="demo-ann">
      <svg viewBox="0 0 40 6" preserveAspectRatio="none">
        <line x1="0" y1="1.5" x2="40" y2="1.5"
          className={'demo-ann-path demo-ann-same' + (visible ? ' vis' : '')} />
        <line x1="0" y1="4.5" x2="40" y2="4.5"
          className={'demo-ann-path demo-ann-same' + (visible ? ' vis' : '')} />
      </svg>
    </span>
  )
}

function AnnotationOpp({ visible }: { visible: boolean }) {
  return (
    <span className="demo-ann">
      <svg viewBox="0 0 40 6" preserveAspectRatio="none">
        <path d="M0 3 Q5 0 10 3 Q15 6 20 3 Q25 0 30 3 Q35 6 40 3"
          className={'demo-ann-path demo-ann-opp' + (visible ? ' vis' : '')} />
      </svg>
    </span>
  )
}

/* ═══ DemoMap — upper/lower token grid with bridges ═══ */

function DemoMap({ mapping, localStage }: { mapping: DemoMapping; localStage: number }) {
  const { tokens, formulaTokens, sameTerm, oppositeTerm } = mapping
  const colCount = tokens.length
  const showSameTerms = localStage >= 0
  const showOppTerms = localStage >= 1

  return (
    <div className="demo-map">
      <div
        className="demo-map-grid"
        style={{ gridTemplateColumns: `repeat(${colCount}, auto)` }}
      >
        {/* Row 1: expression tokens */}
        {tokens.map((tok, i) => {
          const isSame = tok.type === 'same'
          const isOpp = tok.type === 'opposite'
          const showSame = isSame && showSameTerms
          const showOpp = isOpp && showOppTerms
          const vis = showSameTerms
          return (
            <span
              key={`t${i}`}
              className={
                'demo-map-cell'
                + (vis ? ' vis' : '')
                + (tok.type === 'op' ? ' demo-map-op' : tok.type ? ' demo-map-var' : ' demo-map-paren')
                + (showSame ? ' demo-hl-same' : '')
                + (showOpp ? ' demo-hl-opp' : '')
              }
            >
              {tok.text}
            </span>
          )
        })}

        {/* Row 2: bridge connectors */}
        {tokens.map((tok, i) => {
          const isSame = tok.type === 'same'
          const isOpp = tok.type === 'opposite'
          const showBridge = (isSame && showSameTerms) || (isOpp && showOppTerms)
          if (!isSame && !isOpp) {
            return <span key={`b${i}`} className="demo-map-bridge" />
          }
          return (
            <span
              key={`b${i}`}
              className={
                'demo-map-bridge'
                + (showBridge ? ' vis' : '')
                + (isOpp ? ' opp' : '')
              }
            />
          )
        })}

        {/* Row 3: formula tokens */}
        {formulaTokens.map((tok, i) => {
          const isSame = tok.type === 'same'
          const isOpp = tok.type === 'opposite'
          const showSame = isSame && showSameTerms
          const showOpp = isOpp && showOppTerms
          const vis = showSame || showOpp || (showSameTerms && !isSame && !isOpp)
          return (
            <span
              key={`f${i}`}
              className={
                'demo-map-cell'
                + (vis ? ' vis' : '')
                + (tok.type === 'op' ? ' demo-map-op' : tok.type ? ' demo-map-var' : ' demo-map-paren')
                + (showSame ? ' demo-hl-same' : '')
                + (showOpp ? ' demo-hl-opp' : '')
              }
            >
              {tok.text}
            </span>
          )
        })}
      </div>

      <div className="demo-map-legend">
        <span className={'demo-map-legend-item' + (showSameTerms ? ' vis' : '')}>
          <span className="demo-ref-same">{sameTerm.symbol}</span> ↔ <span className="demo-ref-same">{sameTerm.mapsTo}</span>
        </span>
        <span className={'demo-map-legend-item' + (showOppTerms ? ' vis' : '')}>
          <span className="demo-ref-opp">{oppositeTerm.symbol}</span> ↔ <span className="demo-ref-opp">{oppositeTerm.mapsTo}</span>
        </span>
      </div>
    </div>
  )
}

/* ═══ DemoSolution — aligned solution lines ═══ */

function DemoSolution({ lines, localStage }: { lines: DemoSolutionLine[]; localStage: number }) {
  const visibleCount = Math.max(0, localStage + 1)

  return (
    <div className="demo-solution">
      {lines.map((line, i) => {
        const vis = i < visibleCount
        return (
          <Fragment key={i}>
            <span className={'demo-sol-cell demo-sol-prefix' + (vis ? ' vis' : '')}>
              {line.prefix}
            </span>
            <span className={'demo-sol-cell demo-sol-eq' + (vis ? ' vis' : '')}>
              {i === 0 ? '' : '='}
            </span>
            <span className={
              'demo-sol-cell' + (vis ? ' vis' : '') + (line.isFinal ? ' demo-sol-final' : '')
            }>
              {line.math}
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}

function parseExpressionFallback(expr: string): Array<{ text: string; type?: 'same' | 'opposite' | 'op' }> {
  return [{ text: expr }]
}
