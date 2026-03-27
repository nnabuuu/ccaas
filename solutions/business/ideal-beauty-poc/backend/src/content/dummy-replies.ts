/**
 * 7 preset Q&A for the Help Center.
 * Exact-match lookup — if the student question matches a key, return the reply instantly.
 * Extracted from PoC JSX (ideal-beauty-student.jsx).
 */

export const DUMMY_REPLIES: Record<string, string> = {
  "What does 'fattening room' mean?":
    'A <b>fattening room</b> is a traditional practice in West Africa. Young women stay in a special room to gain weight before marriage — a fuller body means wealth and beauty. 增肥房 = 西非传统，出嫁前增重。',

  'What is a topic sentence?':
    'A <b>topic sentence</b> states the main idea of the whole passage. Look for a sentence that covers beauty across both time AND cultures. 主题句 = 概括全文核心观点的句子。',

  'P-E-E 结构是什么？':
    'P-E-E = <b>Point</b>（观点）→ <b>Evidence</b>（论据）→ <b>Elaboration</b>（阐释）。先说观点，再给例子，再解释为什么。',

  '这篇文章主要讲什么？':
    '文章主要说<b>不同文化和历史时期对美的定义不同</b>——没有统一标准，美是被文化塑造的。',

  '"while" 和 "but" 有什么区别？':
    '<b>while</b> 对比并列 (While A..., B...); <b>but</b> 是转折矛盾 (A, but B). while 更温和，but 更强烈。',

  'What counts as a transition?':
    'Look for words that <b>connect</b> ideas: contrast (However, but), examples (for instance), time (Today), cause (because). 过渡词 = 逻辑连接词。',

  'How should I start my paragraph?':
    'Start with a <b>topic sentence</b>: "Beauty standards are shaped by cultural values." Then add your example. 先写主题句，再跟例子。',
};
