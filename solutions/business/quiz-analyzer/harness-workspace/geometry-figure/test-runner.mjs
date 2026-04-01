#!/usr/bin/env node
/**
 * Test Runner — Geometry Figure Benchmark
 *
 * Reads benchmark.json, invokes geometry template via CCAAS API,
 * collects SSE output_update events for geometryFigure/solutionGeometryFigure,
 * and saves results to JSON.
 *
 * Usage:
 *   node test-runner.mjs                           # run all 10 questions
 *   node test-runner.mjs --version v1              # tag results as v1
 *   LIMIT=2 node test-runner.mjs                   # smoke test (2 questions)
 *   CCAAS_URL=http://localhost:3001 node test-runner.mjs
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Configuration ────────────────────────────────────────────────────────────
const CCAAS_URL     = process.env.CCAAS_URL     || 'http://localhost:3001'
const TENANT_ID     = process.env.TENANT_ID     || 'quiz-analyzer'
const TEMPLATE_NAME = process.env.TEMPLATE_NAME || 'geometry'
const LIMIT         = parseInt(process.env.LIMIT || '1', 10)
const TIMEOUT_MS    = parseInt(process.env.TIMEOUT_MS || '300000', 10) // 5 min per question

// Parse CLI args
const args = process.argv.slice(2)
let VERSION = 'v0'
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--version' && args[i + 1]) VERSION = args[i + 1]
}

const BENCHMARK_FILE = path.resolve(__dirname, 'benchmark.json')
const RESULTS_DIR    = path.resolve(__dirname, 'results')
const RESULTS_FILE   = path.resolve(RESULTS_DIR, `${VERSION}-results.json`)

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Async generator: reads SSE response and yields parsed envelope objects.
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
        try { yield JSON.parse(line.slice(6)) } catch { /* ignore parse errors */ }
      }
    }
  }
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const INTER_REQUEST_DELAY = parseInt(process.env.DELAY_MS || '3000', 10)
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '2', 10)

// Fields we track for geometry harness
const GEO_FIELDS = ['geometryFigure', 'solutionGeometryFigure']

// ── Load Benchmark ───────────────────────────────────────────────────────────

log('══════ Loading geometry benchmark ══════')

if (!fs.existsSync(BENCHMARK_FILE)) {
  console.error(`ERROR: ${BENCHMARK_FILE} not found.`)
  process.exit(1)
}

const benchmark = JSON.parse(fs.readFileSync(BENCHMARK_FILE, 'utf-8'))
const workItems = benchmark.slice(0, LIMIT)
log(`Loaded ${benchmark.length} benchmark questions → using ${workItems.length}`)

// ── Ensure results directory ─────────────────────────────────────────────────
fs.mkdirSync(RESULTS_DIR, { recursive: true })

// ── Run Geometry Generation ──────────────────────────────────────────────────

log(`\n══════ Running geometry generation (version=${VERSION}) ══════`)
log(`CCAAS: ${CCAAS_URL} | tenant: ${TENANT_ID} | template: ${TEMPLATE_NAME}`)
log(`Timeout: ${TIMEOUT_MS / 1000}s per question\n`)

const RUN_ID = Date.now()
const results = []

for (let idx = 0; idx < workItems.length; idx++) {
  const quiz = workItems[idx]
  const quizId = quiz.id
  const startTime = Date.now()

  log(`[${idx + 1}/${workItems.length}] Starting ${quizId}: ${quiz.content.substring(0, 50)}...`)

  // Collected fields
  const fields = {}
  const fieldWriteCount = {}
  const duplicateFields = []
  let totalToolCalls = 0
  let errorMessage = null

  const sessionId = `geo-harness-${VERSION}-${RUN_ID}-${idx}`
  const url = `${CCAAS_URL}/api/v1/sessions/${sessionId}/messages`

  const body = {
    message: quiz.content,
    tenantId: TENANT_ID,
    templateName: TEMPLATE_NAME,
    autoClose: true,
  }

  // Inter-request delay to avoid 429
  if (idx > 0) {
    log(`  (waiting ${INTER_REQUEST_DELAY / 1000}s before next request...)`)
    await sleep(INTER_REQUEST_DELAY)
  }

  let resp = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (resp.status === 429 && attempt < MAX_RETRIES) {
        const backoff = (attempt + 1) * 5000
        log(`  ⚠ ${quizId}: HTTP 429, retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})...`)
        await sleep(backoff)
        continue
      }
      break  // success or non-retryable error
    } catch (err) {
      if (err.name === 'AbortError') { resp = null; errorMessage = 'timeout'; break }
      if (attempt < MAX_RETRIES) {
        const backoff = (attempt + 1) * 5000
        log(`  ⚠ ${quizId}: ${err.message}, retrying in ${backoff / 1000}s...`)
        await sleep(backoff)
        continue
      }
      resp = null
      errorMessage = err.message
      break
    }
  }

  try {
    if (!resp) {
      if (!errorMessage) errorMessage = 'no response after retries'
      log(`  ✗ ${quizId}: ${errorMessage}`)
      results.push({
        benchmarkId: quizId,
        sessionId,
        fields,
        geoFieldCount: 0,
        duplicateFields,
        totalToolCalls,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      })
      continue
    }

    if (!resp.ok) {
      errorMessage = `HTTP ${resp.status}`
      log(`  ✗ ${quizId}: ${errorMessage}`)
      results.push({
        benchmarkId: quizId,
        sessionId,
        fields,
        geoFieldCount: 0,
        duplicateFields,
        totalToolCalls,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      })
      continue
    }

    for await (const envelope of streamEvents(resp)) {
      const ev = envelope.event
      if (!ev) continue

      // Track tool calls
      if (ev.type === 'tool_activity') {
        const pl = ev.payload
        if (pl?.phase === 'end' && (pl.toolName || '').startsWith('mcp__')) {
          totalToolCalls++
        }
      }

      // Collect output_update events for geometry fields
      if (ev.type === 'output_update') {
        const data = ev.payload?.data
        if (data?.field && GEO_FIELDS.includes(data.field)) {
          fieldWriteCount[data.field] = (fieldWriteCount[data.field] || 0) + 1
          if (fieldWriteCount[data.field] > 1) {
            duplicateFields.push(data.field)
          }
          fields[data.field] = data.value
        }
      }

      // Check for completion
      if (ev.type === 'agent_status' && ['complete', 'error', 'cancelled'].includes(ev.status)) {
        if (ev.status === 'error') errorMessage = 'agent_error'
        break
      }
      if (ev.type === 'done') break
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      errorMessage = 'timeout'
      log(`  ⏰ ${quizId}: TIMEOUT (${TIMEOUT_MS / 1000}s)`)
    } else {
      errorMessage = err.message
      log(`  ✗ ${quizId}: ${err.message}`)
    }
  }

  const geoFieldCount = GEO_FIELDS.filter(f => fields[f] != null).length
  const durationMs = Date.now() - startTime
  const durationStr = `${(durationMs / 1000).toFixed(1)}s`

  const hasAnim = quiz.hasAnimation
  const expectedFields = hasAnim ? 2 : 1  // animated needs both fields
  const tag = geoFieldCount >= expectedFields ? '✓' : `${geoFieldCount}/${expectedFields}`

  log(`  ${tag} ${quizId} | fields=${geoFieldCount}/${expectedFields} | tools=${totalToolCalls} | ${durationStr}`)

  if (!fields.geometryFigure) {
    log(`     missing: geometryFigure`)
  }
  if (hasAnim && !fields.solutionGeometryFigure) {
    log(`     missing: solutionGeometryFigure (animated question)`)
  }

  results.push({
    benchmarkId: quizId,
    sessionId,
    fields,
    geoFieldCount,
    expectedFieldCount: expectedFields,
    duplicateFields,
    totalToolCalls,
    durationMs,
    error: errorMessage,
    benchmark: {
      category: quiz.category,
      difficulty: quiz.difficulty,
      hasAnimation: quiz.hasAnimation,
    },
  })
}

// ── Save Results ─────────────────────────────────────────────────────────────

const output = {
  version: VERSION,
  timestamp: new Date().toISOString(),
  config: {
    ccaasUrl: CCAAS_URL,
    tenantId: TENANT_ID,
    templateName: TEMPLATE_NAME,
    benchmarkSize: workItems.length,
    timeoutMs: TIMEOUT_MS,
  },
  summary: {
    totalQuestions: results.length,
    avgGeoFieldCount: results.length > 0
      ? (results.reduce((s, r) => s + r.geoFieldCount, 0) / results.length).toFixed(1)
      : 0,
    fullFieldCount: results.filter(r => r.geoFieldCount >= r.expectedFieldCount).length,
    errorCount: results.filter(r => r.error).length,
    avgDurationMs: results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.durationMs, 0) / results.length)
      : 0,
    avgToolCalls: results.length > 0
      ? (results.reduce((s, r) => s + r.totalToolCalls, 0) / results.length).toFixed(1)
      : 0,
  },
  results,
}

fs.writeFileSync(RESULTS_FILE, JSON.stringify(output, null, 2), 'utf-8')
log(`\n══════ Results saved ══════`)
log(`File: ${RESULTS_FILE}`)

// ── Summary ──────────────────────────────────────────────────────────────────

log(`\n══════ Summary ══════`)
log(`Questions:        ${output.summary.totalQuestions}`)
log(`Avg geo fields:   ${output.summary.avgGeoFieldCount}`)
log(`Full coverage:    ${output.summary.fullFieldCount} / ${output.summary.totalQuestions}`)
log(`Errors:           ${output.summary.errorCount}`)
log(`Avg duration:     ${(output.summary.avgDurationMs / 1000).toFixed(1)}s`)
log(`Avg tool calls:   ${output.summary.avgToolCalls}`)
