import { useId, useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import type {
  QuestionsData,
  QuestionDef,
  RadioQuestion,
  TextQuestion,
} from '../../../types/chat-cards'

/**
 * ChatQuestionsCard — renders a `kind: 'questions'` card payload as
 * a clarification form in the chat.
 *
 * Visual contract: `design/surfaces/creator-v7-rich-chat.jsx:236-432`
 * + `creator-v7-rich-chat-doc.md` §2.
 *
 * Two render modes driven by local `submitted` state:
 *   - interactive (default): radio accordion (one question expanded
 *     at a time) + text textareas. Submit button disabled until all
 *     radio questions have an answer (text optional). Counter shows
 *     "{answered}/{total} 已选择".
 *   - submitted: card switches to compact summary view + freezes
 *     interaction. Each radio collapses to one row ("✓ {label}: {chosen}");
 *     filled text questions show the answer; empty text questions
 *     are omitted entirely.
 *
 * Submit-back flow (NEW vs prototype): the prototype only calls
 * `setSubmitted(true)`. We extend that — on submit, the card also
 * calls `onSubmit(formattedText)` so the parent can forward the
 * answers as a synthetic user message to the agent. This closes
 * the loop: agent emitted questions card → teacher answers →
 * agent receives the answers as their "next" user turn and
 * continues working.
 *
 * The card stays mounted with `submitted=true` regardless of
 * whether the parent does anything with `onSubmit` — local-only
 * "I've answered" state is the user's signal that their input was
 * captured even if the chat hook is down.
 */

interface Props {
  data: QuestionsData
  /**
   * Fires once when the user clicks "确认选择". Receives the
   * pre-formatted answer text ready to send to the agent. Parent
   * (AiPanel) typically pipes this into the chat hook's send().
   *
   * Return contract:
   *   - `true` (or undefined / void): send succeeded; card freezes
   *     to its "✓ 已确认" submitted state.
   *   - `false`: send was silently guarded (chat mid-stream, etc.).
   *     Card does NOT freeze; user can retry. Without this the card
   *     would lie ("✓ 已确认") while the agent never got the
   *     answers — see prior CRITICAL review finding.
   */
  onSubmit?: (formattedText: string) => boolean | void
}

export default function ChatQuestionsCard({ data, onSubmit }: Props) {
  // Per-question answer map. Radio default values seed at mount;
  // text questions start empty. After submit, this map is frozen
  // (setAnswer no-ops) so the summary view renders deterministic
  // content even on re-render.
  //
  // useState initializer runs ONCE per component instance — if a
  // future refactor reuses the same instance across different
  // `data` payloads (today impossible: cards are keyed by stable
  // message id in AiPanel, so React always mounts fresh), defaults
  // wouldn't re-seed on data change. Worth flagging here so a
  // future regression can spot the implicit invariant.
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const q of data.items) {
      if (q.type === 'radio' && q.defaultValue) init[q.id] = q.defaultValue
      if (q.type === 'text') init[q.id] = ''
    }
    return init
  })
  const [submitted, setSubmitted] = useState(false)
  const [expandedQId, setExpandedQId] = useState<string | null>(null)
  const headerId = useId()

  const setAnswer = (qId: string, val: string) => {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [qId]: val }))
  }

  // Radio questions must all be answered to submit; text questions
  // are optional (chat-doc §2.5 contract). Items are <= ~10 in
  // practice, so the inline filter is cheap and clearer than memo.
  const radios = data.items.filter(
    (q): q is RadioQuestion => q.type === 'radio',
  )
  const radioCount = radios.length
  const answeredRadios = radios.filter((q) => answers[q.id]).length
  const canSubmit = answeredRadios === radioCount

  const handleSubmit = () => {
    if (submitted || !canSubmit) return
    // Call onSubmit FIRST so we know whether the send went through
    // before we freeze. If it returns `false` (chat is mid-stream
    // and dropped the send), we leave the card unfrozen so the
    // user can retry once the agent is idle.
    const result = onSubmit
      ? onSubmit(formatAnswersForAgent(data, answers))
      : true
    if (result === false) return
    setSubmitted(true)
  }

  return (
    <div
      className="self-start w-full max-w-[95%]"
      data-card-kind="questions"
      data-testid="chat-questions-card"
    >
      {/* Above-card label (purple ?) */}
      <div className="flex items-center gap-1 mb-1">
        <span className="w-3.5 h-3.5 rounded bg-purple-600 text-white flex items-center justify-center">
          <HelpCircle size={8} strokeWidth={3} />
        </span>
        <span className="text-[9px] font-semibold text-purple-700">
          AI 助手 · 需要确认
        </span>
      </div>

      <div
        className={`rounded-[10px] overflow-hidden bg-white border ${submitted ? 'border-gray-200' : 'border-purple-200'}`}
      >
        {/* Header */}
        <div
          id={headerId}
          className={`px-3.5 py-2.5 border-b border-gray-200 ${submitted ? 'bg-green-50' : 'bg-purple-50'}`}
        >
          <div
            className={`text-xs font-semibold ${submitted ? 'text-green-700' : 'text-gray-900'}`}
          >
            {submitted ? '✓ 已确认' : data.title}
          </div>
          {data.subtitle && !submitted && (
            <div className="text-[10px] text-gray-600 mt-0.5 leading-relaxed">
              {data.subtitle}
            </div>
          )}
        </div>

        {/* Questions */}
        <div className={submitted ? 'py-1 px-2.5' : 'py-1.5 px-2.5'}>
          {data.items.map((q, qi) => (
            <QuestionRow
              key={q.id}
              question={q}
              answer={answers[q.id]}
              onAnswer={(val) => setAnswer(q.id, val)}
              submitted={submitted}
              indexLabel={qi + 1}
              expanded={expandedQId === q.id}
              onToggle={() =>
                setExpandedQId(expandedQId === q.id ? null : q.id)
              }
            />
          ))}
        </div>

        {/* Submit bar (hidden after submit) */}
        {!submitted && (
          <div className="px-3.5 py-2 pb-3 border-t border-gray-200 flex items-center gap-2">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={`px-4 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                canSubmit
                  ? 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-default'
              }`}
              aria-controls={headerId}
            >
              确认选择
            </button>
            <span className="text-[9px] text-gray-400">
              {answeredRadios}/{radioCount} 已选择
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pre-formatted answer text for the agent ──────────────────────────

/**
 * Build the user-message text that gets sent back to the agent when
 * the teacher submits. Format is deliberately readable + structured —
 * the agent can pattern-match per-question lines on the next turn.
 *
 * Format: `- [{q.id}] {q.label}: {value}`. The `[id]` prefix lets
 * the agent disambiguate when labels repeat across cards or contain
 * `:` (without it, regex parsing on the prose form is fragile —
 * raised as a review warning when shipping Phase 3c).
 *
 * Skips: empty-text answers (the chat-doc says text questions are
 * optional, no need to send "(empty)"). Always includes all radios
 * since they're required to submit.
 */
export function formatAnswersForAgent(
  data: QuestionsData,
  answers: Record<string, string>,
): string {
  const lines: string[] = ['已确认以下选择:']
  for (const q of data.items) {
    const a = answers[q.id]
    if (q.type === 'radio') {
      const chosen = q.options.find((o) => o.value === a)
      const label = chosen?.label ?? a ?? '(未选)'
      lines.push(`- [${q.id}] ${q.label}: ${label}`)
    } else if (q.type === 'text' && a && a.trim()) {
      lines.push(`- [${q.id}] ${q.label}: ${a.trim()}`)
    }
  }
  return lines.join('\n')
}

// ── Single question row (private) ────────────────────────────────────

interface RowProps {
  question: QuestionDef
  answer: string | undefined
  onAnswer: (val: string) => void
  submitted: boolean
  indexLabel: number
  expanded: boolean
  onToggle: () => void
}

function QuestionRow(props: RowProps) {
  return props.question.type === 'radio' ? (
    <RadioRow {...(props as RowProps & { question: RadioQuestion })} />
  ) : (
    <TextRow {...(props as RowProps & { question: TextQuestion })} />
  )
}

// ── Radio row ────────────────────────────────────────────────────────

interface RadioRowProps extends RowProps {
  question: RadioQuestion
}

function RadioRow({
  question: q,
  answer,
  onAnswer,
  submitted,
  indexLabel,
  expanded,
  onToggle,
}: RadioRowProps) {
  // Submitted: compact summary row.
  if (submitted) {
    const chosen = q.options.find((o) => o.value === answer)
    return (
      <div
        className="flex items-center gap-2 px-1.5 py-1.5"
        data-testid={`questions-summary-${q.id}`}
      >
        <span className="text-[9px] font-bold text-green-600 w-3.5 text-center">
          ✓
        </span>
        <span className="text-[10px] text-gray-600 flex-1 min-w-0 truncate">
          {q.label}
        </span>
        <span className="text-[10px] font-semibold text-gray-900 flex-shrink-0">
          {chosen?.label || answer || '(未选)'}
        </span>
      </div>
    )
  }

  // Interactive: accordion header + (when expanded) options grid.
  const selectedOption = q.options.find((o) => o.value === answer)
  return (
    <div className="mb-2" data-testid={`questions-radio-${q.id}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-1.5 py-1.5 rounded-md hover:bg-gray-50 text-left transition-colors"
        aria-expanded={expanded}
      >
        <span
          className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${answer ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}
        >
          {indexLabel}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-gray-900 truncate">
            {q.label}
          </div>
        </div>
        {selectedOption && (
          <span className="text-[9px] font-semibold text-purple-700 px-1.5 py-0.5 rounded bg-purple-50 flex-shrink-0 truncate max-w-[40%]">
            {selectedOption.label}
          </span>
        )}
        <ChevronDown
          size={10}
          className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>

      {expanded && (
        <div className="pl-6 pr-0 py-0.5">
          {q.desc && (
            <div className="text-[10px] text-gray-400 mb-1.5 leading-relaxed">
              {q.desc}
            </div>
          )}
          <div className="flex flex-col gap-1" role="radiogroup" aria-label={q.label}>
            {q.options.map((opt) => {
              const sel = answer === opt.value
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => onAnswer(opt.value)}
                  role="radio"
                  aria-checked={sel}
                  className={`flex items-start gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors border ${
                    sel
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  data-testid={`questions-option-${q.id}-${opt.value}`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5 transition-all ${
                      sel
                        ? 'border-[4px] border-purple-600 bg-white'
                        : 'border-2 border-gray-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[11px] ${sel ? 'font-semibold text-purple-700' : 'font-normal text-gray-900'}`}
                    >
                      {opt.label}
                    </div>
                    {opt.detail && (
                      <div className="text-[9px] text-gray-400 mt-0.5 leading-relaxed">
                        {opt.detail}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Text row ─────────────────────────────────────────────────────────

interface TextRowProps extends RowProps {
  question: TextQuestion
}

function TextRow({ question: q, answer, onAnswer, submitted }: TextRowProps) {
  // Submitted + empty: omit entirely (chat-doc §2.4). Submitted +
  // filled: compact summary.
  if (submitted) {
    if (!answer || !answer.trim()) return null
    return (
      <div
        className="flex items-start gap-2 px-1.5 py-1.5"
        data-testid={`questions-summary-${q.id}`}
      >
        <span className="text-[9px] font-bold text-green-600 w-3.5 text-center mt-0.5">
          ✓
        </span>
        <div className="min-w-0">
          <div className="text-[10px] text-gray-400">{q.label}</div>
          <div className="text-[10px] text-gray-900 mt-0.5 break-words">
            {answer}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-2 px-1.5" data-testid={`questions-text-${q.id}`}>
      <div className="text-[11px] font-medium text-gray-600 mb-1">
        {q.label}
      </div>
      {q.desc && (
        <div className="text-[9px] text-gray-400 mb-1.5 leading-relaxed">
          {q.desc}
        </div>
      )}
      <textarea
        value={answer || ''}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder={q.placeholder || '输入内容...'}
        rows={2}
        className="w-full px-2.5 py-2 text-[11px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 text-gray-900 resize-y leading-relaxed max-h-20"
      />
    </div>
  )
}
