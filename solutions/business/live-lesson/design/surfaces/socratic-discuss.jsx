const {useState,useCallback,useRef,useEffect,Fragment,useMemo} = React;

/* ═══ SOCRATIC DISCUSS CONFIG ═══
 * Each task's discuss phase now has:
 *  - goal: the learning objective (what student should arrive at)
 *  - openingQ: the Socratic opening question
 *  - systemPrompt: instructions for Claude to behave as Socratic tutor
 *  - maxRounds: max student turns before fallback (default 6)
 *  - maxTimeSeconds: max seconds before fallback (default 300 = 5min)
 *  - fallbackMC: {question, options, correctIndex, explanation}
 *  - successCriteria: keywords/concepts that signal student has arrived
 *  - insight / insightZh: summary shown after completion
 */

const DISCUSS_CONFIGS = {
  1: {
    goal: 'Student should recognize that the text opens with a deliberate conflict between two opposing beauty standards, and that the writer\'s core question is whether any single standard of beauty is truly superior.',
    openingQ: 'You\'ve just read about Happiness Edem and modern media. I\'m curious — why do you think the writer chose to start the text with these two very different examples? What effect does that create?',
    openingQZh: '你觉得作者为什么选择用这两个截然不同的例子开头？这样写有什么效果？',
    scaffolds: ['The writer starts with...', 'This creates a feeling of...', 'The reader might wonder...'],
    maxRounds: 6,
    maxTimeSeconds: 300,
    systemPrompt: `You are a Socratic English reading tutor for a Chinese high school student reading "Ideal Beauty." 

LEARNING GOAL: The student should arrive at this understanding: The writer deliberately opens with two opposing beauty standards (Nigerian fattening rooms vs. slim media models) to create a CONFLICT that makes the reader question whether one idea of beauty is really better than another.

RULES:
- NEVER state the answer directly. Guide through questions.
- Ask ONE focused question per turn. Keep it short (2-3 sentences max).
- If the student says something partially correct, acknowledge it warmly, then probe deeper.
- If the student is stuck, narrow the question or offer a small clue (e.g., "Look at how ¶1 and ¶2 contrast...").
- Use simple English. The student is a Chinese high school learner.
- If the student writes in Chinese, respond in English but show you understood their Chinese.
- If the student demonstrates full understanding of the goal, respond with exactly: [GOAL_REACHED] followed by a brief congratulatory summary.
- Be warm, encouraging, never condescending.
- Do NOT number your questions. Be conversational.`,
    fallbackMC: {
      question: 'Why does the writer start the text with the story of Happiness Edem and then mention modern media beauty standards?',
      questionZh: '作者为什么先讲 Happiness Edem 的故事，然后提到现代媒体的审美标准？',
      options: [
        'To show that Nigerian culture is better than Western culture',
        'To create a conflict that makes readers question whether one beauty standard is better than another',
        'To explain why people should gain weight',
        'To advertise fashion magazines',
      ],
      correctIndex: 1,
      explanation: 'The writer deliberately opens with two *opposing* beauty standards — gaining weight in Nigeria vs. being slim in modern media. This conflict is a classic argumentative technique: present two contradicting facts, then ask a big question. Here the question is: "Is one idea of physical beauty really more attractive than another?" This sets up the entire text.',
      explanationZh: '作者故意用两种对立的审美标准开头——尼日利亚的增肥 vs 现代媒体的纤瘦。这是经典议论文手法：呈现矛盾事实，再提出核心问题。',
    },
    insight: 'The text uses a "conflict opening" — two opposing facts, then a question. This is common in argumentative writing.',
    insightZh: '文章用"冲突开头"——先给两个对立事实，再提出问题。这是议论文常见写法。',
  },

  2: {
    goal: 'Student should understand that the writer organizes the text from Phenomenon → History → Culture → Conclusion, building an argument step by step rather than just listing random examples.',
    openingQ: 'You matched the sections to their functions. But here\'s a deeper question: why does the writer put History BEFORE Culture? Could the order be reversed? What would change?',
    openingQZh: '作者为什么把"历史"放在"文化"前面？顺序能不能反过来？会有什么变化？',
    scaffolds: ['If the writer started with culture...', 'History comes first because...', 'The order creates...'],
    maxRounds: 6,
    maxTimeSeconds: 300,
    systemPrompt: `You are a Socratic English reading tutor for a Chinese high school student reading "Ideal Beauty."

LEARNING GOAL: The student should realize that the writer arranges the text as Phenomenon → History → Culture → Conclusion intentionally. History (time dimension) comes before Culture (space dimension) to show that beauty changes across BOTH time AND place, building a stronger cumulative argument. The order matters because it goes from "beauty changes over time" to "beauty also differs across cultures" — each layer strengthens the conclusion.

RULES:
- NEVER state the answer directly. Guide through questions.
- Ask ONE focused question per turn. Keep it short (2-3 sentences max).
- If the student says something partially correct, acknowledge it, then probe deeper.
- If stuck, try: "What does the History section prove? What does Culture add on top of that?"
- Use simple English for a Chinese high school learner.
- If the student writes in Chinese, respond in English but show you understood.
- If the student demonstrates full understanding, respond with exactly: [GOAL_REACHED] followed by a brief congratulatory summary.
- Be warm, encouraging, conversational.`,
    fallbackMC: {
      question: 'Why does the writer discuss History (¶3-4) before Culture (¶5-7)?',
      questionZh: '作者为什么先讨论历史（¶3-4），再讨论文化（¶5-7）？',
      options: [
        'Because history happened before culture',
        'Because history is more important than culture',
        'To build a stronger argument: beauty changes across time AND place',
        'The order doesn\'t matter — it\'s random',
      ],
      correctIndex: 2,
      explanation: 'The writer builds a layered argument. First, History shows beauty changes across TIME (ancient Egypt, 1600s Europe). Then Culture shows beauty differs across SPACE (Borneo, Maori, Myanmar). Together they prove beauty is neither fixed nor universal — it varies in every dimension. This step-by-step structure makes the conclusion much more convincing.',
      explanationZh: '作者层层递进：先用历史证明审美随时间变化，再用文化证明审美随地域不同。两者结合，证明审美既不固定也不统一。',
    },
    insight: 'The text structure is deliberate: History (time) + Culture (space) = beauty is not universal. A layered argument is stronger than a list.',
    insightZh: '文章结构是刻意的：历史(时间) + 文化(空间) = 审美不是普适的。层层递进比罗列更有说服力。',
  },

  3: {
    goal: 'Student should see that all these beauty practices are not just about appearance — they reflect deeper cultural meanings like identity, status, belonging, and values.',
    openingQ: 'Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about "looking good"? Or is something deeper going on?',
    openingQZh: '看看你填好的矩阵。如果外星人读了它，他们会觉得人类只是在乎"好看"吗？还是有更深层的东西？',
    scaffolds: ['These practices are really about...', 'For example, in Borneo...', 'Beauty connects to...'],
    maxRounds: 6,
    maxTimeSeconds: 300,
    systemPrompt: `You are a Socratic English reading tutor for a Chinese high school student reading "Ideal Beauty."

LEARNING GOAL: The student should realize that beauty practices across cultures are NOT just about appearance — they reflect deeper meanings: identity (Indonesia), social status (Maori, Elizabethan England), life records (Borneo), cultural values (Myanmar). Beauty is a CULTURAL LANGUAGE that communicates who you are and where you belong.

RULES:
- NEVER state the answer directly. Guide through questions.
- Ask ONE focused question per turn. 2-3 sentences max.
- Try questions like: "What does the Borneo tattoo tell others about the person?" or "Is the Maori tā moko about looking beautiful or about something else?"
- If stuck, pick one specific matrix row and ask about the "why" column.
- Use simple English for a Chinese high school learner.
- If Chinese input, respond in English but show understanding.
- If the student demonstrates full understanding, respond with: [GOAL_REACHED] followed by a brief congratulatory summary.
- Warm, encouraging, conversational.`,
    fallbackMC: {
      question: 'What do all the beauty practices in the matrix have in common?',
      questionZh: '矩阵中所有审美实践的共同点是什么？',
      options: [
        'They all make people look more attractive',
        'They are all painful and dangerous',
        'They all reflect cultural meanings like identity, status, and belonging',
        'They are all from ancient times',
      ],
      correctIndex: 2,
      explanation: 'Every beauty practice in the text carries cultural meaning beyond appearance. Borneo tattoos record life events. Maori tā moko shows social position. Elizabethan pale skin signaled wealth. Indonesian teeth-sharpening expressed cultural identity. Beauty is a cultural language — it communicates who you are, not just how you look.',
      explanationZh: '文中每种审美实践都承载着超越外表的文化含义。美是一种文化语言——它传达的是你是谁，而不只是你长什么样。',
    },
    insight: 'Beauty is a cultural language: identity, status, belonging. Not just "looking good."',
    insightZh: '审美是一种文化语言：身份、地位、归属感。不只是"好看"。',
  },

  4: {
    goal: 'Student should be able to use text evidence to argue that modern media beauty standards are "shallow" because they ignore the rich cultural meanings behind different beauty practices, reducing beauty to a single physical standard.',
    openingQ: 'The writer calls modern media beauty standards "shallow." That\'s a strong word. Do you think it\'s fair? What would make a beauty standard "deep" instead of "shallow"?',
    openingQZh: '作者说现代媒体审美是"肤浅的(shallow)"。这个词很重。你觉得公平吗？什么样的审美标准算"深刻"而不是"肤浅"？',
    scaffolds: ['A "shallow" standard means...', 'Based on the text...', 'A "deep" standard would include...'],
    maxRounds: 8,
    maxTimeSeconds: 360,
    systemPrompt: `You are a Socratic English reading tutor for a Chinese high school student reading "Ideal Beauty."

LEARNING GOAL: The student should construct an evidence-based argument that modern media beauty is "shallow" because it promotes ONE physical standard (slim, fair) while ignoring the rich cultural meanings (identity, status, values) that beauty carries in different cultures. A "deep" beauty standard would acknowledge that beauty reflects culture, history, and identity — not just appearance.

RULES:
- NEVER state the answer directly. Guide through questions.
- Ask ONE focused question per turn. 2-3 sentences max.
- Push for EVIDENCE: "Which example from your matrix supports that idea?"
- Push for EXPLANATION: "So what does that prove about 'shallow'?"
- If the student only gives opinion, ask for a text fact.
- If the student only gives a fact, ask what it proves.
- Help them build the claim → evidence → explanation chain.
- Use simple English for a Chinese high school learner.
- If Chinese input, respond in English but show understanding.
- If the student demonstrates a complete argument with evidence, respond with: [GOAL_REACHED] followed by a brief congratulatory summary.
- Warm, encouraging, conversational.`,
    fallbackMC: {
      question: 'Why does the writer call modern media beauty standards "shallow"?',
      questionZh: '作者为什么说现代媒体审美标准是"肤浅的"？',
      options: [
        'Because modern beauty is not real',
        'Because media only promotes one physical standard and ignores the cultural meanings of beauty',
        'Because beautiful people are not smart',
        'Because ancient beauty was better than modern beauty',
      ],
      correctIndex: 1,
      explanation: 'The writer uses evidence from many cultures to show that beauty has always carried deep meaning — identity, status, cultural values. Modern media reduces all of this to ONE narrow physical standard (slim, fair). That\'s why it\'s "shallow" — it strips away the cultural richness and replaces it with a single look. A strong argument uses this pattern: Position → Evidence → Explanation.',
      explanationZh: '作者用多元文化证据表明，审美一直承载着深层含义。现代媒体把这一切简化为单一外表标准，所以是"肤浅的"。',
    },
    insight: 'Claim → Evidence → Explanation. "Shallow" means ignoring cultural depth. Strong arguments need all three links.',
    insightZh: '观点→证据→解释。"肤浅"意味着忽视文化深度。好的论证需要三者缺一不可。',
  },

  5: {
    goal: 'Student should be able to name and explain the 4 reading strategies (Predict, Skim, Scan, Evaluate) in order, and understand that this process is transferable to any argumentative text.',
    openingQ: 'Imagine your friend missed today\'s class and asks: "How did you manage to read such a long English article?" How would you explain your reading process step by step?',
    openingQZh: '假设你朋友缺课了，问你："你怎么读完这么长的英文文章的？"你会怎么一步步解释？',
    scaffolds: ['First, I looked at the title and...', 'Then I read the first sentences to...', 'After that I...'],
    maxRounds: 5,
    maxTimeSeconds: 240,
    systemPrompt: `You are a Socratic English reading tutor for a Chinese high school student reading "Ideal Beauty."

LEARNING GOAL: The student should articulate the 4-step reading process: 1) Predicting (from title, form questions), 2) Skimming (first sentences → structure), 3) Scanning (find specific details → build matrix), 4) Evaluating (use evidence to form judgment). They should also express that these steps are reusable for other texts.

RULES:
- NEVER state the answer directly. Guide through questions.
- Ask ONE focused question per turn. 2-3 sentences max.
- If they name a step, ask: "What did that step help you do specifically?"
- If they skip a step, ask: "What did you do BEFORE scanning for details?"
- If they list all 4, ask: "Could you use these same steps for a different article? How?"
- Use simple English for a Chinese high school learner.
- If Chinese input, respond in English but show understanding.
- If the student names all 4 strategies with their purposes AND mentions transferability, respond with: [GOAL_REACHED] followed by a brief congratulatory summary.
- Warm, encouraging, conversational.`,
    fallbackMC: {
      question: 'What is the correct order of the 4 reading strategies used today?',
      questionZh: '今天用的4个阅读策略，正确顺序是什么？',
      options: [
        'Scanning → Skimming → Predicting → Evaluating',
        'Evaluating → Predicting → Scanning → Skimming',
        'Predicting → Skimming → Scanning → Evaluating',
        'Skimming → Predicting → Evaluating → Scanning',
      ],
      correctIndex: 2,
      explanation: 'The reading process follows a logical order: 1) **Predicting** — look at the title, form expectations. 2) **Skimming** — read first sentences to find the text structure. 3) **Scanning** — locate specific details and organize them (matrix). 4) **Evaluating** — use evidence to form your own judgment. This process works for any argumentative or expository text!',
      explanationZh: '阅读过程遵循逻辑顺序：预测→略读→寻读→评价。这个过程适用于任何议论文或说明文！',
    },
    insight: 'Predict → Skim → Scan → Evaluate. A transferable process for any argumentative text.',
    insightZh: '预测→略读→寻读→评价。适用于任何议论文的可迁移阅读方法。',
  },
};

/* ═══ STYLES ═══ */
const DS = {
  wrap: { marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t3)', padding: '28px 0 10px', display: 'flex', alignItems: 'center', gap: 8 },
  sectionLine: { flex: 1, height: 1, background: 'var(--border)' },
  chatArea: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  chatHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' },
  aiDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)', flexShrink: 0 },
  chatTitle: { fontSize: 12, fontWeight: 600, color: 'var(--purple)', flex: 1 },
  meta: { fontSize: 10, color: 'var(--t3)' },
  msgList: { padding: '12px 16px' },
  msgAi: { display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  msgStudent: { display: 'flex', justifyContent: 'flex-end', marginBottom: 12 },
  aiAvatar: { width: 28, height: 28, borderRadius: '50%', background: 'var(--purple-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--purple)', fontWeight: 700, flexShrink: 0 },
  aiBubble: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '2px 10px 10px 10px', padding: '10px 14px', fontSize: 13, lineHeight: 1.7, color: 'var(--t1)', maxWidth: '85%' },
  studentBubble: { background: 'var(--teal)', color: '#fff', borderRadius: '10px 2px 10px 10px', padding: '10px 14px', fontSize: 13, lineHeight: 1.6, maxWidth: '80%' },
  inputRow: { display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' },
  input: { flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--bg)', resize: 'none', minHeight: 42, lineHeight: 1.5 },
  sendBtn: { width: 42, height: 42, borderRadius: 8, border: 'none', background: 'var(--t1)', color: 'var(--surface)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0 },
  sendBtnOff: { opacity: 0.3, cursor: 'default' },
  /* Status bar */
  statusBar: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', fontSize: 10, color: 'var(--t3)', borderBottom: '1px solid var(--border)' },
  statusPill: { padding: '2px 8px', borderRadius: 10, fontWeight: 600 },
  /* Scaffolds */
  scaffoldWrap: { display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto', borderTop: '1px solid var(--border)', background: 'var(--surface2)' },
  scaffoldChip: { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11, color: 'var(--t2)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'all .1s' },
  /* Fallback MC */
  mcWrap: { background: 'var(--amber-bg)', border: '1px solid rgba(122,77,14,.15)', borderRadius: 10, padding: '16px 20px', marginBottom: 12 },
  mcTitle: { fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 4 },
  mcSubtitle: { fontSize: 11, color: 'var(--t3)', marginBottom: 12 },
  mcQ: { fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 12, lineHeight: 1.5 },
  mcOpt: { padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border)', marginBottom: 6, fontSize: 13, cursor: 'pointer', background: 'var(--surface)', transition: 'all .12s', display: 'flex', alignItems: 'center', gap: 10 },
  mcOptSel: { borderColor: 'var(--teal)', background: 'var(--teal-bg)', color: 'var(--teal)', fontWeight: 500 },
  mcOptOk: { borderColor: 'var(--green)', background: 'var(--green-bg)', color: 'var(--green)' },
  mcOptBad: { borderColor: 'var(--red)', background: 'var(--red-bg)', color: 'var(--red)' },
  mcRadio: { width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', flexShrink: 0, transition: 'all .12s' },
  /* Explanation */
  explWrap: { background: 'var(--green-bg)', border: '1px solid rgba(13,82,69,.15)', borderRadius: 10, padding: '16px 20px', marginBottom: 12 },
  explTitle: { fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 },
  explBody: { fontSize: 13, lineHeight: 1.8, color: 'var(--t1)' },
  explZh: { fontSize: 12, color: 'var(--t3)', marginTop: 8, fontStyle: 'italic' },
  /* Insight */
  insightBox: { background: 'var(--amber-bg)', border: '1px solid rgba(122,77,14,.15)', borderRadius: 8, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, color: 'var(--amber)', marginBottom: 12 },
  /* Typing indicator */
  typing: { display: 'flex', gap: 4, alignItems: 'center', padding: '8px 0' },
  typingDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--purple)', opacity: 0.4 },
  /* Goal indicator */
  goalReached: { background: 'var(--green-bg)', border: '1px solid rgba(13,82,69,.15)', borderRadius: 10, padding: '14px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 },
  goalIcon: { width: 32, height: 32, borderRadius: '50%', background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 },
  goalText: { fontSize: 14, fontWeight: 600, color: 'var(--green)', lineHeight: 1.4 },
  /* Translate help */
  helpBtn: { fontSize: 10, color: 'var(--t3)', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', fontFamily: 'inherit' },
};

/* ═══ TYPING INDICATOR ═══ */
function TypingIndicator() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % 3), 400);
    return () => clearInterval(id);
  }, []);
  return React.createElement('div', { style: DS.msgAi },
    React.createElement('div', { style: DS.aiAvatar }, 'S'),
    React.createElement('div', { style: { ...DS.aiBubble, padding: '12px 18px' } },
      React.createElement('div', { style: DS.typing },
        [0, 1, 2].map(i =>
          React.createElement('div', {
            key: i,
            style: { ...DS.typingDot, opacity: i === frame ? 1 : 0.3, transition: 'opacity .2s' }
          })
        )
      )
    )
  );
}

/* ═══ TIMER DISPLAY ═══ */
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/* ═══ FALLBACK MC ═══ */
function FallbackMC({ config, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (selected === null) return;
    setSubmitted(true);
    /* Always complete — correct or wrong, we reveal the answer and move on */
    setTimeout(() => onComplete && onComplete(), 1200);
  };

  const isCorrect = submitted && selected === config.correctIndex;

  return React.createElement('div', { style: DS.mcWrap },
    React.createElement('div', { style: DS.mcTitle }, '⏱ Let\'s try a different approach'),
    React.createElement('div', { style: DS.mcSubtitle }, 'Pick the best answer to show your understanding.'),
    React.createElement('div', { style: DS.mcQ },
      config.question,
      config.questionZh && React.createElement('div', { style: { fontSize: 11, color: 'var(--t3)', fontWeight: 400, marginTop: 4 } }, config.questionZh),
    ),
    config.options.map((opt, i) => {
      const isSel = selected === i;
      const showResult = submitted;
      const isRight = i === config.correctIndex;
      let optStyle = DS.mcOpt;
      if (showResult && isRight) optStyle = { ...DS.mcOpt, ...DS.mcOptOk };
      else if (showResult && isSel && !isRight) optStyle = { ...DS.mcOpt, ...DS.mcOptBad };
      else if (isSel) optStyle = { ...DS.mcOpt, ...DS.mcOptSel };

      return React.createElement('div', {
        key: i,
        style: { ...optStyle, ...(submitted ? { cursor: 'default' } : {}) },
        onClick: submitted ? undefined : () => setSelected(i),
      },
        React.createElement('span', {
          style: {
            ...DS.mcRadio,
            ...(showResult && isRight ? { borderColor: 'var(--green)', borderWidth: 5 } :
              showResult && isSel ? { borderColor: 'var(--red)', borderWidth: 5 } :
                isSel ? { borderColor: 'var(--teal)', borderWidth: 5 } : {})
          }
        }),
        opt,
      );
    }),
    !submitted && React.createElement('button', {
      style: {
        marginTop: 8, width: '100%', padding: '12px', borderRadius: 8, border: 'none',
        background: selected !== null ? 'var(--t1)' : 'var(--surface2)',
        color: selected !== null ? 'var(--surface)' : 'var(--t3)',
        fontSize: 14, fontWeight: 600, cursor: selected !== null ? 'pointer' : 'default', fontFamily: 'inherit',
      },
      onClick: handleSubmit,
    }, 'Submit'),
    submitted && !isCorrect && React.createElement('div', {
      style: { marginTop: 8, fontSize: 12, color: 'var(--red)', fontWeight: 500, lineHeight: 1.6 }
    }, 'Not quite. The correct answer is highlighted in green above. Let\'s look at the full explanation below.'),
  );
}

/* ═══ EXPLANATION PANEL ═══ */
function ExplanationPanel({ config, viaChat }) {
  return React.createElement('div', { style: DS.explWrap },
    React.createElement('div', { style: DS.explTitle },
      React.createElement('span', null, '✓'),
      viaChat ? 'You got it through discussion!' : 'Here\'s the full explanation',
    ),
    React.createElement('div', { style: DS.explBody }, config.explanation),
    config.explanationZh && React.createElement('div', { style: DS.explZh }, config.explanationZh),
  );
}

/* ═══ MAIN: SOCRATIC DISCUSS COMPONENT ═══ */
function SocraticDiscuss({ taskId, onDone }) {
  const config = DISCUSS_CONFIGS[taskId];
  if (!config) return React.createElement('div', null, 'No discuss config for task ', taskId);

  /* State */
  const [messages, setMessages] = useState([
    { role: 'ai', text: config.openingQ }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [round, setRound] = useState(0);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState('chat'); // chat | fallback | done
  const [goalReached, setGoalReached] = useState(false);
  const [fallbackReason, setFallbackReason] = useState('');
  const msgEndRef = useRef(null);
  const inputRef = useRef(null);
  const calledDone = useRef(false);

  /* Timer */
  useEffect(() => {
    if (phase === 'done') return;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(s);
      if (s >= config.maxTimeSeconds && phase === 'chat') {
        setFallbackReason('time');
        setPhase('fallback');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, startTime, config.maxTimeSeconds]);

  /* Auto-scroll */
  useEffect(() => {
    msgEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading]);

  /* Signal done */
  useEffect(() => {
    if (phase === 'done' && !calledDone.current) {
      calledDone.current = true;
      onDone && onDone();
    }
  }, [phase]);

  /* Send message */
  const send = async () => {
    const text = input.trim();
    if (!text || loading || phase !== 'chat') return;
    
    const newRound = round + 1;
    setRound(newRound);
    setInput('');
    setMessages(m => [...m, { role: 'student', text }]);
    setLoading(true);

    /* Build conversation for Claude */
    const conversationMsgs = [];
    conversationMsgs.push({ role: 'user', content: config.systemPrompt });
    conversationMsgs.push({ role: 'assistant', content: 'Understood. I will guide the student through Socratic questioning toward the learning goal.' });
    
    /* Add all messages */
    const allMsgs = [...messages, { role: 'student', text }];
    for (const msg of allMsgs) {
      if (msg.role === 'ai') {
        conversationMsgs.push({ role: 'assistant', content: msg.text });
      } else {
        conversationMsgs.push({ role: 'user', content: msg.text });
      }
    }

    try {
      const reply = await window.claude.complete({
        messages: conversationMsgs,
      });

      /* Check if goal reached */
      if (reply.includes('[GOAL_REACHED]')) {
        const cleanReply = reply.replace('[GOAL_REACHED]', '').trim();
        setMessages(m => [...m, { role: 'ai', text: cleanReply }]);
        setGoalReached(true);
        setPhase('done');
      } else {
        setMessages(m => [...m, { role: 'ai', text: reply }]);
        /* Check if max rounds exceeded */
        if (newRound >= config.maxRounds) {
          setFallbackReason('rounds');
          setPhase('fallback');
        }
      }
    } catch (err) {
      setMessages(m => [...m, { role: 'ai', text: 'Sorry, let me think about that differently. Could you rephrase your answer?' }]);
    }
    setLoading(false);
  };

  const useScaffold = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const onMCComplete = () => {
    setPhase('done');
  };

  /* Status color */
  const roundProgress = round / config.maxRounds;
  const timeProgress = elapsed / config.maxTimeSeconds;
  const urgency = Math.max(roundProgress, timeProgress);
  const statusColor = urgency < 0.5 ? 'var(--green)' : urgency < 0.8 ? 'var(--amber)' : 'var(--red)';

  return React.createElement('div', { style: DS.wrap, id: 'phase-discuss' },
    React.createElement('div', { style: DS.sectionLabel },
      React.createElement('span', null, 'Discuss'),
      React.createElement('div', { style: DS.sectionLine }),
    ),

    /* Chat area */
    React.createElement('div', { style: DS.chatArea },
      /* Header */
      React.createElement('div', { style: DS.chatHeader },
        React.createElement('div', { style: DS.aiDot }),
        React.createElement('div', { style: DS.chatTitle }, 'Socratic Discussion'),
        config.openingQZh && React.createElement('button', {
          style: DS.helpBtn,
          title: config.openingQZh,
          onClick: () => alert(config.openingQZh),
        }, '中文'),
      ),

      /* Status bar */
      phase === 'chat' && React.createElement('div', { style: DS.statusBar },
        React.createElement('div', { style: { ...DS.statusPill, background: statusColor + '18', color: statusColor } },
          `Round ${round}/${config.maxRounds}`),
        React.createElement('div', { style: { ...DS.statusPill, background: statusColor + '18', color: statusColor } },
          formatTime(elapsed) + ' / ' + formatTime(config.maxTimeSeconds)),
        React.createElement('div', { style: { flex: 1 } }),
        React.createElement('div', { style: DS.meta }, 'Think deeply — no rush!'),
      ),

      /* Messages — everything renders inside this scrollable list */
      React.createElement('div', { style: DS.msgList },
        messages.map((msg, i) =>
          msg.role === 'ai'
            ? React.createElement('div', { key: i, style: DS.msgAi },
                React.createElement('div', { style: DS.aiAvatar }, 'S'),
                React.createElement('div', { style: DS.aiBubble }, msg.text),
              )
            : React.createElement('div', { key: i, style: DS.msgStudent },
                React.createElement('div', { style: DS.studentBubble }, msg.text),
              )
        ),
        loading && React.createElement(TypingIndicator, null),

        /* Fallback MC — as an AI message inside the chat */
        phase === 'fallback' && React.createElement(Fragment, null,
          React.createElement('div', { style: DS.msgAi },
            React.createElement('div', { style: DS.aiAvatar }, 'S'),
            React.createElement('div', { style: { ...DS.aiBubble, maxWidth: '92%' } },
              React.createElement('div', { style: { marginBottom: 10, lineHeight: 1.6 } },
                fallbackReason === 'time'
                  ? 'Time\'s up! You\'ve been thinking hard. Let me give you a question to help:'
                  : 'Great discussion! Let\'s check your understanding:'),
              React.createElement(FallbackMC, { config: config.fallbackMC, onComplete: onMCComplete }),
            ),
          ),
        ),

        /* Goal reached — as a celebration message inside the chat */
        goalReached && React.createElement('div', { style: DS.msgAi },
          React.createElement('div', { style: DS.aiAvatar }, '🎉'),
          React.createElement('div', { style: { ...DS.aiBubble, maxWidth: '92%', background: 'var(--green-bg)', border: '1px solid rgba(13,82,69,.15)' } },
            React.createElement('div', { style: { fontSize: 15, fontWeight: 700, color: 'var(--green)', marginBottom: 4 } }, 'Amazing! You figured it out all by yourself!'),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 } },
              `That's real critical thinking — ${round} round${round > 1 ? 's' : ''} in ${formatTime(elapsed)}. You should be proud! 🌟`),
          ),
        ),

        /* Explanation — as an AI message */
        phase === 'done' && React.createElement('div', { style: DS.msgAi },
          React.createElement('div', { style: DS.aiAvatar }, 'S'),
          React.createElement('div', { style: { ...DS.aiBubble, maxWidth: '92%' } },
            React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 } },
              goalReached ? 'Here\'s a summary' : 'Full explanation'),
            React.createElement('div', { style: { fontSize: 13, lineHeight: 1.8, color: 'var(--t1)' } }, config.fallbackMC.explanation),
            config.fallbackMC.explanationZh && React.createElement('div', { style: { fontSize: 12, color: 'var(--t3)', marginTop: 6, fontStyle: 'italic' } }, config.fallbackMC.explanationZh),
            React.createElement('div', { style: { marginTop: 10, padding: '8px 12px', background: 'var(--amber-bg)', borderRadius: 6, border: '1px solid rgba(122,77,14,.12)' } },
              React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 2 } }, 'Key Insight'),
              React.createElement('div', { style: { fontSize: 12, color: 'var(--amber)', lineHeight: 1.5 } }, config.insight),
              config.insightZh && React.createElement('div', { style: { fontSize: 11, color: 'var(--t3)', marginTop: 2 } }, config.insightZh),
            ),
          ),
        ),

        /* Unlocked notice — system divider inside chat */
        phase === 'done' && React.createElement('div', { style: {
          display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 8px',
        } },
          React.createElement('div', { style: { flex: 1, height: 1, background: 'var(--border)' } }),
          React.createElement('div', { style: {
            fontSize: 11, fontWeight: 600, color: 'var(--green)',
            padding: '4px 12px', borderRadius: 20,
            background: 'var(--green-bg)', border: '1px solid rgba(13,82,69,.15)',
            whiteSpace: 'nowrap',
          } }, '✓ Discuss complete — next section unlocked'),
          React.createElement('div', { style: { flex: 1, height: 1, background: 'var(--border)' } }),
        ),

        React.createElement('div', { ref: msgEndRef }),
      ),  /* end msgList */

      /* Scaffolds */
      phase === 'chat' && round === 0 && config.scaffolds && React.createElement('div', { style: DS.scaffoldWrap },
        config.scaffolds.map((s, i) =>
          React.createElement('button', {
            key: i, style: DS.scaffoldChip,
            onClick: () => useScaffold(s),
          }, s)
        ),
      ),

      /* Input */
      phase === 'chat' && React.createElement('div', { style: DS.inputRow },
        React.createElement('textarea', {
          ref: inputRef,
          style: DS.input,
          placeholder: 'Share your thinking... (English or 中文 both OK)',
          value: input,
          rows: 1,
          onChange: e => setInput(e.target.value),
          onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } },
        }),
        React.createElement('button', {
          style: { ...DS.sendBtn, ...(input.trim() && !loading ? {} : DS.sendBtnOff) },
          onClick: send,
        }, '→'),
      ),
    ),  /* end chatArea */

    /* Continue discussing after completion */
    phase === 'done' && React.createElement(ContinueChat, { config, messages, goalReached }),
  );
}

/* ═══ CONTINUE CHAT (post-completion free discussion) ═══ */
function ContinueChat({ config, messages: priorMsgs, goalReached }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMsgs(m => [...m, { role: 'student', text }]);
    setLoading(true);

    const conversationMsgs = [];
    conversationMsgs.push({ role: 'user', content: `You are a friendly English reading tutor. The student just completed a Socratic discussion about "${config.goal}". The answer has already been revealed. Now the student wants to continue discussing freely — answer their questions, clarify confusion, and encourage deeper thinking. Use simple English for a Chinese high school learner. If they write Chinese, respond in English but show you understood.` });
    conversationMsgs.push({ role: 'assistant', content: 'Sure! I\'m happy to keep discussing. What would you like to explore further?' });

    const context = priorMsgs.slice(-4);
    for (const m of context) {
      conversationMsgs.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text });
    }
    for (const m of msgs) {
      conversationMsgs.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text });
    }
    conversationMsgs.push({ role: 'user', content: text });

    try {
      const reply = await window.claude.complete({ messages: conversationMsgs });
      setMsgs(m => [...m, { role: 'ai', text: reply }]);
    } catch (err) {
      setMsgs(m => [...m, { role: 'ai', text: 'Good question! Could you tell me more about what you\'re curious about?' }]);
    }
    setLoading(false);
  };

  if (!open) {
    return React.createElement('div', { style: { textAlign: 'center', padding: '8px 0' } },
      React.createElement('button', {
        style: { padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: 'var(--purple)', fontFamily: 'inherit' },
        onClick: () => setOpen(true),
      }, '💬 Still have questions? Keep discussing'),
    );
  }

  return React.createElement('div', { style: { ...DS.chatArea, marginTop: 4 } },
    React.createElement('div', { style: DS.chatHeader },
      React.createElement('div', { style: DS.aiDot }),
      React.createElement('div', { style: DS.chatTitle }, 'Continue Discussion'),
      React.createElement('div', { style: DS.meta }, 'Ask anything about this topic'),
    ),
    React.createElement('div', { style: { ...DS.msgList, maxHeight: 260 } },
      msgs.length === 0 && React.createElement('div', { style: { fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: 16 } }, 'Ask a follow-up question, or share what you\'re still confused about.'),
      msgs.map((m, i) =>
        m.role === 'ai'
          ? React.createElement('div', { key: i, style: DS.msgAi },
              React.createElement('div', { style: DS.aiAvatar }, 'S'),
              React.createElement('div', { style: DS.aiBubble }, m.text))
          : React.createElement('div', { key: i, style: DS.msgStudent },
              React.createElement('div', { style: DS.studentBubble }, m.text))
      ),
      loading && React.createElement(TypingIndicator, null),
      React.createElement('div', { ref: endRef }),
    ),
    React.createElement('div', { style: DS.inputRow },
      React.createElement('textarea', {
        style: DS.input, placeholder: 'Ask anything... (English or 中文)',
        value: input, rows: 1,
        onChange: e => setInput(e.target.value),
        onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } },
      }),
      React.createElement('button', {
        style: { ...DS.sendBtn, ...(input.trim() && !loading ? {} : DS.sendBtnOff) },
        onClick: send,
      }, '→'),
    ),
  );
}

Object.assign(window, { SocraticDiscuss, DISCUSS_CONFIGS });
