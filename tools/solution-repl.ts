#!/usr/bin/env ts-node
/**
 * Solution REPL - Test solutions by sending messages directly to backend via SSE
 *
 * Usage:
 *   npx ts-node tools/solution-repl.ts <solution-slug> [options]
 *
 * Examples:
 *   npx ts-node tools/solution-repl.ts lesson-plan-designer
 *   npx ts-node tools/solution-repl.ts lesson-plan-designer --test "你好，帮我设计一节数学课"
 *   npx ts-node tools/solution-repl.ts lesson-plan-designer --url http://localhost:3001
 *   npx ts-node tools/solution-repl.ts lesson-plan-designer --template script-writing
 */

import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

// ─── ANSI colors (no external deps) ──────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  boldBlue: '\x1b[1;34m',
}
const col = (code: string, text: string) => `${code}${text}${c.reset}`

// ─── Argument parsing ─────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const solutionSlug = args.find(a => !a.startsWith('--'))

const getArg = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}

const testMessage = getArg('--test')
const backendUrl = getArg('--url') ?? process.env.CCAAS_URL ?? 'http://localhost:3001'
const templateName = getArg('--template')
const timeoutSecs = parseInt(getArg('--timeout') ?? '180', 10)

if (!solutionSlug) {
  console.error('Usage: npx ts-node tools/solution-repl.ts <solution-slug> [--test "msg"] [--url <url>] [--template <name>]')
  process.exit(1)
}

// ─── Load solution.json ───────────────────────────────────────────────────────
const solutionPath = path.join(__dirname, '..', 'solutions', solutionSlug, 'solution.json')
if (!fs.existsSync(solutionPath)) {
  console.error(col(c.red, `✗ Not found: ${solutionPath}`))
  process.exit(1)
}

const solution = JSON.parse(fs.readFileSync(solutionPath, 'utf-8'))
const tenantId: string = solution.tenant?.slug ?? solutionSlug

let enabledSkills: string[] | undefined
let appendSystemPrompt: string | undefined
let mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }> | undefined

if (solution.sessionTemplates && Object.keys(solution.sessionTemplates).length > 0) {
  const key = templateName ?? Object.keys(solution.sessionTemplates)[0]
  const tmpl = solution.sessionTemplates[key]
  if (!tmpl) {
    console.error(col(c.red, `✗ Template "${key}" not found. Available: ${Object.keys(solution.sessionTemplates).join(', ')}`))
    process.exit(1)
  }
  enabledSkills = tmpl.enabledSkills
  appendSystemPrompt = tmpl.appendSystemPrompt
} else if (Array.isArray(solution.skills)) {
  enabledSkills = solution.skills.map((s: { slug: string }) => s.slug)
}

// Resolve mcpServers from solution.json with absolute paths
const solutionDir = path.dirname(solutionPath)
if (solution.mcpServers && Object.keys(solution.mcpServers).length > 0) {
  mcpServers = {}
  for (const [name, def] of Object.entries(solution.mcpServers as Record<string, { command: string; args?: string[]; env?: Record<string, string> }>)) {
    const resolvedArgs = (def.args ?? []).map(arg =>
      arg.startsWith('/') ? arg : path.join(solutionDir, arg)
    )
    mcpServers[name] = { command: def.command, args: resolvedArgs, env: def.env }
  }
  console.log(col(c.dim, `MCP servers: ${Object.keys(mcpServers).join(', ')}`))
}

// ─── Session state ────────────────────────────────────────────────────────────
let sessionId = randomUUID()

// ─── Event display ────────────────────────────────────────────────────────────
function handleEvent(event: Record<string, unknown>): 'done' | 'error' | void {
  const type = event?.type as string

  switch (type) {
    case 'agent_status': {
      const status = (event?.status ?? (event?.payload as Record<string, unknown>)?.status) as string
      if (status === 'running') {
        process.stdout.write('\n' + col(c.blue, '⚡ [running] '))
      } else if (status === 'error') {
        process.stdout.write('\n' + col(c.red, '✗ [agent error]') + '\n')
        return 'error'
      }
      break
    }

    case 'text_delta': {
      const delta = (event?.delta ?? (event?.payload as Record<string, unknown>)?.delta ?? '') as string
      process.stdout.write(delta)
      break
    }

    case 'tool_activity': {
      const payload = (event?.payload ?? {}) as Record<string, unknown>
      const actType = (payload.type ?? payload.activityType) as string
      const toolName = (payload.toolName ?? payload.tool ?? event?.toolName) as string
      if (actType === 'start' || actType === 'input') {
        process.stdout.write(col(c.dim, `\n🔧 ${toolName} [start] `))
      } else if (actType === 'result') {
        process.stdout.write(col(c.dim, `\n🔧 ${toolName} [done] `))
      }
      break
    }

    case 'output_update': {
      const payload = (event?.payload ?? {}) as Record<string, unknown>
      const data = (payload.data ?? payload) as Record<string, unknown>
      const field = (data?.field ?? event?.field) as string
      const value = (data?.value ?? data?.preview ?? event?.preview) as string
      if (field !== undefined || value !== undefined) {
        // Try to parse as JSON for pretty display
        try {
          const parsed = JSON.parse(String(value ?? ''))
          const pretty = JSON.stringify(parsed, null, 2)
          process.stdout.write(col(c.yellow, `\n📤 ${field}:`))
          process.stdout.write(col(c.dim, ` (JSON, ${Array.isArray(parsed) ? parsed.length + ' items' : 'object'})\n`))
          process.stdout.write(pretty + '\n')
        } catch {
          const shortPreview = String(value ?? '').slice(0, 120)
          process.stdout.write(col(c.yellow, `\n📤 ${field}: "${shortPreview}"`))
        }
      }
      break
    }

    case 'token_usage': {
      const payload = (event?.payload ?? event) as Record<string, unknown>
      const input = (payload?.inputTokens ?? payload?.input ?? 0) as number
      const output = (payload?.outputTokens ?? payload?.output ?? 0) as number
      if (input || output) {
        process.stdout.write(col(c.dim, `\n📊 Tokens: ${input} in / ${output} out`))
      }
      break
    }

    case 'done': {
      process.stdout.write('\n' + col(c.green, '✅ Done') + '\n')
      return 'done'
    }

    case 'error': {
      const msg = (event?.message ?? (event?.payload as Record<string, unknown>)?.message ?? 'Unknown error') as string
      process.stdout.write('\n' + col(c.red, `✗ Error: ${msg}`) + '\n')
      return 'error'
    }
  }
}

// ─── Core: send message → stream SSE ─────────────────────────────────────────
async function sendMessage(message: string): Promise<'done' | 'error'> {
  const url = `${backendUrl}/api/v1/sessions/${sessionId}/messages`

  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tenantId, enabledSkills, appendSystemPrompt, mcpServers }),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(col(c.red, `\n✗ Connection failed: ${msg}`))
    console.error(col(c.yellow, `  Is the backend running? (npm run dev:backend)`))
    return 'error'
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '(no body)')
    console.error(col(c.red, `\n✗ HTTP ${resp.status}: ${body}`))
    return 'error'
  }

  if (!resp.body) {
    console.error(col(c.red, '\n✗ No response body'))
    return 'error'
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let lineBuffer = ''
  let outcome: 'done' | 'error' = 'error'
  let gotTerminal = false

  try {
    outer: while (true) {
      const { done, value } = await reader.read()
      if (done) break

      lineBuffer += decoder.decode(value, { stream: true })
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        let event: Record<string, unknown>
        try {
          const envelope = JSON.parse(line.slice('data: '.length)) as Record<string, unknown>
          // SSE envelope: { seq, sessionId, event: FrontendEvent } OR the event directly
          event = (envelope.event as Record<string, unknown>) ?? envelope
        } catch {
          continue
        }

        const result = handleEvent(event)
        if (result === 'done') { outcome = 'done'; gotTerminal = true; break outer }
        if (result === 'error') { outcome = 'error'; gotTerminal = true; break outer }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!gotTerminal) {
    // Stream closed without explicit done/error event — treat as done if no error seen
    outcome = 'done'
  }

  return outcome
}

// ─── Test mode ────────────────────────────────────────────────────────────────
async function runTestMode(message: string) {
  console.log(col(c.bold, `\n🧪 Test: ${solutionSlug}`))
  console.log(col(c.dim, `Backend: ${backendUrl} | Tenant: ${tenantId}`))
  console.log(col(c.dim, `Session: ${sessionId}`))
  if (enabledSkills?.length) {
    console.log(col(c.dim, `Skills: ${enabledSkills.join(', ')}`))
  }
  console.log(col(c.dim, `Timeout: ${timeoutSecs}s`))
  console.log(col(c.cyan, `\n> ${message}\n`))

  let exited = false
  const exit = (code: number) => {
    if (exited) return
    exited = true
    process.exit(code)
  }

  const timer = setTimeout(() => {
    console.error(col(c.red, `\n✗ Timeout (${timeoutSecs}s)`))
    exit(1)
  }, timeoutSecs * 1000)

  const result = await sendMessage(message)
  clearTimeout(timer)
  exit(result === 'done' ? 0 : 1)
}

// ─── REPL mode ────────────────────────────────────────────────────────────────
async function runReplMode() {
  console.log(col(c.boldBlue, '\n╔══════════════════════════════════════╗'))
  console.log(col(c.boldBlue, '║         Solution REPL                ║'))
  console.log(col(c.boldBlue, '╚══════════════════════════════════════╝'))
  console.log(col(c.dim, `Solution : ${solutionSlug}`))
  console.log(col(c.dim, `Backend  : ${backendUrl}`))
  console.log(col(c.dim, `Tenant   : ${tenantId}`))
  console.log(col(c.dim, `Session  : ${sessionId}`))
  if (enabledSkills?.length) {
    console.log(col(c.dim, `Skills   : ${enabledSkills.join(', ')}`))
  }
  console.log(col(c.dim, 'Commands : /new  /session  /exit\n'))

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  const prompt = () => {
    rl.question(col(c.cyan, '\n> '), async (input) => {
      const cmd = input.trim()
      if (!cmd) { prompt(); return }

      if (cmd === '/exit' || cmd === 'exit' || cmd === 'quit') {
        console.log(col(c.dim, '\nGoodbye!\n'))
        rl.close()
        process.exit(0)
      }

      if (cmd === '/new') {
        sessionId = randomUUID()
        console.log(col(c.green, `✓ New session: ${sessionId}`))
        prompt(); return
      }

      if (cmd === '/session') {
        console.log(col(c.dim, `Session: ${sessionId}`))
        prompt(); return
      }

      await sendMessage(cmd)
      prompt()
    })
  }

  process.on('SIGINT', () => {
    console.log(col(c.dim, '\n\nGoodbye!\n'))
    rl.close()
    process.exit(0)
  })

  prompt()
}

// ─── Entry point ──────────────────────────────────────────────────────────────
if (testMessage !== undefined) {
  runTestMode(testMessage)
} else {
  runReplMode()
}
