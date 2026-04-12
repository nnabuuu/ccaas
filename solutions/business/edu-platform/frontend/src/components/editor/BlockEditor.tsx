import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Block, BlockType } from '../../types/lesson-plan'
import { createEmptyBlock } from '../../types/lesson-plan'
import { BlockTypeSelector } from './BlockTypeSelector'
import { SectionBlock } from './blocks/SectionBlock'
import { TextBlock } from './blocks/TextBlock'
import { ListBlock } from './blocks/ListBlock'
import { TableBlock } from './blocks/TableBlock'
import { TimelineBlock } from './blocks/TimelineBlock'
import { CalloutBlock } from './blocks/CalloutBlock'
import { ImageBlock } from './blocks/ImageBlock'

export interface BlockEditorProps {
  mode: 'lesson' | 'template'
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  readOnly?: boolean
}

interface BlockComponentProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

type BlockRenderer = React.ComponentType<BlockComponentProps>

const BLOCK_RENDERERS: Record<BlockType, BlockRenderer> = {
  section: SectionBlock,
  text: TextBlock,
  list: ListBlock,
  table: TableBlock,
  timeline: TimelineBlock,
  callout: CalloutBlock,
  image: ImageBlock,
}

function SortableBlock({
  block,
  mode,
  onContentChange,
  onDelete,
  onToggleRequired,
  readOnly,
}: {
  block: Block
  mode: 'lesson' | 'template'
  onContentChange: (id: string, content: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onToggleRequired: (id: string) => void
  readOnly?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    padding: '8px 12px 8px 24px',
    marginBottom: '2px',
    borderRadius: '6px',
  }

  const Renderer = BLOCK_RENDERERS[block.type]

  return (
    <div ref={setNodeRef} style={style} className="block-item">
      {/* Drag handle */}
      {!readOnly && (
        <div
          {...attributes}
          {...listeners}
          style={{
            position: 'absolute',
            left: '2px',
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'grab',
            color: 'var(--t3)',
            fontSize: '10px',
            opacity: 0,
            transition: 'opacity 0.15s',
            padding: '4px 2px',
            userSelect: 'none',
          }}
          className="drag-handle"
        >
          ⋮⋮
        </div>
      )}

      {/* Block content */}
      <Renderer
        block={block}
        mode={mode}
        onChange={(content) => onContentChange(block.id, content)}
        readOnly={readOnly}
      />

      {/* Block actions (top right) */}
      {!readOnly && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: 0,
            transition: 'opacity 0.15s',
          }}
          className="block-actions"
        >
          {/* Template: "建议保留" badge */}
          {mode === 'template' && (
            <button
              onClick={() => onToggleRequired(block.id)}
              style={{
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '3px',
                border: 'none',
                cursor: 'pointer',
                background: block.is_required ? 'var(--teal-bg)' : 'var(--bg2)',
                color: block.is_required ? 'var(--teal-t)' : 'var(--t3)',
                fontWeight: 500,
              }}
            >
              建议保留
            </button>
          )}
          {/* Delete */}
          <button
            onClick={() => onDelete(block.id)}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '4px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'var(--t3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Hover styles via CSS class (inline alternative) */}
      <style>{`
        .block-item:hover .drag-handle,
        .block-item:hover .block-actions {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}

function InsertGap({
  onInsert,
  readOnly,
}: {
  onInsert: (type: BlockType) => void
  readOnly?: boolean
}) {
  const [showSelector, setShowSelector] = useState(false)

  if (readOnly) return null

  return (
    <div
      style={{
        position: 'relative',
        height: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className="insert-gap"
    >
      {/* Purple line + button */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: '1px',
          background: 'var(--purple-t)',
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
        className="insert-line"
      />
      <button
        onClick={() => setShowSelector(!showSelector)}
        style={{
          position: 'relative',
          zIndex: 10,
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'var(--purple-t)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          lineHeight: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
        className="insert-btn"
      >
        +
      </button>

      {showSelector && (
        <BlockTypeSelector
          onSelect={(type) => {
            onInsert(type)
            setShowSelector(false)
          }}
          onClose={() => setShowSelector(false)}
        />
      )}

      <style>{`
        .insert-gap:hover .insert-line,
        .insert-gap:hover .insert-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}

export function BlockEditor({ mode, blocks, onChange, readOnly }: BlockEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = blocks.findIndex((b) => b.id === active.id)
      const newIndex = blocks.findIndex((b) => b.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(blocks, oldIndex, newIndex).map((b, i) => ({
        ...b,
        sort_order: i,
      }))
      onChange(reordered)
    },
    [blocks, onChange]
  )

  const handleContentChange = useCallback(
    (id: string, content: Record<string, unknown>) => {
      onChange(blocks.map((b) => (b.id === id ? { ...b, content } : b)))
    },
    [blocks, onChange]
  )

  const handleDelete = useCallback(
    (id: string) => {
      onChange(blocks.filter((b) => b.id !== id))
    },
    [blocks, onChange]
  )

  const handleToggleRequired = useCallback(
    (id: string) => {
      onChange(
        blocks.map((b) =>
          b.id === id ? { ...b, is_required: !b.is_required } : b
        )
      )
    },
    [blocks, onChange]
  )

  const handleInsert = useCallback(
    (index: number, type: BlockType) => {
      const newBlock = createEmptyBlock(type, index)
      const updated = [...blocks]
      updated.splice(index, 0, newBlock)
      onChange(updated.map((b, i) => ({ ...b, sort_order: i })))
    },
    [blocks, onChange]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={blocks.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {/* Insert gap before first block */}
          <InsertGap
            onInsert={(type) => handleInsert(0, type)}
            readOnly={readOnly}
          />

          {blocks.map((block, index) => (
            <div key={block.id}>
              <SortableBlock
                block={block}
                mode={mode}
                onContentChange={handleContentChange}
                onDelete={handleDelete}
                onToggleRequired={handleToggleRequired}
                readOnly={readOnly}
              />
              {/* Insert gap after each block */}
              <InsertGap
                onInsert={(type) => handleInsert(index + 1, type)}
                readOnly={readOnly}
              />
            </div>
          ))}

          {blocks.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '32px',
                color: 'var(--t3)',
                fontSize: '12px',
              }}
            >
              点击上方 "+" 按钮添加内容块
            </div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  )
}
