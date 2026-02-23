import { readFileSync, writeFileSync } from 'fs';

const items = JSON.parse(readFileSync('quiz-gen-chunk-xiaoxue-en-4.json', 'utf8'));
const result = {};

function extractInfo(leafName) {
  let word = '';
  let pos = '';
  let chinese = '';
  let extra = '';

  const m1 = leafName.match(/^(.+?)\s*[\(（](.+?)[\)）]\s*$/);
  if (m1) {
    word = m1[1].trim();
    const inside = m1[2].trim();
    // Strip trailing punctuation/spaces before matching Chinese
    const insideTrimmed = inside.replace(/[,，\s]+$/, '').trim();
    const chMatch = insideTrimmed.match(/[\u4e00-\u9fff][\u4e00-\u9fff\w\s，；、·（）\(\)…—～\-\/]*$/);
    if (chMatch) {
      chinese = chMatch[0].trim();
      const before = insideTrimmed.substring(0, insideTrimmed.length - chMatch[0].length).replace(/[,，\s]+$/, '').trim();
      const posMatch = before.match(/^(n\.|v\.|adj\.|adv\.|prep\.|int\.|num\.|pron\.|modal verb|abbr\.|v\.ing|pt\.|n,)/i);
      if (posMatch) {
        pos = posMatch[1];
      }
      extra = before;
    } else {
      extra = inside;
    }
  } else {
    // Try to handle unclosed parentheses: "word(rest..."
    const m2 = leafName.match(/^(\w[\w'-]*)\s*[\(（](.+)$/);
    if (m2) {
      word = m2[1].trim();
      extra = m2[2].trim();
    } else {
      word = leafName.trim();
    }
  }

  return { word, pos, chinese, extra, raw: leafName };
}

function generateQuiz(item) {
  const { leafName, n1Name } = item;
  const info = extractInfo(leafName);

  // Skip deleted items — generate a simple quiz anyway
  // (items marked 删除 still need a quiz for the benchmark)

  // Past tense patterns — many variants:
  // "swept(sweep的过去式)" "came (v. come的过去式 来)" "ran (run 过去式)(删除)"
  // "loved (love 过去式)" "planted(过去式)" "talked(v. talk 说话的过去式)"
  // "woke(v. wake 醒来的过去式)" "shot (v. shoot过去式 投射)"
  if (leafName.includes('过去式')) {
    let base = '';
    // Strategy 1: find English word immediately before 过去式 (with optional 的)
    // e.g. "sweep的过去式" -> sweep, "come的过去式" -> come
    const m1 = leafName.match(/([a-zA-Z]+)的过去式/);
    if (m1) {
      base = m1[1].trim();
    }
    // Strategy 2: find English word followed by space then 过去式
    // e.g. "run 过去式" -> run, "shoot过去式" -> shoot
    if (!base) {
      const m2 = leafName.match(/([a-zA-Z]+)\s*过去式/);
      if (m2) {
        const candidate = m2[1].trim();
        const pastWord = (info.word || leafName.split(/[\s(（]/)[0]).trim();
        // Only use if it's different from the past tense word
        if (candidate !== pastWord) {
          base = candidate;
        }
      }
    }
    // Strategy 3: find English base verb anywhere in parentheses (e.g. "v. talk 说话的过去式")
    if (!base) {
      const m3 = leafName.match(/[\(（].*?(?:v\.?\s*)?([a-zA-Z]{2,})\s+/);
      if (m3) {
        const candidate = m3[1].trim();
        const pastWord = (info.word || leafName.split(/[\s(（]/)[0]).trim();
        if (candidate !== pastWord && !['v', 'n', 'adj', 'adv', 'pt'].includes(candidate.toLowerCase())) {
          base = candidate;
        }
      }
    }
    // Strategy 4: Derive from the past tense word itself
    const pastWord = (info.word || leafName.split(/[\s(（]/)[0]).trim();
    if (!base || base === pastWord) {
      // Known irregular past tenses
      const irregularPast = {
        'woke': 'wake', 'ran': 'run', 'came': 'come', 'went': 'go',
        'saw': 'see', 'got': 'get', 'made': 'make', 'took': 'take',
        'gave': 'give', 'found': 'find', 'told': 'tell', 'felt': 'feel',
        'left': 'leave', 'brought': 'bring', 'thought': 'think', 'kept': 'keep',
        'held': 'hold', 'stood': 'stand', 'lost': 'lose', 'paid': 'pay',
        'met': 'meet', 'sat': 'sit', 'read': 'read', 'spent': 'spend',
        'grew': 'grow', 'won': 'win', 'hung': 'hang', 'shot': 'shoot',
        'led': 'lead', 'bit': 'bite', 'broke': 'break', 'chose': 'choose',
        'drove': 'drive', 'ate': 'eat', 'fell': 'fall', 'flew': 'fly',
        'forgot': 'forget', 'froze': 'freeze', 'hid': 'hide', 'knew': 'know',
        'lay': 'lie', 'rode': 'ride', 'rang': 'ring', 'rose': 'rise',
        'sang': 'sing', 'sank': 'sink', 'slept': 'sleep', 'spoke': 'speak',
        'stole': 'steal', 'swam': 'swim', 'swept': 'sweep', 'threw': 'throw',
        'wore': 'wear', 'wrote': 'write', 'sold': 'sell', 'built': 'build',
        'caught': 'catch', 'dug': 'dig', 'drew': 'draw', 'fed': 'feed',
        'fought': 'fight', 'heard': 'hear', 'lent': 'lend', 'meant': 'mean',
        'sent': 'send', 'shook': 'shake', 'shone': 'shine', 'spread': 'spread',
        'struck': 'strike', 'taught': 'teach', 'tore': 'tear', 'wept': 'weep',
        'wound': 'wind', 'bent': 'bend', 'crept': 'creep', 'dealt': 'deal',
        'leapt': 'leap', 'spelt': 'spell', 'spilt': 'spill', 'wove': 'weave',
      };
      if (irregularPast[pastWord]) {
        base = irregularPast[pastWord];
      } else if (pastWord.endsWith('ed')) {
        // Regular past: derive base
        if (pastWord.endsWith('ied')) {
          base = pastWord.slice(0, -3) + 'y'; // carried -> carry
        } else if (pastWord.match(/([^aeiou])\1ed$/) && pastWord.length <= 8) {
          base = pastWord.slice(0, -3); // stopped -> stop
        } else {
          // For "planted" (plant+ed) vs "loved" (love+d):
          // If char before "ed" is 'e', base = word - 'd' (loved -> love)
          // Otherwise base = word - 'ed' (planted -> plant)
          const beforeEd = pastWord.slice(0, -2);
          if (beforeEd.endsWith('e')) {
            // But 'agreed' -> 'agree', not 'agre'... check: agreedee? no.
            // Actually: 'loved' -> before='lov' doesn't end in 'e'
            // Wait: pastWord='loved', pastWord.slice(0,-2)='love' which DOES end in 'e'
            // So base = 'love' (drop 'ed' = 'lov' is wrong, we want 'love')
            // Actually for 'loved': drop just 'd' gives 'love' (correct)
            base = pastWord.slice(0, -1); // drop 'd': loved -> love
          } else {
            base = beforeEd; // drop 'ed': planted -> plant
          }
        }
      }
      if (!base || base === pastWord) {
        base = n1Name.replace(/[\(（].*$/, '').trim();
      }
    }
    if (base) {
      return `填空：写出动词 ${base} 的过去式：______。`;
    }
  }

  // Past participle: "gone(n. the past participle of go, 去)"
  if (leafName.includes('past participle')) {
    const m = leafName.match(/past participle of (\w+)/);
    if (m) {
      return `填空：写出动词 ${m[1]} 的过去分词形式：______。`;
    }
  }

  // Gerund/present participle: "singing(v.ing, song, sing的动名词)"
  if (leafName.includes('动名词')) {
    const m = leafName.match(/(\w+)的动名词/);
    if (m) {
      return `填空：写出动词 ${m[1]} 的动名词形式：______。`;
    }
  }

  // Present participle: "singing(v.ing ... sing的现在分词)"
  if (leafName.includes('现在分词')) {
    const m = leafName.match(/(\w+)的现在分词/);
    if (m) {
      return `填空：写出动词 ${m[1]} 的现在分词形式：______。`;
    }
  }

  // Reflexive pronoun: "反身代词：himself" or "yourselves(反身代词：你们自己)"
  if (leafName.includes('反身代词')) {
    const reflexiveMap = {
      'himself': 'he', 'herself': 'she', 'itself': 'it',
      'myself': 'I', 'yourself': 'you', 'yourselves': 'you (plural)',
      'themselves': 'they', 'ourselves': 'we'
    };
    const m = leafName.match(/反身代词[：:]?\s*(\w+)/);
    if (m) {
      const base = reflexiveMap[m[1]] || n1Name;
      return `填空：写出 ${base} 对应的反身代词：______。`;
    }
    const m2 = leafName.match(/^(\w+)\s*[\(（]反身代词/);
    if (m2) {
      const base = reflexiveMap[m2[1]] || n1Name;
      return `填空：写出 ${base} 对应的反身代词：______。`;
    }
  }

  // Superlative: "tallest(最高级)"
  if (leafName.includes('最高级')) {
    const supWord = info.word || leafName.split('(')[0].trim();
    let baseAdj = supWord;
    // Known superlative -> base mappings
    const superlativeMap = {
      'tallest': 'tall', 'shortest': 'short', 'longest': 'long',
      'biggest': 'big', 'hottest': 'hot', 'thinnest': 'thin',
      'happiest': 'happy', 'easiest': 'easy',
    };
    if (superlativeMap[supWord]) {
      baseAdj = superlativeMap[supWord];
    } else if (supWord.endsWith('iest')) {
      baseAdj = supWord.slice(0, -4) + 'y';
    } else if (supWord.endsWith('est')) {
      baseAdj = supWord.slice(0, -3);
    }
    return `填空：写出 ${baseAdj} 的最高级形式：______。`;
  }

  // Plural forms: "vegetables(n. food, vegetable的复数)" or "geese(n. animal, goose的复数)"
  if (leafName.includes('的复数')) {
    const m = leafName.match(/(\w+)的复数/);
    if (m) {
      return `填空：写出 ${m[1]} 的复数形式：______。`;
    }
  }

  // thief -> thieves pattern
  if (leafName.includes('复数形式')) {
    const m = leafName.match(/(\w+)的?复数形式/);
    if (m) {
      return `填空：写出 ${m[1]} 的复数形式：______。`;
    }
  }

  // "dishes(n. container, 盘子复数)" — Chinese includes 复数
  if (info.chinese && info.chinese.includes('复数') && !leafName.includes('的复数')) {
    const chineseBase = info.chinese.replace(/复数$/, '').replace(/[的，,\s]+$/, '').trim();
    if (chineseBase) {
      return `填空：根据中文提示写出对应的英文单词（复数形式）。"${chineseBase}" → ______。`;
    }
    // Derive singular
    const pluralWord = info.word;
    let singular = pluralWord;
    if (pluralWord.endsWith('ies')) singular = pluralWord.slice(0, -3) + 'y';
    else if (pluralWord.endsWith('es')) singular = pluralWord.slice(0, -2);
    else if (pluralWord.endsWith('s')) singular = pluralWord.slice(0, -1);
    return `填空：写出 ${singular} 的复数形式：______。`;
  }

  // Contraction: "I'll=I will"
  if (leafName.includes('=')) {
    const parts = leafName.split('=');
    if (parts.length === 2) {
      return `填空：写出 ${parts[1].trim()} 的缩写形式：______。`;
    }
  }

  // have的第三人称单数: "has (v.have的第三人称单数)"
  if (leafName.includes('第三人称单数')) {
    const m = leafName.match(/(\w+)的第三人称单数/);
    if (m) {
      return `填空：写出 ${m[1]} 的第三人称单数形式：______。`;
    }
  }

  // am/is(was) pattern
  if (leafName === 'am/is(was)') {
    return `填空：am 和 is 的过去式是______。`;
  }

  // Month abbreviations: "Jan. (n. 一月)"
  const monthMatch = leafName.match(/^(Jan\.|Feb\.|Mar\.|Apr\.|May\.|Jun\.|Jul\.|Aug\.|Sept?\.|Oct\.|Nov\.|Dec\.)\s*[\(（].*?([\u4e00-\u9fff]+月)[\)）]?$/);
  if (monthMatch) {
    return `填空："${monthMatch[2]}"的英文缩写是______。`;
  }

  // Ordinal numbers: "1st（adj. first, 第一）"
  const ordinalMatch = leafName.match(/^(\d+\w{2})\s*[\(（].*?(第[\u4e00-\u9fff]+)[\)）]?$/);
  if (ordinalMatch) {
    return `填空：${ordinalMatch[2]}的序数词缩写是______。`;
  }

  // Cardinal number: "forty-six(n.number,46)"
  const cardinalMatch = leafName.match(/^([\w-]+)\s*[\(（].*?n\.?\s*number\s*,?\s*(\d+)[\)）]?$/i);
  if (cardinalMatch) {
    return `填空：数字 ${cardinalMatch[2]} 用英语怎么写？______。`;
  }

  // "zero(num. number, 基数词0)"
  if (leafName.includes('基数词')) {
    return `填空：数字 0 用英语怎么写？______。`;
  }

  // Person names: "Lily (人名)" etc
  if (leafName.match(/[\(（]?\s*人名/)) {
    const personWord = info.word || n1Name;
    if (info.chinese && info.chinese !== '人名' && !info.chinese.startsWith('人名')) {
      return `填空：在英语中，"${info.chinese.replace(/^人名[,，]?\s*/, '')}"这个人物用英文名字怎么拼写？______。`;
    }
    return `填空：请正确拼写英文人名：${personWord.split('').join(' ')} → ______。`;
  }

  // Abbreviations: "Dr=doctor(n. person, 医生)"
  if (leafName.startsWith('Dr=doctor')) {
    return `填空："医生"的英文单词缩写是______。`;
  }

  // Modal verbs: "cannot(modal verb, ...)"
  if (leafName.includes('modal verb')) {
    if (info.chinese) {
      const cleanCh = info.chinese.replace(/[\)）]+$/, '').trim();
      return `填空：表示"${cleanCh}"的情态动词是______。`;
    }
  }

  // Country/city/place proper nouns
  const placeCategories = ['country', 'city', 'continent', 'island', 'a country', 'a state', 'the capital'];
  const isPlace = placeCategories.some(c => info.extra.toLowerCase().includes(c)) ||
    leafName.match(/capital of/i) ||
    info.extra.toLowerCase().includes('places of int');
  if (isPlace && info.chinese) {
    return `填空："${info.chinese.replace(/[\)）]+$/, '')}"的英文名称是______。`;
  }
  if (info.extra.toLowerCase().includes('places of int') && !info.chinese) {
    return `填空：请写出著名景点 ${n1Name} 的正确英文拼写：______。`;
  }

  // Abbreviations like IT, ICT, CD-ROM, PS etc
  if (leafName.match(/^[A-Z]{2,}[\s(]/) || leafName.match(/^[A-Z][-.]/) || leafName.match(/^CD-ROM/)) {
    if (info.chinese) {
      return `填空："${info.chinese}"的英文缩写是______。`;
    }
  }

  // "cm(abbr. centimetres，厘米)"
  if (info.extra && info.extra.toLowerCase().includes('abbr')) {
    if (info.chinese) {
      return `填空："${info.chinese}"的英文缩写是______。`;
    }
  }

  // Extended known words lookup — covers bare words and words with English-only definitions
  const knownBareWords = {
    'phew': '表示松了一口气或觉得热的感叹词',
    'oops': '表示犯了小错误时的感叹词',
    'hmm': '表示犹豫或思考的语气词',
    'yuk': '表示讨厌或恶心的感叹词',
    'heeheehee': '表示偷笑的拟声词',
    'mm': '表示同意或思考的语气词',
    'er': '表示犹豫的语气词',
    'yucky': '表示恶心、讨厌的',
    'good-bye': '表示告别的用语',
    'anybody': '任何人',
    'none': '没有一个',
    'Ms.': '女士（不区分婚姻状况的称呼）',
    'hard-working': '努力工作的',
    'kg': '千克（kilogram的缩写）',
    'paw': '爪子',
    'set': '放置；一套',
    'dye': '染色',
    'population': '人口',
    'world-famous': '世界闻名的',
    'condition': '条件，状况',
    'succeed': '成功',
    'fail': '失败',
    'congratulations': '祝贺',
    'composer': '作曲家',
    'nation': '国家，民族',
    'Olympic': '奥林匹克的',
    'the U.S.': '美国',
    'India': '印度',
    'erhu': '二胡',
    'orchard': '果园',
    'Hyde Park': '海德公园',
    'Huangshan': '黄山',
    'the West Lake': '西湖',
    'Easter Bunny': '复活节兔子',
    'phone box': '电话亭',
    'North Pole': '北极',
    'South Pole': '南极',
    'KungFu Panda': '功夫熊猫',
    'CD player': 'CD播放器',
    'koala bear': '考拉',
    'black rhino': '黑犀牛',
    'L.A.Lakers': '洛杉矶湖人队',
    'tub': '盆，桶',
    'southeast': '东南方',
    'monarch': '君主',
    'km': '千米（kilometer的缩写）',
    'Lhasa': '拉萨',
    'scare': '使害怕',
    'neighbor': '邻居',
    'Edison': '爱迪生',
    'comb': '梳子',
  };

  // Words with English-only definitions (no Chinese in parentheses)
  const englishDefWords = {
    'such(refer to person / thing)': '这样的，如此的',
    'wake (stop sleeping)': '醒来',
    'dumplings(food)': '饺子',
    'career(job)': '职业',
    'doctor(Dr)': '医生',
    'scale(s)': '秤，天平',
    'mobile': '移动电话',
  };

  // Check English-def lookup by full leafName first
  const engDefLookup = englishDefWords[leafName];
  if (engDefLookup) {
    return `填空：根据中文提示写出对应的英文单词。"${engDefLookup}" → ______。`;
  }

  // Check if it's a word with only English definition (extra but no Chinese)
  if (!info.chinese && info.extra) {
    // Has parenthetical info but no Chinese meaning — check known words
    const w = info.word;
    const lookup = knownBareWords[w] || englishDefWords[leafName];
    if (lookup) {
      if (w.match(/^[A-Z]/) && w.length > 3 && !w.includes(' ')) {
        return `填空："${lookup}"的英文名称是______。`;
      }
      return `填空：根据中文提示写出对应的英文单词。"${lookup}" → ______。`;
    }
    // For words with English-only definitions like "comb(n. a flat piece of plastic...)"
    // just ask for Chinese meaning without showing the English word in quotes
    return `填空：请写出以下英文单词的中文含义：______ = ${info.extra}`;
  }

  // Bare words with no definition at all
  if (!info.chinese && !info.extra) {
    const w = info.word || n1Name;
    const lookup = knownBareWords[w] || knownBareWords[leafName];
    if (lookup) {
      if (w.match(/^[A-Z]/) && w.length > 3 && !w.includes(' ')) {
        return `填空："${lookup}"的英文名称是______。`;
      }
      return `填空：表示"${lookup}"的英文单词是______。`;
    }
    // Truly unknown bare word — ask Chinese→English using parent context
    return `简答：请写出英文单词的中文含义（提示：属于"${n1Name}"类别）：______。`;
  }

  // Brand names with Chinese containing English: iPod, iPhone, mobile
  if (info.chinese && info.word) {
    let cleanChinese = info.chinese
      .replace(/[\)）]+$/, '')
      .replace(/\s*$/, '')
      .trim();

    // Remove English brand names and the answer word from Chinese hint
    cleanChinese = cleanChinese
      .replace(/iPod\s*/gi, '')
      .replace(/iPhone\s*/gi, '')
      .replace(/iPad\s*/gi, '')
      .replace(/a mobile phone/gi, '手机')
      .replace(/mobile phone/gi, '手机')
      .replace(new RegExp(info.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
      .replace(/[\)）]+/g, '') // Remove stray closing parens
      .replace(/[\(（]+/g, '') // Remove stray opening parens
      .replace(/\s+/g, ' ')
      .trim();

    // If Chinese hint is now empty, use a generic description
    if (!cleanChinese || cleanChinese.length < 1 || !cleanChinese.match(/[\u4e00-\u9fff]/)) {
      return `简答：请写出英文单词的中文含义（提示：属于"${n1Name}"类别）：______。`;
    }

    return `填空：根据中文提示写出对应的英文单词。"${cleanChinese}" → ______。`;
  }

  // Fallback
  const w = info.word || n1Name;
  return `简答：请写出英文单词的中文含义（提示：属于"${n1Name}"类别）：______。`;
}

// Process all items
for (const item of items) {
  result[item.leafId] = generateQuiz(item);
}

// Verify count
console.log(`Generated ${Object.keys(result).length} quizzes for ${items.length} items`);

// Check for quizzes that accidentally contain the answer word
let issues = 0;
for (const item of items) {
  const quiz = result[item.leafId];
  const answerWord = (item.leafName.split(/[\(（]/)[0] || '').trim();
  if (answerWord.length >= 3 && quiz.includes(answerWord)) {
    // Allow if it's part of the question structure (e.g., asking about the base form)
    const allowed = [
      `动词 ${answerWord}`,
      `${answerWord} 的`,
      `${answerWord} 对应`,
      `人名：${answerWord}`,
      `属于"${answerWord}"`,
      `"${answerWord}"类别`,
    ];
    if (!allowed.some(a => quiz.includes(a))) {
      issues++;
      if (issues <= 10) {
        console.log(`WARNING: Quiz for ${item.leafId} may contain answer "${answerWord}": ${quiz.substring(0, 80)}`);
      }
    }
  }
}
if (issues > 0) {
  console.log(`Total potential answer-leak issues: ${issues}`);
}

writeFileSync('quiz-out-chunk-xiaoxue-en-4.json', JSON.stringify(result, null, 2), 'utf8');
console.log('Written to quiz-out-chunk-xiaoxue-en-4.json');
