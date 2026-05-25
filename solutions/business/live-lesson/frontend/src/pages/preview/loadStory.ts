/**
 * loadStory — fetch a bundle from the exercise-preview server and pick a story.
 *
 * Hits the proxied `/preview/bundles/:bundleId` endpoint (vite.config.ts
 * proxies /preview to the preview-server at :4321 in dev). Returns the
 * matching story plus its parent bundle's plugin metadata.
 */

export interface PreviewStory {
  name: string
  answerKey: Record<string, unknown>
  initialAns?: Record<string, unknown>
  reviewData?: { data: Record<string, unknown>; checkItems?: Array<Record<string, unknown>> }
  initialPhase?: 'idle' | 'submitting' | 'review'
  initialRole?: 'student' | 'teacher'
  classSubmissions?: Array<{
    studentId: string
    name: string
    data: Record<string, unknown>
    score?: number
    submittedAt?: number
  }>
  classObserveData?: Record<string, unknown>
  notes?: string
  metadata?: Record<string, unknown>
  locale?: 'zh' | 'en'
}

export interface LoadedPreviewStory {
  bundleId: string
  storyName: string
  story: PreviewStory
  plugin: { type: string; displayName?: string }
  meta: { title?: string; description?: string; tags?: string[] }
}

export async function loadStory(
  bundleId: string,
  storyName: string,
): Promise<LoadedPreviewStory> {
  // bundleId / storyName come from URL params — JSON.stringify keeps log
  // output well-formed if either contains quotes or newlines.
  const res = await fetch(`/preview/bundles/${encodeURIComponent(bundleId)}`)
  if (!res.ok) {
    throw new Error(`Failed to load bundle ${JSON.stringify(bundleId)} (${res.status})`)
  }
  const bundle = (await res.json()) as {
    bundleId: string
    plugin: { type: string; displayName?: string }
    meta: { title?: string; description?: string; tags?: string[] }
    stories: Record<string, PreviewStory>
  }
  const story = bundle.stories[storyName]
  if (!story) {
    throw new Error(
      `Story ${JSON.stringify(storyName)} not in bundle ${JSON.stringify(bundleId)}. Available: [${Object.keys(bundle.stories).join(', ')}]`,
    )
  }
  return { bundleId: bundle.bundleId, storyName, story, plugin: bundle.plugin, meta: bundle.meta }
}
