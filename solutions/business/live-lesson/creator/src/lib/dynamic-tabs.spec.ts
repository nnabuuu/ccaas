import { describe, it, expect } from 'vitest'
import {
  type DynamicTab,
  type TabsState,
  closeDynamic,
  dynamicTabId,
  initialState,
  openDynamic,
  selectDynamic,
  selectWorkspace,
} from './dynamic-tabs'

const auditTab = (id: string, openedAt = id.charCodeAt(0)): DynamicTab => ({
  id,
  kind: 'audit-report',
  reportPath: `audit/${id}.md`,
  title: `审计 ${id}`,
  openedAt,
})

const fileTab = (id: string): DynamicTab => ({
  id,
  kind: 'file-viewer',
  filePath: `notes/${id}.md`,
  title: id,
  openedAt: 0,
})

describe('initialState', () => {
  it('starts on execution workspace tab', () => {
    const s = initialState()
    expect(s.activeWorkspace).toBe('execution')
    expect(s.activeDynamic).toBeNull()
    expect(s.dynamic).toEqual([])
  })
})

describe('selectWorkspace', () => {
  it('switches workspace tab', () => {
    const s = selectWorkspace(initialState(), 'plan')
    expect(s.activeWorkspace).toBe('plan')
    expect(s.activeDynamic).toBeNull()
  })

  it('clears the active dynamic tab when switching to a workspace', () => {
    let s: TabsState = initialState()
    s = openDynamic(s, auditTab('a'))
    expect(s.activeDynamic).toBe('a')
    s = selectWorkspace(s, 'plan')
    expect(s.activeWorkspace).toBe('plan')
    expect(s.activeDynamic).toBeNull()
    // The dynamic tab is still in the list — selecting workspace
    // doesn't close anything.
    expect(s.dynamic).toHaveLength(1)
  })
})

describe('openDynamic', () => {
  it('appends + activates the new tab', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    expect(s.dynamic).toHaveLength(1)
    expect(s.activeDynamic).toBe('a')
    expect(s.activeWorkspace).toBeNull()
  })

  it('preserves opening order across multiple opens', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    s = openDynamic(s, auditTab('b'))
    s = openDynamic(s, auditTab('c'))
    expect(s.dynamic.map((t) => t.id)).toEqual(['a', 'b', 'c'])
    // Latest opened is active.
    expect(s.activeDynamic).toBe('c')
  })

  it('dedupes by id (defensive — callers should pass unique ids)', () => {
    let s = initialState()
    const tab = auditTab('a')
    s = openDynamic(s, tab)
    s = openDynamic(s, tab)
    expect(s.dynamic).toHaveLength(1)
    expect(s.activeDynamic).toBe('a')
  })
})

describe('selectDynamic', () => {
  it('switches to an existing dynamic tab', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    s = openDynamic(s, auditTab('b'))
    s = selectDynamic(s, 'a')
    expect(s.activeDynamic).toBe('a')
    expect(s.activeWorkspace).toBeNull()
  })

  it('is a no-op when id is not in the list', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    const before = { ...s }
    s = selectDynamic(s, 'missing')
    expect(s.activeDynamic).toBe(before.activeDynamic)
  })
})

describe('closeDynamic', () => {
  it('removes the tab from the list', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    s = openDynamic(s, auditTab('b'))
    s = closeDynamic(s, 'a')
    expect(s.dynamic.map((t) => t.id)).toEqual(['b'])
  })

  it('when closing a non-active tab, keeps the active selection', () => {
    // Open a, then b (b active), then close a — b should stay active.
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    s = openDynamic(s, auditTab('b'))
    expect(s.activeDynamic).toBe('b')
    s = closeDynamic(s, 'a')
    expect(s.activeDynamic).toBe('b')
  })

  it('when closing the active tab, falls back to the tab on its left', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    s = openDynamic(s, auditTab('b'))
    s = openDynamic(s, auditTab('c'))
    expect(s.activeDynamic).toBe('c')
    s = closeDynamic(s, 'c')
    // Closing the rightmost selects the new rightmost.
    expect(s.activeDynamic).toBe('b')
  })

  it('when closing the leftmost active tab, selects the new leftmost', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    s = openDynamic(s, auditTab('b'))
    s = openDynamic(s, auditTab('c'))
    s = selectDynamic(s, 'a')
    s = closeDynamic(s, 'a')
    expect(s.activeDynamic).toBe('b')
  })

  it('when closing the only remaining dynamic tab, falls back to execution workspace', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    s = closeDynamic(s, 'a')
    expect(s.dynamic).toEqual([])
    expect(s.activeDynamic).toBeNull()
    expect(s.activeWorkspace).toBe('execution')
  })

  it('is a no-op when id is not in the list', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    const before = JSON.stringify(s)
    s = closeDynamic(s, 'missing')
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('mixed scenarios', () => {
  it('open dynamic → switch to workspace → reopen → see same dynamic list', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('a'))
    s = openDynamic(s, fileTab('b'))
    s = selectWorkspace(s, 'plan')
    // dynamic list survives the workspace switch
    expect(s.dynamic.map((t) => t.id)).toEqual(['a', 'b'])
    expect(s.activeDynamic).toBeNull()
    expect(s.activeWorkspace).toBe('plan')
    s = selectDynamic(s, 'b')
    expect(s.activeDynamic).toBe('b')
    expect(s.activeWorkspace).toBeNull()
  })

  it('audit + file viewer can coexist as separate kinds', () => {
    let s = initialState()
    s = openDynamic(s, auditTab('audit-1'))
    s = openDynamic(s, fileTab('manifest'))
    expect(s.dynamic.map((t) => t.kind)).toEqual(['audit-report', 'file-viewer'])
  })
})

describe('dynamicTabId', () => {
  it('generates a non-empty string', () => {
    const id = dynamicTabId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('generates unique ids on consecutive calls', () => {
    const a = dynamicTabId()
    const b = dynamicTabId()
    expect(a).not.toBe(b)
  })
})
