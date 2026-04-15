import React from 'react'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AtPicker } from '../AtPicker'
import type { ContextEntityRef } from '../AtPicker'

// ---- jsdom shim ----
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

// ---- Mock ContextLayerClient ----

const mockGetEntityTypes = vi.fn()
const mockSuggest = vi.fn()
const mockBrowse = vi.fn()
const mockSearch = vi.fn()
const mockResolve = vi.fn()
const mockRecordActivity = vi.fn()
const mockGetShortcuts = vi.fn()

vi.mock('@kedge-agentic/context-layer/client', () => ({
  ContextLayerClient: vi.fn().mockImplementation(() => ({
    getEntityTypes: mockGetEntityTypes,
    suggest: mockSuggest,
    browse: mockBrowse,
    search: mockSearch,
    resolve: mockResolve,
    recordActivity: mockRecordActivity,
    getShortcuts: mockGetShortcuts,
  })),
}))

const BASE_URL = 'http://localhost:3002'

const entityTypesResponse = {
  types: [
    { type: 'recipe', displayName: '食谱', icon: '🍳' },
    { type: 'ingredient', displayName: '食材', icon: '🥕' },
  ],
  tree: {
    roots: ['recipe'],
    relations: [{ parent: 'recipe', child: 'ingredient' }],
  },
}

const recipeContext: ContextEntityRef = {
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
  dataHash: 'abc',
  resolvedAt: '2026-01-01T00:00:00Z',
  breadcrumb: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetEntityTypes.mockResolvedValue(entityTypesResponse)
  mockGetShortcuts.mockResolvedValue({ pinned: [], hidden: [] })
  mockSuggest.mockResolvedValue({ recents: [] })
  mockResolve.mockResolvedValue(resolvedRecipe)
  mockRecordActivity.mockResolvedValue(undefined)
  mockBrowse.mockResolvedValue({ items: [], total: 0 })
  mockSearch.mockResolvedValue({ results: [] })
})

describe('AtPicker', () => {
  describe('contextEntity section', () => {
    it('renders "当前上下文" section when contextEntity is provided', async () => {
      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          contextEntity={recipeContext}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('context-entity-section')).toBeTruthy()
      })

      expect(screen.getByText('当前上下文')).toBeTruthy()
      expect(screen.getByText('鱼香肉丝')).toBeTruthy()
    })

    it('does NOT render context section when contextEntity is undefined', async () => {
      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('at-picker')).toBeTruthy()
      })

      expect(screen.queryByTestId('context-entity-section')).toBeNull()
    })

    it('shows drill button when entity type has child relations', async () => {
      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          contextEntity={recipeContext}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId(`context-entity-drill-${recipeContext.entityId}`)).toBeTruthy()
      })
    })

    it('does NOT show drill button when entity type has no child relations', async () => {
      const ingredientContext: ContextEntityRef = {
        entityType: 'ingredient',
        entityId: 'i1',
        displayName: '猪肉',
        icon: '🥩',
      }

      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          contextEntity={ingredientContext}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('context-entity-section')).toBeTruthy()
      })

      expect(screen.queryByTestId('context-entity-drill-i1')).toBeNull()
    })

    it('clicking context entity triggers select with resolve', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      const onClose = vi.fn()

      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={onClose}
          onSelect={onSelect}
          contextEntity={recipeContext}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId(`context-entity-${recipeContext.entityId}`)).toBeTruthy()
      })

      await user.click(screen.getByTestId(`context-entity-${recipeContext.entityId}`))

      await waitFor(() => {
        expect(mockResolve).toHaveBeenCalledWith('recipe', 'r1')
      })

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: 'recipe',
            entityId: 'r1',
            displayName: '鱼香肉丝',
            icon: '🍳',
          }),
        )
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('clicking drill button navigates to browse view', async () => {
      const user = userEvent.setup()
      const ingredientItems = [
        { entityType: 'ingredient', entityId: 'i1', displayName: '猪肉', hasChildren: false },
        { entityType: 'ingredient', entityId: 'i2', displayName: '木耳', hasChildren: false },
      ]
      mockBrowse.mockResolvedValue({ items: ingredientItems, total: 2 })

      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          contextEntity={recipeContext}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId(`context-entity-drill-${recipeContext.entityId}`)).toBeTruthy()
      })

      await user.click(screen.getByTestId(`context-entity-drill-${recipeContext.entityId}`))

      await waitFor(() => {
        expect(mockBrowse).toHaveBeenCalledWith('ingredient', { parentType: 'recipe', parentId: 'r1' })
      })

      await waitFor(() => {
        expect(screen.getByTestId('browse-view')).toBeTruthy()
      })
    })

    it('uses typeInfo icon when contextEntity has no icon', async () => {
      const contextNoIcon: ContextEntityRef = {
        entityType: 'recipe',
        entityId: 'r1',
        displayName: '鱼香肉丝',
        // no icon — should fall back to typeInfo.icon '🍳'
      }

      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          contextEntity={contextNoIcon}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('context-entity-section')).toBeTruthy()
      })

      // The context entity section should show the recipe type icon
      const section = screen.getByTestId('context-entity-section')
      expect(section.textContent).toContain('🍳')
    })
  })

  describe('sessionId optional', () => {
    it('renders without sessionId', async () => {
      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('at-picker')).toBeTruthy()
      })
    })

    it('does not call suggest when sessionId is undefined', async () => {
      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('at-picker')).toBeTruthy()
      })

      expect(mockSuggest).not.toHaveBeenCalled()
    })

    it('calls suggest when sessionId is provided', async () => {
      render(
        <AtPicker
          baseUrl={BASE_URL}
          sessionId="session-1"
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      )

      await waitFor(() => {
        expect(mockSuggest).toHaveBeenCalledWith('session-1')
      })
    })

    it('does not call recordActivity when sessionId is undefined on select', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()

      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={onSelect}
          contextEntity={recipeContext}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId(`context-entity-${recipeContext.entityId}`)).toBeTruthy()
      })

      await user.click(screen.getByTestId(`context-entity-${recipeContext.entityId}`))

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalled()
      })

      // recordActivity guard: no sessionId → no call to client.recordActivity
      expect(mockRecordActivity).not.toHaveBeenCalled()
    })
  })

  describe('keyboard navigation with contextEntity', () => {
    it('includes contextEntity in data-nav-item count', async () => {
      const recents = [
        { entityType: 'recipe', entityId: 'r2', displayName: '宫保鸡丁', icon: '🍗' },
      ]
      mockSuggest.mockResolvedValue({ recents })

      render(
        <AtPicker
          baseUrl={BASE_URL}
          sessionId="s1"
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          contextEntity={recipeContext}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('context-entity-section')).toBeTruthy()
        expect(screen.getByTestId('recents-section')).toBeTruthy()
      })

      // contextEntity(1) + recent(1) + root type(1) = 3
      const navItems = document.querySelectorAll('[data-nav-item]')
      expect(navItems.length).toBe(3)
    })

    it('has correct nav count without contextEntity', async () => {
      const recents = [
        { entityType: 'recipe', entityId: 'r2', displayName: '宫保鸡丁', icon: '🍗' },
      ]
      mockSuggest.mockResolvedValue({ recents })

      render(
        <AtPicker
          baseUrl={BASE_URL}
          sessionId="s1"
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('recents-section')).toBeTruthy()
      })

      // recent(1) + root type(1) = 2
      const navItems = document.querySelectorAll('[data-nav-item]')
      expect(navItems.length).toBe(2)
    })
  })

  describe('composition scenarios', () => {
    it('split view first message: contextEntity + no session', async () => {
      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          contextEntity={recipeContext}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('context-entity-section')).toBeTruthy()
        expect(screen.getByTestId('type-browse-section')).toBeTruthy()
      })

      expect(screen.queryByTestId('recents-section')).toBeNull()
      expect(mockSuggest).not.toHaveBeenCalled()
    })

    it('split view ongoing: contextEntity + session with recents', async () => {
      const recents = [
        { entityType: 'recipe', entityId: 'r2', displayName: '宫保鸡丁', icon: '🍗' },
      ]
      mockSuggest.mockResolvedValue({ recents })

      render(
        <AtPicker
          baseUrl={BASE_URL}
          sessionId="session-1"
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          contextEntity={recipeContext}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('context-entity-section')).toBeTruthy()
        expect(screen.getByTestId('recents-section')).toBeTruthy()
      })
    })

    it('standalone chat: no contextEntity, only recents and type browse', async () => {
      const recents = [
        { entityType: 'recipe', entityId: 'r1', displayName: '鱼香肉丝', icon: '🍳' },
      ]
      mockSuggest.mockResolvedValue({ recents })

      render(
        <AtPicker
          baseUrl={BASE_URL}
          sessionId="session-1"
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('recents-section')).toBeTruthy()
        expect(screen.getByTestId('type-browse-section')).toBeTruthy()
      })

      expect(screen.queryByTestId('context-entity-section')).toBeNull()
    })

    it('standalone chat first message: no context, no session', async () => {
      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      )

      await waitFor(() => {
        expect(screen.getByTestId('type-browse-section')).toBeTruthy()
      })

      expect(screen.queryByTestId('context-entity-section')).toBeNull()
      expect(screen.queryByTestId('recents-section')).toBeNull()
    })
  })

  describe('does not render when closed', () => {
    it('returns null when open=false', () => {
      render(
        <AtPicker
          baseUrl={BASE_URL}
          open={false}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          contextEntity={recipeContext}
        />,
      )

      expect(screen.queryByTestId('at-picker')).toBeNull()
    })
  })
})
