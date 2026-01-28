import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChapterTree from '../src/components/ChapterTree'
import type { TextbookChapter } from '../src/types'

const mockChapters: TextbookChapter[] = [
  {
    id: 1,
    title: '第一单元 时、分、秒',
    children: [
      { id: 11, title: '秒的认识' },
      { id: 12, title: '时间的计算' },
    ],
  },
  {
    id: 2,
    title: '第二单元 万以内的加法和减法',
    children: [
      { id: 21, title: '两位数加两位数' },
      { id: 22, title: '两位数减两位数' },
    ],
  },
  {
    id: 3,
    title: '第三单元 测量',
    children: [
      { id: 31, title: '毫米、分米的认识' },
      { id: 32, title: '千米的认识' },
    ],
  },
]

describe('ChapterTree', () => {
  describe('rendering', () => {
    it('should render empty state when no chapters', () => {
      render(
        <ChapterTree
          chapters={[]}
          selectedChapterId={null}
          onSelect={vi.fn()}
        />
      )

      expect(screen.getByText('请先选择学科、年级、出版社和册别')).toBeInTheDocument()
    })

    it('should render loading state', () => {
      render(
        <ChapterTree
          chapters={[]}
          selectedChapterId={null}
          onSelect={vi.fn()}
          loading={true}
        />
      )

      expect(screen.getByText('加载章节...')).toBeInTheDocument()
    })

    it('should render chapter titles', () => {
      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={null}
          onSelect={vi.fn()}
        />
      )

      expect(screen.getByText('第一单元 时、分、秒')).toBeInTheDocument()
      expect(screen.getByText('第二单元 万以内的加法和减法')).toBeInTheDocument()
      expect(screen.getByText('第三单元 测量')).toBeInTheDocument()
    })

    it('should not show children by default', () => {
      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={null}
          onSelect={vi.fn()}
        />
      )

      expect(screen.queryByText('秒的认识')).not.toBeInTheDocument()
    })

    it('should render toolbar with expand/collapse buttons', () => {
      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={null}
          onSelect={vi.fn()}
        />
      )

      expect(screen.getByText('全部展开')).toBeInTheDocument()
      expect(screen.getByText('全部收起')).toBeInTheDocument()
    })
  })

  describe('expand/collapse', () => {
    it('should expand chapter on click', () => {
      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={null}
          onSelect={vi.fn()}
        />
      )

      // Click on a parent chapter to expand
      fireEvent.click(screen.getByText('第一单元 时、分、秒'))

      // Children should be visible now
      expect(screen.getByText('秒的认识')).toBeInTheDocument()
      expect(screen.getByText('时间的计算')).toBeInTheDocument()
    })

    it('should collapse chapter on second click', () => {
      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={null}
          onSelect={vi.fn()}
        />
      )

      // Click to expand
      fireEvent.click(screen.getByText('第一单元 时、分、秒'))
      expect(screen.getByText('秒的认识')).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(screen.getByText('第一单元 时、分、秒'))
      expect(screen.queryByText('秒的认识')).not.toBeInTheDocument()
    })

    it('should expand all chapters', () => {
      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={null}
          onSelect={vi.fn()}
        />
      )

      fireEvent.click(screen.getByText('全部展开'))

      expect(screen.getByText('秒的认识')).toBeInTheDocument()
      expect(screen.getByText('两位数加两位数')).toBeInTheDocument()
      expect(screen.getByText('千米的认识')).toBeInTheDocument()
    })

    it('should collapse all chapters', () => {
      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={null}
          onSelect={vi.fn()}
        />
      )

      // First expand all
      fireEvent.click(screen.getByText('全部展开'))
      expect(screen.getByText('秒的认识')).toBeInTheDocument()

      // Then collapse all
      fireEvent.click(screen.getByText('全部收起'))
      expect(screen.queryByText('秒的认识')).not.toBeInTheDocument()
    })
  })

  describe('selection', () => {
    it('should call onSelect when leaf node is clicked', () => {
      const onSelect = vi.fn()

      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={null}
          onSelect={onSelect}
        />
      )

      // Expand first unit
      fireEvent.click(screen.getByText('第一单元 时、分、秒'))

      // Click on leaf node
      fireEvent.click(screen.getByText('秒的认识'))

      expect(onSelect).toHaveBeenCalledWith(11, '秒的认识')
    })

    it('should not call onSelect when parent node is clicked', () => {
      const onSelect = vi.fn()

      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={null}
          onSelect={onSelect}
        />
      )

      // Click on parent node (should just expand, not select)
      fireEvent.click(screen.getByText('第一单元 时、分、秒'))

      expect(onSelect).not.toHaveBeenCalled()
    })

    it('should highlight selected chapter', () => {
      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={11}
          onSelect={vi.fn()}
        />
      )

      // Expand to show selected chapter
      fireEvent.click(screen.getByText('第一单元 时、分、秒'))

      // The selected item should have the primary color styling
      const selectedItem = screen.getByText('秒的认识').parentElement
      expect(selectedItem?.className).toContain('bg-primary-100')
    })
  })

  describe('accessibility', () => {
    it('should have proper hierarchy', () => {
      render(
        <ChapterTree
          chapters={mockChapters}
          selectedChapterId={null}
          onSelect={vi.fn()}
        />
      )

      // Expand all to see full structure
      fireEvent.click(screen.getByText('全部展开'))

      // Check that all items are rendered
      expect(screen.getByText('第一单元 时、分、秒')).toBeInTheDocument()
      expect(screen.getByText('秒的认识')).toBeInTheDocument()
    })
  })
})

describe('ChapterTree with nested chapters', () => {
  const deeplyNestedChapters: TextbookChapter[] = [
    {
      id: 1,
      title: 'Level 1',
      children: [
        {
          id: 11,
          title: 'Level 2',
          children: [
            { id: 111, title: 'Level 3 - Leaf' },
          ],
        },
      ],
    },
  ]

  it('should handle multiple levels of nesting', () => {
    const onSelect = vi.fn()

    render(
      <ChapterTree
        chapters={deeplyNestedChapters}
        selectedChapterId={null}
        onSelect={onSelect}
      />
    )

    // Expand level 1
    fireEvent.click(screen.getByText('Level 1'))
    expect(screen.getByText('Level 2')).toBeInTheDocument()

    // Expand level 2
    fireEvent.click(screen.getByText('Level 2'))
    expect(screen.getByText('Level 3 - Leaf')).toBeInTheDocument()

    // Click on leaf
    fireEvent.click(screen.getByText('Level 3 - Leaf'))
    expect(onSelect).toHaveBeenCalledWith(111, 'Level 3 - Leaf')
  })
})
