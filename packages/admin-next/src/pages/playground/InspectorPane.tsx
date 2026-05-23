/**
 * Inspector Pane — §14 L1 / L2 / L3 preview-server diagnostics.
 *
 *  L1 — Prompt traces       : every LLM call captured by the instrumented
 *                             plugin runtime (system prompt, user message,
 *                             response, duration).
 *  L2 — Lifecycle events    : per-plugin method call timeline + counts
 *                             (grade.start / grade.end / errors).
 *  L3 — Two-stage grade     : Build Prompt → edit response → Rerun Parse.
 *                             Lets the bundle author iterate on parse logic
 *                             without burning live LLM tokens.
 *
 * Backend endpoints used (preview-server.ts:300-385):
 *   GET  /preview/sessions/:id/inspector       — fetch L1/L2 + history
 *   POST /preview/sessions/:id/build-prompt    — L3 stage 1
 *   POST /preview/sessions/:id/rerun-parse     — L3 stage 2 (body: {editedResponses})
 *
 * Backend returns 400 "L3 not available" for plugins that don't implement
 * buildGradePrompt / parseGradeResponse. We surface that as a clear UI hint
 * rather than an opaque error.
 */
import { useCallback, useEffect, useState } from 'react'
import { Editor } from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface PromptTrace {
  callId: string
  systemPrompt: string
  userMessage: string
  response: string
  durationMs: number
  timestamp: number
}

interface LifecycleEvent {
  method: string
  phase: 'start' | 'end' | 'error'
  timestamp: number
  durationMs?: number
  payload?: unknown
}

interface GradeHistoryItem {
  timestamp: number
  input: { ans: Record<string, unknown> }
  output: unknown
  durationMs: number
}

interface InspectorData {
  sessionId: string
  gradeHistory: GradeHistoryItem[]
  prompts: PromptTrace[]
  lifecycle: LifecycleEvent[]
  lifecycleCounts: Record<string, number>
  answerKey: { raw: unknown; sanitized: unknown }
  bundle: { type: string; meta: { title?: string } } | null
}

interface GradePromptSpec {
  systemPrompt: string
  userMessage: string
  options?: Record<string, unknown>
}

interface Props {
  previewUrl: string
  sessionId: string | null
  /** Bumped on each preview grade so the inspector auto-refreshes. */
  refreshTrigger: number
}

export function InspectorPane({ previewUrl, sessionId, refreshTrigger }: Props) {
  const [data, setData] = useState<InspectorData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${previewUrl}/preview/sessions/${sessionId}/inspector`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = (await r.json()) as InspectorData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [previewUrl, sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshTrigger])

  // L3 state
  const [l3Specs, setL3Specs] = useState<GradePromptSpec[] | null>(null)
  const [l3EditedResponses, setL3EditedResponses] = useState<string[]>([])
  const [l3Error, setL3Error] = useState<string | null>(null)
  const [l3Result, setL3Result] = useState<unknown>(null)
  const [l3Busy, setL3Busy] = useState(false)

  // Reset L3 panel when session changes (specs / responses tied to ans/key).
  useEffect(() => {
    setL3Specs(null)
    setL3EditedResponses([])
    setL3Error(null)
    setL3Result(null)
  }, [sessionId])

  const buildPrompt = async () => {
    if (!sessionId) return
    setL3Busy(true)
    setL3Error(null)
    setL3Result(null)
    try {
      const r = await fetch(`${previewUrl}/preview/sessions/${sessionId}/build-prompt`, {
        method: 'POST',
      })
      const json = await r.json()
      if (!r.ok) {
        setL3Error(json.error || `HTTP ${r.status}`)
        setL3Specs(null)
        return
      }
      const specs = (json.specs as GradePromptSpec[]) ?? []
      setL3Specs(specs)
      // Seed the response editor with the last LLM response (if any) so the
      // author can edit-and-rerun without re-typing. Falls back to '{}'.
      const lastResponses = data?.prompts.slice(-specs.length).map((p) => p.response) ?? []
      setL3EditedResponses(specs.map((_, i) => lastResponses[i] ?? '{}'))
    } catch (e) {
      setL3Error(e instanceof Error ? e.message : String(e))
    } finally {
      setL3Busy(false)
    }
  }

  const rerunParse = async () => {
    if (!sessionId) return
    setL3Busy(true)
    setL3Error(null)
    try {
      const r = await fetch(`${previewUrl}/preview/sessions/${sessionId}/rerun-parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedResponses: l3EditedResponses }),
      })
      const json = await r.json()
      if (!r.ok) {
        setL3Error(json.error || `HTTP ${r.status}`)
        setL3Result(null)
        return
      }
      setL3Result(json.result)
    } catch (e) {
      setL3Error(e instanceof Error ? e.message : String(e))
    } finally {
      setL3Busy(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Pick a story and let the preview load to start inspecting.
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
        <span className="text-xs font-semibold">Inspector</span>
        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
          {sessionId.slice(0, 8)}…
        </code>
        {data?.bundle && (
          <Badge variant="outline" className="text-[10px]">
            {data.bundle.type}
          </Badge>
        )}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700">
            {error}
          </div>
        )}

        {/* L2 — Lifecycle counts */}
        <Section title="L2 · Lifecycle (counts)">
          {data && Object.keys(data.lifecycleCounts).length === 0 ? (
            <p className="text-muted-foreground">No events yet — submit something in the preview.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data &&
                Object.entries(data.lifecycleCounts).map(([method, count]) => (
                  <Badge key={method} variant="secondary" className="text-[10px]">
                    {method} · {count}
                  </Badge>
                ))}
            </div>
          )}
        </Section>

        {/* Grade history */}
        <Section title={`Grade history (${data?.gradeHistory.length ?? 0})`}>
          {data?.gradeHistory.length === 0 ? (
            <p className="text-muted-foreground">No grades yet.</p>
          ) : (
            <ul className="space-y-1">
              {data?.gradeHistory.slice(-5).reverse().map((g, idx) => {
                const out = g.output as { total?: number } | null
                return (
                  <li key={idx} className="rounded border bg-muted/30 px-2 py-1">
                    <div className="flex gap-2">
                      <span className="font-mono">
                        {new Date(g.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-muted-foreground">
                        {g.durationMs}ms
                      </span>
                      <span className="ml-auto font-semibold">
                        total: {out?.total ?? '—'}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        {/* L1 — Prompt traces */}
        <Section title={`L1 · Prompts (${data?.prompts.length ?? 0})`}>
          {data?.prompts.length === 0 ? (
            <p className="text-muted-foreground">No LLM calls recorded.</p>
          ) : (
            <ul className="space-y-2">
              {data?.prompts.slice(-3).reverse().map((p) => (
                <li key={p.callId} className="rounded border bg-muted/30 p-2 space-y-1">
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono">{new Date(p.timestamp).toLocaleTimeString()}</span>
                    <span>{p.durationMs}ms</span>
                    <code className="ml-auto">{p.callId.slice(0, 8)}…</code>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-[11px]">system prompt</summary>
                    <pre className="whitespace-pre-wrap text-[10px] mt-1 max-h-32 overflow-y-auto">
                      {p.systemPrompt}
                    </pre>
                  </details>
                  <details>
                    <summary className="cursor-pointer text-[11px]">user message</summary>
                    <pre className="whitespace-pre-wrap text-[10px] mt-1 max-h-32 overflow-y-auto">
                      {p.userMessage}
                    </pre>
                  </details>
                  <details>
                    <summary className="cursor-pointer text-[11px]">response</summary>
                    <pre className="whitespace-pre-wrap text-[10px] mt-1 max-h-32 overflow-y-auto">
                      {p.response}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* L3 — Two-stage grade debugger */}
        <Section title="L3 · Two-stage grade (edit & rerun)">
          <p className="text-[11px] text-muted-foreground mb-2">
            Build the prompt the plugin would send, edit the response by hand, and re-grade
            without burning LLM tokens. Plugins without L3 will surface a "not available" error.
          </p>
          <div className="flex gap-2 mb-2">
            <Button size="sm" variant="outline" onClick={() => void buildPrompt()} disabled={l3Busy}>
              {l3Busy ? '…' : 'Build Prompt'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void rerunParse()}
              disabled={l3Busy || !l3Specs}
            >
              Rerun Parse
            </Button>
          </div>
          {l3Error && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-800 mb-2">
              {l3Error}
            </div>
          )}
          {l3Specs && l3Specs.length === 0 && (
            <div className="rounded border bg-muted/30 px-2 py-1.5 text-muted-foreground">
              Plugin reports zero LLM prompts for this answerKey — nothing to edit.
              "Rerun Parse" will simply re-run the deterministic grader.
            </div>
          )}
          {l3Specs && l3Specs.length > 0 && (
            <div className="space-y-2">
              {l3Specs.map((spec, i) => (
                <div key={i} className="rounded border bg-muted/30 p-2">
                  <div className="text-[11px] font-semibold mb-1">Prompt {i + 1}</div>
                  <details>
                    <summary className="cursor-pointer text-[10px] text-muted-foreground">system prompt</summary>
                    <pre className="whitespace-pre-wrap text-[10px] mt-1 max-h-32 overflow-y-auto">
                      {spec.systemPrompt}
                    </pre>
                  </details>
                  <details>
                    <summary className="cursor-pointer text-[10px] text-muted-foreground">user message</summary>
                    <pre className="whitespace-pre-wrap text-[10px] mt-1 max-h-32 overflow-y-auto">
                      {spec.userMessage}
                    </pre>
                  </details>
                  <div className="text-[10px] text-muted-foreground mt-1">edited response</div>
                  <div className="border h-32 rounded overflow-hidden mt-1">
                    <Editor
                      defaultLanguage="json"
                      value={l3EditedResponses[i] ?? '{}'}
                      onChange={(v) => {
                        const next = [...l3EditedResponses]
                        next[i] = v ?? ''
                        setL3EditedResponses(next)
                      }}
                      theme="vs"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 11,
                        lineNumbers: 'off',
                        folding: false,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {l3Result !== null && (
            <div className="rounded border bg-emerald-50 border-emerald-200 p-2 mt-2">
              <div className="text-[11px] font-semibold mb-1">Rerun result</div>
              <pre className="text-[10px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                {JSON.stringify(l3Result, null, 2)}
              </pre>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  )
}
