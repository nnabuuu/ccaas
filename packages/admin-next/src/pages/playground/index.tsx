/**
 * Bundle Playground — Admin embedding of the exercise-preview server.
 *
 * Connects to a running exercise-preview dev server (default http://localhost:4321),
 * lists its bundles + stories, and provides a three-pane workspace:
 *   - Left: bundle/story tree
 *   - Middle: AnswerKey JSON editor (textarea, monaco upgrade path noted)
 *   - Right: live preview iframe + draft save
 *
 * Drafts are persisted to localStorage as a v1 quick-win; the full
 * playground_drafts DB table is a v2 follow-up (see exercise-plugin-preview-design §17).
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

  // Seed draft from story or localStorage on selection
  useEffect(() => {
    if (!activeBundleId || !activeStory || !bundleDetail) return
    const story = bundleDetail.stories.find((s) => s.name === activeStory)
    if (!story) return
    const key = draftKey(activeBundleId, activeStory)
    let initial = JSON.stringify(story.answerKey, null, 2)
    try {
      const saved = localStorage.getItem(key)
      if (saved) initial = saved
    } catch {
      /* ignore */
    }
    setDraftJson(initial)
    setDraftError(null)
  }, [activeBundleId, activeStory, bundleDetail])

  const saveDraft = () => {
    if (!activeBundleId || !activeStory) return
    try {
      JSON.parse(draftJson) // validate
      localStorage.setItem(draftKey(activeBundleId, activeStory), draftJson)
      setDraftError(null)
      setStatus(`Draft saved · ${new Date().toLocaleTimeString()}`)
    } catch (e) {
      setDraftError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const resetDraft = () => {
    if (!activeBundleId || !activeStory || !bundleDetail) return
    const story = bundleDetail.stories.find((s) => s.name === activeStory)
    if (!story) return
    setDraftJson(JSON.stringify(story.answerKey, null, 2))
    localStorage.removeItem(draftKey(activeBundleId, activeStory))
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

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background">
        <h1 className="text-base font-semibold">Bundle Playground</h1>
        <span className="text-xs text-muted-foreground">{status}</span>
        <div className="ml-auto flex gap-2 items-center">
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
                  <Button size="sm" onClick={saveDraft}>
                    Save Draft
                  </Button>
                </div>
              </div>
              <textarea
                value={draftJson}
                onChange={(e) => setDraftJson(e.target.value)}
                spellCheck={false}
                className="flex-1 font-mono text-xs p-3 outline-none resize-none"
                style={{ tabSize: 2 }}
              />
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

        {/* Right: live preview iframe */}
        <section className="flex flex-col overflow-hidden">
          <div className="flex items-center px-4 py-2 border-b bg-muted/50">
            <span className="text-xs font-semibold">Live Preview</span>
            <span className="ml-2 text-[11px] text-muted-foreground">embedded from {previewUrl}</span>
          </div>
          {activeBundleId ? (
            <iframe
              src={previewUrl}
              title="Exercise Preview"
              className="flex-1 border-0"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Pick a story to load the preview.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default PlaygroundPage
