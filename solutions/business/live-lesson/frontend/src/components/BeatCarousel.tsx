import { useCallback, useEffect, useMemo, useRef } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { BeatSnapshot } from '../types'
import type { ChalkboardAction } from '../types/blackboard-actions'
import { DynamicBoard } from './DynamicBoard'

/** Strip dangerous elements/attributes from SVG innerHTML (defense-in-depth) */
function sanitizeSvg(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
}

interface BeatCarouselProps {
  snapshots: BeatSnapshot[]
  // DynamicBoard props
  activeActions: ChalkboardAction[]
  activeBeatId: string | null
  isLoading: boolean
  onStart: () => void
  onAnimationChange?: (animating: boolean) => void
  onSnapshot?: (svgHtml: string) => void
  paused?: boolean
  // Sticker overlay props
  stickerActions?: ChalkboardAction[]
  stickerVisible?: boolean
  stickerExpanded?: boolean
  onDismissSticker?: () => void
  onToggleStickerExpand?: () => void
  onCollapseStickerBackdrop?: () => void
  // Navigation
  viewingIndex: number | null
  onNavigate: (index: number | null) => void
  activeBeatIndex: number
}

export function BeatCarousel({
  snapshots,
  activeActions,
  activeBeatId,
  isLoading,
  onStart,
  onAnimationChange,
  onSnapshot,
  paused,
  stickerActions,
  stickerVisible,
  stickerExpanded,
  onDismissSticker,
  onToggleStickerExpand,
  onCollapseStickerBackdrop,
  viewingIndex,
  onNavigate,
  activeBeatIndex,
}: BeatCarouselProps) {
  const hasSnapshots = snapshots.length > 0
  const totalSlides = snapshots.length + 1 // snapshots + current live slide
  const liveSlideIndex = snapshots.length  // last slide is always the live one

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'center',
    containScroll: false,
    startIndex: liveSlideIndex,
    watchDrag: hasSnapshots,
  })

  const prevActiveBeatIndexRef = useRef(activeBeatIndex)
  const snapshotsRef = useRef(snapshots)
  snapshotsRef.current = snapshots

  // Guard to prevent onSelect → onNavigate → viewingIndex → scrollTo loop
  const isProgrammaticScrollRef = useRef(false)

  // When activeBeatIndex advances, scroll to the live slide
  useEffect(() => {
    if (!emblaApi) return
    if (activeBeatIndex > prevActiveBeatIndexRef.current) {
      isProgrammaticScrollRef.current = true
      emblaApi.scrollTo(snapshots.length, false)
      queueMicrotask(() => { isProgrammaticScrollRef.current = false })
    }
    prevActiveBeatIndexRef.current = activeBeatIndex
  }, [activeBeatIndex, emblaApi, snapshots.length])

  // Sync external viewingIndex → carousel position
  useEffect(() => {
    if (!emblaApi) return
    isProgrammaticScrollRef.current = true
    if (viewingIndex === null) {
      if (emblaApi.selectedScrollSnap() !== liveSlideIndex) {
        emblaApi.scrollTo(liveSlideIndex, false)
      }
    } else {
      const slideIdx = snapshotsRef.current.findIndex(s => s.beatIndex === viewingIndex)
      if (slideIdx >= 0 && emblaApi.selectedScrollSnap() !== slideIdx) {
        emblaApi.scrollTo(slideIdx, false)
      }
    }
    queueMicrotask(() => { isProgrammaticScrollRef.current = false })
  }, [viewingIndex, emblaApi, liveSlideIndex])

  // Listen to carousel select events → update viewingIndex
  const onSelect = useCallback(() => {
    if (!emblaApi || isProgrammaticScrollRef.current) return
    const idx = emblaApi.selectedScrollSnap()
    const currentSnapshots = snapshotsRef.current
    if (idx >= currentSnapshots.length) {
      onNavigate(null)
    } else {
      onNavigate(currentSnapshots[idx].beatIndex)
    }
  }, [emblaApi, onNavigate])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi, onSelect])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  // Determine current selected slide index for indicator dots
  const currentSlideIdx = viewingIndex === null
    ? liveSlideIndex
    : snapshots.findIndex(s => s.beatIndex === viewingIndex)

  // No snapshots yet: render plain DynamicBoard (no carousel)
  if (!hasSnapshots) {
    return (
      <DynamicBoard
        actions={activeActions}
        beatId={activeBeatId}
        isLoading={isLoading}
        onStart={onStart}
        onAnimationChange={onAnimationChange}
        onSnapshot={onSnapshot}
        paused={paused}
        stickerActions={stickerActions}
        stickerVisible={stickerVisible}
        stickerExpanded={stickerExpanded}
        onDismissSticker={onDismissSticker}
        onToggleStickerExpand={onToggleStickerExpand}
        onCollapseStickerBackdrop={onCollapseStickerBackdrop}
      />
    )
  }

  return (
    <div className="relative flex flex-col h-full">
      {/* Carousel viewport */}
      <div className="flex-1 min-h-0 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {/* History snapshot slides */}
          {snapshots.map((snap) => (
            <div
              key={snap.beatId}
              className="flex-[0_0_85%] min-w-0 px-2"
            >
              <div className="h-full rounded-lg overflow-hidden bg-[#1A3A32] relative">
                <svg
                  viewBox="0 0 800 600"
                  preserveAspectRatio="xMidYMid meet"
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: sanitizeSvg(snap.svgSnapshot) }}
                />
                {/* Dim overlay for history beats */}
                <div className="absolute inset-0 bg-black/10 pointer-events-none rounded-lg" />
              </div>
            </div>
          ))}

          {/* Live slide (current beat) */}
          <div className="flex-[0_0_85%] min-w-0 px-2">
            <div className="h-full rounded-lg overflow-hidden">
              <DynamicBoard
                actions={activeActions}
                beatId={activeBeatId}
                isLoading={isLoading}
                onStart={onStart}
                onAnimationChange={onAnimationChange}
                onSnapshot={onSnapshot}
                paused={paused}
                stickerActions={stickerActions}
                stickerVisible={stickerVisible}
                stickerExpanded={stickerExpanded}
                onDismissSticker={onDismissSticker}
                onToggleStickerExpand={onToggleStickerExpand}
                onCollapseStickerBackdrop={onCollapseStickerBackdrop}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={scrollPrev}
        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-surface-1/80 backdrop-blur text-text-secondary hover:text-text-primary hover:bg-surface-2/80 transition-colors"
        aria-label="Previous beat"
      >
        <CaretLeft size={14} weight="bold" />
      </button>
      <button
        onClick={scrollNext}
        className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-surface-1/80 backdrop-blur text-text-secondary hover:text-text-primary hover:bg-surface-2/80 transition-colors"
        aria-label="Next beat"
      >
        <CaretRight size={14} weight="bold" />
      </button>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 py-2 flex-shrink-0">
        {Array.from({ length: totalSlides }, (_, i) => {
          const isActive = i === currentSlideIdx
          const isLive = i === liveSlideIndex
          return (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={[
                'transition-all duration-200 rounded-full',
                isActive
                  ? (isLive ? 'w-5 h-1.5 bg-accent' : 'w-5 h-1.5 bg-accent/70')
                  : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40',
              ].join(' ')}
              aria-label={isLive ? 'Current beat' : `Beat ${i + 1}`}
            />
          )
        })}
      </div>
    </div>
  )
}

export default BeatCarousel
