/**
 * "Ideal Beauty" reading passage — 6 paragraphs + sentence-level splits.
 * Extracted from PoC JSX (ideal-beauty-student.jsx).
 */

export const FULL_TEXT_PARAS: string[] = [
  `Nigerian teenager Happiness Edem had just one aim in life: to put on weight. So she spent six months in a "fattening room" where her daily routine was to sleep, eat and grow fat. She went in weighing 60 kg, but came out weighing twice that. In some parts of Africa, being fat is desirable because it is a sign of attractiveness in women and power and wealth in men.`,
  `However, in magazines and in the media we are bombarded with images of slim women with a fair complexion and handsome, broad-shouldered young men. It is fairly rare to see short-sighted, middle-aged models. Some people question these shallow beauty ideals. Is one idea of physical beauty really more attractive than another?`,
  `Ideas about physical beauty change over time and different periods of history reveal different views of beauty, particularly of women. Egyptian paintings often show slim dark-haired women as the normal practice, while one of the earliest representations of women in art in Europe is an overweight female. This is the Venus of Hohle Fels and it is more than 35,000 years old. In the early 1600s, artists like Peter Paul Rubens also painted plump, pale-skinned women who were thought to be the most stunning examples of female beauty at that time. In Elizabethan England, pale skin was still fashionable because it was a sign of wealth: the make-up used to achieve this look was expensive, so only rich people could afford it.`,
  `Within different cultures around the world, there is a huge difference in what is considered beautiful. Traditional customs, like tattooing, head-shaving, piercing or other kinds of bodily changes can express social position, identity or values. In Borneo, for instance, tattoos are like a diary because they are a written record of all the important events and places a man has experienced in his life. For New Zealand's Maoris they reflect the person's position in society. Western society used to have a very low opinion of tattoos. Today they are considered a popular form of body art among the new generation.`,
  `For Europeans, the tradition of using metal rings to stretch a girl's neck may be shocking, but the Myanmar people consider women with long and thin necks more elegant. In Indonesia, the custom of sharpening girls' teeth to points might seem very odd while it is perfectly acceptable in other places to straighten children's teeth with braces. Wearing rings in the nose or plastic surgery might be seen as ugly and unattractive by some cultures, but it is commonplace in many others.`,
  `It appears that through the ages and across different cultures, people have always changed their bodies and faces for a wide variety of reasons: sometimes to help them look more beautiful, and sometimes to enable them to show social position or display group identity. Whether it is wearing make-up or decorating the body with tattoos, rings and piercings, different cultures view these things with different eyes. Does this mean that we are all beautiful in our own way?`,
];

export interface Sentence {
  pi: number; // paragraph index
  si: number; // sentence index within paragraph
  text: string;
  id: string; // "{pi}-{si}"
}

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+[\s]*/g) || [text])
    .map((s) => s.trim())
    .filter(Boolean);
}

export const SENTS: Sentence[] = FULL_TEXT_PARAS.flatMap((p, pi) =>
  splitSentences(p).map((s, si) => ({ pi, si, text: s, id: `${pi}-${si}` })),
);
