/**
 * Merge temporary batch files into benchmark-checkpoint.json
 * Usage: node merge-quiz-batches.mjs batch-*.json
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const CHECKPOINT_FILE = path.resolve(__dirname, 'benchmark-checkpoint.json')

let cp = { quizzes: {}, evaluations: {} }
if (fs.existsSync(CHECKPOINT_FILE)) {
  try { cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')) } catch {}
}

const batchFiles = process.argv.slice(2)
if (batchFiles.length === 0) {
  // Auto-detect batch-*.json files in scripts dir
  const dir = __dirname
  batchFiles.push(...fs.readdirSync(dir).filter(f => /^batch-xiaoxue-en-\d+\.json$/.test(f)).map(f => path.join(dir, f)))
}

let merged = 0
for (const file of batchFiles) {
  const abs = path.isAbsolute(file) ? file : path.resolve(__dirname, file)
  if (!fs.existsSync(abs)) { console.warn('Missing:', abs); continue }
  try {
    const batch = JSON.parse(fs.readFileSync(abs, 'utf-8'))
    for (const [leafId, val] of Object.entries(batch.quizzes || {})) {
      if (val?.quizContent && !cp.quizzes[leafId]?.quizContent) {
        cp.quizzes[leafId] = val
        merged++
      }
    }
    console.log(`  merged ${Object.keys(batch.quizzes || {}).length} from ${path.basename(abs)}`)
  } catch (e) {
    console.error('Failed to parse', abs, e.message)
  }
}

fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
const total = Object.values(cp.quizzes).filter(q => q.quizContent).length
console.log(`\n✅ Merged ${merged} new quizzes → checkpoint total: ${total} / 6996`)
