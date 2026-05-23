/**
 * Bundle Playground — Admin embedding of the exercise-preview server.
 *
 * Connects to a running exercise-preview dev server (default http://localhost:4321),
 * lists its bundles + stories, and provides a three-pane workspace:
 *   - Left: bundle/story tree
 *   - Middle: AnswerKey JSON editor (Monaco)
 *   - Right: live preview iframe + draft save
 *
 * Drafts persist to the admin backend's playground_drafts table via
 * /api/v1/admin/playground-drafts (§17). LocalStorage fallback keeps work
 * available when offline / backend unreachable.
 */
import { useEffect, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api-client'
import { InspectorPane } from './InspectorPane'
import { ShortCodesDialog } from './ShortCodesDialog'

const DEFAULT_PREVIEW_URL = (() => {
  try {
    return localStorage.getItem('playground.previewUrl') || 'http://localhost:4321'
  } catch {
    return 'http://localhost:4321'
  }
})()

interface StorySummary {
  name: string
  displayName: string
  locale?: 'zh' | 'en'
  initialRole?: 'student' | 'teacher'
}

interface BundleSummary {
  bundleId: string
  plugin: { type: string; displayName?: string }
  meta: { title: string; description?: string; tags?: string[] }
  stories: StorySummary[]
}

interface FullStory {
  name: string
  answerKey: Record<string, unknown>
  initialAns?: Record<string, unknown>
  initialRole?: 'student' | 'teacher'
  locale?: 'zh' | 'en'
  classSubmissions?: unknown[]
}

interface BundleDetail extends BundleSummary {
  stories: (StorySummary & FullStory)[]
}

function draftKey(bundleId: string, storyName: string): string {
  return `playground.draft.${bundleId}.${storyName}`
}

export function PlaygroundPage() {
  const [previewUrl, setPreviewUrl] = useState(DEFAULT_PREVIEW_URL)
  const [urlInput, setUrlInput] = useState(DEFAULT_PREVIEW_URL)
  const [bundles, setBundles] = useState<BundleSummary[]>([])
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null)
  const [activeStory, setActiveStory] = useState<string | null>(null)
  const [bundleDetail, setBundleDetail] = useState<BundleDetail | null>(null)
  const [draftJson, setDraftJson] = useState<string>('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Connecting...')
  // Right-pane mode + sessionId/refresh used by the Inspector tab.
  const [rightTab, setRightTab] = useState<'preview' | 'inspector'>('preview')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [inspectorRefresh, setInspectorRefresh] = useState(0)
  // Locale switcher — persisted to localStorage and synced to preview via
  // postMessage ('set-locale'). Today the preview iframe stores the locale
  // on state.story.locale (visible in Inspector metadata) but its hardcoded
  // zh-CN strings don't actually retranslate. The i18n.ts contract is the
  // foothold for v2 when the public demo lands.
  const [locale, setLocale] = useState<'zh-CN' | 'en'>(() => {
    try {
      const v = localStorage.getItem('playground.locale')
      return v === 'en' ? 'en' : 'zh-CN'
    } catch {
      return 'zh-CN'
    }
  })

  // Load bundle list
  useEffect(() => {
    let cancelled = false
    setStatus('Connecting...')
    fetch(`${previewUrl}/preview/bundles`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: BundleSummary[]) => {
        if (cancelled) return
        setBundles(data)
        setStatus(`${data.length} bundle${data.length === 1 ? '' : 's'} loaded`)
      })
      .catch((e) => {
        if (cancelled) return
        setStatus(`Connection failed: ${e.message}. Is the preview server running at ${previewUrl}?`)
        setBundles([])
      })
    return () => {
      cancelled = true
    }
  }, [previewUrl])

  // Load bundle detail when active bundle changes
  useEffect(() => {
    if (!activeBundleId) {
      setBundleDetail(null)
      return
    }
    let cancelled = false
    fetch(`${previewUrl}/preview/bundles/${activeBundleId}`)
      .then((r) => r.json())
      .then((data: BundleDetail) => {
        if (!cancelled) setBundleDetail(data)
      })
      .catch(() => !cancelled && setBundleDetail(null))
    return () => {
      cancelled = true
    }
  }, [activeBundleId, previewUrl])

  // Seed draft from server (then localStorage fallback) on selection
  useEffect(() => {
    if (!activeBundleId || !activeStory || !bundleDetail) return
    const story = bundleDetail.stories.find((s) => s.name === activeStory)
    if (!story) return
    let cancelled = false
    const fallback = JSON.stringify(story.answerKey, null, 2)
    ;(async () => {
      const key = draftKey(activeBundleId, activeStory)
      // Try server first
      try {
        const res = await apiClient.get(`/admin/playground-drafts/${encodeURIComponent(activeBundleId)}/${encodeURIComponent(activeStory)}`)
        if (cancelled) return
        if (res.status === 200 && res.data?.payload) {
          setDraftJson(JSON.stringify(res.data.payload, null, 2))
          setDraftError(null)
          setStatus(`Loaded draft from server`)
          return
        }
      } catch {
        // 404 or network error — fall through to localStorage
      }
      if (cancelled) return
      try {
        const saved = localStorage.getItem(key)
        setDraftJson(saved ?? fallback)
      } catch {
        setDraftJson(fallback)
      }
      setDraftError(null)
    })()
    return () => {
      cancelled = true
    }
  }, [activeBundleId, activeStory, bundleDetail])

  const saveDraft = async () => {
    if (!activeBundleId || !activeStory) return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(draftJson)
    } catch (e) {
      setDraftError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
    setDraftError(null)
    // Always update localStorage as offline cache
    try {
      localStorage.setItem(draftKey(activeBundleId, activeStory), draftJson)
    } catch {
      /* quota / private mode */
    }
    // Persist to backend
    try {
      await apiClient.put(
        `/admin/playground-drafts/${encodeURIComponent(activeBundleId)}/${encodeURIComponent(activeStory)}`,
        { payload: parsed },
      )
      setStatus(`Draft saved · ${new Date().toLocaleTimeString()}`)
    } catch (e) {
      setStatus(`Saved locally (backend unreachable): ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const resetDraft = async () => {
    if (!activeBundleId || !activeStory || !bundleDetail) return
    const story = bundleDetail.stories.find((s) => s.name === activeStory)
    if (!story) return
    setDraftJson(JSON.stringify(story.answerKey, null, 2))
    try {
      localStorage.removeItem(draftKey(activeBundleId, activeStory))
    } catch {
      /* ignore */
    }
    try {
      await apiClient.delete(
        `/admin/playground-drafts/${encodeURIComponent(activeBundleId)}/${encodeURIComponent(activeStory)}`,
      )
    } catch {
      /* draft might not exist server-side */
    }
    setDraftError(null)
    setStatus('Draft reset to original')
  }

  const onCheckDraft = () => {
    try {
      JSON.parse(draftJson)
      setDraftError(null)
    } catch (e) {
      setDraftError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // postMessage protocol — see web/index.html docstring
  // We target the iframe's exact origin (parsed from `previewUrl`) so messages
  // can't leak to a window that navigated mid-session, and we validate
  // `event.origin` on receipt to block hostile parents.
  const previewOrigin = (() => {
    try {
      return new URL(previewUrl).origin
    } catch {
      return null
    }
  })()
  const sendToPreview = (type: string, payload?: unknown) => {
    if (!previewOrigin) return
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null
    iframe?.contentWindow?.postMessage(
      { source: 'kedge-playground', type, payload },
      previewOrigin,
    )
  }

  // Auto-open story in iframe when selection changes
  useEffect(() => {
    if (!activeBundleId || !activeStory) return
    const timer = setTimeout(() => {
      sendToPreview('open-story', { bundleId: activeBundleId, storyName: activeStory })
    }, 200) // small delay to let iframe load
    return () => clearTimeout(timer)
  }, [activeBundleId, activeStory, previewOrigin])

  // Push locale to preview iframe whenever it changes (debounced — typing in
  // localStorage shouldn't burn extra postMessages).
  useEffect(() => {
    if (!previewOrigin) return
    sendToPreview('set-locale', { locale })
    try {
      localStorage.setItem('playground.locale', locale)
    } catch {
      /* ignore */
    }
  }, [locale, previewOrigin])

  /**
   * Live-sync: when the AnswerKey JSON parses cleanly, push it to the preview
   * iframe automatically (debounced 350ms after typing stops). Authors no
   * longer have to click "Push to Preview" every time — invalid intermediate
   * states are simply skipped without firing.
   *
   * Skipped on the first render for a story (the `open-story` message above
   * already loaded the canonical answerKey — re-pushing it would be wasteful
   * but harmless; we still guard against it to keep the postMessage trace
   * clean during a fresh story load).
   */
  useEffect(() => {
    if (!activeBundleId || !activeStory || !draftJson) return
    // Skip the auto-push if the editor still holds exactly the canonical
    // answerKey (just opened — open-story already loaded it).
    const initial = bundleDetail?.stories.find((s) => s.name === activeStory)?.answerKey
    if (initial && JSON.stringify(initial, null, 2) === draftJson) return

    const timer = setTimeout(() => {
      try {
        const ak = JSON.parse(draftJson)
        sendToPreview('set-answer-key', {
          bundleId: activeBundleId,
          storyName: activeStory,
          answerKey: ak,
        })
        setDraftError(null)
      } catch {
        // Intermediate edit state — silent. The Validate button surfaces
        // explicit errors when the user wants them.
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [draftJson, activeBundleId, activeStory, bundleDetail, previewOrigin])

  // Listen for preview messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Validate origin first — block messages from any window other than the
      // configured preview iframe origin.
      if (previewOrigin && event.origin !== previewOrigin) return
      const msg = event.data
      if (!msg || msg.source !== 'kedge-preview') return
      if (msg.type === 'grade-result') {
        setStatus(`Last grade: ${JSON.stringify(msg.payload?.result?.total ?? '?')}`)
        // Bump the inspector refresh signal so L1/L2 panels re-fetch after
        // every grade — no need for the user to click Refresh.
        setInspectorRefresh((n) => n + 1)
      } else if (msg.type === 'story-loaded') {
        // Preview hands back the new sessionId after open-story. Captured
        // here so the Inspector pane can hit /preview/sessions/:id endpoints.
        if (msg.payload?.sessionId) {
          setSessionId(msg.payload.sessionId as string)
          setInspectorRefresh((n) => n + 1)
        }
      } else if (msg.type === 'ready') {
        setStatus(`Preview ready · ${msg.payload?.bundleCount ?? 0} bundles`)
      } else if (msg.type === 'error') {
        setStatus(`Preview error: ${msg.payload?.message ?? 'unknown'}`)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [previewOrigin])

  const pushDraftToPreview = () => {
    try {
      const ak = JSON.parse(draftJson)
      sendToPreview('set-answer-key', { bundleId: activeBundleId, storyName: activeStory, answerKey: ak })
      setStatus(`Pushed draft to preview · ${new Date().toLocaleTimeString()}`)
    } catch (e) {
      setDraftError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const submitInPreview = () => sendToPreview('submit')
  const resetInPreview = () => sendToPreview('reset')

  // Monaco editor mount hook — enables JSON validation diagnostics
  const handleEditorMount: OnMount = (editor, monaco) => {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemaValidation: 'error',
      trailingCommas: 'error',
    })
    // Format on Cmd/Ctrl+Shift+F via built-in action.
    // Ctrl+S triggers save draft.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveDraft()
    })
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background">
        <h1 className="text-base font-semibold">Bundle Playground</h1>
        <span className="text-xs text-muted-foreground">{status}</span>
        <div className="ml-auto flex gap-2 items-center">
          {/* Share-link dialog (§18) — mint deterministic / random short
              codes for the current story; copy public URL; prune old codes. */}
          <ShortCodesDialog
            previewUrl={previewUrl}
            bundleId={activeBundleId}
            storyName={activeStory}
          />
          {/* Locale toggle — persists to localStorage and posts to the
              preview iframe via 'set-locale'. Preview today only updates
              the metadata display; full i18n re-render is a v2 follow-up. */}
          <div className="inline-flex rounded border bg-background text-[11px]">
            <button
              type="button"
              onClick={() => setLocale('zh-CN')}
              className={`px-2 py-1 ${locale === 'zh-CN' ? 'bg-foreground text-background' : ''}`}
              title="Set preview locale to Chinese"
            >
              中
            </button>
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`px-2 py-1 ${locale === 'en' ? 'bg-foreground text-background' : ''}`}
              title="Set preview locale to English"
            >
              EN
            </button>
          </div>
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="http://localhost:4321"
            className="w-72 text-xs h-8"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPreviewUrl(urlInput)
              try {
                localStorage.setItem('playground.previewUrl', urlInput)
              } catch {
                /* ignore */
              }
            }}
          >
            Connect
          </Button>
        </div>
      </div>

      {/* Three-pane layout */}
      <div className="grid grid-cols-[280px_1fr_1fr] flex-1 overflow-hidden">
        {/* Left: bundle/story tree */}
        <aside className="border-r overflow-y-auto p-3 text-sm">
          {bundles.length === 0 ? (
            <div className="text-xs text-muted-foreground p-4">
              No bundles. Make sure <code>exercise-preview</code> is running.
            </div>
          ) : (
            bundles.map((b) => (
              <div key={b.bundleId} className="mb-3">
                <div className="font-semibold text-xs mb-1 flex items-center gap-2">
                  <span>{b.meta.title}</span>
                  <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{b.plugin.type}</code>
                </div>
                {b.meta.description && (
                  <div className="text-[11px] text-muted-foreground mb-1">{b.meta.description}</div>
                )}
                {b.stories.map((s) => {
                  const isActive = activeBundleId === b.bundleId && activeStory === s.name
                  return (
                    <button
                      key={s.name}
                      onClick={() => {
                        setActiveBundleId(b.bundleId)
                        setActiveStory(s.name)
                      }}
                      className={`block w-full text-left text-xs px-2 py-1.5 rounded my-0.5 transition-colors ${
                        isActive
                          ? 'bg-foreground text-background font-semibold'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span>{s.displayName}</span>
                      {s.locale && <span className="text-[9px] ml-2 opacity-60">{s.locale}</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </aside>

        {/* Middle: AnswerKey editor */}
        <main className="border-r flex flex-col overflow-hidden">
          {activeBundleId && activeStory ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
                <span className="text-xs font-semibold">AnswerKey Editor</span>
                <span className="text-[11px] text-muted-foreground">
                  {activeBundleId} · {activeStory}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={onCheckDraft}>
                    Validate
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetDraft}>
                    Reset
                  </Button>
                  <Button size="sm" variant="outline" onClick={pushDraftToPreview}>
                    Push to Preview
                  </Button>
                  <Button size="sm" variant="outline" onClick={submitInPreview}>
                    Submit
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetInPreview}>
                    Reset Preview
                  </Button>
                  <Button size="sm" onClick={saveDraft}>
                    Save Draft
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <Editor
                  defaultLanguage="json"
                  value={draftJson}
                  theme="vs"
                  onChange={(value) => setDraftJson(value ?? '')}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    lineNumbers: 'on',
                    folding: true,
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    formatOnPaste: true,
                    formatOnType: false,
                    tabSize: 2,
                    bracketPairColorization: { enabled: true },
                    wordWrap: 'on',
                  }}
                />
              </div>
              {draftError && (
                <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t">
                  {draftError}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a story from the left.
            </div>
          )}
        </main>

        {/* Right: live preview iframe ↔ Inspector tab.
            Both stay mounted (CSS-hidden when inactive) so the iframe doesn't
            lose state and the inspector can re-poll silently. */}
        <section className="flex flex-col overflow-hidden">
          <div className="flex items-center px-4 py-2 border-b bg-muted/50 gap-2">
            <div className="inline-flex rounded border bg-background">
              <button
                onClick={() => setRightTab('preview')}
                className={`text-[11px] px-3 py-1 ${
                  rightTab === 'preview' ? 'bg-foreground text-background' : ''
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setRightTab('inspector')}
                className={`text-[11px] px-3 py-1 ${
                  rightTab === 'inspector' ? 'bg-foreground text-background' : ''
                }`}
              >
                Inspector
              </button>
            </div>
            {rightTab === 'preview' && (
              <span className="text-[11px] text-muted-foreground">
                embedded from {previewUrl}
              </span>
            )}
            {rightTab === 'inspector' && !sessionId && (
              <span className="text-[11px] text-muted-foreground">
                no session yet — open a story first
              </span>
            )}
          </div>

          {/* Preview pane (always mounted) */}
          <div
            className="flex-1 flex flex-col"
            style={{ display: rightTab === 'preview' ? 'flex' : 'none' }}
          >
            {activeBundleId ? (
              <iframe
                id="preview-iframe"
                src={`${previewUrl}${previewUrl.includes('?') ? '&' : '?'}parentOrigin=${encodeURIComponent(window.location.origin)}`}
                title="Exercise Preview"
                className="flex-1 border-0"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Pick a story to load the preview.
              </div>
            )}
          </div>

          {/* Inspector pane */}
          <div
            className="flex-1 flex flex-col"
            style={{ display: rightTab === 'inspector' ? 'flex' : 'none' }}
          >
            <InspectorPane
              previewUrl={previewUrl}
              sessionId={sessionId}
              refreshTrigger={inspectorRefresh}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

export default PlaygroundPage
