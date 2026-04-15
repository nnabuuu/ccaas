import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MentionPicker } from '../chat/MentionPicker'
import { MentionProvider } from '../chat/MentionContext'

// ---- Mocks ----

const mockResolve = vi.fn()
const mockSuggest = vi.fn()
const mockBrowse = vi.fn()
const mockSearch = vi.fn()
const mockGetEntityTypes = vi.fn()
const mockRecordActivity = vi.fn()
const mockGetShortcuts = vi.fn()

vi.mock('@kedge-agentic/context-layer/client', () => ({
  ContextLayerClient: vi.fn().mockImplementation(() => ({
    resolve: mockResolve,
    suggest: mockSuggest,
    browse: mockBrowse,
    search: mockSearch,
    getEntityTypes: mockGetEntityTypes,
    recordActivity: mockRecordActivity,
    getShortcuts: mockGetShortcuts,
  })),
}))

const BASE_URL = 'http://localhost:3002'

const defaultEntityTypes = {
  types: [
    { type: 'recipe', displayName: '食谱', icon: '🍳' },
    { type: 'ingredient', displayName: '食材', icon: '🥕' },
  ],
  tree: {
    roots: ['recipe'],
    relations: [{ parent: 'recipe', child: 'ingredient' }],
  },
}

const defaultShortcuts = { pinned: [], hidden: [] }

const recipeContextEntity = {
  entityType: 'recipe',
  entityId: 'r1',
  displayName: '鱼香肉丝',
  icon: '🍳',
}

const resolvedRecipe = {
  entityType: 'recipe',
  entityId: 'r1',
  displayName: '鱼香肉丝',
  data: { title: '鱼香肉丝', servings: 4 },
  dataHash: 'abc123',
  resolvedAt: '2026-01-01T00:00:00Z',
  breadcrumb: null,
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<MentionProvider>{ui}</MentionProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetEntityTypes.mockResolvedValue(defaultEntityTypes)
  mockGetShortcuts.mockResolvedValue(defaultShortcuts)
  mockSuggest.mockResolvedValue({ recents: [] })
  mockResolve.mockResolvedValue(resolvedRecipe)
  mockRecordActivity.mockResolvedValue(undefined)
  mockBrowse.mockResolvedValue({ items: [], total: 0 })
  mockSearch.mockResolvedValue({ results: [] })
})

describe('MentionPicker', () => {
  describe('backward compatibility', () => {
    it('renders without contextEntity or autoRef (existing behavior)', () => {
      renderWithProvider(
        <MentionPicker
          baseUrl={BASE_URL}
          sessionId="session-1"
          sessionTemplate="recipe-book"
        />,
      )
      // No pills rendered, no errors
      expect(screen.queryByTestId('mention-refs')).toBeNull()
    })

    it('renders without sessionId', () => {
      renderWithProvider(
        <MentionPicker baseUrl={BASE_URL} />,
      )
      expect(screen.queryByTestId('mention-refs')).toBeNull()
    })
  })

  describe('autoRef with contextEntity', () => {
    it('auto-adds contextEntity as ref pill when autoRef=true', async () => {
      renderWithProvider(
        <MentionPicker
          baseUrl={BASE_URL}
          contextEntity={recipeContextEntity}
          autoRef={true}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('mention-refs')).toBeTruthy()
      })

      const pills = screen.getAllByTestId('ref-pill')
      expect(pills).toHaveLength(1)
      expect(screen.getByTestId('ref-pill-name').textContent).toBe('鱼香肉丝')
    })

    it('resolves entity data when auto-adding ref', async () => {
      renderWithProvider(
        <MentionPicker
          baseUrl={BASE_URL}
          contextEntity={recipeContextEntity}
          autoRef={true}
        />,
      )

      await waitFor(() => {
        expect(mockResolve).toHaveBeenCalledWith('recipe', 'r1')
      })
    })

    it('does NOT auto-add when autoRef=false', async () => {
      renderWithProvider(
        <MentionPicker
          baseUrl={BASE_URL}
          contextEntity={recipeContextEntity}
          autoRef={false}
        />,
      )

      // Give it time to potentially fire
      await act(async () => {
        await new Promise(r => setTimeout(r, 50))
      })

      expect(mockResolve).not.toHaveBeenCalled()
      expect(screen.queryByTestId('mention-refs')).toBeNull()
    })

    it('does NOT auto-add when contextEntity is undefined', async () => {
      renderWithProvider(
        <MentionPicker
          baseUrl={BASE_URL}
          autoRef={true}
        />,
      )

      await act(async () => {
        await new Promise(r => setTimeout(r, 50))
      })

      expect(mockResolve).not.toHaveBeenCalled()
      expect(screen.queryByTestId('mention-refs')).toBeNull()
    })

    it('gracefully degrades when resolve fails', async () => {
      mockResolve.mockRejectedValue(new Error('Network error'))

      renderWithProvider(
        <MentionPicker
          baseUrl={BASE_URL}
          contextEntity={recipeContextEntity}
          autoRef={true}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('mention-refs')).toBeTruthy()
      })

      // Pill still added, just without resolved data
      const pills = screen.getAllByTestId('ref-pill')
      expect(pills).toHaveLength(1)
      expect(screen.getByTestId('ref-pill-name').textContent).toBe('鱼香肉丝')
    })

    it('does not duplicate when same contextEntity is re-rendered', async () => {
      const { rerender } = render(
        <MentionProvider>
          <MentionPicker
            baseUrl={BASE_URL}
            contextEntity={recipeContextEntity}
            autoRef={true}
          />
        </MentionProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('mention-refs')).toBeTruthy()
      })

      // Re-render with same props
      rerender(
        <MentionProvider>
          <MentionPicker
            baseUrl={BASE_URL}
            contextEntity={recipeContextEntity}
            autoRef={true}
          />
        </MentionProvider>,
      )

      await act(async () => {
        await new Promise(r => setTimeout(r, 50))
      })

      // Still only 1 pill
      const pills = screen.getAllByTestId('ref-pill')
      expect(pills).toHaveLength(1)
    })

    it('auto-adds new entity when contextEntity changes', async () => {
      const { rerender } = render(
        <MentionProvider>
          <MentionPicker
            baseUrl={BASE_URL}
            contextEntity={recipeContextEntity}
            autoRef={true}
          />
        </MentionProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('mention-refs')).toBeTruthy()
      })

      const newEntity = {
        entityType: 'recipe',
        entityId: 'r2',
        displayName: '宫保鸡丁',
        icon: '🍗',
      }
      const newResolved = {
        ...resolvedRecipe,
        entityId: 'r2',
        displayName: '宫保鸡丁',
        data: { title: '宫保鸡丁' },
      }
      mockResolve.mockResolvedValue(newResolved)

      rerender(
        <MentionProvider>
          <MentionPicker
            baseUrl={BASE_URL}
            contextEntity={newEntity}
            autoRef={true}
          />
        </MentionProvider>,
      )

      await waitFor(() => {
        const names = screen.getAllByTestId('ref-pill-name')
        // MentionProvider is re-created by rerender, so we get only the new one
        expect(names.some(n => n.textContent === '宫保鸡丁')).toBe(true)
      })
    })

    it('uses default icon 📄 when contextEntity has no icon', async () => {
      const entityNoIcon = {
        entityType: 'recipe',
        entityId: 'r1',
        displayName: '鱼香肉丝',
      }

      renderWithProvider(
        <MentionPicker
          baseUrl={BASE_URL}
          contextEntity={entityNoIcon}
          autoRef={true}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('mention-refs')).toBeTruthy()
      })

      // Pill rendered with default icon
      expect(screen.getAllByTestId('ref-pill')).toHaveLength(1)
    })

    it('user can remove auto-added pill', async () => {
      const user = userEvent.setup()

      renderWithProvider(
        <MentionPicker
          baseUrl={BASE_URL}
          contextEntity={recipeContextEntity}
          autoRef={true}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('mention-refs')).toBeTruthy()
      })

      const removeBtn = screen.getByTestId('ref-pill-remove')
      await user.click(removeBtn)

      expect(screen.queryByTestId('mention-refs')).toBeNull()
    })
  })

  describe('sessionId optional', () => {
    it('does not call suggest when sessionId is undefined', async () => {
      renderWithProvider(
        <MentionPicker baseUrl={BASE_URL} />,
      )

      await act(async () => {
        await new Promise(r => setTimeout(r, 50))
      })

      expect(mockSuggest).not.toHaveBeenCalled()
    })
  })
})
