// Mock data for textbook API (Mathematics only)

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

export interface TextbookChapter {
  id: number;
  title: string;
  children?: TextbookChapter[];
}

// Subjects (currently only Math is supported)
export const SUBJECTS: TextbookSubject[] = [
  { id: 'math', label: '数学' },
  { id: 'chinese', label: '语文' },
  { id: 'english', label: '英语' },
];

// Grades
export const MATH_GRADES: TextbookGrade[] = [
  { id: 1, label: '一年级', stage: '义务教育阶段第一学段' },
  { id: 2, label: '二年级', stage: '义务教育阶段第一学段' },
  { id: 3, label: '三年级', stage: '义务教育阶段第二学段' },
  { id: 4, label: '四年级', stage: '义务教育阶段第二学段' },
  { id: 5, label: '五年级', stage: '义务教育阶段第二学段' },
  { id: 6, label: '六年级', stage: '义务教育阶段第二学段' },
];

// Publishers
export const MATH_PUBLISHERS: TextbookPublisher[] = [
  { id: 'pep', label: '人教版' },
  { id: 'bsd', label: '北师大版' },
  { id: 'su', label: '苏教版' },
];

// Volumes
export const VOLUMES: TextbookVolume[] = [
  { id: 'vol1', label: '上册' },
  { id: 'vol2', label: '下册' },
];

// Chapter trees by grade, publisher, and volume
// Key format: `${gradeId}-${publisher}-${volume}`
export const CHAPTER_TREES: Record<string, TextbookChapter[]> = {
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
        { id: 63, title: '整理和复习' },
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
      children: [
        { id: 91, title: '集合' },
      ],
    },
    {
      id: 10,
      title: '第十单元 总复习',
      children: [
        { id: 101, title: '总复习' },
      ],
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
        { id: 23, title: '整理和复习' },
      ],
    },
    {
      id: 3,
      title: '第三单元 复式统计表',
      children: [
        { id: 31, title: '复式统计表' },
      ],
    },
    {
      id: 4,
      title: '第四单元 两位数乘两位数',
      children: [
        { id: 41, title: '口算乘法' },
        { id: 42, title: '笔算乘法' },
        { id: 43, title: '整理和复习' },
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
      children: [
        { id: 81, title: '搭配问题' },
      ],
    },
    {
      id: 9,
      title: '第九单元 总复习',
      children: [
        { id: 91, title: '总复习' },
      ],
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
        { id: 14, title: '计算工具的认识' },
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
    {
      id: 6,
      title: '第六单元 除数是两位数的除法',
      children: [
        { id: 61, title: '口算除法' },
        { id: 62, title: '笔算除法' },
        { id: 63, title: '商的变化规律' },
      ],
    },
    {
      id: 7,
      title: '第七单元 条形统计图',
      children: [
        { id: 71, title: '条形统计图' },
      ],
    },
    {
      id: 8,
      title: '第八单元 数学广角——优化',
      children: [
        { id: 81, title: '沏茶问题' },
        { id: 82, title: '烙饼问题' },
        { id: 83, title: '田忌赛马' },
      ],
    },
    {
      id: 9,
      title: '第九单元 总复习',
      children: [
        { id: 91, title: '总复习' },
      ],
    },
  ],

  // Grade 1, PEP, Volume 1 (一年级上册 - 人教版)
  '1-pep-vol1': [
    {
      id: 1,
      title: '第一单元 准备课',
      children: [
        { id: 11, title: '数一数' },
        { id: 12, title: '比多少' },
      ],
    },
    {
      id: 2,
      title: '第二单元 位置',
      children: [
        { id: 21, title: '上、下、前、后' },
        { id: 22, title: '左、右' },
      ],
    },
    {
      id: 3,
      title: '第三单元 1~5的认识和加减法',
      children: [
        { id: 31, title: '1~5的认识' },
        { id: 32, title: '比大小' },
        { id: 33, title: '加法' },
        { id: 34, title: '减法' },
        { id: 35, title: '0的认识和加减法' },
      ],
    },
    {
      id: 4,
      title: '第四单元 认识图形（一）',
      children: [
        { id: 41, title: '认识图形' },
      ],
    },
    {
      id: 5,
      title: '第五单元 6~10的认识和加减法',
      children: [
        { id: 51, title: '6和7的认识' },
        { id: 52, title: '8和9的认识' },
        { id: 53, title: '10的认识' },
        { id: 54, title: '连加、连减' },
        { id: 55, title: '加减混合' },
      ],
    },
    {
      id: 6,
      title: '第六单元 11~20各数的认识',
      children: [
        { id: 61, title: '11~20各数的认识' },
        { id: 62, title: '十加几和相应的减法' },
      ],
    },
    {
      id: 7,
      title: '第七单元 认识钟表',
      children: [
        { id: 71, title: '认识钟表' },
      ],
    },
    {
      id: 8,
      title: '第八单元 20以内的进位加法',
      children: [
        { id: 81, title: '9加几' },
        { id: 82, title: '8、7、6加几' },
        { id: 83, title: '5、4、3、2加几' },
      ],
    },
    {
      id: 9,
      title: '第九单元 总复习',
      children: [
        { id: 91, title: '总复习' },
      ],
    },
  ],

  // Grade 2, PEP, Volume 1 (二年级上册 - 人教版)
  '2-pep-vol1': [
    {
      id: 1,
      title: '第一单元 长度单位',
      children: [
        { id: 11, title: '统一长度单位' },
        { id: 12, title: '认识厘米' },
        { id: 13, title: '认识米' },
        { id: 14, title: '认识线段' },
      ],
    },
    {
      id: 2,
      title: '第二单元 100以内的加法和减法（二）',
      children: [
        { id: 21, title: '两位数加两位数' },
        { id: 22, title: '两位数减两位数' },
        { id: 23, title: '连加、连减和加减混合' },
      ],
    },
    {
      id: 3,
      title: '第三单元 角的初步认识',
      children: [
        { id: 31, title: '角的初步认识' },
        { id: 32, title: '直角的初步认识' },
      ],
    },
    {
      id: 4,
      title: '第四单元 表内乘法（一）',
      children: [
        { id: 41, title: '乘法的初步认识' },
        { id: 42, title: '5的乘法口诀' },
        { id: 43, title: '2、3、4的乘法口诀' },
      ],
    },
    {
      id: 5,
      title: '第五单元 观察物体（一）',
      children: [
        { id: 51, title: '观察物体' },
      ],
    },
    {
      id: 6,
      title: '第六单元 表内乘法（二）',
      children: [
        { id: 61, title: '7的乘法口诀' },
        { id: 62, title: '8的乘法口诀' },
        { id: 63, title: '9的乘法口诀' },
      ],
    },
    {
      id: 7,
      title: '第七单元 认识时间',
      children: [
        { id: 71, title: '认识时间' },
      ],
    },
    {
      id: 8,
      title: '第八单元 数学广角——搭配（一）',
      children: [
        { id: 81, title: '简单的排列' },
        { id: 82, title: '简单的组合' },
      ],
    },
    {
      id: 9,
      title: '第九单元 总复习',
      children: [
        { id: 91, title: '总复习' },
      ],
    },
  ],

  // Grade 5, PEP, Volume 1 (五年级上册 - 人教版)
  '5-pep-vol1': [
    {
      id: 1,
      title: '第一单元 小数乘法',
      children: [
        { id: 11, title: '小数乘整数' },
        { id: 12, title: '小数乘小数' },
        { id: 13, title: '积的近似数' },
        { id: 14, title: '整数乘法运算定律推广到小数' },
      ],
    },
    {
      id: 2,
      title: '第二单元 位置',
      children: [
        { id: 21, title: '用数对确定位置' },
      ],
    },
    {
      id: 3,
      title: '第三单元 小数除法',
      children: [
        { id: 31, title: '除数是整数的小数除法' },
        { id: 32, title: '一个数除以小数' },
        { id: 33, title: '商的近似数' },
        { id: 34, title: '循环小数' },
        { id: 35, title: '用计算器探索规律' },
      ],
    },
    {
      id: 4,
      title: '第四单元 可能性',
      children: [
        { id: 41, title: '可能性' },
      ],
    },
    {
      id: 5,
      title: '第五单元 简易方程',
      children: [
        { id: 51, title: '用字母表示数' },
        { id: 52, title: '解简易方程' },
        { id: 53, title: '实际问题与方程' },
      ],
    },
    {
      id: 6,
      title: '第六单元 多边形的面积',
      children: [
        { id: 61, title: '平行四边形的面积' },
        { id: 62, title: '三角形的面积' },
        { id: 63, title: '梯形的面积' },
        { id: 64, title: '组合图形的面积' },
      ],
    },
    {
      id: 7,
      title: '第七单元 植树问题',
      children: [
        { id: 71, title: '植树问题' },
      ],
    },
    {
      id: 8,
      title: '第八单元 总复习',
      children: [
        { id: 81, title: '总复习' },
      ],
    },
  ],

  // Grade 6, PEP, Volume 1 (六年级上册 - 人教版)
  '6-pep-vol1': [
    {
      id: 1,
      title: '第一单元 分数乘法',
      children: [
        { id: 11, title: '分数乘整数' },
        { id: 12, title: '分数乘分数' },
        { id: 13, title: '分数混合运算' },
        { id: 14, title: '解决问题' },
      ],
    },
    {
      id: 2,
      title: '第二单元 位置与方向（二）',
      children: [
        { id: 21, title: '位置与方向' },
      ],
    },
    {
      id: 3,
      title: '第三单元 分数除法',
      children: [
        { id: 31, title: '倒数的认识' },
        { id: 32, title: '分数除法' },
        { id: 33, title: '解决问题' },
      ],
    },
    {
      id: 4,
      title: '第四单元 比',
      children: [
        { id: 41, title: '比的意义' },
        { id: 42, title: '比的基本性质' },
        { id: 43, title: '比的应用' },
      ],
    },
    {
      id: 5,
      title: '第五单元 圆',
      children: [
        { id: 51, title: '圆的认识' },
        { id: 52, title: '圆的周长' },
        { id: 53, title: '圆的面积' },
        { id: 54, title: '扇形' },
      ],
    },
    {
      id: 6,
      title: '第六单元 百分数（一）',
      children: [
        { id: 61, title: '百分数的意义' },
        { id: 62, title: '百分数和分数、小数的互化' },
        { id: 63, title: '用百分数解决问题' },
      ],
    },
    {
      id: 7,
      title: '第七单元 扇形统计图',
      children: [
        { id: 71, title: '扇形统计图' },
      ],
    },
    {
      id: 8,
      title: '第八单元 数学广角——数与形',
      children: [
        { id: 81, title: '数与形' },
      ],
    },
    {
      id: 9,
      title: '第九单元 总复习',
      children: [
        { id: 91, title: '总复习' },
      ],
    },
  ],
};

// Helper function to get chapters
export function getChapters(
  subject: string,
  gradeId: number,
  publisher: string,
  volume: string,
): TextbookChapter[] {
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

  return CHAPTER_TREES[key] || [];
}

// Helper function to find a chapter by ID recursively
export function findChapterById(
  chapters: TextbookChapter[],
  id: number,
): TextbookChapter | null {
  for (const chapter of chapters) {
    if (chapter.id === id) {
      return chapter;
    }
    if (chapter.children) {
      const found = findChapterById(chapter.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
