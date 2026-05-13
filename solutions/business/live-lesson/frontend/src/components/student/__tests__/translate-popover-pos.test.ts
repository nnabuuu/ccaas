import { describe, it, expect } from 'vitest'
import { calcPopoverPos, type Viewport } from '../TranslateButton'

const VP: Viewport = { innerWidth: 1024, innerHeight: 768 }

const rect = (top: number, bottom: number, left: number) => ({ top, bottom, left })

describe('calcPopoverPos', () => {
  /* ═══ Normal placement ═══ */

  it('places below selection when there is room', () => {
    const pos = calcPopoverPos(rect(100, 120, 200), VP)
    expect(pos.top).toBe(128)   // bottom(120) + 8
    expect(pos.left).toBe(200)
  })

  /* ═══ Vertical edge cases ═══ */

  it('flips above when popover would overflow bottom', () => {
    // bottom=500, below=508, 508+430=938 > 768 → flip
    const pos = calcPopoverPos(rect(480, 500, 200), VP)
    expect(pos.top).toBe(50)    // 480 - 430
  })

  it('clamps to top:8 when flipped position goes negative', () => {
    // Selection near top of a short viewport — flip overshoots
    const pos = calcPopoverPos(rect(20, 580, 200), { innerWidth: 1024, innerHeight: 600 })
    // below=588, 588+430=1018 > 600 → flip: 20-430=-410 → clamp to 8
    expect(pos.top).toBe(8)
  })

  it('pins to top:8 on extremely small viewport', () => {
    const pos = calcPopoverPos(rect(10, 30, 50), { innerWidth: 400, innerHeight: 300 })
    // below=38, 38+430=468 > 300 → flip: 10-430=-420 → 8
    expect(pos.top).toBe(8)
  })

  /* ═══ Horizontal edge cases ═══ */

  it('shifts left when selection is near right edge', () => {
    // rect.left=900, vp.innerWidth-356=668 → clamp to 668
    const pos = calcPopoverPos(rect(100, 120, 900), VP)
    expect(pos.left).toBe(668)
  })

  it('clamps to left:8 when selection is at left edge', () => {
    const pos = calcPopoverPos(rect(100, 120, 0), VP)
    expect(pos.left).toBe(8)
  })

  it('clamps negative left to 8', () => {
    const pos = calcPopoverPos(rect(100, 120, -50), VP)
    expect(pos.left).toBe(8)
  })

  /* ═══ Corner cases ═══ */

  it('handles bottom-right corner: flips and shifts', () => {
    const pos = calcPopoverPos(rect(700, 750, 950), VP)
    // flip: 700-430=270; left: min(950, 668)=668
    expect(pos.top).toBe(270)
    expect(pos.left).toBe(668)
  })

  it('handles top-left corner: both clamped', () => {
    const pos = calcPopoverPos(rect(5, 25, 2), { innerWidth: 400, innerHeight: 300 })
    // below=33, 33+430>300 → flip: 5-430=-425 → 8
    // left: max(8, min(2, 44))=8
    expect(pos.top).toBe(8)
    expect(pos.left).toBe(8)
  })

  /* ═══ Exact boundary ═══ */

  it('stays below when popover exactly fits', () => {
    // below=330, 330+430=760 < 768 → no flip
    const pos = calcPopoverPos(rect(300, 322, 200), VP)
    expect(pos.top).toBe(330)
  })

  it('flips when one pixel over', () => {
    // below=331 (323+8), 331+430=761 > 760 → flip: max(8, 400-430) = 8
    const pos = calcPopoverPos(rect(400, 323, 200), { innerWidth: 1024, innerHeight: 760 })
    expect(pos.top).toBe(8)
  })
})
