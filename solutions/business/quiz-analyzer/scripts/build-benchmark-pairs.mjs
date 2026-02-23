/**
 * Build Benchmark Pairs (Phase 1 — one-time, ~5 ms)
 *
 * Finds all n-1 nodes (non-leaf nodes whose children are ALL leaves),
 * picks one deterministic leaf child per n-1 node via seeded hash,
 * and writes 6,996 pairs to benchmark-pairs.json.
 *
 * Usage:
 *   node build-benchmark-pairs.mjs
 *   → benchmark-pairs.json  (6,996 entries)
 *
 * Prerequisites:
 *   cd mcp-server && npm run build   # produces dist/json-data-loader.js
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { jsonDataLoader } from '../mcp-server/dist/json-data-loader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_FILE = path.resolve(__dirname, 'benchmark-pairs.json')

// ── Subject names map ─────────────────────────────────────────────────────────
const SUBJECT_NAMES = {
  '1155be3f-391a-4b0d-9f0c-a78d7d36800e': '小学-数学',
  'b0e09778-0968-4313-a335-f61d541cc838': '小学-语文',
  '4fa62c23-a13a-4b6a-9781-33f492dd041f': '小学-英语',
  '3601171b-5ac9-46ba-8dec-2022b42b0fa5': '初中-数学',
  '013a2410-f817-487b-af58-9447a08311ac': '初中-语文',
  '0acaab37-fe7e-4054-a7a4-8443115d8ed5': '初中-英语',
  'b7a84c9e-36e2-45ed-8a70-669bf044b861': '初中-物理',
  'b9bbfd17-9d61-4b6a-81e2-8fa3033d3ad4': '初中-化学',
  'ef4ccf49-e3fe-4eed-8f68-b355b76e937f': '初中-生物学',
  '44a5a5fc-8614-40e7-a58c-9250266985ab': '初中-历史',
  '8b5c5962-0b09-4b96-857d-10f00fdac665': '初中-地理',
  '8927adef-f214-46f0-a2d6-45cf9f6cf357': '初中-道德与法治',
  'de8cb5ee-1f32-4c26-bbb9-8aba82f38880': '高中-数学',
  '7f7cd3ff-c1af-4239-a6a5-056b9546132a': '高中-语文',
  'c76f8bbb-6329-439d-ba9b-3e90841974c0': '高中-英语',
  'dde96d5f-cc45-40f4-9d15-7324a75a10c5': '高中-物理',
  '40ea8701-e720-4215-bbf7-38fb7018eaee': '高中-化学',
  '74e5f7c3-13a2-4e95-9597-11dbc439f864': '高中-生物学',
  '6b1127fe-54aa-4794-b51a-f15523caf7c5': '高中-历史',
  '107aeda0-45bd-4675-9239-2e1512b56d7a': '高中-地理',
  'e1b45e68-6764-4f9c-977d-a86b36685d71': '高中-思想政治',
}

/** Deterministic pick from array using seed string (node ID). */
function seededPick(arr, seed) {
  let h = 0
  for (const c of seed) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return arr[Math.abs(h) % arr.length]
}

// ── Load data ─────────────────────────────────────────────────────────────────
console.log('Loading knowledge points...')
jsonDataLoader.load()

const allKPs = jsonDataLoader.getAllKnowledgePoints()

// Fast kpById map
const kpById = new Map()
for (const kp of allKPs) kpById.set(kp.id, kp)

// ── Find all n-1 nodes ────────────────────────────────────────────────────────
const pairs = []
for (const kp of allKPs) {
  if (kp.children.length === 0) continue  // skip leaves

  const allChildrenLeaves = kp.children.every(cid => {
    const child = kpById.get(cid)
    return child && child.children.length === 0
  })
  if (!allChildrenLeaves) continue

  // Collect leaf children
  const leafChildren = kp.children.map(cid => kpById.get(cid)).filter(Boolean)
  const leaf = seededPick(leafChildren, kp.id)

  const subjectId   = kp.subjectId
  const subjectName = SUBJECT_NAMES[subjectId] || subjectId
  const gradeLevel  = subjectName.startsWith('小学') ? '小学'
                    : subjectName.startsWith('初中') ? '初中' : '高中'

  pairs.push({
    subjectId,
    subjectName,
    gradeLevel,
    n1Id:     kp.id,
    n1Name:   kp.name.trim(),
    leafId:   leaf.id,
    leafName: leaf.name.trim(),
  })
}

// ── Write output ──────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pairs, null, 2))
console.log(`✅ Wrote ${pairs.length} pairs → ${OUTPUT_FILE}`)

// Distribution summary
const bySubject = {}
for (const p of pairs) {
  bySubject[p.subjectName] = (bySubject[p.subjectName] || 0) + 1
}
const sorted = Object.entries(bySubject).sort((a, b) => b[1] - a[1])
console.log('\nDistribution by subject:')
for (const [name, count] of sorted) {
  console.log(`  ${name.padEnd(12)} ${count}`)
}
