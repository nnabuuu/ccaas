import {
  useState, useRef, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'
import { compressImage } from '../../../utils/compress-image'
import { useCamera } from './useCamera'
import { CameraModal } from './CameraModal'
import './handwriting.css'

/* ── Types ── */

interface Stroke {
  tool: 'pen' | 'eraser'
  color: string
  points: Array<{ x: number; y: number }>
}

interface PageData {
  id: number
  type: 'canvas' | 'photo'
  photoData?: string
}

export interface HandwritingCanvasHandle {
  /** Synchronously export all pages as data URIs (canvas → JPEG, photo → as-is). */
  exportPages(): string[]
}

interface HandwritingCanvasProps {
  maxPages?: number
  onPagesChange?: (dataUris: string[]) => void
  onContentStatusChange?: (hasContent: boolean) => void
  disabled?: boolean
}

/* ── Constants ── */

const W = 1200
const H = 480

/* ── Component ── */

export const HandwritingCanvas = forwardRef<HandwritingCanvasHandle, HandwritingCanvasProps>(
  function HandwritingCanvas({ maxPages = 5, onPagesChange, onContentStatusChange, disabled }, ref) {
    const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
    const strokesRef = useRef<Record<number, Stroke[]>>({})
    const drawingRef = useRef(false)
    const pathRef = useRef<Array<{ x: number; y: number }>>([])
    const activePageIdRef = useRef<number | null>(null)
    const nextIdRef = useRef(1)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const pagesRef = useRef<PageData[]>([])
    const onPagesChangeRef = useRef(onPagesChange)
    onPagesChangeRef.current = onPagesChange
    const onContentStatusChangeRef = useRef(onContentStatusChange)
    onContentStatusChangeRef.current = onContentStatusChange
    const lastHasContentRef = useRef(false)
    const notifyTimerRef = useRef(0)

    const [pages, setPages] = useState<PageData[]>([])
    const [activePageId, setActivePageId] = useState<number | null>(null)
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
    const [redrawTick, setRedrawTick] = useState(0)
    const [dragOver, setDragOver] = useState(false)
    const [showCamera, setShowCamera] = useState(false)
    const { hasCamera, permission, facing, requestPermission, switchFacing } = useCamera()

    /* ── Helpers ── */

    const setActive = (id: number | null) => {
      activePageIdRef.current = id
      setActivePageId(id)
    }

    const updatePages = (newPages: PageData[]) => {
      pagesRef.current = newPages
      setPages(newPages)
    }

    const makeCanvasPage = (): PageData => {
      const id = nextIdRef.current++
      strokesRef.current[id] = []
      return { id, type: 'canvas' }
    }

    const makePhotoPage = (data: string): PageData => {
      const id = nextIdRef.current++
      return { id, type: 'photo', photoData: data }
    }

    /* ── Export ── */

    const doExport = useCallback((): string[] => {
      const uris: string[] = []
      for (const p of pagesRef.current) {
        if (p.type === 'photo' && p.photoData) {
          uris.push(p.photoData)
        } else if (p.type === 'canvas') {
          const canvas = canvasRefs.current[p.id]
          if (canvas) uris.push(canvas.toDataURL('image/jpeg', 0.85))
        }
      }
      return uris
    }, [])

    useImperativeHandle(ref, () => ({ exportPages: doExport }), [doExport])

    const computeHasContent = useCallback((): boolean => {
      return pagesRef.current.length > 0 && pagesRef.current.some(p =>
        (p.type === 'photo' && p.photoData) ||
        (p.type === 'canvas' && (strokesRef.current[p.id]?.length ?? 0) > 0),
      )
    }, [])

    const scheduleNotify = useCallback(() => {
      if (notifyTimerRef.current) cancelAnimationFrame(notifyTimerRef.current)
      notifyTimerRef.current = requestAnimationFrame(() => {
        onPagesChangeRef.current?.(doExport())
        const has = computeHasContent()
        if (has !== lastHasContentRef.current) {
          lastHasContentRef.current = has
          onContentStatusChangeRef.current?.(has)
        }
      })
    }, [doExport, computeHasContent])

    /* ── Redraw ── */

    const redrawPage = useCallback((pageId: number) => {
      const c = canvasRefs.current[pageId]
      if (!c) return
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)
      for (const s of (strokesRef.current[pageId] || [])) {
        if (s.points.length < 1) continue
        ctx.save()
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        if (s.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out'
          ctx.lineWidth = 28
          ctx.strokeStyle = 'rgba(0,0,0,1)'
        } else {
          ctx.globalCompositeOperation = 'source-over'
          ctx.strokeStyle = s.color || '#1c1c1a'
          ctx.lineWidth = 2.5
        }
        ctx.beginPath()
        ctx.moveTo(s.points[0].x, s.points[0].y)
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
        ctx.stroke()
        ctx.restore()
      }
    }, [])

    useEffect(() => {
      if (pages.length === 0) return
      requestAnimationFrame(() => {
        for (const p of pages) {
          if (p.type === 'canvas') redrawPage(p.id)
        }
      })
    }, [pages, redrawTick, redrawPage])

    /* ── Drawing ── */

    const getPos = (e: React.MouseEvent | React.TouchEvent, pageId: number) => {
      const c = canvasRefs.current[pageId]
      if (!c) return { x: 0, y: 0 }
      const r = c.getBoundingClientRect()
      const t = 'touches' in e ? e.touches[0] : e
      return {
        x: (t.clientX - r.left) * (W / r.width),
        y: (t.clientY - r.top) * (H / r.height),
      }
    }

    const handleStart = (e: React.MouseEvent | React.TouchEvent, pageId: number) => {
      if (disabled) return
      e.preventDefault()
      activePageIdRef.current = pageId
      setActivePageId(pageId)
      drawingRef.current = true
      const pos = getPos(e, pageId)
      pathRef.current = [pos]
      const canvas = canvasRefs.current[pageId]
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.lineWidth = 28
        ctx.strokeStyle = 'rgba(0,0,0,1)'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = '#1c1c1a'
        ctx.lineWidth = 2.5
      }
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.lineTo(pos.x + 0.1, pos.y)
      ctx.stroke()
    }

    const handleMove = (e: React.MouseEvent | React.TouchEvent, pageId: number) => {
      if (!drawingRef.current || pageId !== activePageIdRef.current) return
      e.preventDefault()
      const pos = getPos(e, pageId)
      pathRef.current.push(pos)
      const canvas = canvasRefs.current[pageId]
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }

    const handleEnd = () => {
      if (!drawingRef.current) return
      drawingRef.current = false
      const pid = activePageIdRef.current
      if (pid !== null) {
        const ctx = canvasRefs.current[pid]?.getContext('2d')
        if (ctx) ctx.globalCompositeOperation = 'source-over'
        if (pathRef.current.length > 0) {
          if (!strokesRef.current[pid]) strokesRef.current[pid] = []
          strokesRef.current[pid].push({ tool, color: '#1c1c1a', points: [...pathRef.current] })
        }
      }
      pathRef.current = []
      scheduleNotify()
    }

    /* ── Page operations ── */

    const activeCanvasPage = pages.find(p => p.id === activePageId && p.type === 'canvas')

    const undo = () => {
      if (!activeCanvasPage) return
      const s = strokesRef.current[activeCanvasPage.id]
      if (!s?.length) return
      s.pop()
      setRedrawTick(t => t + 1)
      scheduleNotify()
    }

    const clearPage = () => {
      if (!activeCanvasPage) return
      strokesRef.current[activeCanvasPage.id] = []
      setRedrawTick(t => t + 1)
      scheduleNotify()
    }

    const scrollToBottom = () => {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }, 80)
    }

    const addCanvasPage = () => {
      if (pagesRef.current.length >= maxPages) return
      const p = makeCanvasPage()
      updatePages([...pagesRef.current, p])
      setActive(p.id)
      scrollToBottom()
      scheduleNotify()
    }

    const triggerPhotoUpload = async () => {
      if (disabled || pagesRef.current.length >= maxPages) return

      if (!hasCamera || permission === 'unavailable') {
        fileInputRef.current?.click()
        return
      }

      if (permission === 'prompt') {
        const ok = await requestPermission()
        if (!ok) {
          fileInputRef.current?.click()
          return
        }
      }

      if (permission === 'denied') {
        fileInputRef.current?.click()
        return
      }

      setShowCamera(true)
    }

    const handleCameraCapture = (dataUri: string) => {
      const page = makePhotoPage(dataUri)
      const next = [...pagesRef.current, page]
      updatePages(next)
      setActive(page.id)
      scrollToBottom()
      scheduleNotify()
    }

    const handlePhotoFiles = async (files: FileList | null) => {
      if (!files) return
      const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
      for (const file of imageFiles) {
        if (pagesRef.current.length >= maxPages) break
        try {
          const compressed = await compressImage(file)
          const p = makePhotoPage(compressed)
          updatePages([...pagesRef.current, p])
          setActive(p.id)
        } catch { /* ignore corrupt files */ }
      }
      scrollToBottom()
      scheduleNotify()
    }

    const deletePage = (pageId: number) => {
      if (disabled) return
      const currentPages = pagesRef.current
      const idx = currentPages.findIndex(p => p.id === pageId)
      const newPages = currentPages.filter(p => p.id !== pageId)
      delete strokesRef.current[pageId]
      delete canvasRefs.current[pageId]
      updatePages(newPages)
      if (newPages.length === 0) {
        setActive(null)
      } else if (activePageId === pageId) {
        const nextIdx = Math.min(idx, newPages.length - 1)
        setActive(newPages[nextIdx].id)
      }
      setRedrawTick(t => t + 1)
      scheduleNotify()
    }

    /* ── Drag & drop ── */

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
    const handleDragLeave = () => setDragOver(false)
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length) handlePhotoFiles(e.dataTransfer.files)
    }

    /* ── Hidden file input ── */

    const photoInput = (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => { handlePhotoFiles(e.target.files); e.target.value = '' }}
          style={{ display: 'none' }}
        />
        {showCamera && (
          <CameraModal
            facing={facing}
            permission={permission}
            onCapture={handleCameraCapture}
            onClose={() => setShowCamera(false)}
            onSwitchFacing={switchFacing}
          />
        )}
      </>
    )

    /* ── Empty state: input method chooser ── */

    if (pages.length === 0) {
      return (
        <div>
          {photoInput}
          <div className="hw-input-methods">
            <button className="hw-im-btn" onClick={addCanvasPage} disabled={disabled}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              手写作答
            </button>
            <button className="hw-im-btn" onClick={triggerPhotoUpload} disabled={disabled}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              拍照上传
            </button>
          </div>
        </div>
      )
    }

    /* ── Filled state: unified answer area ── */

    const activePageNum = pages.findIndex(p => p.id === activePageId) + 1
    const activePageType = pages.find(p => p.id === activePageId)?.type

    return (
      <div
        className="hw-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={dragOver ? { borderColor: 'var(--teal)', background: 'var(--teal-bg)' } : undefined}
      >
        {photoInput}

        {/* Toolbar */}
        <div className="hw-toolbar">
          <div className="hw-tools">
            <button className={'hw-btn' + (tool === 'pen' ? ' active' : '')} onClick={() => setTool('pen')} disabled={disabled}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔
            </button>
            <button className={'hw-btn' + (tool === 'eraser' ? ' active' : '')} onClick={() => setTool('eraser')} disabled={disabled}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>橡皮
            </button>
            <div className="hw-sep" />
            <button className="hw-btn" onClick={undo} disabled={disabled} title="撤销（当前画布页）">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>撤销
            </button>
            <button className="hw-btn" onClick={clearPage} disabled={disabled} title="清除（当前画布页）">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>清除
            </button>
            <div className="hw-sep" />
            <button className="hw-btn" onClick={triggerPhotoUpload} disabled={disabled || pages.length >= maxPages} title="拍照 / 上传照片">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>拍照
            </button>
            {activeCanvasPage && activePageNum > 1 && (
              <span className="hw-active-hint">操作：第{activePageNum}页</span>
            )}
            {activePageType === 'photo' && (
              <span className="hw-active-hint" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>当前：照片页</span>
            )}
          </div>
        </div>

        {/* Pages */}
        <div className="hw-pages-scroll" ref={scrollRef}>
          {pages.map((page, idx) => (
            <div
              key={page.id}
              className={'hw-page-block' + (page.id === activePageId ? ' active' : '')}
              onClick={() => setActive(page.id)}
            >
              <div className="hw-page-hd">
                <span className="hw-page-num">
                  第{idx + 1}页
                  <span className={'hw-page-type-badge ' + (page.type === 'canvas' ? 'type-canvas' : 'type-photo')}>
                    {page.type === 'canvas' ? '手写' : '照片'}
                  </span>
                </span>
                {pages.length > 1 && !disabled && (
                  <button className="hw-page-del" onClick={(e) => { e.stopPropagation(); deletePage(page.id) }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                    删除
                  </button>
                )}
              </div>

              {page.type === 'canvas' ? (
                <div className="hw-canvas-wrap">
                  <canvas
                    ref={el => { canvasRefs.current[page.id] = el }}
                    width={W}
                    height={H}
                    onMouseDown={e => handleStart(e, page.id)}
                    onMouseMove={e => handleMove(e, page.id)}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                    onTouchStart={e => handleStart(e, page.id)}
                    onTouchMove={e => handleMove(e, page.id)}
                    onTouchEnd={handleEnd}
                    style={{ touchAction: 'none' }}
                  />
                </div>
              ) : (
                <div className="hw-photo-wrap">
                  {page.photoData && (
                    <img src={page.photoData} alt={`照片 ${idx + 1}`} />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Bottom: add canvas page + add photo */}
          {!disabled && pages.length < maxPages && (
            <div className="hw-add-row">
              <button className="hw-add-btn" onClick={addCanvasPage}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>新增手写页</span>
              </button>
              <button className="hw-add-btn" onClick={triggerPhotoUpload}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>拍照上传</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  },
)
