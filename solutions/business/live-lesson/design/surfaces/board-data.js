// ui_kits/board/board-data.js
// Example board for the *Ideal Beauty* lesson, all 5 steps populated.
// Each step now defines its own column layout — real teachers re-divide the
// board at each phase. Blocks carry a `region` ('L'|'C'|'R') to land in a
// specific column; `fullBleed:true` lets a block span all columns.
// Loaded as a global: window.IDEAL_BEAUTY_BOARD

window.IDEAL_BEAUTY_BOARD = {
  id: 'ideal-beauty-2024',
  lesson: {
    title: 'Ideal Beauty',
    subtitle: '高一(3)班 · 阅读策略训练',
    class: 'B7U2 · Beauty Across Cultures',
  },
  steps: [
    {
      id: 's1', idx: 1, label: '图式激活',
      layout: { columns: [
        { id: 'L', title: '现象', subtitle: '先观察',  tone: 'cool',   width: 1 },
        { id: 'C', title: '对照', subtitle: '媒体 vs 现实', tone: 'warm', width: 1.4 },
        { id: 'R', title: '悬念', subtitle: '带着问题读', tone: 'accent', width: 1 },
      ] },
    },
    {
      id: 's2', idx: 2, label: '结构解码',
      layout: { columns: [
        { id: 'L', title: '信号词', subtitle: '首句 + 转折词', tone: 'cool',   width: 1 },
        { id: 'C', title: '骨架',   subtitle: '四段结构',       tone: 'accent', width: 2 },
      ] },
    },
    {
      id: 's3', idx: 3, label: '矩阵构建',
      layout: { columns: [
        { id: 'L', title: '矩阵',     subtitle: 'Place × Practice × Reason', tone: 'neutral', width: 2 },
        { id: 'R', title: '学生答题', subtitle: '对比讲评',                  tone: 'warm',    width: 1 },
      ] },
    },
    {
      id: 's4', idx: 4, label: '批判质疑',
      layout: { columns: [
        { id: 'L', title: '论点',   subtitle: '媒体的主张', tone: 'cool',   width: 1 },
        { id: 'C', title: '立场',   subtitle: '你怎么看',   tone: 'accent', width: 1.6 },
        { id: 'R', title: '评分点', subtitle: '怎么写',     tone: 'muted',  width: 1 },
      ] },
    },
    {
      id: 's5', idx: 5, label: '复盘升华',
      layout: { columns: [
        { id: 'L', title: '方法',   subtitle: '4 策略复盘',       tone: 'cool',   width: 1 },
        { id: 'C', title: '文本',   subtitle: '回到 ¶8',           tone: 'muted',  width: 1 },
        { id: 'R', title: '主题',   subtitle: 'Beauty = ?',         tone: 'accent', width: 1.2 },
      ] },
    },
  ],

  blocks: [
    // ───────────────────────────── STEP 1 · Schema activation ─────────────
    {
      id: 'b-s1-title', kind: 'heading',
      geometry: { col: 1, span: 12 }, fullBleed: true,
      style: { tone: 'neutral', emphasis: 'strong' },
      reveal: { step: 1, sub: 1 },
      data: { eyebrow: 'Step 1 · Predicting', text: 'What is "beautiful"?', accent: '从你的经验出发' },
    },
    {
      id: 'b-s1-quote', kind: 'quote',
      region: 'L', geometry: { col: 1, span: 12 },
      style: { tone: 'cool' },
      reveal: { step: 1, sub: 2 },
      data: {
        paragraph: '¶2',
        text: 'Many people are worried that modern media promotes shallow beauty ideals.',
        highlights: ['shallow beauty ideals'],
      },
    },
    {
      id: 'b-s1-compare', kind: 'compare',
      region: 'C', geometry: { col: 1, span: 12 },
      style: { tone: 'neutral' },
      reveal: { step: 1, sub: 3 },
      data: {
        joiner: 'vs',
        left:  { label: 'Modern Media', tone: 'cool',
                 items: ['slim', 'fair-skinned', 'youthful', 'symmetrical', '"shallow"'] },
        right: { label: 'Real Cultures', tone: 'warm',
                 items: ['plump (Nigeria)', 'tattooed (Borneo)', 'painted (Egypt)', 'long-necked (Myanmar)'] },
      },
    },
    {
      id: 'b-s1-prompt', kind: 'annotation',
      region: 'R', geometry: { col: 1, span: 12 },
      style: { tone: 'accent' },
      reveal: { step: 1, sub: 4 },
      data: { kind: 'aha', text: '👁 作者真的同意 "shallow" 吗？带着这个怀疑读下去。' },
    },
    {
      id: 'b-s1-followup', kind: 'annotation',
      region: 'R', geometry: { col: 1, span: 12 },
      style: { tone: 'muted', density: 'tight' },
      reveal: { step: 1, sub: 5 },
      data: { kind: 'note', text: '找证据：每个文化都有自己的"理想"，这算 shallow 吗？' },
    },

    // ───────────────────────────── STEP 2 · Structure decode ──────────────
    {
      id: 'b-s2-title', kind: 'heading',
      geometry: { col: 1, span: 12 }, fullBleed: true,
      style: { tone: 'neutral', emphasis: 'strong' },
      reveal: { step: 2, sub: 1 },
      data: { eyebrow: 'Step 2 · Skimming', text: '读首句，找骨架' },
    },
    {
      id: 'b-s2-signals', kind: 'chip-row',
      region: 'L', geometry: { col: 1, span: 12 },
      style: { tone: 'cool' },
      reveal: { step: 2, sub: 2 },
      data: { items: [
        { text: 'change over time',          note: '→ 时间' },
        { text: 'different periods',         note: '→ 时间' },
        { text: 'around the world',          note: '→ 地理' },
        { text: 'different cultures',        note: '→ 地理' },
        { text: 'It appears that',           note: '→ 总结', tone: 'accent' },
      ] },
    },
    {
      id: 'b-s2-method', kind: 'annotation',
      region: 'L', geometry: { col: 1, span: 12 },
      style: { tone: 'muted', density: 'tight' },
      reveal: { step: 2, sub: 4 },
      data: { kind: 'aha', text: '每段只读首句 + 转折词 = 拿到全文骨架。3 分钟 vs 30 分钟。' },
    },
    {
      id: 'b-s2-flow', kind: 'flow',
      region: 'C', geometry: { col: 1, span: 12 },
      style: { tone: 'accent' },
      reveal: { step: 2, sub: 3 },
      data: { arrow: 'right', steps: [
        { paragraph: '¶1-2', label: 'Phenomenon', sub: 'Media vs Reality' },
        { paragraph: '¶3-4', label: 'History',    sub: 'Across Time' },
        { paragraph: '¶5-7', label: 'Culture',    sub: 'Across Space' },
        { paragraph: '¶8',   label: 'Conclusion', sub: 'All Beautiful' },
      ] },
    },
    {
      id: 'b-s2-pattern', kind: 'formula',
      region: 'C', geometry: { col: 1, span: 12 },
      style: { tone: 'cool' },
      reveal: { step: 2, sub: 5 },
      data: {
        expr: '首句 + [change / within / It appears] = 段落功能',
        caption: '这是 skimming 的核心公式',
      },
    },

    // ───────────────────────────── STEP 3 · Matrix scan ───────────────────
    {
      id: 'b-s3-title', kind: 'heading',
      geometry: { col: 1, span: 12 }, fullBleed: true,
      style: { tone: 'neutral', emphasis: 'strong' },
      reveal: { step: 3, sub: 1 },
      data: { eyebrow: 'Step 3 · Scanning', text: 'Place × Practice × Reason' },
    },
    {
      id: 'b-s3-matrix', kind: 'matrix',
      region: 'L', geometry: { col: 1, span: 12 },
      style: { tone: 'neutral' },
      reveal: { step: 3, sub: 2 },
      data: {
        headers: ['Place', 'Practice', 'Reason'],
        rows: [
          { tone: 'demo', cells: [
            { text: 'Ancient Egypt', note: '示范 ¶3' },
            { text: 'kohl eye paint' },
            { text: 'status' },
          ]},
          { cells: [
            { text: 'Borneo', note: '¶5' },
            { text: 'tattoos' },
            { text: 'diary of events' },
          ]},
          { cells: [
            { text: 'NZ Maori', note: '¶6' },
            { text: 'tā moko', mark: 'sig', note: '常误写为 tattoos' },
            { text: 'position in society' },
          ]},
          { cells: [
            { text: 'Myanmar', note: '¶7' },
            { text: 'metal neck rings' },
            { placeholder: '——?', mark: 'warn' },
          ]},
          { cells: [
            { text: 'Indonesia', note: '¶7' },
            { text: 'sharpened teeth' },
            { text: 'cultural identity' },
          ]},
        ],
      },
    },
    {
      id: 'b-s3-pattern', kind: 'formula',
      region: 'L', geometry: { col: 1, span: 12 },
      style: { tone: 'accent' },
      reveal: { step: 3, sub: 3 },
      data: {
        expr: 'In [Place], people [Practice] because it means [Reason].',
        caption: '答题句型 — 用矩阵每一行套这句话',
      },
    },
    {
      id: 'b-s3-stu-good', kind: 'student-work',
      region: 'R', geometry: { col: 1, span: 12 },
      style: { tone: 'success' },
      reveal: { step: 3, sub: 4 },
      data: {
        author: '林雅婷', status: 'celebrate',
        text: 'In Borneo, people get tattoos because they record important life events — like a diary on skin.',
      },
    },
    {
      id: 'b-s3-stu-redo', kind: 'student-work',
      region: 'R', geometry: { col: 1, span: 12 },
      style: { tone: 'warm' },
      reveal: { step: 3, sub: 5 },
      data: {
        author: '陈思远', status: 'redo',
        text: 'In Myanmar, women wear neck rings because they look beautiful.',
      },
    },
    {
      id: 'b-s3-redo-note', kind: 'annotation',
      region: 'R', geometry: { col: 1, span: 12 },
      style: { tone: 'warm' },
      reveal: { step: 3, sub: 6 },
      data: {
        kind: 'warning',
        text: '⚠ 思远 → 雅婷：从 "好看" 到 "文化意义"。↗ ¶8 "tell the world about culture and status"',
      },
    },

    // ───────────────────────────── STEP 4 · Critical evaluation ───────────
    {
      id: 'b-s4-title', kind: 'heading',
      geometry: { col: 1, span: 12 }, fullBleed: true,
      style: { tone: 'neutral', emphasis: 'strong' },
      reveal: { step: 4, sub: 1 },
      data: { eyebrow: 'Step 4 · Evaluating', text: 'Challenge "shallow beauty"' },
    },
    {
      id: 'b-s4-claim', kind: 'quote',
      region: 'L', geometry: { col: 1, span: 12 },
      style: { tone: 'cool' },
      reveal: { step: 4, sub: 2 },
      data: {
        paragraph: '¶2', text: '"Modern media promotes shallow beauty ideals."',
        highlights: ['shallow'],
      },
    },
    {
      id: 'b-s4-claim-note', kind: 'annotation',
      region: 'L', geometry: { col: 1, span: 12 },
      style: { tone: 'muted', density: 'tight' },
      reveal: { step: 4, sub: 3 },
      data: { kind: 'note', text: '作者只是引用了 "many people" 的看法 — 这是一个观点，不是结论。' },
    },
    {
      id: 'b-s4-mindmap', kind: 'mindmap',
      region: 'C', geometry: { col: 1, span: 12 },
      style: { tone: 'accent' },
      reveal: { step: 4, sub: 4 },
      data: {
        center: { label: 'shallow?', note: '同意 / 不同意 ?' },
        branches: [
          { label: 'Disagree',     leaves: ['Borneo: 记录人生', 'Maori: 社会地位', 'Egypt: 阶级符号', 'Myanmar: 文化身份'] },
          { label: 'Partly agree', leaves: ['媒体审美单一', '滤镜 ≠ 真实', 'BUT: 不同文化都有 "理想"'] },
          { label: 'Agree',        leaves: ['fashion 杂志', '"slim and fair"', '商业驱动'] },
        ],
      },
    },
    {
      id: 'b-s4-rubric', kind: 'annotation',
      region: 'R', geometry: { col: 1, span: 12 },
      style: { tone: 'muted' },
      reveal: { step: 4, sub: 5 },
      data: {
        kind: 'note',
        text: '评分点：\n① 立场清晰\n② 引用 ≥ 2 条矩阵事实\n③ 用 First / Second / Therefore 组段',
      },
    },
    {
      id: 'b-s4-pattern', kind: 'formula',
      region: 'R', geometry: { col: 1, span: 12 },
      style: { tone: 'accent' },
      reveal: { step: 4, sub: 6 },
      data: {
        expr: 'I [agree/disagree] that ... First, in [Place]... Second, in [Place]... Therefore, beauty is [not] shallow.',
        caption: '议论段模板',
      },
    },

    // ───────────────────────────── STEP 5 · Synthesis & recap ─────────────
    {
      id: 'b-s5-title', kind: 'heading',
      geometry: { col: 1, span: 12 }, fullBleed: true,
      style: { tone: 'neutral', emphasis: 'strong' },
      reveal: { step: 5, sub: 1 },
      data: { eyebrow: 'Step 5 · Recap', text: '4 Strategies, 1 Conclusion' },
    },
    {
      id: 'b-s5-strategies', kind: 'flow',
      region: 'L', geometry: { col: 1, span: 12 },
      style: { tone: 'cool' },
      reveal: { step: 5, sub: 2 },
      data: { arrow: 'right', steps: [
        { paragraph: '①', label: 'Predict',  sub: '激活图式' },
        { paragraph: '②', label: 'Skim',     sub: '骨架' },
        { paragraph: '③', label: 'Scan',     sub: '矩阵' },
        { paragraph: '④', label: 'Evaluate', sub: '批判' },
      ] },
    },
    {
      id: 'b-s5-quote', kind: 'quote',
      region: 'C', geometry: { col: 1, span: 12 },
      style: { tone: 'muted' },
      reveal: { step: 5, sub: 3 },
      data: {
        paragraph: '¶8',
        text: 'It appears that people change their appearance to tell the world about their culture and status.',
        highlights: ['tell the world', 'culture and status'],
      },
    },
    {
      id: 'b-s5-thesis', kind: 'mindmap',
      region: 'R', geometry: { col: 1, span: 12 },
      style: { tone: 'accent' },
      reveal: { step: 5, sub: 4 },
      data: {
        center: { label: 'Beauty', note: '= cultural language' },
        branches: [
          { label: 'across time',  leaves: ['ancient kohl', '1600s pale', 'today slim'] },
          { label: 'across space', leaves: ['Nigeria 丰满', 'Borneo 纹身', 'Myanmar 颈环'] },
          { label: 'common root',  leaves: ['表达身份', '群体归属', '"tell the world"'] },
        ],
      },
    },
    {
      id: 'b-s5-hw', kind: 'annotation',
      geometry: { col: 1, span: 12 }, fullBleed: true,
      style: { tone: 'success', emphasis: 'strong' },
      reveal: { step: 5, sub: 5 },
      data: {
        kind: 'aha',
        text: '📒 HW：用今天的 4 步法读 "Beyond the Plate"。提交 structure map + matrix。下节课对比讲评。',
      },
    },
  ],
};
