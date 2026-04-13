import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Block, BlockType } from '../../types/lesson-plan'
import { SectionBlock } from './blocks/SectionBlock'
import { TextBlock } from './blocks/TextBlock'
import { ListBlock } from './blocks/ListBlock'
import { TableBlock } from './blocks/TableBlock'
import { TimelineBlock } from './blocks/TimelineBlock'
import { CalloutBlock } from './blocks/CalloutBlock'
import { ImageBlock } from './blocks/ImageBlock'
import { BlockTypeSelector } from './BlockTypeSelector'

interface BlockEditorProps {
  mode: 'lesson' | 'template'
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  readOnly?: boolean
}

function createBlock(type: BlockType, sortOrder: number): Block {
  const id = `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const defaults: Record<BlockType, Record<string, unknown>> = {
    section: { title: '' },
    text: { text: '' },
    list: { items: [''], ordered: false },
    table: { headers: ['列1', '列2', '列3'], rows: [['', '', '']] },
    timeline: { entries: [{ time: "0-5'", duration: '5min', description: '' }] },
    callout: { text: '' },
    image: {},
  }

  return {
    id,
    type,
    content: defaults[type],
    sort_order: sortOrder,
  }
}

function renderBlock(
  block: Block,
  mode: 'lesson' | 'template',
  onChange: (content: Record<string, unknown>) => void,
  readOnly?: boolean,
) {
  const props = { block, mode, onChange, readOnly }

  switch (block.type) {
    case 'section': return <SectionBlock {...props} />
    case 'text': return <TextBlock {...props} />
    case 'list': return <ListBlock {...props} />
    case 'table': return <TableBlock {...props} />
    case 'timeline': return <TimelineBlock {...props} />
    case 'callout': return <CalloutBlock {...props} />
    case 'image': return <ImageBlock {...props} />
    default: return null
  }
}

interface SortableBlockItemProps {
  block: Block
  mode: 'lesson' | 'template'
  readOnly?: boolean
  onContentChange: (id: string, content: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onToggleRequired?: (id: string) => void
}

function SortableBlockItem({
  block,
  mode,
  readOnly,
  onContentChange,
  onDelete,
  onToggleRequired,
}: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleContentChange = useCallback(
    (content: Record<string, unknown>) => onContentChange(block.id, content),
    [block.id, onContentChange],
  )

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'relative',
        padding: '4px 0 4px 24px',
      }}
      className="block-item"
    >
      {/* Drag handle */}
      {!readOnly && (
        <div
          {...attributes}
          {...listeners}
          style={{
            position: 'absolute',
            left: '0',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            opacity: 0,
            transition: 'opacity .15s',
            color: 'var(--t3)',
            fontSize: '10px',
          }}
          className="drag-handle"
        >
          ⠿
        </div>
      )}

      {/* Block content */}
      <div style={{ position: 'relative' }}>
        {renderBlock(block, mode, handleContentChange, readOnly)}

        {/* Delete button + required badge */}
        {!readOnly && (
          <div style={{
            position: 'absolute',
            top: '0',
            right: '0',
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
            opacity: 0,
            transition: 'opacity .15s',
          }} className="block-actions">
            {mode === 'template' && onToggleRequired && (
              <button
                onClick={() => onToggleRequired(block.id)}
                style={{
                  fontSize: '9px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  border: 'none',
                  background: block.is_required ? 'var(--teal-bg)' : 'var(--surface2)',
                  color: block.is_required ? 'var(--teal)' : 'var(--t3)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                }}
              >
                建议保留
              </button>
            )}
            <button
              onClick={() => onDelete(block.id)}
              style={{
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'var(--t3)',
                fontSize: '14px',
                fontFamily: 'inherit',
                transition: 'background .15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Required badge (always visible in template mode) */}
        {mode === 'template' && block.is_required && readOnly && (
          <span style={{
            position: 'absolute',
            top: '0',
            right: '0',
            fontSize: '9px',
            padding: '2px 6px',
            borderRadius: '3px',
            background: 'var(--teal-bg)',
            color: 'var(--teal)',
            fontWeight: 500,
          }}>
            建议保留
          </span>
        )}
      </div>
    </div>
  )
}

interface InsertLineProps {
  onInsert: (type: BlockType) => void
  readOnly?: boolean
}

function InsertLine({ onInsert, readOnly }: InsertLineProps) {
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
        opacity: 0,
        transition: 'opacity .15s',
      }}
      className="insert-line"
    >
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: '1px',
        background: 'var(--purple)',
      }} />
      <button
        onClick={() => setShowSelector(true)}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'var(--purple)',
          color: 'var(--surface)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 500,
          fontFamily: 'inherit',
          lineHeight: 1,
        }}
      >
        +
      </button>
      {showSelector && (
        <BlockTypeSelector
          onSelect={onInsert}
          onClose={() => setShowSelector(false)}
        />
      )}
    </div>
  )
}

export function BlockEditor({ mode, blocks, onChange, readOnly }: BlockEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id)
      const newIndex = blocks.findIndex((b) => b.id === over.id)
      const reordered = arrayMove(blocks, oldIndex, newIndex).map((b, i) => ({
        ...b,
        sort_order: i,
      }))
      onChange(reordered)
    }
  }, [blocks, onChange])

  const handleContentChange = useCallback((id: string, content: Record<string, unknown>) => {
    onChange(blocks.map((b) => b.id === id ? { ...b, content } : b))
  }, [blocks, onChange])

  const handleDelete = useCallback((id: string) => {
    onChange(blocks.filter((b) => b.id !== id))
  }, [blocks, onChange])

  const handleToggleRequired = useCallback((id: string) => {
    onChange(blocks.map((b) => b.id === id ? { ...b, is_required: !b.is_required } : b))
  }, [blocks, onChange])

  const handleInsert = useCallback((index: number, type: BlockType) => {
    const newBlock = createBlock(type, index)
    const newBlocks = [...blocks]
    newBlocks.splice(index, 0, newBlock)
    onChange(newBlocks.map((b, i) => ({ ...b, sort_order: i })))
  }, [blocks, onChange])

  return (
    <div>
      <style>{`
        .block-item:hover .drag-handle,
        .block-item:hover .block-actions {
          opacity: 1 !important;
        }
        .insert-line:hover {
          opacity: 1 !important;
        }
      `}</style>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {blocks.map((block, index) => (
            <div key={block.id}>
              <InsertLine
                onInsert={(type) => handleInsert(index, type)}
                readOnly={readOnly}
              />
              <SortableBlockItem
                block={block}
                mode={mode}
                readOnly={readOnly}
                onContentChange={handleContentChange}
                onDelete={handleDelete}
                onToggleRequired={mode === 'template' ? handleToggleRequired : undefined}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      {/* Insert at end */}
      <InsertLine
        onInsert={(type) => handleInsert(blocks.length, type)}
        readOnly={readOnly}
      />
    </div>
  )
}
