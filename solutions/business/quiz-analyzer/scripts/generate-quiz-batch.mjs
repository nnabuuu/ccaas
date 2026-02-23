/**
 * Benchmark Quiz Generator (Phase 2 — Claude Code authored)
 *
 * Generates MCQ quiz questions for all 6,996 benchmark pairs using:
 * - Chinese subject quizzes: nearby leaf names as distractors
 * - English vocabulary: definition-clue MCQs (Chinese stem, English options)
 * - English grammar/topic: topic+grammar MCQs
 * - IPA phonics / alphabet: recognition MCQs
 *
 * Usage:
 *   node generate-quiz-batch.mjs --subject "小学-英语" --limit 500
 *   node generate-quiz-batch.mjs                    # all pending pairs
 *   node generate-quiz-batch.mjs --limit 500        # first 500 pending overall
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PAIRS_FILE      = path.resolve(__dirname, 'benchmark-pairs.json')
const CHECKPOINT_FILE = path.resolve(__dirname, 'benchmark-checkpoint.json')

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const subjectFilter = args.includes('--subject') ? args[args.indexOf('--subject') + 1] : null
const limitArg      = args.includes('--limit')   ? parseInt(args[args.indexOf('--limit') + 1]) : 0
const offsetArg     = args.includes('--offset')  ? parseInt(args[args.indexOf('--offset') + 1]) : 0
// --output writes a standalone JSON file instead of merging into the main checkpoint
const outputFile    = args.includes('--output')  ? path.resolve(__dirname, args[args.indexOf('--output') + 1]) : null

// ── Load data ─────────────────────────────────────────────────────────────────
const allPairs = JSON.parse(fs.readFileSync(PAIRS_FILE, 'utf-8'))
// When writing to a separate output file, start with empty quizzes (no checkpoint read needed)
let cp = { quizzes: {}, evaluations: {} }
if (!outputFile && fs.existsSync(CHECKPOINT_FILE)) {
  try { cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')) } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashStr(s) {
  let h = 0
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** Extract Chinese meaning from leafName patterns like "word(pos. en_def, 中文)" */
function parseVocabLeaf(leafName) {
  // "word(pos. english, 中文)"
  const m1 = leafName.match(/^(.+?)\(([a-z]+\.|[a-z]+\.?\s).+?[，,]\s*(.+?)\)$/)
  if (m1) return { word: m1[1].trim(), pos: m1[2].trim(), chinese: m1[3].trim() }

  // "word(中文)" — parenthetical is Chinese only
  const m2 = leafName.match(/^([A-Za-z].+?)\(([^\)]+)\)$/)
  if (m2 && /[\u4e00-\u9fff]/.test(m2[2])) return { word: m2[1].trim(), chinese: m2[2].trim() }

  // "word(n. something)" with Chinese inside
  const m3 = leafName.match(/^(.+?)\(.+[，,]\s*([\u4e00-\u9fff].+)\)$/)
  if (m3) return { word: m3[1].trim(), chinese: m3[2].replace(/\).*$/, '').trim() }

  // Bare Chinese text mixed with English — no parse
  return null
}

/** Select 3 distractor pairs from same subject, different n1 node. */
function getDistractors(pair, subjectPairs) {
  const diffN1 = subjectPairs.filter(p => p.leafId !== pair.leafId && p.n1Id !== pair.n1Id)
  const pool   = diffN1.length >= 3 ? diffN1 : subjectPairs.filter(p => p.leafId !== pair.leafId)

  const h   = hashStr(pair.leafId)
  const out = []
  const seen = new Set([pair.leafId])

  for (let i = 0; out.length < 3 && i < pool.length * 2; i++) {
    const candidate = pool[(h + i * 137) % pool.length]
    if (candidate && !seen.has(candidate.leafId)) {
      seen.add(candidate.leafId)
      out.push(candidate)
    }
  }

  // If still short, pad with anything different
  for (const p of subjectPairs) {
    if (out.length >= 3) break
    if (!seen.has(p.leafId)) { seen.add(p.leafId); out.push(p) }
  }

  return out.slice(0, 3)
}

/** Build MCQ string from stem + 4 options, placing correct at hash-determined slot. */
function buildMCQ(stem, correctText, distractorTexts) {
  const h = hashStr(correctText)
  const pos = h % 4  // 0=A, 1=B, 2=C, 3=D

  const options = [...distractorTexts.slice(0, 3)]
  options.splice(pos, 0, correctText)

  const labels = ['A', 'B', 'C', 'D']
  return `${stem}\n${labels.map((l, i) => `${l}. ${options[i]}`).join('\n')}`
}

// ── Subject-specific stem templates ───────────────────────────────────────────

const STEM_TEMPLATES = {
  '小学-数学': (n1) => `在小学数学"${n1}"的学习中，以下哪个知识点属于这一内容范畴？`,
  '初中-数学': (n1) => `在初中数学"${n1}"的学习中，下列哪项是该知识点下的具体内容？`,
  '高中-数学': (n1) => `在高中数学"${n1}"的学习中，下列哪项是该知识点的核心内容？`,
  '初中-物理': (n1) => `在初中物理"${n1}"的学习中，下列哪项是需要掌握的具体知识内容？`,
  '高中-物理': (n1) => `在高中物理"${n1}"的学习中，下列哪项属于这一知识点的核心内容？`,
  '初中-化学': (n1) => `在初中化学"${n1}"的学习中，下列哪项是该部分的具体知识内容？`,
  '高中-化学': (n1) => `在高中化学"${n1}"的学习中，下列哪项属于该知识点的主要内容？`,
  '初中-生物学': (n1) => `在初中生物学"${n1}"的学习中，下列哪项是需要掌握的具体知识内容？`,
  '高中-生物学': (n1) => `在高中生物学"${n1}"的学习中，下列哪项是该知识点的核心内容？`,
  '初中-历史': (n1) => `在初中历史"${n1}"的学习中，下列哪项是这一时期的重要历史事件或知识点？`,
  '高中-历史': (n1) => `在高中历史"${n1}"的学习中，下列哪项是该内容范畴内的具体知识点？`,
  '初中-地理': (n1) => `在初中地理"${n1}"的学习中，下列哪项属于这一地理知识范畴？`,
  '高中-地理': (n1) => `在高中地理"${n1}"的学习中，下列哪项是该知识点的核心内容？`,
  '初中-道德与法治': (n1) => `在初中"${n1}"的学习中，下列哪项是这一内容中需要理解的重要知识？`,
  '高中-思想政治': (n1) => `在高中政治"${n1}"的学习中，下列哪项是该知识点下的核心内容？`,
  '小学-语文': (n1) => `在小学语文"${n1}"的学习中，下列哪项是这一知识范畴内的具体内容？`,
  '初中-语文': (n1) => `在初中语文"${n1}"的学习中，下列哪项属于这一知识点的具体内容？`,
  '高中-语文': (n1) => `在高中语文"${n1}"的学习中，下列哪项是该知识点下的具体学习内容？`,
  '初中-英语': (n1) => `在初中英语"${n1}"的学习中，以下哪项是该话题下需要掌握的语言知识？`,
  '高中-英语': (n1) => `在高中英语"${n1}"的学习中，下列哪项属于该知识点的核心内容？`,
}

// ── Quiz generators ───────────────────────────────────────────────────────────

/** 小学-英语: special handling by KP type */
function genXiaoxueEnglishQuiz(pair, distractorPairs) {
  const { n1Name, leafName } = pair

  // ── Type 1: Alphabet (Aa, Bb, ...) ──────────────────────────────────────
  const alphaMatch = /^([A-Z])([a-z])$/.exec(n1Name)
  if (alphaMatch) {
    const letter = alphaMatch[1].toUpperCase()
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const correctPos = alpha.indexOf(letter) + 1
    // Generate 3 wrong ordinal positions
    const wrongs = new Set()
    const h = hashStr(pair.leafId)
    for (let i = 0; wrongs.size < 3 && i < 26; i++) {
      const candidate = ((h + i * 7 + 1) % 26) + 1
      if (candidate !== correctPos) wrongs.add(candidate)
    }
    const distractorNums = [...wrongs]
    const stem = `大写字母"${letter}"是英语字母表中的第几个字母？`
    return buildMCQ(stem, `第${correctPos}个`, distractorNums.map(n => `第${n}个`))
  }

  // ── Type 2: IPA phoneme (n1Name starts with [) ─────────────────────────
  if (n1Name.startsWith('[')) {
    const phoneme = n1Name.replace(/^\[|\]$/g, '')
    const spelling = leafName.replace(/\[.*?\]/, '').trim()

    const stem = `下列哪种字母拼写方式在英语中可以发出"/${phoneme}/"这个音？`
    const distractorSpellings = distractorPairs
      .filter(d => d.n1Name.startsWith('['))
      .map(d => d.leafName.replace(/\[.*?\]/, '').trim())
      .filter(s => s && s !== spelling)

    if (distractorSpellings.length < 3) {
      // Fallback: use the phoneme symbols as options
      const phonemeOptions = distractorPairs.map(d => d.n1Name.replace(/^\[|\]$/g, '')).filter(p => p !== phoneme)
      const stem2 = `以下哪个字母组合"${spelling}"的发音所对应的音标符号是？`
      const d = phonemeOptions.slice(0, 3).map(p => `/${p}/`)
      return buildMCQ(stem2, `/${phoneme}/`, d.length >= 3 ? d : [`/p/`, `/b/`, `/t/`].filter(x => x !== `/${phoneme}/`).slice(0, 3))
    }

    return buildMCQ(stem, spelling || n1Name, distractorSpellings.slice(0, 3))
  }

  // ── Type 3: Grammar/Topic items ─────────────────────────────────────────
  // leafName contains grammar terms (逗号 separates topic + grammar)
  const grammarMatch = leafName.match(/^(.+?)[，,]\s*(.+?)\s*(?:\(|$)/)
  const hasGrammar = grammarMatch && /时|式|句型|语态|情态|助动词|动词|名词|形容词|副词/.test(grammarMatch[2])
  const isTopicItem = /[\u4e00-\u9fff]{2,}.*(?:时|式|句型|语态|tense|structure|pattern)/i.test(leafName)

  if (isTopicItem || hasGrammar) {
    const topic   = grammarMatch ? grammarMatch[1].trim() : n1Name
    const grammar = grammarMatch ? grammarMatch[2].trim() : leafName

    // Extract grammar concepts from distractor leaf names for options
    const distractorOptions = distractorPairs.map(d => {
      const dm = d.leafName.match(/^(.+?)[，,]\s*(.+?)\s*(?:\(|$)/)
      return dm ? dm[2].trim() : d.leafName.trim()
    }).filter(s => s && s !== grammar).slice(0, 3)

    const stem = `在英语学习"${topic}"话题时，描述此内容所需掌握的主要语法或语言功能是？`

    if (distractorOptions.length < 3) {
      const fallback = ['一般现在时', '一般将来时', '现在完成时', '过去进行时', '被动语态'].filter(g => g !== grammar)
      distractorOptions.push(...fallback)
    }

    return buildMCQ(stem, grammar, distractorOptions.slice(0, 3))
  }

  // ── Type 4: Pure vocabulary words ───────────────────────────────────────
  const vocab = parseVocabLeaf(leafName)
  const word = vocab?.word || n1Name.trim()
  const chineseDef = vocab?.chinese || ''

  if (chineseDef) {
    // Good: we have a Chinese definition to use as clue
    const stem = `下列哪个英语单词或词组的含义是"${chineseDef}"？`
    const distractorWords = distractorPairs.map(d => {
      const dv = parseVocabLeaf(d.leafName)
      return (dv?.word || d.n1Name).trim()
    }).filter(w => w && w !== word).slice(0, 3)

    if (distractorWords.length < 3) {
      const fallbackWords = ['happy', 'small', 'school', 'water', 'light', 'room', 'open', 'good'].filter(w => w !== word.toLowerCase())
      distractorWords.push(...fallbackWords)
    }

    return buildMCQ(stem, word, distractorWords.slice(0, 3))
  }

  // No definition available — use topic/meaning style
  const distractorWords = distractorPairs.map(d => (parseVocabLeaf(d.leafName)?.word || d.n1Name).trim())
    .filter(w => w && w !== word).slice(0, 3)

  const stem = `以下哪个英语词汇属于小学英语词汇学习中"${n1Name}"类别下的常用表达？`
  return buildMCQ(stem, word, distractorWords.length >= 3 ? distractorWords.slice(0, 3) : ['school', 'happy', 'water'].filter(w => w !== word.toLowerCase()).slice(0, 3))
}

/** 高中-英语 / 初中-英语: similar to 小学-英语 but sometimes more complex */
function genEnglishQuiz(pair, distractorPairs) {
  const { n1Name, leafName, subjectName } = pair

  // Vocabulary word with English definition
  const vocab = parseVocabLeaf(leafName)
  if (vocab?.chinese) {
    const stem = `下列哪个英语单词或词组的意思是"${vocab.chinese}"？`
    const distractorWords = distractorPairs.map(d => (parseVocabLeaf(d.leafName)?.word || d.n1Name).trim())
      .filter(w => w && w !== vocab.word).slice(0, 3)
    const fallbacks = ['consider', 'develop', 'approach', 'maintain', 'explore'].filter(w => w !== vocab.word.toLowerCase())
    while (distractorWords.length < 3) distractorWords.push(fallbacks[distractorWords.length])
    return buildMCQ(stem, vocab.word, distractorWords.slice(0, 3))
  }

  // Default: use generic template with leaf names as options
  const grade = subjectName.includes('高中') ? '高中' : '初中'
  const stemFn = STEM_TEMPLATES[subjectName] || ((n1) => `在${grade}英语"${n1}"的学习中，下列哪项是该知识点的核心内容？`)
  const stem = stemFn(n1Name)
  const distractors = distractorPairs.map(d => d.leafName.trim()).filter(l => l !== leafName).slice(0, 3)
  return buildMCQ(stem, leafName, distractors.length >= 3 ? distractors : ['记叙文写作', '议论文写作', '说明文写作'].filter(l => l !== leafName).slice(0, 3))
}

/** Chinese subjects: use leaf names from distractor pairs as wrong options */
function genChineseSubjectQuiz(pair, distractorPairs) {
  const { n1Name, leafName, subjectName } = pair

  const stemFn = STEM_TEMPLATES[subjectName] || ((n1) => `在"${n1}"的学习中，下列哪项属于该知识点的具体内容？`)
  const stem = stemFn(n1Name)

  const distractors = distractorPairs.map(d => d.leafName.trim()).filter(l => l !== leafName).slice(0, 3)

  // Pad with generic fillers if needed
  const fillers = ['相关概念的应用', '基础知识的理解', '综合能力的培养'].filter(f => f !== leafName)
  while (distractors.length < 3) distractors.push(fillers[distractors.length % fillers.length])

  return buildMCQ(stem, leafName, distractors.slice(0, 3))
}

/** Main dispatcher */
function generateQuiz(pair, distractorPairs) {
  const { subjectName } = pair
  if (subjectName === '小学-英语') return genXiaoxueEnglishQuiz(pair, distractorPairs)
  if (subjectName.includes('英语'))  return genEnglishQuiz(pair, distractorPairs)
  return genChineseSubjectQuiz(pair, distractorPairs)
}

// ── Build subject index ───────────────────────────────────────────────────────
const bySubject = {}
for (const p of allPairs) {
  if (!bySubject[p.subjectName]) bySubject[p.subjectName] = []
  bySubject[p.subjectName].push(p)
}

// ── Select pending pairs ──────────────────────────────────────────────────────
let pending = outputFile
  // In standalone mode: operate on a slice of the full pairs list directly (no checkpoint filter)
  ? allPairs.filter(p => subjectFilter ? p.subjectName === subjectFilter : true)
  : allPairs.filter(p => !cp.quizzes[p.leafId]?.quizContent && (subjectFilter ? p.subjectName === subjectFilter : true))

if (offsetArg > 0) pending = pending.slice(offsetArg)
if (limitArg > 0)  pending = pending.slice(0, limitArg)

console.log(`Generating ${pending.length} quizzes${subjectFilter ? ' for ' + subjectFilter : ''} ...`)

// ── Generate and write ────────────────────────────────────────────────────────
let done = 0
for (const pair of pending) {
  const subjectPairs  = bySubject[pair.subjectName] || []
  const distractors   = getDistractors(pair, subjectPairs)
  const quizContent   = generateQuiz(pair, distractors)

  cp.quizzes[pair.leafId] = { quizContent }
  done++

  if (done % 500 === 0) {
    console.log(`  ${done}/${pending.length} done...`)
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────
const target = outputFile || CHECKPOINT_FILE
fs.writeFileSync(target, JSON.stringify(cp, null, 2))
const totalDone = Object.values(cp.quizzes).filter(q => q.quizContent).length
console.log(`✅ Generated ${done} quizzes → ${outputFile ? path.basename(target) : 'checkpoint'} now has ${totalDone} quizzes`)

// ── Print samples ─────────────────────────────────────────────────────────────
console.log('\n── Sample quizzes ──')
const samples = pending.slice(0, 5)
for (const p of samples) {
  const q = cp.quizzes[p.leafId]?.quizContent || ''
  console.log(`\n[${p.subjectName}] n1="${p.n1Name}" leaf="${p.leafName}"`)
  console.log(q)
}
