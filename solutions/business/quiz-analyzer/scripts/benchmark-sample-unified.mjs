/**
 * Sample-based Unified KP Search Benchmark
 *
 * Reads quizzes from data/sample/题目Sample数学.xlsx (with ground truth KP),
 * runs the unified-kp-search skill via CCAAS backend, collects Phase A/B
 * details, and exports benchmark-results-sample-unified.xlsx (14 columns).
 *
 * Prerequisites:
 *   npm run dev:backend                                    # port 3001
 *   cd mcp-server && npm run build                        # built dist/
 *
 * Usage:
 *   LIMIT=3 node benchmark-sample-unified.mjs             # smoke test
 *   node benchmark-sample-unified.mjs                     # default 10
 *   LIMIT=98 node benchmark-sample-unified.mjs            # full run
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Configuration ──────────────────────────────────────────────────────────────
const CCAAS_URL      = process.env.CCAAS_URL      || 'http://localhost:3001'
const TENANT_ID      = process.env.TENANT_ID      || 'quiz-analyzer'
const TEMPLATE_NAME  = process.env.TEMPLATE_NAME  || 'kp-search'
const LIMIT          = parseInt(process.env.LIMIT || '10', 10)
const CONCURRENCY    = parseInt(process.env.CONCURRENCY || '5', 10)

const EXCEL_FILE   = path.resolve(__dirname, '../data/sample/题目Sample数学.xlsx')
const RESULTS_FILE = process.env.RESULTS_FILE || path.resolve(__dirname, 'benchmark-results-sample-unified.xlsx')

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Async generator that reads an SSE response and yields parsed envelope objects.
 */
async function* streamEvents(response) {
  const reader = response.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() || ''
    for (const part of parts) {
      const line = part.split('\n').find(l => l.startsWith('data: '))
      if (line) {
        try { yield JSON.parse(line.slice(6)) } catch { /* ignore */ }
      }
    }
  }
}

/** Run up to `limit` async tasks concurrently over an items array. */
async function runConcurrent(items, fn, limit) {
  let i = 0
  const results = new Array(items.length)
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/**
 * Parse MCP tool output from a tool_activity event's toolOutput field.
 * Returns the parsed JSON object, or null on failure.
 */
function parseMcpOutput(toolOutput) {
  if (!toolOutput) return null
  if (Array.isArray(toolOutput)) {
    for (const block of toolOutput) {
      if (block?.type === 'text' && block.text) {
        try { return JSON.parse(block.text) } catch { /* keep trying */ }
      }
    }
    return null
  }
  if (typeof toolOutput === 'string') {
    try { return JSON.parse(toolOutput) } catch { return null }
  }
  if (typeof toolOutput === 'object') return toolOutput
  return null
}

/** Strip MCP server prefix (e.g. "mcp__quiz-analyzer-tools__search_...") → bare tool name */
function stripPrefix(toolName) {
  return (toolName || '').replace(/^mcp__[^_]+__/, '')
}

// ── Load Excel ────────────────────────────────────────────────────────────────
console.log('\n══════ Loading sample quizzes ══════')

if (!fs.existsSync(EXCEL_FILE)) {
  console.error(`ERROR: ${EXCEL_FILE} not found.`)
  process.exit(1)
}

const wb = XLSX.readFile(EXCEL_FILE)
const sheetName = wb.SheetNames[0]
const allRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName])
const workRows = allRows.slice(0, LIMIT)

console.log(`Loaded ${allRows.length} rows from "${sheetName}" → using first ${workRows.length}`)

// ── Phase 3: Agent evaluation via CCAAS backend ───────────────────────────────
console.log(`\n══════ Agent evaluation (concurrency=${CONCURRENCY}) ══════`)

const RUN_ID = Date.now()
let done = 0

async function evaluateQuiz(quiz, idx) {
  const quizContent = quiz['题干'] || ''
  const targetKpId = String(quiz['知识点id'] || '').trim()
  const targetKpName = String(quiz['知识点名称'] || '').trim()

  const base = {
    quiz_content: quizContent,
    target_kp_id: targetKpId,
    target_kp_name: targetKpName,
  }

  if (!quizContent) {
    console.warn(`\n[SKIP] Row ${idx}: empty quiz content`)
    return {
      ...base,
      phase_a_keywords: '', phase_a_results: '[]', phase_a_anchor: '',
      phase_b_trace: '[]', phase_b_steps: 0,
      agent_kp_id: '', agent_kp_name: '', correct: false,
      target_rank: -1, in_top5: false, total_tool_calls: 0, traversal_type: '',
    }
  }

  // Phase A/B collectors
  const phaseAKeywords = []
  const phaseAResults = []
  let phaseAAnchor = ''
  const phaseBTrace = []
  let totalToolCalls = 0

  // Track all seen KP IDs for target_rank
  const seenIds = []
  const seenIdSet = new Set()

  // Agent output
  let agentKpId = ''
  let agentKpName = ''
  let bestConfidence = -1
  let traversalType = ''

  const sessionId = `benchmark-unified-${RUN_ID}-${idx}`
  const url = `${CCAAS_URL}/api/v1/sessions/${sessionId}/messages`

  const body = {
    message: `请标注这道题的知识点：\n\n${quizContent}`,
    tenantId: TENANT_ID,
    templateName: TEMPLATE_NAME,
    autoClose: true,
  }

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      console.error(`\n[ERR] HTTP ${resp.status} for row ${idx}`)
      return {
        ...base,
        phase_a_keywords: '', phase_a_results: '[]', phase_a_anchor: '',
        phase_b_trace: '[]', phase_b_steps: 0,
        agent_kp_id: '', agent_kp_name: '', correct: false,
        target_rank: -1, in_top5: false, total_tool_calls: 0, traversal_type: '',
      }
    }

    for await (const envelope of streamEvents(resp)) {
      const ev = envelope.event
      if (!ev) continue

      if (ev.type === 'tool_activity') {
        const pl = ev.payload
        if (!pl || pl.phase !== 'end') continue
        const toolName = stripPrefix(pl.toolName)
        // Only count MCP tool calls (skip internal tools like ToolSearch)
        if ((pl.toolName || '').startsWith('mcp__')) totalToolCalls++

        // ── Phase A: fuzzy_search_knowledge_points ──
        if (toolName === 'fuzzy_search_knowledge_points') {
          phaseAKeywords.push(pl.toolInput?.query)
          const out = parseMcpOutput(pl.toolOutput)
          const allResults = out?.results || []
          // Record top-5 for display, but track ALL for target_rank
          for (const r of allResults.slice(0, 5)) {
            phaseAResults.push({ id: String(r.id), name: r.name, score: r.score })
          }
          for (const r of allResults) {
            const rid = String(r.id)
            if (!seenIdSet.has(rid)) { seenIdSet.add(rid); seenIds.push(rid) }
          }
        }

        // ── Phase B: get_knowledge_point_children ──
        if (toolName === 'get_knowledge_point_children') {
          const parentId = pl.toolInput?.parentId
          if (!phaseAAnchor && parentId) phaseAAnchor = String(parentId)
          const out = parseMcpOutput(pl.toolOutput)
          const children = (out?.children || [])
          for (const c of children) {
            if (!seenIdSet.has(String(c.id))) { seenIdSet.add(String(c.id)); seenIds.push(String(c.id)) }
          }
          phaseBTrace.push({
            tool: 'get_children',
            parentId,
            children: children.map(c => `${c.name}(${c.id})`).join(', '),
          })
        }

        // ── Phase B: get_knowledge_point_path ──
        if (toolName === 'get_knowledge_point_path') {
          const out = parseMcpOutput(pl.toolOutput)
          const pathArr = out?.path || out?.pathNames || []
          phaseBTrace.push({
            tool: 'get_path',
            nodeId: pl.toolInput?.nodeId,
            path: pathArr.join(' > '),
          })
        }

      } else if (ev.type === 'output_update') {
        const data = ev.payload?.data
        // Handle kpRefinementResult (new merged skill output)
        if (data?.field === 'kpRefinementResult' && data?.value?.tags) {
          for (const tag of data.value.tags) {
            if (tag.role === 'primary' || !agentKpId) {
              agentKpId = String(tag.id ?? '')
              agentKpName = String(tag.name ?? '')
              bestConfidence = typeof tag.confidence === 'number' ? tag.confidence : 0
            }
          }
          // Capture traversalType for reporting
          if (data.value.traversalType) {
            traversalType = String(data.value.traversalType)
          }
        }
        // Backward-compat: also handle legacy knowledgePointTags
        else if (data?.field === 'knowledgePointTags' && Array.isArray(data?.value)) {
          for (const tag of data.value) {
            const conf = typeof tag.confidence === 'number' ? tag.confidence : 0
            if (conf > bestConfidence) {
              bestConfidence = conf
              agentKpId = String(tag.id ?? '')
              agentKpName = String(tag.name ?? '')
            }
          }
        }

      } else if (ev.type === 'agent_status' && ['complete', 'error', 'cancelled'].includes(ev.status)) {
        break
      } else if (ev.type === 'done') {
        break
      }
    }

    const correct = agentKpId === targetKpId
    const targetRank = seenIds.indexOf(targetKpId)
    const inTop5 = targetRank >= 0 && targetRank <= 4

    done++
    const tag = correct ? '✓' : '✗'
    console.log(`[${done}/${workRows.length}] ${tag} row ${idx} | agent=${agentKpId} target=${targetKpId} rank=${targetRank} calls=${totalToolCalls} traversal=${traversalType || 'n/a'}`)

    return {
      ...base,
      phase_a_keywords: phaseAKeywords.join(', '),
      phase_a_results: JSON.stringify(phaseAResults),
      phase_a_anchor: phaseAAnchor,
      phase_b_trace: JSON.stringify(phaseBTrace),
      phase_b_steps: phaseBTrace.length,
      agent_kp_id: agentKpId,
      agent_kp_name: agentKpName,
      correct,
      target_rank: targetRank,
      in_top5: inTop5,
      total_tool_calls: totalToolCalls,
      traversal_type: traversalType,
    }

  } catch (err) {
    console.error(`\n[ERR] Row ${idx}: ${err.message}`)
    return {
      ...base,
      phase_a_keywords: '', phase_a_results: '[]', phase_a_anchor: '',
      phase_b_trace: '[]', phase_b_steps: 0,
      agent_kp_id: '', agent_kp_name: '', correct: false,
      target_rank: -1, in_top5: false, total_tool_calls: 0, traversal_type: '',
    }
  }
}

const evaluations = await runConcurrent(workRows, evaluateQuiz, CONCURRENCY)

// ── Export XLSX ──────────────────────────────────────────────────────────────
console.log('\n══════ Export XLSX ══════')

const outWb = XLSX.utils.book_new()
const ws = XLSX.utils.json_to_sheet(evaluations)
XLSX.utils.book_append_sheet(outWb, ws, 'Results')
XLSX.writeFile(outWb, RESULTS_FILE)
console.log(`Exported ${evaluations.length} rows → ${RESULTS_FILE}`)

// ── Summary ───────────────────────────────────────────────────────────────────
const total     = evaluations.length
const nCorrect  = evaluations.filter(r => r.correct).length
const nTop5     = evaluations.filter(r => r.in_top5).length
const avgCalls  = total > 0 ? (evaluations.reduce((s, r) => s + r.total_tool_calls, 0) / total).toFixed(1) : 'n/a'
const pct = (n) => total > 0 ? `(${((n / total) * 100).toFixed(1)}%)` : '(n/a)'

console.log('\n══════ Summary ══════')
console.log(`correct:       ${nCorrect} / ${total}  ${pct(nCorrect)}`)
console.log(`in top-5:      ${nTop5} / ${total}  ${pct(nTop5)}`)
console.log(`avg tool calls: ${avgCalls}`)
