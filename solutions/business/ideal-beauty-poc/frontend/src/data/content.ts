/* ═══════ FULL TEXT ═══════ */
export const FULL_TEXT_PARAS = [
  `Nigerian teenager Happiness Edem had just one aim in life: to put on weight. So she spent six months in a "fattening room" where her daily routine was to sleep, eat and grow fat. She went in weighing 60 kg, but came out weighing twice that. In some parts of Africa, being fat is desirable because it is a sign of attractiveness in women and power and wealth in men.`,
  `However, in magazines and in the media we are bombarded with images of slim women with a fair complexion and handsome, broad-shouldered young men. It is fairly rare to see short-sighted, middle-aged models. Some people question these shallow beauty ideals. Is one idea of physical beauty really more attractive than another?`,
  `Ideas about physical beauty change over time and different periods of history reveal different views of beauty, particularly of women. Egyptian paintings often show slim dark-haired women as the normal practice, while one of the earliest representations of women in art in Europe is an overweight female. This is the Venus of Hohle Fels and it is more than 35,000 years old. In the early 1600s, artists like Peter Paul Rubens also painted plump, pale-skinned women who were thought to be the most stunning examples of female beauty at that time. In Elizabethan England, pale skin was still fashionable because it was a sign of wealth: the make-up used to achieve this look was expensive, so only rich people could afford it.`,
  `Within different cultures around the world, there is a huge difference in what is considered beautiful. Traditional customs, like tattooing, head-shaving, piercing or other kinds of bodily changes can express social position, identity or values. In Borneo, for instance, tattoos are like a diary because they are a written record of all the important events and places a man has experienced in his life. For New Zealand's Maoris they reflect the person's position in society. Western society used to have a very low opinion of tattoos. Today they are considered a popular form of body art among the new generation.`,
  `For Europeans, the tradition of using metal rings to stretch a girl's neck may be shocking, but the Myanmar people consider women with long and thin necks more elegant. In Indonesia, the custom of sharpening girls' teeth to points might seem very odd while it is perfectly acceptable in other places to straighten children's teeth with braces. Wearing rings in the nose or plastic surgery might be seen as ugly and unattractive by some cultures, but it is commonplace in many others.`,
  `It appears that through the ages and across different cultures, people have always changed their bodies and faces for a wide variety of reasons: sometimes to help them look more beautiful, and sometimes to enable them to show social position or display group identity. Whether it is wearing make-up or decorating the body with tattoos, rings and piercings, different cultures view these things with different eyes. Does this mean that we are all beautiful in our own way?`,
];

/* ═══════ SENTENCE SPLITTING ═══════ */
export function splitSents(t: string): string[] {
  return (t.match(/[^.!?]+[.!?]+[\s]*/g) || [t]).map(s => s.trim()).filter(Boolean);
}

export interface Sent {
  pi: number;
  si: number;
  text: string;
  id: string;
}

export const SENTS: Sent[] = FULL_TEXT_PARAS.flatMap((p, pi) =>
  splitSents(p).map((s, si) => ({ pi, si, text: s, id: `${pi}-${si}` }))
);

/* ═══════ TRANSITIONS ═══════ */
export const TRANS = [
  'So', 'because', 'but', 'However,', 'while', 'also',
  'In the early 1600s,', 'In Elizabethan England,',
  'Within different cultures around the world,',
  'like', 'for instance,', 'Today',
  'but the Myanmar people', 'while it is perfectly acceptable',
  'through the ages and across different cultures,',
  'Whether', 'over time',
];

export const TCAT: Record<string, string[]> = {
  example: ['like', 'for instance,'],
  contrast: ['However,', 'while', 'but', 'but the Myanmar people', 'while it is perfectly acceptable'],
  temporal: ['So', 'In the early 1600s,', 'In Elizabethan England,', 'Today', 'over time', 'through the ages and across different cultures,'],
  causal: ['because'],
  cultural: ['Within different cultures around the world,', 'Whether'],
  addition: ['also'],
};

export function catOf(p: string): string {
  for (const [c, ps] of Object.entries(TCAT)) if (ps.includes(p)) return c;
  return 'other';
}

export const CAT_C: Record<string, string> = {
  example: '#a78bfa', contrast: '#a78bfa', temporal: '#a78bfa',
  causal: '#a78bfa', cultural: '#a78bfa', addition: '#a78bfa',
};
export const CAT_L: Record<string, string> = {
  example: 'Example', contrast: 'Contrast', temporal: 'Time/Culture',
  causal: 'Cause', cultural: 'Cultural', addition: 'Addition',
};

/* ═══════ BEAUTY EXAMPLES ═══════ */
export const BEAUTY_EX = [
  { c: 'Nigeria', s: 'Fattening room', p: 'Contemporary' },
  { c: 'Western media', s: 'Slim ideal', p: 'Contemporary' },
  { c: 'Ancient Egypt', s: 'Slim, dark-haired', p: 'Ancient' },
  { c: 'Venus of Hohle Fels', s: 'Overweight figure', p: '35,000+ yrs' },
  { c: 'Rubens era', s: 'Plump, pale-skinned', p: '1600s' },
  { c: 'Elizabethan England', s: 'Pale skin = wealth', p: '16th c.' },
  { c: 'Borneo', s: 'Tattoo diary', p: 'Traditional' },
  { c: 'NZ Māori', s: 'Tattoos = rank', p: 'Traditional' },
  { c: 'Myanmar', s: 'Long neck rings', p: 'Traditional' },
  { c: 'Indonesia', s: 'Sharpened teeth', p: 'Traditional' },
];

/* ═══════ RUBRIC ═══════ */
export const RUBRIC = [
  { key: 'hasTopicSentence', label: 'Topic sentence', short: 'TS' },
  { key: 'hasSpecificExample', label: 'Specific example', short: 'Ex' },
  { key: 'usesTransitions', label: 'Transitions', short: 'Tr' },
] as const;

/* ═══════ SCENES ═══════ */
export interface Scene {
  id: string;
  type: 'lecture' | 'task';
  label: string;
  zh: string;
}

export const SCENES: Scene[] = [
  { id: 'L1', type: 'lecture', label: 'Reading', zh: '阅读导入' },
  { id: 'T1', type: 'task', label: 'Highlight P-E-E', zh: '标注结构' },
  { id: 'L2', type: 'lecture', label: 'Structure & Transitions', zh: '结构与过渡' },
  { id: 'T2', type: 'task', label: 'Pick transitions', zh: '采集过渡词' },
  { id: 'L3', type: 'lecture', label: 'Writing task', zh: '写作任务' },
  { id: 'T3', type: 'task', label: 'Write & evaluate', zh: '写作工坊' },
  { id: 'T4', type: 'task', label: 'Final submit', zh: '最终提交' },
];

/* ═══════ HIGHLIGHT TOOLS ═══════ */
export interface HLTool {
  key: string;
  label: string;
  color: string;
  bg: string;
}

export const HL: HLTool[] = [
  { key: 'topic', label: 'Topic sentence', color: '#a78bfa', bg: 'rgba(167,139,250,.18)' },
  { key: 'point', label: 'Point', color: '#8b9eb8', bg: 'rgba(139,158,184,.12)' },
  { key: 'evidence', label: 'Evidence', color: '#7da88a', bg: 'rgba(125,168,138,.12)' },
  { key: 'elaboration', label: 'Elaboration', color: '#b8a77e', bg: 'rgba(184,167,126,.12)' },
];

export function hlFor(k: string): HLTool | undefined {
  return HL.find(t => t.key === k);
}
