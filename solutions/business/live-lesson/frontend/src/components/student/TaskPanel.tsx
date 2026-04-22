import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import HelpButton, { HintBanner } from './HelpButton'
import BoardInline from './BoardInline'

/* ═══ MARKDOWN-LITE RENDERER ═══ */
function renderMd(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, i) => {
    let parts: (string | JSX.Element)[] = [line]
    // bold **...**
    parts = parts.flatMap((p, pi) => {
      if (typeof p !== 'string') return [p]
      const segs: (string | JSX.Element)[] = []
      let rest = p
      while (rest.includes('**')) {
        const a = rest.indexOf('**')
        const b = rest.indexOf('**', a + 2)
        if (b === -1) { segs.push(rest); rest = ''; break }
        if (a > 0) segs.push(rest.slice(0, a))
        segs.push(<strong key={`b${pi}${a}`}>{rest.slice(a + 2, b)}</strong>)
        rest = rest.slice(b + 2)
      }
      if (rest) segs.push(rest)
      return segs
    })
    // italic *...*
    parts = parts.flatMap((p, pi) => {
      if (typeof p !== 'string') return [p]
      const segs: (string | JSX.Element)[] = []
      let rest = p
      while (rest.includes('*')) {
        const a = rest.indexOf('*')
        const b = rest.indexOf('*', a + 1)
        if (b === -1) { segs.push(rest); rest = ''; break }
        if (a > 0) segs.push(rest.slice(0, a))
        segs.push(<em key={`i${pi}${a}`}>{rest.slice(a + 1, b)}</em>)
        rest = rest.slice(b + 1)
      }
      if (rest) segs.push(rest)
      return segs
    })
    // bullet
    if (line.startsWith('• ')) {
      return <div key={i} style={{ paddingLeft: 12, position: 'relative', lineHeight: 1.7 }}>• {parts.map((p) => typeof p === 'string' ? p.replace('• ', '') : p)}</div>
    }
    return <Fragment key={i}>{i > 0 && <br />}{parts}</Fragment>
  })
}

/* ═══ TASKS DATA ═══ */
interface TaskQuestion {
  q: string; opts: string[]; correct: number
  hint: string; hintZh: string; translate: string
}
interface TaskMatchPair {
  left: string; opts: string[]; correct: number
  hint: string; hintZh: string
}
interface TaskMatrixRow {
  place: string; demo?: boolean; practice?: string; reason?: string
  hint?: string; hintZh?: string
}
interface TaskExercise {
  type: 'quiz' | 'match' | 'matrix' | 'stance' | 'order'
  label: string
  questions?: TaskQuestion[]
  pairs?: TaskMatchPair[]
  rows?: TaskMatrixRow[]
  stanceQ?: string; stanceQZh?: string; stanceOpts?: string[]; evidence?: string[]
  items?: string[]; correctOrder?: number[]
}
interface TaskDiscussProbe {
  q: string; translate: string; aiReply: string
  followUp: string; followUpTranslate: string; followUpReply: string
}
interface TaskDiscuss {
  probe: TaskDiscussProbe
  insight: string; insightZh: string
}
export interface Task {
  id: number; name: string; subtitle: string; time: string
  focus: number[]; intro: string; exercise: TaskExercise
  discuss: TaskDiscuss; summary: string
}

const TASKS: Task[] = [
  {
    id: 1, name: 'Predict', subtitle: 'What is beauty?', time: '5 min', focus: [1, 2],
    intro: 'Let\'s start with the title: **Ideal Beauty**.\n\nRead the first two paragraphs quickly. Your job is to find the **conflict** — two very different ideas of beauty.\n\nPay attention to:\n• Who is Happiness Edem?\n• What kind of beauty does modern media promote?',
    exercise: {
      type: 'quiz', label: 'Answer the questions about ¶1-2.',
      questions: [
        { q: 'What did Happiness Edem do to become "beautiful"?', opts: ['Went on a diet to become slim', 'Gained weight in a fattening room', 'Got cosmetic surgery', 'Started a fashion brand'], correct: 1, hint: 'Look at ¶1. What happened to her weight?', hintZh: '看 ¶1，她的体重发生了什么变化？', translate: 'Happiness Edem 为了变"美"做了什么？' },
        { q: 'What kind of beauty does modern media promote?', opts: ['Plump and strong', 'Diverse and inclusive', 'Slim and fair-skinned', 'Tattooed and unique'], correct: 2, hint: 'Look at ¶2: "you will see young models — women who are..."', hintZh: '看 ¶2 描述的 models 特征。', translate: '现代媒体推崇哪种美？' },
        { q: 'What is the writer\'s main question?', opts: ['Why do people want to be beautiful?', 'Is one idea of beauty really better than another?', 'How can we become more beautiful?', 'Why is the media so powerful?'], correct: 1, hint: 'Read the last sentence of ¶2 carefully.', hintZh: '仔细读 ¶2 的最后一句话。', translate: '作者真正想问的大问题是什么？' },
      ],
    },
    discuss: {
      probe: { q: 'For the last question — how did you figure out the answer? Where exactly in the text did you find the clue?', translate: '你是怎么看出作者的核心问题的？从文章哪里找到的？', aiReply: 'Good thinking! The last sentence of ¶2 directly asks: "Is one idea of physical beauty really more attractive than another?"\n\nNotice the writer\'s technique: first, two opposing examples (Nigeria vs media), then a big question. This "conflict → question" opening is very common in argumentative texts.', followUp: 'Do you think the writer agrees that media beauty standards are correct? Why or why not?', followUpTranslate: '你觉得作者同意"媒体的审美标准是对的"吗？', followUpReply: 'Looking at the cultural examples later in the text, the writer clearly does NOT think there\'s only one "right" standard. The writer uses facts to show: beauty means different things in different times and cultures.\n\nThis is what we\'ll explore next!' },
      insight: 'Key technique: The text uses a "conflict opening" — two opposing facts, then a question. This is common in argumentative writing.',
      insightZh: '文章用"冲突开头"——先给两个对立事实，再提出问题。这是议论文常见写法。',
    },
    summary: 'You found the central conflict: one culture values gaining weight, while modern media promotes being slim.\n\nKey question: *Is one idea of beauty really better than another?*\n\nLet\'s see how the writer answers it.',
  },
  {
    id: 2, name: 'Skim', subtitle: 'Find the skeleton', time: '8 min', focus: [3, 4, 5, 6, 7, 8],
    intro: 'Strong readers don\'t read word by word. They look for the **skeleton** first.\n\nRead ¶3-8, but only focus on:\n• Each paragraph\'s **first sentence**\n• **Signal words** like "change over time", "different cultures", "It appears that"',
    exercise: {
      type: 'match', label: 'Match each section to its function.',
      pairs: [
        { left: '¶1-2', opts: ['Phenomenon', 'History', 'Culture', 'Conclusion'], correct: 0, hint: '"Phenomenon" means the opening situation or conflict.', hintZh: 'Phenomenon = 现象/冲突。¶1-2 讲了什么现象？' },
        { left: '¶3-4', opts: ['Phenomenon', 'History', 'Culture', 'Conclusion'], correct: 1, hint: 'Look for TIME signal words in ¶3\'s first sentence.', hintZh: '找 ¶3 首句中的时间信号词。' },
        { left: '¶5-7', opts: ['Phenomenon', 'History', 'Culture', 'Conclusion'], correct: 2, hint: 'Look for PLACE signal words in ¶5\'s first sentence.', hintZh: '找 ¶5 首句中的地点信号词。' },
        { left: '¶8', opts: ['Phenomenon', 'History', 'Culture', 'Conclusion'], correct: 3, hint: '"It appears that" is a summary signal word.', hintZh: '"It appears that" 是总结信号词。' },
      ],
    },
    discuss: {
      probe: { q: 'How did you decide that ¶3-4 is about "History" and not "Culture"? What signal words helped you?', translate: '你怎么判断 ¶3-4 是"历史"而不是"文化"？', aiReply: 'The key is in ¶3\'s first sentence: "change over time" and "different periods of history" — these are TIME signal words.\n\nCompare with ¶5: "different cultures around the world" — that\'s a PLACE signal.\n\nTime words = History. Place words = Culture.', followUp: 'Why is ¶8 the Conclusion and not another Culture paragraph?', followUpTranslate: '¶8 为什么是结论而不是又一个文化段？', followUpReply: 'Three clues: 1) "It appears that" — summary signal. 2) No new examples. 3) Circles back to the opening question.\n\nWhen you see these three together, you\'ve found the conclusion!' },
      insight: 'Skimming: Read first sentences + signal words. Time words → History. Place words → Culture. Summary words → Conclusion. Full structure in 3 minutes.',
      insightZh: '略读：读首句 + 信号词。时间词→历史，地理词→文化，总结词→结论。',
    },
    summary: 'Text structure: Phenomenon → History → Culture → Conclusion.\n\nThe writer builds an argument step by step. Next, let\'s collect the evidence.',
  },
  {
    id: 3, name: 'Scan & Build', subtitle: 'Collect evidence', time: '15 min', focus: [3, 4, 5, 6, 7],
    intro: 'Now we go from skeleton to details.\n\nDon\'t translate every sentence — use the **Information Matrix**.\n\nOnly collect three things:\n• **WHERE** — the place or time\n• **WHAT** — what people did\n• **WHY** — the reason behind it',
    exercise: {
      type: 'matrix', label: 'Read ¶3-7 and fill the matrix.',
      rows: [
        { place: 'Ancient Egypt (¶3)', demo: true, practice: 'Painted dark kohl around eyes', reason: 'Show wealth and status' },
        { place: '1600s Europe (¶4)', hint: 'Look for what was "considered stunning beauty".', hintZh: '找什么被认为是 "stunning beauty"。' },
        { place: 'Borneo (¶5)', hint: 'Their body art is like a diary of...', hintZh: '他们的 body art 像一本什么的日记？' },
        { place: 'NZ Maori (¶6)', hint: 'What is "tā moko"? What does it show?', hintZh: 'tā moko 是什么？代表什么？' },
        { place: 'Myanmar (¶7)', hint: 'Find "wearing..." in the first sentence.', hintZh: '找 ¶7 第一句中 "wearing..." 后面的内容。' },
        { place: 'Indonesia (¶7)', hint: 'Find "sharpening..." in the second sentence.', hintZh: '找 ¶7 第二句中 "sharpening..." 的内容。' },
      ],
    },
    discuss: {
      probe: { q: 'Look at your completed matrix. Are these beauty practices only about "looking good"? What do they have in common?', translate: '这些审美实践仅仅是为了好看吗？有什么共同点？', aiReply: 'Not just "looking good"! Egypt\'s kohl = wealth. Borneo\'s tattoos = life records. Maori\'s tā moko = social position. Indonesia\'s teeth = cultural identity.\n\nCommon thread: every beauty practice carries cultural meaning — identity, status, belonging. Beauty is a cultural language.', followUp: 'What reading method did you use to find all this information in such a long text?', followUpTranslate: '你是用什么方法从这么长的文章里找到这些信息的？', followUpReply: 'You used Scanning — reading with a specific target (where/what/why) and quickly locating information.\n\nSkimming finds structure. Scanning finds details. They work together!' },
      insight: 'Beauty practices are more than "looking good" — they\'re about identity, status, and culture. Scanning helps you extract organized evidence from long texts.',
      insightZh: '审美实践不只是好看——背后是身份、地位、文化。Scanning 帮你从长文中提取结构化信息。',
    },
    summary: 'You turned paragraphs into organized evidence.\n\nYour matrix shows beauty is about culture, status, and identity.\n\nNext, use this evidence to form your own opinion.',
  },
  {
    id: 4, name: 'Evaluate', subtitle: 'Do you agree?', time: '12 min', focus: [2, 8],
    intro: 'Now the most important thinking task.\n\nGo back to ¶2: the writer calls modern beauty standards **"shallow beauty ideals"**.\n\nDo you agree? Use evidence from your matrix.',
    exercise: {
      type: 'stance', label: 'Choose your position and select supporting evidence.',
      stanceQ: 'Do you agree that the media\'s beauty standard is "shallow"?',
      stanceQZh: '你同意现代媒体的审美标准是"肤浅的"吗？',
      stanceOpts: ['I agree', 'I partly agree', 'I disagree'],
      evidence: [
        'Ancient Egypt: kohl showed wealth and status',
        '1600s Europe: plump + pale = beauty (different from today)',
        'Borneo: tattoos as a diary of life events',
        'NZ Maori: tā moko shows social position',
        'Myanmar: metal neck rings seen as elegant',
        'Indonesia: sharpening teeth for cultural identity',
        'Beauty changes across time and cultures',
        'Modern media only promotes one standard: slim and fair',
      ],
    },
    discuss: {
      probe: { q: 'Pick your strongest piece of evidence. Explain: what does it prove about beauty standards?', translate: '挑最有说服力的一条证据，解释它能证明什么。', aiReply: 'The key is explaining WHAT the evidence proves. For example: "In 1600s Europe, plump and pale was beautiful" proves beauty changes over time — today\'s standard isn\'t eternal.\n\nSo calling today\'s standard the ONLY standard is indeed "shallow."', followUp: 'What is the writer\'s conclusion in ¶8? Does it match your judgment?', followUpTranslate: '作者在 ¶8 的结论是什么？和你的判断一致吗？', followUpReply: '¶8: "people change their appearance to tell the world about their culture and status."\n\nThe writer uses evidence, not just opinion. This "evidence-based argument" is more persuasive than simply saying "I disagree."\n\nThat\'s academic writing: position + evidence + explanation.' },
      insight: 'Strong opinions need evidence: 1) State position. 2) Give evidence. 3) Explain what it proves. This is the "claim → evidence → explanation" chain.',
      insightZh: '好观点需要证据：1) 表明立场；2) 给证据；3) 解释证据证明了什么。',
    },
    summary: 'You used evidence to support your judgment — a big step in academic reading.\n\nLet\'s review how you learned today.',
  },
  {
    id: 5, name: 'Wrap-up', subtitle: 'Review & transfer', time: '5 min', focus: [],
    intro: 'Before we finish, think about **HOW** you read this text today.\n\nGood readers use strategies, not just translation.\n\nLet\'s name the steps and think about using them next time.',
    exercise: {
      type: 'order', label: 'Put today\'s 4 reading strategies in the correct order.',
      items: ['Scanning — find specific details', 'Predicting — read the title, ask questions', 'Evaluating — form your own judgment', 'Skimming — find the structure quickly'],
      correctOrder: [1, 3, 0, 2],
    },
    discuss: {
      probe: { q: 'If you get a new article next time — "Beyond the Plate" — what would you do first? Why?', translate: '如果下次给你新文章，你会先做什么？为什么？', aiReply: 'Best starting point: Predicting — title, guess topic, form a question. Then Skim first sentences for structure. Then Scan for details + build matrix. Finally Evaluate.\n\nThe order matters: big picture → details → thinking.', followUp: 'Which of today\'s 4 strategies helped you the most? Why?', followUpTranslate: '今天哪个策略对你帮助最大？为什么？', followUpReply: 'Some students love Skimming — they used to read word by word, now they get structure in 3 minutes. Others find Scanning + Matrix most useful.\n\nThe key: these improve with practice. Homework is your chance!' },
      insight: 'Today: not just "beauty" but a reading process — Predict → Skim → Scan → Evaluate. Works for any argumentative text.',
      insightZh: '今天学的不只是"美"，更是阅读方法：Predict → Skim → Scan → Evaluate。',
    },
    summary: 'Reading process: Predict → Skim → Scan → Evaluate.\n\nThese work for any text. Keep using them!\n\nHomework: "Beyond the Plate" using today\'s 4 steps.',
  },
]

export { TASKS }
export type { Task as TaskData }

const LESSON_INTRO = 'Hello! Welcome to today\'s English reading lesson.\n\nToday we\'re reading **Ideal Beauty**. Keep one big question in mind:\n\n*Is one idea of beauty really better than another?*\n\nWe\'ll complete 5 tasks. Let\'s begin!'
const LESSON_SUMMARY = 'Great job today!\n\nYou explored whether one beauty standard is better than another, and practiced 4 reading strategies.\n\nReading is not just understanding words — it\'s organizing evidence and forming your own judgment.\n\nHomework: "Beyond the Plate" using today\'s 4 steps.'

const PHASE_IDS = ['listen', 'practice', 'discuss', 'takeaway'] as const
const PHASE_LABELS = ['Listen', 'Practice', 'Discuss', 'Takeaway']

/* ═══ ATTEMPT REPORTING ═══ */
function reportAttempt(taskId: number, questionIdx: number, attempt: number, selected: any, correct: any, isCorrect: boolean) {
  try { window.parent.postMessage({ type: 'student_attempt', taskId, questionIdx, attempt, selected, correct, isCorrect, ts: Date.now() }, window.location.origin) } catch { /* noop */ }
}

/* ═══ LISTEN PHASE ═══ */
function ListenPhase({ task }: { task: Task }) {
  return (
    <div id="phase-listen">
      <div className="stu-section-label"><span>Listen</span><div className="stu-section-line" /></div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
          Task {task.id} · {task.name}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', lineHeight: 1.3, marginBottom: 16, color: 'var(--t1)' }}>
          {task.subtitle}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>
          {renderMd(task.intro)}
        </div>
      </div>
    </div>
  )
}

/* ═══ PRACTICE PHASE ═══ */
function PracticePhase({ task, onDone }: { task: Task; onDone: () => void }) {
  const ex = task.exercise
  const [ans, setAns] = useState<Record<string, any>>({})
  const [attempts, setAttempts] = useState<Record<number, any[]>>({})
  const [wrongQs, setWrongQs] = useState<Set<number>>(new Set())
  const [correctQs, setCorrectQs] = useState<Set<number>>(new Set())
  const [allDone, setAllDone] = useState(false)
  const [softDone, setSoftDone] = useState(false)

  const canSub = () => {
    if (ex.type === 'quiz') return !ex.questions!.some((_, qi) => !correctQs.has(qi) && ans[qi] === undefined)
    if (ex.type === 'match') return !ex.pairs!.some((_, pi) => !correctQs.has(pi) && ans[pi] === undefined)
    if (ex.type === 'matrix') return true
    if (ex.type === 'stance') return ans.stance !== undefined && (ans.evidence || []).length >= 1
    if (ex.type === 'order') return (ans.order || []).length === ex.items!.length
    return true
  }

  const handleSubmit = () => {
    if (ex.type === 'quiz') {
      const newCorrect = new Set(correctQs)
      const newWrong = new Set<number>()
      const newAttempts = { ...attempts }
      ex.questions!.forEach((q, qi) => {
        if (newCorrect.has(qi)) return
        const sel = ans[qi]; if (sel === undefined) return
        const isOk = sel === q.correct
        if (!newAttempts[qi]) newAttempts[qi] = []
        newAttempts[qi].push({ selected: sel, correct: q.correct, isCorrect: isOk, ts: Date.now() })
        reportAttempt(task.id, qi, newAttempts[qi].length, sel, q.correct, isOk)
        if (isOk) newCorrect.add(qi); else newWrong.add(qi)
      })
      setAttempts(newAttempts); setCorrectQs(newCorrect); setWrongQs(newWrong)
      if (newWrong.size > 0) {
        const cleared = { ...ans }; newWrong.forEach(qi => { delete cleared[qi] }); setAns(cleared)
      }
      if (newWrong.size === 0 && newCorrect.size === ex.questions!.length) { setAllDone(true); onDone() }
    } else if (ex.type === 'match') {
      const newCorrect = new Set(correctQs)
      const newWrong = new Set<number>()
      const newAttempts = { ...attempts }
      ex.pairs!.forEach((p, pi) => {
        if (newCorrect.has(pi)) return
        const sel = ans[pi]; if (sel === undefined) return
        const isOk = sel === p.correct
        if (!newAttempts[pi]) newAttempts[pi] = []
        newAttempts[pi].push({ selected: sel, correct: p.correct, isCorrect: isOk, ts: Date.now() })
        reportAttempt(task.id, pi, newAttempts[pi].length, sel, p.correct, isOk)
        if (isOk) newCorrect.add(pi); else newWrong.add(pi)
      })
      setAttempts(newAttempts); setCorrectQs(newCorrect); setWrongQs(newWrong)
      if (newWrong.size > 0) {
        const cleared = { ...ans }; newWrong.forEach(pi => { delete cleared[pi] }); setAns(cleared)
      }
      if (newWrong.size === 0 && newCorrect.size === ex.pairs!.length) { setAllDone(true); onDone() }
    } else if (ex.type === 'order') {
      const order = ans.order || []
      const isOk = order.every((idx: number, pos: number) => ex.correctOrder![pos] === idx)
      const newAttempts = { ...attempts }
      if (!newAttempts[0]) newAttempts[0] = []
      newAttempts[0].push({ selected: [...order], correct: ex.correctOrder, isCorrect: isOk, ts: Date.now() })
      reportAttempt(task.id, 0, newAttempts[0].length, order, ex.correctOrder, isOk)
      setAttempts(newAttempts)
      if (isOk) { setAllDone(true); onDone() }
      else {
        const wrong = new Set<number>()
        order.forEach((idx: number, pos: number) => { if (ex.correctOrder![pos] !== idx) wrong.add(pos) })
        setWrongQs(wrong)
        setAns({})
      }
    } else {
      setSoftDone(true); setAllDone(true)
      reportAttempt(task.id, 0, 1, ans, null, true)
      onDone()
    }
  }

  const attemptCount = (qi: number) => (attempts[qi] || []).length

  return (
    <div id="phase-practice">
      <div className="stu-section-label"><span>Practice</span><div className="stu-section-line" /></div>
      <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>{ex.label}</div>

      {/* QUIZ */}
      {ex.type === 'quiz' && ex.questions!.map((q, qi) => {
        const locked = correctQs.has(qi)
        const isWrong = wrongQs.has(qi)
        const tries = attemptCount(qi)
        return (
          <div key={qi} className={`stu-quiz-card${locked ? ' correct' : ''}`}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flex: 1 }}>{q.q}</span>
              {locked && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>✓</span>}
              {tries > 0 && !locked && <span style={{ fontSize: 9, color: 'var(--t3)' }}>{tries === 1 ? '1 attempt' : `${tries} attempts`}</span>}
              <HelpButton hint={q.hint} hintZh={q.hintZh} translate={q.translate} />
            </div>
            {q.opts.map((o, oi) => {
              const sel = ans[qi] === oi
              const isCorrectLocked = locked && oi === q.correct
              return (
                <div
                  key={oi}
                  className={`stu-quiz-opt${isCorrectLocked ? ' opt-correct' : sel ? ' selected' : ''}`}
                  style={locked && oi !== q.correct ? { opacity: 0.5, cursor: 'default' } : locked ? { cursor: 'default' } : undefined}
                  onClick={locked ? undefined : () => setAns(a => ({ ...a, [qi]: oi }))}
                >
                  <span className="stu-quiz-radio" />{isCorrectLocked ? `✓ ${o}` : o}
                </div>
              )
            })}
            {isWrong && <HintBanner hint={q.hint} hintZh={q.hintZh} />}
          </div>
        )
      })}

      {/* MATCH */}
      {ex.type === 'match' && ex.pairs!.map((p, pi) => {
        const locked = correctQs.has(pi)
        const isWrong = wrongQs.has(pi)
        const tries = attemptCount(pi)
        return (
          <div key={pi}>
            <div className="stu-match-row">
              <div className="stu-match-left" style={locked ? { color: 'var(--green)' } : undefined}>{locked ? '✓' : p.left}</div>
              <div style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                {p.opts.map((o, oi) => {
                  const sel = ans[pi] === oi
                  const isCorrectLocked = locked && oi === p.correct
                  let cls = 'stu-match-opt'
                  if (isCorrectLocked) cls += ' correct'
                  else if (sel) cls += ' selected'
                  return (
                    <button
                      key={oi} className={cls}
                      style={locked && oi !== p.correct ? { opacity: 0.4, cursor: 'default' } : locked ? { cursor: 'default' } : undefined}
                      onClick={locked ? undefined : () => setAns(a => ({ ...a, [pi]: oi }))}
                    >{o}</button>
                  )
                })}
                {!locked && <HelpButton hint={p.hint} hintZh={p.hintZh} />}
                {tries > 0 && !locked && <span style={{ fontSize: 9, color: 'var(--t3)' }}>{tries === 1 ? '1 attempt' : `${tries} attempts`}</span>}
              </div>
            </div>
            {isWrong && <HintBanner hint={p.hint} hintZh={p.hintZh} />}
          </div>
        )
      })}

      {/* MATRIX */}
      {ex.type === 'matrix' && (
        <div className="stu-mat-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th className="stu-mat-th" style={{ width: '24%' }}>Where / When</th>
                <th className="stu-mat-th" style={{ width: '38%' }}>What they do</th>
                <th className="stu-mat-th" style={{ width: '38%' }}>Why</th>
              </tr>
            </thead>
            <tbody>
              {ex.rows!.map((r, ri) => (
                <tr key={ri} style={r.demo ? { background: 'rgba(13,82,69,.03)' } : undefined}>
                  <td className="stu-mat-td" style={{ fontWeight: 500, fontSize: 12 }}>{r.place}</td>
                  <td className="stu-mat-td">
                    {r.demo ? r.practice : (
                      <div>
                        <input className="stu-mat-in" placeholder="What?" />
                        <div style={{ marginTop: 2 }}><HelpButton hint={r.hint} hintZh={r.hintZh} /></div>
                      </div>
                    )}
                  </td>
                  <td className="stu-mat-td">{r.demo ? r.reason : <input className="stu-mat-in" placeholder="Why?" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* STANCE */}
      {ex.type === 'stance' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            {ex.stanceQ}
            <HelpButton translate={ex.stanceQZh} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {ex.stanceOpts!.map((o, oi) => (
              <button
                key={oi}
                className={`stu-stance-btn${ans.stance === oi ? ' selected' : ''}`}
                onClick={softDone ? undefined : () => setAns(a => ({ ...a, stance: oi }))}
              >{o}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', marginBottom: 6 }}>Select supporting evidence (at least 1):</div>
          {ex.evidence!.map((ev, ei) => {
            const sel = (ans.evidence || []).includes(ei)
            return (
              <div
                key={ei}
                className={`stu-evidence-row${sel ? ' selected' : ''}`}
                onClick={softDone ? undefined : () => setAns(a => {
                  const c = a.evidence || []
                  return { ...a, evidence: sel ? c.filter((x: number) => x !== ei) : [...c, ei] }
                })}
              >
                <span style={{ flexShrink: 0 }}>{sel ? '✓' : '○'}</span> {ev}
              </div>
            )
          })}
        </div>
      )}

      {/* ORDER */}
      {ex.type === 'order' && (
        <OrderEx
          items={ex.items!}
          correctOrder={ex.correctOrder!}
          ans={ans} setAns={setAns}
          done={allDone}
          wrongPositions={wrongQs}
          attemptCount={(attempts[0] || []).length}
        />
      )}

      {/* Submit/Done */}
      <div style={{ marginTop: 16 }}>
        {allDone ? (
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>✓</span>Practice complete!
          </div>
        ) : (
          <button
            className="stu-btn pri"
            style={!canSub() ? { opacity: 0.35, cursor: 'default' } : undefined}
            onClick={canSub() ? handleSubmit : undefined}
          >
            {Object.keys(attempts).length > 0 ? 'Try Again' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  )
}

/* Order exercise sub-component */
function OrderEx({ items, correctOrder, ans, setAns, done, wrongPositions, attemptCount }: {
  items: string[]; correctOrder: number[]; ans: Record<string, any>
  setAns: (fn: (a: Record<string, any>) => Record<string, any>) => void
  done: boolean; wrongPositions: Set<number>; attemptCount: number
}) {
  const order: number[] = ans.order || []
  const rem = items.map((_, i) => i).filter(i => !order.includes(i))

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        Click to select the correct order:
        {attemptCount > 0 && !done && <span style={{ fontSize: 9, color: 'var(--amber)' }}>{attemptCount === 1 ? '1 attempt' : `${attemptCount} attempts`}</span>}
      </div>
      {done && order.map((idx, pos) => (
        <div key={`s${pos}`} className="stu-order-slot" style={{ borderColor: 'var(--green)', background: 'var(--green-bg)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', marginRight: 6 }}>{pos + 1}.</span>{items[idx]}
        </div>
      ))}
      {!done && order.map((idx, pos) => (
        <div key={`s${pos}`} className="stu-order-slot">
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', marginRight: 6 }}>{pos + 1}.</span>
          {items[idx]}
          <span
            style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t3)', cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); setAns(a => ({ ...a, order: (a.order || []).filter((_: number, i: number) => i !== pos) })) }}
          >✕</span>
        </div>
      ))}
      {!done && rem.map(idx => (
        <div key={`c${idx}`} className="stu-order-choice" onClick={() => setAns(a => ({ ...a, order: [...(a.order || []), idx] }))}>
          {items[idx]}
        </div>
      ))}
      {!done && wrongPositions.size > 0 && (
        <HintBanner
          hint="The order isn't quite right. Think about the reading process: what do you do FIRST when you see a new text?"
          hintZh="顺序不太对。想想阅读流程：看到新文章你第一步做什么？"
        />
      )}
    </div>
  )
}

/* ═══ DISCUSS PHASE ═══ */
function DiscussPhase({ task, onDone }: { task: Task; onDone: () => void }) {
  const d = task.discuss
  const pr = d.probe
  const [step, setStep] = useState(0)
  const [input1, setI1] = useState('')
  const [input2, setI2] = useState('')
  const [extraMsgs, setEM] = useState<Array<{ t: string; x: string }>>([])
  const [extraIn, setEI] = useState('')
  const calledDone = useRef(false)

  useEffect(() => {
    if (step >= 1 && !calledDone.current) {
      calledDone.current = true
      onDone()
    }
  }, [step, onDone])

  const sendExtra = () => {
    if (!extraIn.trim()) return
    setEM(m => [...m, { t: 'q', x: extraIn }, { t: 'a', x: 'Great question! Think about how the evidence in the text connects to your idea. Try using the pattern: "Based on the text, I think... because..."' }])
    setEI('')
  }

  return (
    <div id="phase-discuss">
      <div className="stu-section-label"><span>Discuss</span><div className="stu-section-line" /></div>

      {/* Probe */}
      <div className="stu-probe-box">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div className="stu-ai-dot" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.5 }}>{pr.q}</div>
            {pr.translate && <div style={{ marginTop: 4 }}><HelpButton translate={pr.translate} /></div>}
          </div>
        </div>
        {step === 0 && (
          <div>
            <textarea className="stu-free-input" placeholder="Share your thoughts... (English or Chinese)" value={input1} onChange={e => setI1(e.target.value)} />
            <button
              className="stu-btn pri"
              style={{ marginTop: 8, fontSize: 13, ...(input1.trim().length === 0 ? { opacity: 0.35, cursor: 'default' } : {}) }}
              onClick={input1.trim() ? () => setStep(1) : undefined}
            >Submit</button>
          </div>
        )}
      </div>

      {/* AI Reply 1 */}
      {step >= 1 && (
        <div className="stu-ai-reply">
          <div className="stu-ai-dot" />
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.7, color: 'var(--t1)', whiteSpace: 'pre-line' }}>{pr.aiReply}</div>
        </div>
      )}

      {/* Follow-up probe */}
      {step >= 1 && pr.followUp && (
        <div className="stu-probe-box">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div className="stu-ai-dot" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.5 }}>{pr.followUp}</div>
              {pr.followUpTranslate && <div style={{ marginTop: 4 }}><HelpButton translate={pr.followUpTranslate} /></div>}
            </div>
          </div>
          {step < 3 && (
            <div>
              <textarea className="stu-free-input" placeholder="Continue..." value={input2} onChange={e => setI2(e.target.value)} />
              <button
                className="stu-btn pri"
                style={{ marginTop: 8, fontSize: 13, ...(input2.trim().length === 0 ? { opacity: 0.35, cursor: 'default' } : {}) }}
                onClick={input2.trim() ? () => setStep(3) : undefined}
              >Submit</button>
            </div>
          )}
        </div>
      )}

      {/* AI Reply 2 (follow-up) */}
      {step >= 3 && (
        <div className="stu-ai-reply">
          <div className="stu-ai-dot" />
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.7, color: 'var(--t1)', whiteSpace: 'pre-line' }}>{pr.followUpReply}</div>
        </div>
      )}

      {/* Insight */}
      {step >= 1 && (
        <div className="stu-insight-box">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Key Insight</div>
          {d.insight}
          {d.insightZh && <div style={{ marginTop: 4 }}><HelpButton translate={d.insightZh} /></div>}
        </div>
      )}

      {/* Extra discussion */}
      {step >= 1 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--purple)', marginBottom: 6 }}>Want to discuss more?</div>
          {extraMsgs.map((m, i) => (
            <div key={i} className={m.t === 'q' ? 'stu-extra-q' : 'stu-extra-a'}>{m.x}</div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)' }}
              placeholder="Ask anything..."
              value={extraIn}
              onChange={e => setEI(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendExtra() }}
            />
            <button
              style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--t1)', color: 'var(--surface)', cursor: 'pointer', fontSize: 12 }}
              onClick={sendExtra}
            >→</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ TAKEAWAY PHASE ═══ */
function TakeawayPhase({ task, onComplete }: { task: Task; onComplete: () => void }) {
  return (
    <div id="phase-takeaway">
      <div className="stu-section-label"><span>Takeaway</span><div className="stu-section-line" /></div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, lineHeight: 1.85, color: 'var(--t1)', whiteSpace: 'pre-line' }}>{renderMd(task.summary)}</div>
      </div>
      <BoardInline taskId={task.id} />
      <button className="stu-btn pri" style={{ marginTop: 8 }} onClick={onComplete}>
        {task.id < 5 ? 'Next Task →' : 'Complete Course →'}
      </button>
    </div>
  )
}

/* ═══ TASK VIEW — main component ═══ */
function TaskView({ task, onComplete }: { task: Task; onComplete: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activePhase, setActivePhase] = useState('listen')
  const [practiceDone, setPracticeDone] = useState(false)
  const [discussDone, setDiscussDone] = useState(false)

  useEffect(() => { setPracticeDone(false); setDiscussDone(false); setActivePhase('listen') }, [task.id])

  /* IntersectionObserver for phase tracking */
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.15) {
          setActivePhase(e.target.id.replace('phase-', ''))
        }
      })
    }, { root: container, rootMargin: '-40px 0px -60% 0px', threshold: [0.15] })
    const t = setTimeout(() => {
      PHASE_IDS.forEach(id => { const el = container.querySelector(`#phase-${id}`); if (el) observer.observe(el) })
    }, 100)
    return () => { clearTimeout(t); observer.disconnect() }
  }, [task.id, practiceDone, discussDone])

  const onPracticeDone = useCallback(() => {
    if (!practiceDone) {
      setPracticeDone(true)
      setTimeout(() => {
        const el = scrollRef.current?.querySelector('#phase-discuss')
        if (el) scrollRef.current!.scrollTo({ top: (el as HTMLElement).offsetTop - 50, behavior: 'smooth' })
      }, 200)
    }
  }, [practiceDone])

  const onDiscussDone = useCallback(() => {
    if (!discussDone) {
      setDiscussDone(true)
      setTimeout(() => {
        const el = scrollRef.current?.querySelector('#phase-takeaway')
        if (el) scrollRef.current!.scrollTo({ top: (el as HTMLElement).offsetTop - 50, behavior: 'smooth' })
      }, 200)
    }
  }, [discussDone])

  const jumpTo = (phaseId: string) => {
    if (phaseId === 'discuss' && !practiceDone) return
    if (phaseId === 'takeaway' && !discussDone) return
    const el = scrollRef.current?.querySelector(`#phase-${phaseId}`)
    if (el) scrollRef.current!.scrollTo({ top: (el as HTMLElement).offsetTop - 50, behavior: 'smooth' })
  }

  const phaseVisible = (id: string) => {
    if (id === 'listen' || id === 'practice') return true
    if (id === 'discuss') return practiceDone
    if (id === 'takeaway') return discussDone
    return false
  }

  return (
    <>
      {/* Sticky phase jump nav */}
      <div className="stu-phase-nav">
        {PHASE_IDS.map((id, i) => {
          const isAct = activePhase === id
          const vis = phaseVisible(id)
          return (
            <div
              key={id}
              className={`stu-phase-tab${isAct ? ' active' : ''}${!vis ? ' locked' : ''}`}
              onClick={vis ? () => jumpTo(id) : undefined}
            >
              <span>{PHASE_LABELS[i]}</span>
              {!vis && <span style={{ fontSize: 8, marginLeft: 2, color: 'var(--t3)' }}>🔒</span>}
            </div>
          )
        })}
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div className="stu-task-inner">
          <div style={{ paddingTop: 24 }} />
          <ListenPhase task={task} />
          <PracticePhase key={`p${task.id}`} task={task} onDone={onPracticeDone} />
          {practiceDone && <DiscussPhase key={`d${task.id}`} task={task} onDone={onDiscussDone} />}
          {discussDone && <TakeawayPhase task={task} onComplete={onComplete} />}
          {!practiceDone && <div className="stu-phase-locked-msg">Complete Practice to unlock Discuss</div>}
          {practiceDone && !discussDone && <div className="stu-phase-locked-msg">Complete Discuss to unlock Takeaway</div>}
          <div style={{ height: 80 }} />
        </div>
      </div>
    </>
  )
}

/* ═══ CUSTOM HOOK — useStudentTask ═══ */
export function useStudentTask() {
  const [screen, setScreen] = useState<string>('intro')
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set())

  let taskId = 0
  if (screen !== 'intro' && screen !== 'summary') taskId = parseInt(screen)
  const task = TASKS.find(t => t.id === taskId)

  // Listen for sync messages from parent (demo orchestrator)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'sync' && typeof d.step === 'number') {
        setScreen(String(d.step + 1))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const completeTask = useCallback((tid: number) => {
    setDoneSet(d => { const n = new Set(d); n.add(tid); return n })
    if (tid < 5) setScreen(String(tid + 1)); else setScreen('summary')
  }, [])

  const currentFocus = task ? task.focus : []

  return { taskId, task, currentFocus, doneSet, screen, setScreen, completeTask }
}

/* ═══ TASK COLUMN — rendered as a proper component ═══ */
export function TaskColumn({ screen, setScreen, task, completeTask }: {
  screen: string
  setScreen: (s: string) => void
  task: Task | undefined
  completeTask: (tid: number) => void
}) {
  return (
    <div className="stu-left-col">
      {screen === 'intro' && (
        <div className="stu-task-inner" style={{ paddingTop: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Welcome</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 16 }}>Ideal Beauty</div>
            <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>{renderMd(LESSON_INTRO)}</div>
          </div>
          <button className="stu-btn pri" onClick={() => setScreen('1')}>Start Task 1 →</button>
        </div>
      )}
      {screen === 'summary' && (
        <div className="stu-task-inner" style={{ paddingTop: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Complete</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 16 }}>Great job today!</div>
            <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>{renderMd(LESSON_SUMMARY)}</div>
          </div>
        </div>
      )}
      {task && <TaskView key={task.id} task={task} onComplete={() => completeTask(task.id)} />}
    </div>
  )
}

/* default export kept for backwards compat — re-export the hook */
export default useStudentTask
