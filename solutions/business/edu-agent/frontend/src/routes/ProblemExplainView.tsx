import { useState, useEffect } from 'react'
import { Play } from 'lucide-react'
import { useOutputSync, type OutputUpdate } from '@kedge-agentic/react-sdk'
import { useSessionContext } from '../context/SessionContext'
import type { Explanation } from '../types/problem-explain'

const emptyExplanation: Explanation = {
  keyKnowledge: [],
  solutionSteps: [],
  commonMistakes: [],
  relatedProblems: [],
}

export function ProblemExplainView() {
  const { chat, registerOutputHandler } = useSessionContext()
  const [problemText, setProblemText] = useState('')
  const [explanation, setExplanation] = useState<Explanation>(emptyExplanation)

  const sync = useOutputSync<Explanation>({ mode: 'auto' })

  useEffect(() => {
    return registerOutputHandler((update: OutputUpdate) => {
      if (update.field === '__navigation__') return
      sync.handleOutputUpdate(update)
      setExplanation(prev => ({
        ...prev,
        [update.field]: update.value,
      }))
    })
  }, [registerOutputHandler, sync.handleOutputUpdate])

  const handleStartExplain = async () => {
    if (!problemText.trim()) return
    try {
      await chat.sendMessage(`请讲解这道题：\n\n${problemText}`)
    } catch (err) {
      console.error('Failed to start explanation:', err)
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Problem input */}
      <section>
        <h2 className="label mb-2">题目输入</h2>
        <textarea
          value={problemText}
          onChange={(e) => setProblemText(e.target.value)}
          placeholder="输入题目内容，或粘贴题目文本..."
          rows={4}
          className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-surface outline-none resize-none transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent/10"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleStartExplain}
            disabled={!problemText.trim() || chat.isProcessing}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-problem text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity duration-150 cursor-pointer"
          >
            <Play size={14} strokeWidth={2} />
            开始讲解
          </button>
        </div>
      </section>

      {/* Explanation results */}
      {explanation.problemAnalysis && (
        <ExplanationSection title="题目分析" color="problem">
          <p className="text-sm">{explanation.problemAnalysis}</p>
        </ExplanationSection>
      )}

      {explanation.keyKnowledge.length > 0 && (
        <ExplanationSection title="核心知识点" color="problem">
          <div className="flex flex-wrap gap-2">
            {explanation.keyKnowledge.map((k, i) => (
              <span key={i} className="px-2.5 py-1 text-xs rounded-pill bg-problem-light text-problem font-medium">
                {k}
              </span>
            ))}
          </div>
        </ExplanationSection>
      )}

      {explanation.solutionSteps.length > 0 && (
        <ExplanationSection title="解题步骤" color="problem">
          <div className="space-y-3">
            {explanation.solutionSteps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-problem text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="text-sm">
                  {typeof step === 'string' ? (
                    <p>{step}</p>
                  ) : (
                    <>
                      <p className="font-medium">{step.description}</p>
                      {step.explanation && <p className="text-ink-secondary mt-0.5">{step.explanation}</p>}
                      {step.formula && <code className="block mt-1 text-xs font-mono bg-surface-tertiary px-2 py-1 rounded">{step.formula}</code>}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ExplanationSection>
      )}

      {explanation.answer && (
        <ExplanationSection title="最终答案" color="success">
          <p className="text-sm font-medium">{explanation.answer}</p>
        </ExplanationSection>
      )}

      {explanation.commonMistakes.length > 0 && (
        <ExplanationSection title="易错点" color="warning">
          <ul className="space-y-1">
            {explanation.commonMistakes.map((m, i) => (
              <li key={i} className="text-sm text-ink-secondary flex gap-2">
                <span className="text-warning">!</span> {m}
              </li>
            ))}
          </ul>
        </ExplanationSection>
      )}

      {explanation.relatedProblems.length > 0 && (
        <ExplanationSection title="变式练习" color="accent">
          <div className="space-y-2">
            {explanation.relatedProblems.map((p, i) => (
              <div key={i} className="p-3 rounded-lg bg-surface-tertiary border border-border-subtle text-sm">
                {p}
              </div>
            ))}
          </div>
        </ExplanationSection>
      )}

      {explanation.difficulty != null && (
        <div className="flex items-center gap-2">
          <span className="label">难度</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(level => (
              <div
                key={level}
                className={`w-5 h-2 rounded-sm ${level <= (explanation.difficulty || 0) ? 'bg-problem' : 'bg-border'}`}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

function ExplanationSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const borderColors: Record<string, string> = {
    problem: 'border-l-problem',
    success: 'border-l-success',
    warning: 'border-l-warning',
    accent: 'border-l-accent',
  }

  return (
    <section className={`p-4 rounded-xl border border-border ${borderColors[color] || ''} border-l-2`}>
      <h3 className="label mb-3">{title}</h3>
      {children}
    </section>
  )
}
