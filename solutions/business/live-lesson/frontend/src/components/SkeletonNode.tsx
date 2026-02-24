import React, { useEffect, useRef, useState } from 'react'
import type { SkeletonNodeDef, HighlightedNode } from '../types'

interface SkeletonNodeProps {
  node: SkeletonNodeDef
  highlight: HighlightedNode | null
  onConfused?: (nodeId: string) => void
  isNew?: boolean // triggers appear animation
}

export function SkeletonNode({ node, highlight, onConfused, isNew = false }: SkeletonNodeProps) {
  const [showAnimation, setShowAnimation] = useState(isNew)
  const [highlightActive, setHighlightActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trigger appear animation on first render when isNew
  useEffect(() => {
    if (isNew) {
      setShowAnimation(true)
      const t = setTimeout(() => setShowAnimation(false), 600)
      return () => clearTimeout(t)
    }
  }, [isNew])

  // Manage highlight state and auto-dismiss timer
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (highlight && highlight.durationMs > 0) {
      setHighlightActive(true)
      const elapsed = Date.now() - highlight.startedAt
      const remaining = Math.max(0, highlight.durationMs - elapsed)
      if (remaining > 0) {
        timerRef.current = setTimeout(() => setHighlightActive(false), remaining)
      } else {
        setHighlightActive(false)
      }
    } else {
      setHighlightActive(false)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [highlight])

  // Build class names
  const highlightClass = highlightActive && highlight
    ? highlight.color === 'red'
      ? 'node-highlight-red'
      : highlight.color === 'blue'
        ? 'node-highlight-blue'
        : 'node-highlight-yellow'
    : ''

  const typeClass = node.type === 'formula'
    ? 'font-mono text-logic-yellow'
    : node.type === 'diagram'
      ? 'text-blue-200'
      : 'text-gray-100'

  // Build inline styles from node definition
  const inlineStyle: React.CSSProperties = {
    left: `${node.position.x}%`,
    top: `${node.position.y}%`,
    width: `${node.position.w}%`,
    height: `${node.position.h}%`,
    ...node.style,
  }

  const hasConfusion = !!node.confusionPointId && !!onConfused

  return (
    <div
      className={[
        'absolute',
        'border border-white/20',
        'rounded',
        'px-2 py-1',
        'text-sm leading-snug',
        'transition-all duration-300',
        showAnimation ? 'node-appear' : '',
        highlightActive ? highlightClass : '',
        highlightActive ? 'bg-white/5' : 'bg-transparent',
        typeClass,
      ].join(' ')}
      style={inlineStyle}
    >
      <span className="relative z-10">
        {node.type === 'formula' ? (
          <code className="text-logic-yellow text-base">{node.content}</code>
        ) : (
          node.content
        )}
      </span>

      {/* "不明白" button - shown when node has a confusion point */}
      {hasConfusion && (
        <button
          onClick={() => onConfused!(node.id)}
          className={[
            'absolute -top-3 -right-2',
            'text-xs px-1.5 py-0.5',
            'bg-warning-red/80 hover:bg-warning-red',
            'text-white rounded',
            'transition-colors',
            'z-20',
            'whitespace-nowrap',
          ].join(' ')}
          title="点击告诉老师你不明白这里"
        >
          不明白
        </button>
      )}
    </div>
  )
}

export default SkeletonNode
