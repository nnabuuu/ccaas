/**
 * Mock Data for Lesson Plan Designer MCP Server
 *
 * Provides mock curriculum standards, textbook content, and teaching resources
 * for demonstration purposes.
 */

// ===== Curriculum Standards =====

export interface CurriculumStandard {
  id: string;
  code: string;
  subject: string;
  gradeLevel: string;
  category: 'content' | 'academic';
  title: string;
  description: string;
  keywords: string[];
}

export const MOCK_CURRICULUM_STANDARDS: CurriculumStandard[] = [
  // Mathematics Standards
  {
    id: 'math-3-1',
    code: 'MA.3.NSO.1',
    subject: '数学',
    gradeLevel: '三年级',
    category: 'content',
    title: '数与运算 - 分数的认识',
    description: '理解分数的意义，能够用分数表示整体的一部分，认识简单的分数。',
    keywords: ['分数', '数学', '三年级', '数与运算'],
  },
  {
    id: 'math-3-2',
    code: 'MA.3.NSO.2',
    subject: '数学',
    gradeLevel: '三年级',
    category: 'content',
    title: '数与运算 - 分数的比较',
    description: '能够比较同分母分数的大小，理解分数大小的基本规律。',
    keywords: ['分数', '比较', '大小', '数学'],
  },
  {
    id: 'math-3-3',
    code: 'MA.3.AR.1',
    subject: '数学',
    gradeLevel: '三年级',
    category: 'academic',
    title: '代数推理 - 数量关系',
    description: '能够用符号表示数量关系，初步理解等式的概念。',
    keywords: ['代数', '等式', '数量关系', '推理'],
  },
  {
    id: 'math-4-1',
    code: 'MA.4.FR.1',
    subject: '数学',
    gradeLevel: '四年级',
    category: 'content',
    title: '分数运算 - 同分母分数加减法',
    description: '掌握同分母分数的加减法运算方法，能够正确进行计算。',
    keywords: ['分数', '加减法', '运算', '四年级'],
  },
  // Chinese Standards
  {
    id: 'chi-3-1',
    code: 'CH.3.RD.1',
    subject: '语文',
    gradeLevel: '三年级',
    category: 'content',
    title: '阅读理解 - 理解课文主要内容',
    description: '能够读懂课文的主要内容，把握文章的中心思想。',
    keywords: ['阅读', '理解', '课文', '中心思想'],
  },
  {
    id: 'chi-3-2',
    code: 'CH.3.WR.1',
    subject: '语文',
    gradeLevel: '三年级',
    category: 'academic',
    title: '写作能力 - 记叙文写作',
    description: '能够按照一定顺序写清楚一件事情，语句通顺，使用标点符号正确。',
    keywords: ['写作', '记叙文', '作文', '表达'],
  },
  // Physics Standards
  {
    id: 'phy-8-1',
    code: 'PH.8.ME.1',
    subject: '物理',
    gradeLevel: '初二',
    category: 'content',
    title: '力学 - 力的概念',
    description: '理解力的概念，知道力的三要素，能够用示意图表示力。',
    keywords: ['力', '力学', '物理', '初二'],
  },
  {
    id: 'phy-8-2',
    code: 'PH.8.ME.2',
    subject: '物理',
    gradeLevel: '初二',
    category: 'content',
    title: '力学 - 二力平衡',
    description: '理解二力平衡的条件，能够分析简单的平衡问题。',
    keywords: ['力', '平衡', '二力平衡', '物理'],
  },
];

// ===== Textbook Content =====

export interface TextbookChapter {
  id: string;
  subject: string;
  gradeLevel: string;
  unit: string;
  chapter: string;
  title: string;
  summary: string;
  keyPoints: string[];
  vocabulary: string[];
}

export const MOCK_TEXTBOOK_CONTENT: TextbookChapter[] = [
  {
    id: 'math-3-u5-c1',
    subject: '数学',
    gradeLevel: '三年级',
    unit: '第五单元',
    chapter: '第1课',
    title: '分数的初步认识',
    summary: '本课主要介绍分数的基本概念，通过分物品的活动让学生理解"把一个整体平均分成若干份，取其中的一份或几份"的含义。',
    keyPoints: [
      '分数的意义：把一个整体平均分成若干份',
      '分数的表示方法：分子、分母',
      '用分数表示图形的一部分',
    ],
    vocabulary: ['分数', '分子', '分母', '平均分'],
  },
  {
    id: 'math-3-u5-c2',
    subject: '数学',
    gradeLevel: '三年级',
    unit: '第五单元',
    chapter: '第2课',
    title: '几分之一的认识',
    summary: '通过折纸、涂色等活动，帮助学生认识几分之一，理解单位分数的含义。',
    keyPoints: [
      '二分之一、三分之一等单位分数',
      '用图形表示几分之一',
      '比较简单的单位分数',
    ],
    vocabulary: ['二分之一', '三分之一', '四分之一', '单位分数'],
  },
  {
    id: 'chi-3-u4-c1',
    subject: '语文',
    gradeLevel: '三年级',
    unit: '第四单元',
    chapter: '第10课',
    title: '秋天的雨',
    summary: '这是一篇写景散文，描写了秋天的雨带来的各种变化，表达了作者对秋天的喜爱之情。',
    keyPoints: [
      '理解课文中的比喻和拟人手法',
      '感受秋天的美丽',
      '学习按顺序描写景物的方法',
    ],
    vocabulary: ['秋雨', '比喻', '拟人', '景物描写'],
  },
  {
    id: 'phy-8-u1-c1',
    subject: '物理',
    gradeLevel: '初二',
    unit: '第一章',
    chapter: '第1节',
    title: '力',
    summary: '本节介绍力的基本概念，包括力的定义、力的作用效果、力的三要素以及力的示意图。',
    keyPoints: [
      '力是物体对物体的作用',
      '力可以改变物体的形状和运动状态',
      '力的三要素：大小、方向、作用点',
      '力的示意图画法',
    ],
    vocabulary: ['力', '形变', '运动状态', '力的示意图'],
  },
];

// ===== Teaching Resources =====

export interface TeachingResource {
  id: string;
  type: 'video' | 'document' | 'interactive' | 'image' | 'exercise';
  subject: string;
  gradeLevel: string;
  title: string;
  description: string;
  url: string;
  duration?: string;
  keywords: string[];
}

export const MOCK_TEACHING_RESOURCES: TeachingResource[] = [
  {
    id: 'res-math-3-1',
    type: 'video',
    subject: '数学',
    gradeLevel: '三年级',
    title: '分数的认识 - 动画演示',
    description: '通过生动的动画演示，帮助学生理解分数的概念和意义。',
    url: 'https://example.com/videos/fraction-intro.mp4',
    duration: '5分钟',
    keywords: ['分数', '动画', '演示', '入门'],
  },
  {
    id: 'res-math-3-2',
    type: 'interactive',
    subject: '数学',
    gradeLevel: '三年级',
    title: '分数比较互动游戏',
    description: '学生通过拖拽和点击，比较不同分数的大小，加深对分数概念的理解。',
    url: 'https://example.com/games/fraction-compare.html',
    keywords: ['分数', '互动', '游戏', '比较'],
  },
  {
    id: 'res-math-3-3',
    type: 'exercise',
    subject: '数学',
    gradeLevel: '三年级',
    title: '分数基础练习题',
    description: '包含20道分数基础练习题，涵盖分数的认识、表示和比较。',
    url: 'https://example.com/exercises/fraction-basic.pdf',
    keywords: ['分数', '练习', '习题', '测试'],
  },
  {
    id: 'res-chi-3-1',
    type: 'image',
    subject: '语文',
    gradeLevel: '三年级',
    title: '秋天的雨 - 配图',
    description: '精美的秋天景色图片集，可用于课堂展示和情境创设。',
    url: 'https://example.com/images/autumn-rain.zip',
    keywords: ['秋天', '图片', '景色', '配图'],
  },
  {
    id: 'res-phy-8-1',
    type: 'video',
    subject: '物理',
    gradeLevel: '初二',
    title: '力的作用效果实验演示',
    description: '通过实验演示力可以改变物体的形状和运动状态。',
    url: 'https://example.com/videos/force-effects.mp4',
    duration: '8分钟',
    keywords: ['力', '实验', '演示', '物理'],
  },
  {
    id: 'res-phy-8-2',
    type: 'document',
    subject: '物理',
    gradeLevel: '初二',
    title: '力学概念图解手册',
    description: '图文并茂的力学概念手册，包含力的概念、二力平衡等核心知识点。',
    url: 'https://example.com/docs/mechanics-handbook.pdf',
    keywords: ['力学', '手册', '图解', '概念'],
  },
];

// ===== Search Functions =====

/**
 * Search curriculum standards by subject, grade, or keywords
 */
export function searchCurriculumStandards(query: {
  subject?: string;
  gradeLevel?: string;
  keyword?: string;
  category?: 'content' | 'academic';
}): CurriculumStandard[] {
  let results = [...MOCK_CURRICULUM_STANDARDS];

  if (query.subject) {
    results = results.filter(s =>
      s.subject.toLowerCase().includes(query.subject!.toLowerCase())
    );
  }

  if (query.gradeLevel) {
    results = results.filter(s =>
      s.gradeLevel.toLowerCase().includes(query.gradeLevel!.toLowerCase())
    );
  }

  if (query.category) {
    results = results.filter(s => s.category === query.category);
  }

  if (query.keyword) {
    const kw = query.keyword.toLowerCase();
    results = results.filter(s =>
      s.title.toLowerCase().includes(kw) ||
      s.description.toLowerCase().includes(kw) ||
      s.keywords.some(k => k.toLowerCase().includes(kw))
    );
  }

  return results;
}

/**
 * Search textbook content by subject, grade, or keywords
 */
export function searchTextbook(query: {
  subject?: string;
  gradeLevel?: string;
  keyword?: string;
}): TextbookChapter[] {
  let results = [...MOCK_TEXTBOOK_CONTENT];

  if (query.subject) {
    results = results.filter(t =>
      t.subject.toLowerCase().includes(query.subject!.toLowerCase())
    );
  }

  if (query.gradeLevel) {
    results = results.filter(t =>
      t.gradeLevel.toLowerCase().includes(query.gradeLevel!.toLowerCase())
    );
  }

  if (query.keyword) {
    const kw = query.keyword.toLowerCase();
    results = results.filter(t =>
      t.title.toLowerCase().includes(kw) ||
      t.summary.toLowerCase().includes(kw) ||
      t.keyPoints.some(p => p.toLowerCase().includes(kw)) ||
      t.vocabulary.some(v => v.toLowerCase().includes(kw))
    );
  }

  return results;
}

/**
 * Search teaching resources by type, subject, grade, or keywords
 */
export function searchTeachingResources(query: {
  type?: TeachingResource['type'];
  subject?: string;
  gradeLevel?: string;
  keyword?: string;
}): TeachingResource[] {
  let results = [...MOCK_TEACHING_RESOURCES];

  if (query.type) {
    results = results.filter(r => r.type === query.type);
  }

  if (query.subject) {
    results = results.filter(r =>
      r.subject.toLowerCase().includes(query.subject!.toLowerCase())
    );
  }

  if (query.gradeLevel) {
    results = results.filter(r =>
      r.gradeLevel.toLowerCase().includes(query.gradeLevel!.toLowerCase())
    );
  }

  if (query.keyword) {
    const kw = query.keyword.toLowerCase();
    results = results.filter(r =>
      r.title.toLowerCase().includes(kw) ||
      r.description.toLowerCase().includes(kw) ||
      r.keywords.some(k => k.toLowerCase().includes(kw))
    );
  }

  return results;
}

// ===== Textbook Edition Data (教材版本数据) =====

export interface TextbookSubject {
  id: string;
  label: string;
}

export interface TextbookGrade {
  id: number;
  label: string;
  stage: string;
}

export interface TextbookPublisher {
  id: string;
  label: string;
}

export interface TextbookVolume {
  id: string;
  label: string;
}

export interface TextbookEditionChapter {
  id: number;
  title: string;
  children?: TextbookEditionChapter[];
}

// Subjects
export const TEXTBOOK_SUBJECTS: TextbookSubject[] = [
  { id: 'math', label: '数学' },
  { id: 'chinese', label: '语文' },
  { id: 'english', label: '英语' },
];

// Grades
export const TEXTBOOK_GRADES: TextbookGrade[] = [
  { id: 1, label: '一年级', stage: '义务教育阶段第一学段' },
  { id: 2, label: '二年级', stage: '义务教育阶段第一学段' },
  { id: 3, label: '三年级', stage: '义务教育阶段第二学段' },
  { id: 4, label: '四年级', stage: '义务教育阶段第二学段' },
  { id: 5, label: '五年级', stage: '义务教育阶段第二学段' },
  { id: 6, label: '六年级', stage: '义务教育阶段第二学段' },
];

// Publishers
export const TEXTBOOK_PUBLISHERS: TextbookPublisher[] = [
  { id: 'pep', label: '人教版' },
  { id: 'bsd', label: '北师大版' },
  { id: 'su', label: '苏教版' },
];

// Volumes
export const TEXTBOOK_VOLUMES: TextbookVolume[] = [
  { id: 'vol1', label: '上册' },
  { id: 'vol2', label: '下册' },
];

// Chapter trees by grade, publisher, and volume
const TEXTBOOK_CHAPTER_TREES: Record<string, TextbookEditionChapter[]> = {
  // Grade 3, PEP, Volume 1 (三年级上册 - 人教版)
  '3-pep-vol1': [
    {
      id: 1,
      title: '第一单元 时、分、秒',
      children: [
        { id: 11, title: '秒的认识' },
        { id: 12, title: '时间的计算' },
      ],
    },
    {
      id: 2,
      title: '第二单元 万以内的加法和减法（一）',
      children: [
        { id: 21, title: '两位数加两位数' },
        { id: 22, title: '两位数减两位数' },
        { id: 23, title: '几百几十加、减几百几十' },
      ],
    },
    {
      id: 3,
      title: '第三单元 测量',
      children: [
        { id: 31, title: '毫米、分米的认识' },
        { id: 32, title: '千米的认识' },
        { id: 33, title: '吨的认识' },
      ],
    },
    {
      id: 4,
      title: '第四单元 万以内的加法和减法（二）',
      children: [
        { id: 41, title: '加法' },
        { id: 42, title: '减法' },
        { id: 43, title: '整理和复习' },
      ],
    },
    {
      id: 5,
      title: '第五单元 倍的认识',
      children: [
        { id: 51, title: '倍的认识' },
        { id: 52, title: '求一个数是另一个数的几倍' },
        { id: 53, title: '求一个数的几倍是多少' },
      ],
    },
    {
      id: 6,
      title: '第六单元 多位数乘一位数',
      children: [
        { id: 61, title: '口算乘法' },
        { id: 62, title: '笔算乘法' },
      ],
    },
    {
      id: 7,
      title: '第七单元 长方形和正方形',
      children: [
        { id: 71, title: '四边形' },
        { id: 72, title: '周长' },
        { id: 73, title: '长方形和正方形的周长' },
      ],
    },
    {
      id: 8,
      title: '第八单元 分数的初步认识',
      children: [
        { id: 81, title: '认识几分之一' },
        { id: 82, title: '认识几分之几' },
        { id: 83, title: '分数的简单计算' },
        { id: 84, title: '分数的简单应用' },
      ],
    },
    {
      id: 9,
      title: '第九单元 数学广角——集合',
      children: [{ id: 91, title: '集合' }],
    },
    {
      id: 10,
      title: '第十单元 总复习',
      children: [{ id: 101, title: '总复习' }],
    },
  ],
  // Grade 3, PEP, Volume 2 (三年级下册 - 人教版)
  '3-pep-vol2': [
    {
      id: 1,
      title: '第一单元 位置与方向（一）',
      children: [
        { id: 11, title: '认识东、南、西、北' },
        { id: 12, title: '认识东北、东南、西北、西南' },
        { id: 13, title: '简单的路线图' },
      ],
    },
    {
      id: 2,
      title: '第二单元 除数是一位数的除法',
      children: [
        { id: 21, title: '口算除法' },
        { id: 22, title: '笔算除法' },
      ],
    },
    {
      id: 3,
      title: '第三单元 复式统计表',
      children: [{ id: 31, title: '复式统计表' }],
    },
    {
      id: 4,
      title: '第四单元 两位数乘两位数',
      children: [
        { id: 41, title: '口算乘法' },
        { id: 42, title: '笔算乘法' },
      ],
    },
    {
      id: 5,
      title: '第五单元 面积',
      children: [
        { id: 51, title: '面积和面积单位' },
        { id: 52, title: '长方形、正方形面积的计算' },
        { id: 53, title: '面积单位间的进率' },
      ],
    },
    {
      id: 6,
      title: '第六单元 年、月、日',
      children: [
        { id: 61, title: '年、月、日' },
        { id: 62, title: '24时计时法' },
      ],
    },
    {
      id: 7,
      title: '第七单元 小数的初步认识',
      children: [
        { id: 71, title: '认识小数' },
        { id: 72, title: '简单的小数加减法' },
      ],
    },
    {
      id: 8,
      title: '第八单元 数学广角——搭配（二）',
      children: [{ id: 81, title: '搭配问题' }],
    },
  ],
  // Grade 4, PEP, Volume 1 (四年级上册 - 人教版)
  '4-pep-vol1': [
    {
      id: 1,
      title: '第一单元 大数的认识',
      children: [
        { id: 11, title: '亿以内数的认识' },
        { id: 12, title: '亿以内数的读法和写法' },
        { id: 13, title: '亿以上数的认识' },
      ],
    },
    {
      id: 2,
      title: '第二单元 公顷和平方千米',
      children: [
        { id: 21, title: '公顷' },
        { id: 22, title: '平方千米' },
      ],
    },
    {
      id: 3,
      title: '第三单元 角的度量',
      children: [
        { id: 31, title: '线段、直线、射线' },
        { id: 32, title: '角的度量' },
        { id: 33, title: '角的分类' },
        { id: 34, title: '画角' },
      ],
    },
    {
      id: 4,
      title: '第四单元 三位数乘两位数',
      children: [
        { id: 41, title: '口算乘法' },
        { id: 42, title: '笔算乘法' },
        { id: 43, title: '积的变化规律' },
      ],
    },
    {
      id: 5,
      title: '第五单元 平行四边形和梯形',
      children: [
        { id: 51, title: '垂直与平行' },
        { id: 52, title: '平行四边形' },
        { id: 53, title: '梯形' },
      ],
    },
  ],
};

/**
 * Get textbook subjects
 */
export function getTextbookSubjects(): TextbookSubject[] {
  return TEXTBOOK_SUBJECTS;
}

/**
 * Get textbook grades for a subject
 */
export function getTextbookGrades(subject: string): TextbookGrade[] {
  if (subject === 'math' || subject === '数学') {
    return TEXTBOOK_GRADES;
  }
  return [];
}

/**
 * Get textbook publishers for a subject and grade
 */
export function getTextbookPublishers(subject: string, gradeId: number): TextbookPublisher[] {
  if (subject === 'math' || subject === '数学') {
    return TEXTBOOK_PUBLISHERS;
  }
  return [];
}

/**
 * Get textbook volumes
 */
export function getTextbookVolumes(subject: string, gradeId: number, publisher: string): TextbookVolume[] {
  if (subject === 'math' || subject === '数学') {
    return TEXTBOOK_VOLUMES;
  }
  return [];
}

/**
 * Get textbook chapters for a specific edition
 */
export function getTextbookChapters(
  subject: string,
  gradeId: number,
  publisher: string,
  volume: string
): TextbookEditionChapter[] {
  if (subject !== 'math' && subject !== '数学') {
    return [];
  }

  // Map publisher label to key
  const publisherMap: Record<string, string> = {
    '人教版': 'pep',
    '北师大版': 'bsd',
    '苏教版': 'su',
    pep: 'pep',
    bsd: 'bsd',
    su: 'su',
  };

  // Map volume label to key
  const volumeMap: Record<string, string> = {
    '上册': 'vol1',
    '下册': 'vol2',
    vol1: 'vol1',
    vol2: 'vol2',
  };

  const publisherKey = publisherMap[publisher] || publisher;
  const volumeKey = volumeMap[volume] || volume;
  const key = `${gradeId}-${publisherKey}-${volumeKey}`;

  return TEXTBOOK_CHAPTER_TREES[key] || [];
}

/**
 * Find a chapter by ID in the chapter tree
 */
export function findTextbookChapterById(
  chapters: TextbookEditionChapter[],
  id: number
): TextbookEditionChapter | null {
  for (const chapter of chapters) {
    if (chapter.id === id) {
      return chapter;
    }
    if (chapter.children) {
      const found = findTextbookChapterById(chapter.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
