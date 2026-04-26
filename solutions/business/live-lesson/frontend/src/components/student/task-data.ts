/* ═══ TASKS DATA — types, constants, TASK_TO_STEP ═══ */

export interface TaskQuestion {
  q: string; opts: string[]; correct: number
  hint: string; hintZh: string; translate: string
  walkthrough?: string; walkthroughZh?: string
}
export interface TaskMatchPair {
  left: string; opts: string[]; correct: number
  hint: string; hintZh: string
  walkthrough?: string; walkthroughZh?: string
}
export interface TaskMatrixRow {
  place: string; demo?: boolean; practice?: string; reason?: string
  hint?: string; hintZh?: string
}
export interface TaskExercise {
  type: 'quiz' | 'match' | 'matrix' | 'stance' | 'order'
  label: string
  questions?: TaskQuestion[]
  pairs?: TaskMatchPair[]
  rows?: TaskMatrixRow[]
  stanceQ?: string; stanceQZh?: string; stanceOpts?: string[]; evidence?: string[]
  items?: string[]; correctOrder?: number[]
}
export interface TaskDiscussProbe {
  q: string; translate: string
}
export interface TaskDiscuss {
  probe: TaskDiscussProbe
  insight: string; insightZh: string
}
/** Manifest-sourced discuss metadata for AI generation */
export interface ManifestDiscuss {
  probe: { q: string; translate?: string }
  targetInsight?: string
  commonMisconceptions?: string[]
  scaffoldStrategies?: string[]
  insight: string; insightZh?: string
}
export interface InstructionView {
  title: string
  body: string
  keyPoints?: string[]
  confirmLabel?: string
}

export interface Task {
  id: number; name: string; subtitle: string; time: string
  focus: number[]; intro: string; exercise: TaskExercise
  discuss: TaskDiscuss; summary: string
  manifestDiscuss?: ManifestDiscuss
  instructionView?: InstructionView
}

/** Dynamically compute task→step mapping from manifest readingSteps */
export function buildTaskToStep(readingSteps: Array<{ idx: number; type?: string; answerKey?: any }>): Record<number, number> {
  return readingSteps
    .filter(s => s.type === 'task' || (!s.type && s.answerKey))
    .sort((a, b) => a.idx - b.idx)
    .reduce<Record<number, number>>((map, s, i) => ({ ...map, [i + 1]: s.idx }), {})
}

/** Map each task to the preceding instruction's studentView */
export function buildInstructionMap(
  readingSteps: Array<{ idx: number; type?: string; studentView?: any }>,
  taskToStep: Record<number, number>,
): Record<number, InstructionView> {
  const stepToTask: Record<number, number> = {}
  for (const [tid, sid] of Object.entries(taskToStep)) stepToTask[+sid] = +tid

  const map: Record<number, InstructionView> = {}
  const sorted = [...readingSteps].sort((a, b) => a.idx - b.idx)

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].type !== 'instruction' || !sorted[i].studentView) continue
    const next = sorted.slice(i + 1).find(n => stepToTask[n.idx] !== undefined)
    if (next) map[stepToTask[next.idx]] = sorted[i].studentView
  }
  return map
}

export const TASKS: Task[] = [
  {
    id: 1, name: 'Predict', subtitle: 'What is beauty?', time: '5 min', focus: [1, 2],
    intro: 'Let\'s start with the title: **Ideal Beauty**.\n\nRead the first two paragraphs quickly. Your job is to find the **conflict** — two very different ideas of beauty.\n\nPay attention to:\n• Who is Happiness Edem?\n• What kind of beauty does modern media promote?',
    exercise: {
      type: 'quiz', label: 'Answer the questions about ¶1-2.',
      questions: [
        { q: 'What did Happiness Edem do to become "beautiful"?', opts: ['Went on a diet to become slim', 'Gained weight in a fattening room', 'Got cosmetic surgery', 'Started a fashion brand'], correct: 1, hint: 'Look at ¶1. What happened to her weight?', hintZh: '看 ¶1，她的体重发生了什么变化？', translate: 'Happiness Edem 为了变"美"做了什么？' },
        { q: 'What kind of beauty does modern media promote?', opts: ['Plump and strong', 'Diverse and inclusive', 'Slim and fair-skinned', 'Tattooed and unique'], correct: 2, hint: 'Look at ¶2: "we are bombarded with images of..."', hintZh: '看 ¶2 描述的 images 特征。', translate: '现代媒体推崇哪种美？' },
        { q: 'What is the writer\'s main question?', opts: ['Why do people want to be beautiful?', 'Is one idea of physical beauty really more attractive than another?', 'How can we become more beautiful?', 'Why is the media so powerful?'], correct: 1, hint: 'Read the last sentence of ¶2 carefully.', hintZh: '仔细读 ¶2 的最后一句话。', translate: '作者真正想问的大问题是什么？' },
      ],
    },
    discuss: {
      probe: { q: 'For the last question — how did you figure out the answer? Where exactly in the text did you find the clue?', translate: '你是怎么看出作者的核心问题的？从文章哪里找到的？' },
      insight: 'Key technique: The text uses a "conflict opening" — two opposing facts, then a question. This is common in argumentative writing.',
      insightZh: '文章用"冲突开头"——先给两个对立事实，再提出问题。这是议论文常见写法。',
    },
    summary: 'You found the central conflict: one culture values gaining weight, while modern media promotes being slim.\n\nKey question: *Is one idea of physical beauty really more attractive than another?*\n\nLet\'s see how the writer answers it.',
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
      probe: { q: 'How did you decide that ¶3-4 is about "History" and not "Culture"? What signal words helped you?', translate: '你怎么判断 ¶3-4 是"历史"而不是"文化"？' },
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
        { place: 'Ancient Egypt (¶3)', demo: true, practice: 'Paintings showed slim dark-haired women', reason: 'Normal beauty practice' },
        { place: '1600s Europe (¶4)', hint: 'Look for what was "considered stunning beauty".', hintZh: '找什么被认为是 "stunning beauty"。' },
        { place: 'Borneo (¶6)', hint: 'Their tattoos are like a diary of...', hintZh: '他们的 tattoos 像一本什么的日记？' },
        { place: 'NZ Maori (¶6)', hint: 'What do Maori tattoos show about a person?', hintZh: 'Maori 的 tattoos 反映了什么？' },
        { place: 'Myanmar (¶7)', hint: 'Find "metal rings" in ¶7. What do Myanmar people think of long necks?', hintZh: '找 ¶7 中 "metal rings"。缅甸人怎么看待长脖子？' },
        { place: 'Indonesia (¶7)', hint: 'Find "sharpening..." in the second sentence.', hintZh: '找 ¶7 第二句中 "sharpening..." 的内容。' },
      ],
    },
    discuss: {
      probe: { q: 'Look at your completed matrix. Are these beauty practices only about "looking good"? What do they have in common?', translate: '这些审美实践仅仅是为了好看吗？有什么共同点？' },
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
        'Ancient Egypt: slim dark-haired women were the beauty ideal',
        '1600s Europe: plump + pale = beauty (different from today)',
        'Borneo: tattoos as a diary of life events',
        'NZ Maori: tattoos show social position',
        'Myanmar: metal neck rings seen as elegant',
        'Indonesia: sharpening teeth for cultural identity',
        'Beauty changes across time and cultures',
        'Modern media only promotes one standard: slim and fair',
      ],
    },
    discuss: {
      probe: { q: 'Pick your strongest piece of evidence. Explain: what does it prove about beauty standards?', translate: '挑最有说服力的一条证据，解释它能证明什么。' },
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
      probe: { q: 'If you get a new article next time — "Beyond the Plate" — what would you do first? Why?', translate: '如果下次给你新文章，你会先做什么？为什么？' },
      insight: 'Today: not just "beauty" but a reading process — Predict → Skim → Scan → Evaluate. Works for any argumentative text.',
      insightZh: '今天学的不只是"美"，更是阅读方法：Predict → Skim → Scan → Evaluate。',
    },
    summary: 'Reading process: Predict → Skim → Scan → Evaluate.\n\nThese work for any text. Keep using them!\n\nHomework: "Beyond the Plate" using today\'s 4 steps.',
  },
]

export const LESSON_INTRO = 'Hello! Welcome to today\'s English reading lesson.\n\nToday we\'re reading **Ideal Beauty**. Keep one big question in mind:\n\n*Is one idea of physical beauty really more attractive than another?*\n\nWe\'ll complete 5 tasks. Let\'s begin!'
export const LESSON_SUMMARY = 'Great job today!\n\nYou explored whether one beauty standard is better than another, and practiced 4 reading strategies.\n\nReading is not just understanding words — it\'s organizing evidence and forming your own judgment.\n\nHomework: "Beyond the Plate" using today\'s 4 steps.'
