import { useCallback, useEffect, useRef, useState } from 'react'
import { Layout, Save, CheckCircle, Loader2 } from 'lucide-react'
import { readFile, writeFile } from '../../api/projects'
import type { Manifest, ReadingStep } from '../../types'
import { getStepColor } from '../../types'
import StepList from './StepList'
import BlockEditorDrawer from './BlockEditorDrawer'

interface ExecutionTabProps {
  projectId: string
}

type SaveStatus = 'saved' | 'saving' | 'unsaved'

const TIMELINE_BG: Record<string, string> = {
  teal: 'bg-teal-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  amber: 'bg-amber-400',
  green: 'bg-green-400',
}

let stepIdCounter = 0
function nextStepId(): string {
  return `s-${Date.now()}-${++stepIdCounter}`
}

export default function ExecutionTab({ projectId }: ExecutionTabProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [selectedBlock, setSelectedBlock] = useState<{ stepIdx: number } | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manifestRef = useRef<Manifest | null>(null)
  manifestRef.current = manifest

  // Load manifest
  useEffect(() => {
    let cancelled = false
    // Clear timer when projectId changes
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    async function load() {
      try {
        setLoading(true)
        setError(null)
        setSelectedBlock(null)
        const { content } = await readFile(projectId, 'execution/manifest.json')
        if (!cancelled) {
          const parsed = JSON.parse(content) as Manifest
          if (!Array.isArray(parsed.readingSteps)) {
            throw new Error('Invalid manifest: missing readingSteps array')
          }
          setManifest(parsed)
          setSaveStatus('saved')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load manifest')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [projectId])

  // Save function
  const save = useCallback(async () => {
    const m = manifestRef.current
    if (!m) return
    setSaveStatus('saving')
    try {
      await writeFile(projectId, 'execution/manifest.json', JSON.stringify(m, null, 2))
      setSaveStatus('saved')
    } catch {
      setSaveStatus('unsaved')
    }
  }, [projectId])

  // Schedule auto-save with 2s debounce
  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { save() }, 2000)
  }, [save])

  const handleStepsChange = useCallback((steps: ReadingStep[]) => {
    setManifest((prev) => {
      if (!prev) return prev
      return { ...prev, readingSteps: steps }
    })
    scheduleSave()
  }, [scheduleSave])

  // Use functional updater to avoid stale closure over steps
  const handleStepChange = useCallback((updatedStep: ReadingStep) => {
    if (!selectedBlock) return
    const idx = selectedBlock.stepIdx
    setManifest((prev) => {
      if (!prev) return prev
      const next = [...prev.readingSteps]
      next[idx] = updatedStep
      return { ...prev, readingSteps: next }
    })
    scheduleSave()
  }, [selectedBlock, scheduleSave])

  const handleSelectBlock = useCallback((stepIdx: number, _blockType: string) => {
    setSelectedBlock({ stepIdx })
  }, [])

  const handleAddStep = useCallback(() => {
    setManifest((prev) => {
      if (!prev) return prev
      const steps = prev.readingSteps
      const newStep: ReadingStep = {
        id: nextStepId(),
        idx: steps.length,
        type: 'task',
        duration: 5,
        label: `Step ${steps.length + 1}`,
      }
      return { ...prev, readingSteps: [...steps, newStep] }
    })
    scheduleSave()
  }, [scheduleSave])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading manifest...
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500 text-sm">
        {error}
      </div>
    )
  }

  if (!manifest) return null

  const steps = manifest.readingSteps
  const selectedStep = selectedBlock ? steps[selectedBlock.stepIdx] : null

  return (
    <div className="h-full flex">
      {/* Left: step list */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Layout size={16} className="text-blue-500" />
              执行设计
            </h2>
            <div className="flex items-center gap-1.5 text-xs">
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle size={12} className="text-green-500" />
                  <span className="text-gray-400">Saved</span>
                </>
              )}
              {saveStatus === 'saving' && (
                <>
                  <Loader2 size={12} className="animate-spin text-blue-500" />
                  <span className="text-gray-400">Saving...</span>
                </>
              )}
              {saveStatus === 'unsaved' && (
                <>
                  <Save size={12} className="text-amber-500" />
                  <span className="text-amber-600">Unsaved</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Design the step-by-step execution flow for your lesson
          </p>

          {/* Timeline bar */}
          {steps.length > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mt-3">
              {steps.map((step, i) => (
                <div
                  key={step.id}
                  className={TIMELINE_BG[getStepColor(i)]}
                  style={{ flex: step.duration || 1 }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Step list */}
        <div className="flex-1 overflow-y-auto p-6">
          <StepList
            steps={steps}
            onStepsChange={handleStepsChange}
            onSelectBlock={handleSelectBlock}
            selectedBlock={selectedBlock}
          />

          {/* Add step button */}
          <button
            onClick={handleAddStep}
            className="w-full flex items-center justify-center gap-2 py-3 mt-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
          >
            + Add step
          </button>
        </div>
      </div>

      {/* Right: block editor drawer */}
      {selectedStep && (
        <BlockEditorDrawer
          step={selectedStep}
          onStepChange={handleStepChange}
          onClose={() => setSelectedBlock(null)}
        />
      )}
    </div>
  )
}
