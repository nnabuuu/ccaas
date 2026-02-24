import React, { useRef } from 'react'
import type { BoardState, LessonManifest, SkeletonNodeDef, HighlightedNode } from '../types'
import SkeletonNode from './SkeletonNode'

// Fallback node definitions used when manifest is not loaded
// This allows the board to render even before manifest is fetched
const FALLBACK_NODES: SkeletonNodeDef[] = [
  {
    id: 'title',
    type: 'text',
    content: '登山追及问题',
    position: { x: 30, y: 2, w: 40, h: 6 },
    phase: 'intro',
    initiallyHidden: false,
    style: { fontSize: '1.4em', fontWeight: 'bold', textAlign: 'center' },
  },
  {
    id: 'problem-statement',
    type: 'text',
    content: '小明以 v₁ 速度登山，比小红早 30 分钟出发。小红以 1.2v₁ 速度追赶，问小红何时追上小明？',
    position: { x: 5, y: 10, w: 90, h: 10 },
    phase: 'intro',
    initiallyHidden: false,
    style: { fontSize: '0.95em', border: '1px dashed #aaa', padding: '8px' },
  },
  {
    id: 'arithmetic-xiaoming-dist',
    type: 'formula',
    content: '小明路程 = v₁ × t',
    position: { x: 5, y: 25, w: 42, h: 8 },
    phase: 'arithmetic',
    initiallyHidden: true,
    confusionPointId: 'cp-speed-ratio',
  },
  {
    id: 'arithmetic-xiaohong-dist',
    type: 'formula',
    content: '小红路程 = 1.2v₁ × (t - 30)',
    position: { x: 53, y: 25, w: 42, h: 8 },
    phase: 'arithmetic',
    initiallyHidden: true,
    confusionPointId: 'cp-speed-ratio',
  },
  {
    id: 'speed-ratio-label',
    type: 'text',
    content: '为什么是 1.2×？',
    position: { x: 53, y: 34, w: 42, h: 5 },
    phase: 'arithmetic',
    initiallyHidden: true,
    style: { color: '#FFD700', fontSize: '0.85em', fontStyle: 'italic' },
    confusionPointId: 'cp-speed-ratio',
  },
  {
    id: 'transition-question',
    type: 'text',
    content: '如何用一个等式表达"两人路程相等"？',
    position: { x: 10, y: 42, w: 80, h: 8 },
    phase: 'transition',
    initiallyHidden: true,
    style: { border: '2px solid #FFD700', padding: '8px', textAlign: 'center' },
  },
  {
    id: 'variable-setup',
    type: 'formula',
    content: '设追及时间为 x 分钟',
    position: { x: 5, y: 53, w: 40, h: 7 },
    phase: 'equation',
    initiallyHidden: true,
    confusionPointId: 'cp-variable-setup',
  },
  {
    id: 'equation-lhs',
    type: 'formula',
    content: 'v₁(x + 30)',
    position: { x: 5, y: 62, w: 30, h: 8 },
    phase: 'equation',
    initiallyHidden: true,
  },
  {
    id: 'equation-equals',
    type: 'text',
    content: '=',
    position: { x: 36, y: 62, w: 8, h: 8 },
    phase: 'equation',
    initiallyHidden: true,
    style: { fontSize: '1.6em', fontWeight: 'bold', textAlign: 'center' },
    confusionPointId: 'cp-equation-balance',
  },
  {
    id: 'equation-rhs',
    type: 'formula',
    content: '1.2v₁ · x',
    position: { x: 45, y: 62, w: 30, h: 8 },
    phase: 'equation',
    initiallyHidden: true,
  },
  {
    id: 'equation-simplified',
    type: 'formula',
    content: 'x + 30 = 1.2x  →  x = 150',
    position: { x: 5, y: 73, w: 70, h: 8 },
    phase: 'equation',
    initiallyHidden: true,
    style: { color: '#13ec5b', fontSize: '1.1em' },
  },
  {
    id: 'answer-box',
    type: 'text',
    content: '小红追上小明需要 150 分钟（即出发后 2.5 小时）',
    position: { x: 10, y: 83, w: 80, h: 8 },
    phase: 'synthesis',
    initiallyHidden: true,
    style: { border: '2px solid #13ec5b', padding: '8px', fontWeight: 'bold' },
  },
  {
    id: 'equation-concept',
    type: 'text',
    content: '一元一次方程：含一个未知数，最高次数为1的等式',
    position: { x: 5, y: 92, w: 90, h: 6 },
    phase: 'synthesis',
    initiallyHidden: true,
    style: { background: '#1A3A32', padding: '6px', fontSize: '0.9em' },
  },
]

interface DynamicBoardProps {
  boardState: BoardState | null
  manifest: LessonManifest | null
  onConfused: (nodeId: string) => void
}

export function DynamicBoard({ boardState, manifest, onConfused }: DynamicBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const prevVisibleRef = useRef<Set<string>>(new Set())

  // Use manifest nodes if available, otherwise fall back to hardcoded definitions
  const allNodes = manifest?.boardNodes ?? FALLBACK_NODES

  // Determine which nodes are currently visible
  const visibleNodeIds = new Set(boardState?.visibleNodeIds ?? ['title', 'problem-statement'])

  // Track newly appeared nodes for animation
  const newNodeIds = new Set<string>()
  for (const id of visibleNodeIds) {
    if (!prevVisibleRef.current.has(id)) {
      newNodeIds.add(id)
    }
  }
  // Update ref for next render
  prevVisibleRef.current = new Set(visibleNodeIds)

  // Build highlight lookup
  const highlightMap = new Map<string, HighlightedNode>()
  for (const h of boardState?.highlightedNodes ?? []) {
    highlightMap.set(h.nodeId, h)
  }

  // Current phase label
  const currentPhase = boardState?.currentPhase ?? 'intro'
  const phaseInfo = manifest?.teachingPhases.find(p => p.id === currentPhase)
  const phaseLabel = phaseInfo?.name ?? currentPhase

  return (
    <div className="flex flex-col h-full bg-chalkboard">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-background-dark/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-gray-400 font-lexend">Active Step:</span>
          <span className="text-xs font-medium text-primary px-2 py-0.5 bg-primary/10 rounded-full border border-primary/30">
            {phaseLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{visibleNodeIds.size} / {allNodes.length} 节点</span>
        </div>
      </div>

      {/* Main board area */}
      <div
        ref={boardRef}
        className="relative flex-1 chalkboard-texture overflow-hidden"
        style={{ background: '#1A3A32' }}
      >
        {/* SVG background: coordinate axes / slope line (static skeleton) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: 0.12 }}
        >
          {/* Horizontal guide line */}
          <line x1="5%" y1="22%" x2="95%" y2="22%" stroke="white" strokeWidth="1" strokeDasharray="4 8" />
          {/* Vertical guide */}
          <line x1="50%" y1="5%" x2="50%" y2="95%" stroke="white" strokeWidth="1" strokeDasharray="4 8" />
          {/* Diagonal slope line (represents speed ratio) */}
          <line x1="5%" y1="95%" x2="95%" y2="20%" stroke="#FFD700" strokeWidth="1.5" strokeDasharray="6 6" />
        </svg>

        {/* Node overlay */}
        {allNodes
          .filter(node => visibleNodeIds.has(node.id))
          .map(node => (
            <SkeletonNode
              key={node.id}
              node={node}
              highlight={highlightMap.get(node.id) ?? null}
              onConfused={onConfused}
              isNew={newNodeIds.has(node.id)}
            />
          ))}

        {/* Empty state */}
        {visibleNodeIds.size === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-600 text-sm">等待课程加载...</p>
          </div>
        )}
      </div>

      {/* Bottom legend */}
      <div className="flex items-center gap-6 px-4 py-2 border-t border-white/10 bg-background-dark/50">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/30 border border-white/30" />
          <span className="text-xs text-gray-500">待展示节点</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-logic-yellow shadow-[0_0_6px_rgba(255,215,0,0.8)]" />
          <span className="text-xs text-gray-500">焦点概念</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-warning-red shadow-[0_0_6px_rgba(255,68,68,0.8)]" />
          <span className="text-xs text-gray-500">困惑定位</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_rgba(19,236,91,0.8)]" />
          <span className="text-xs text-gray-500">已掌握</span>
        </div>
      </div>
    </div>
  )
}

export default DynamicBoard
