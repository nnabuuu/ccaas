import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChatTodoCard from './ChatTodoCard'
import type { TodoData } from '../../../types/chat-cards'

const fixture = (overrides: Partial<TodoData> = {}): TodoData => ({
  kind: 'todo',
  title: 'Default Title',
  items: [{ id: 't1', label: 'Step 1', status: 'pending' }],
  ...overrides,
})

describe('ChatTodoCard', () => {
  describe('rendering', () => {
    it('renders the title + matches chat-doc §1.6 example shape', () => {
      render(
        <ChatTodoCard
          data={fixture({
            title: '执行设计生成',
            summary: '根据教案自动生成 5 个 Step',
            items: [
              { id: 't1', label: '解析教案', status: 'done' },
              { id: 't2', label: '生成模块', status: 'active', detail: 'Step 1-3' },
              { id: 't3', label: '配置 Rubric', status: 'pending' },
            ],
          })}
        />,
      )
      expect(screen.getByText('执行设计生成')).toBeInTheDocument()
      expect(screen.getByText('根据教案自动生成 5 个 Step')).toBeInTheDocument()
      expect(screen.getByText('解析教案')).toBeInTheDocument()
      expect(screen.getByText('Step 1-3')).toBeInTheDocument() // detail
    })

    it('summary is optional (omitted from DOM when absent)', () => {
      render(
        <ChatTodoCard data={fixture({ title: 'X', summary: undefined })} />,
      )
      expect(screen.getByText('X')).toBeInTheDocument()
      // No summary div — only the title text is rendered.
      expect(screen.queryByText(/根据教案/)).not.toBeInTheDocument()
    })

    it('renders item.detail only when present', () => {
      render(
        <ChatTodoCard
          data={fixture({
            items: [
              { id: 't1', label: 'With detail', status: 'done', detail: 'extra info' },
              { id: 't2', label: 'No detail', status: 'pending' },
            ],
          })}
        />,
      )
      expect(screen.getByText('extra info')).toBeInTheDocument()
      // No phantom detail row for the second item.
      const items = screen.getAllByTestId(/^todo-item-/)
      expect(items).toHaveLength(2)
    })
  })

  describe('progress pill', () => {
    it('shows N/total based on done count', () => {
      render(
        <ChatTodoCard
          data={fixture({
            items: [
              { id: '1', label: 'A', status: 'done' },
              { id: '2', label: 'B', status: 'done' },
              { id: '3', label: 'C', status: 'pending' },
            ],
          })}
        />,
      )
      expect(screen.getByText('2/3')).toBeInTheDocument()
    })

    it('shows 0/0 (edge case — empty items not technically valid per Zod, but render handles it)', () => {
      render(<ChatTodoCard data={fixture({ items: [] })} />)
      expect(screen.getByText('0/0')).toBeInTheDocument()
    })

    it('full completion (N/N) shows green-tinted pill', () => {
      render(
        <ChatTodoCard
          data={fixture({
            items: [
              { id: '1', label: 'A', status: 'done' },
              { id: '2', label: 'B', status: 'done' },
            ],
          })}
        />,
      )
      const pill = screen.getByLabelText('2 of 2 done')
      expect(pill.className).toMatch(/bg-green/)
    })
  })

  describe('variant (header color) by item statuses', () => {
    // The variant signal drives both the above-card label color and
    // the header background. We assert via the label text (deterministic)
    // + the header data attribute.
    it('all done → "已完成" label + green header', () => {
      render(
        <ChatTodoCard
          data={fixture({
            items: [
              { id: '1', label: 'A', status: 'done' },
              { id: '2', label: 'B', status: 'done' },
            ],
          })}
        />,
      )
      expect(screen.getByText(/已完成/)).toBeInTheDocument()
      const header = screen.getByRole('button', { expanded: true })
      expect(header.className).toMatch(/bg-green-50/)
    })

    it('has active item → "执行中" label + blue header', () => {
      render(
        <ChatTodoCard
          data={fixture({
            items: [
              { id: '1', label: 'A', status: 'active' },
              { id: '2', label: 'B', status: 'pending' },
            ],
          })}
        />,
      )
      expect(screen.getByText(/执行中/)).toBeInTheDocument()
      const header = screen.getByRole('button', { expanded: true })
      expect(header.className).toMatch(/bg-blue-50/)
    })

    it('all pending → "任务" label + neutral header (priority order: done > active > idle)', () => {
      render(<ChatTodoCard data={fixture()} />)
      expect(screen.getByText(/任务/)).toBeInTheDocument()
      const header = screen.getByRole('button', { expanded: true })
      expect(header.className).not.toMatch(/bg-green-50|bg-blue-50/)
    })
  })

  describe('item status styling', () => {
    it('done items get line-through + muted color', () => {
      render(
        <ChatTodoCard
          data={fixture({ items: [{ id: '1', label: 'Done', status: 'done' }] })}
        />,
      )
      const item = screen.getByTestId('todo-item-1')
      expect(item).toHaveAttribute('data-status', 'done')
      expect(item.querySelector('.line-through')).toBeTruthy()
    })

    it('active items get aiBlink animation class', () => {
      render(
        <ChatTodoCard
          data={fixture({ items: [{ id: '1', label: 'Active', status: 'active' }] })}
        />,
      )
      const item = screen.getByTestId('todo-item-1')
      // The status icon span carries the animation class.
      const icon = item.querySelector('.animate-aiBlink')
      expect(icon).toBeTruthy()
    })

    it('error items render the ✗ icon', () => {
      render(
        <ChatTodoCard
          data={fixture({ items: [{ id: '1', label: 'Failed', status: 'error' }] })}
        />,
      )
      expect(screen.getByText('✗')).toBeInTheDocument()
    })
  })

  describe('collapse / expand', () => {
    it('items visible by default; header aria-expanded=true', () => {
      render(<ChatTodoCard data={fixture()} />)
      expect(screen.getByText('Step 1')).toBeInTheDocument()
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    })

    it('clicking header hides items + flips aria-expanded', () => {
      render(<ChatTodoCard data={fixture()} />)
      const header = screen.getByRole('button')
      fireEvent.click(header)
      expect(screen.queryByText('Step 1')).not.toBeInTheDocument()
      expect(header).toHaveAttribute('aria-expanded', 'false')
    })

    it('clicking again re-expands', () => {
      render(<ChatTodoCard data={fixture()} />)
      const header = screen.getByRole('button')
      fireEvent.click(header)
      fireEvent.click(header)
      expect(screen.getByText('Step 1')).toBeInTheDocument()
      expect(header).toHaveAttribute('aria-expanded', 'true')
    })
  })

  it('exposes data-card-kind="todo" on root (lets parent / e2e select by kind)', () => {
    const { container } = render(<ChatTodoCard data={fixture()} />)
    expect(container.querySelector('[data-card-kind="todo"]')).toBeTruthy()
  })
})
