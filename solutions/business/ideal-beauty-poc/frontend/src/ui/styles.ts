/* ═══════ Shared Style Objects ═══════
 * Reusable inline style constants for common UI patterns.
 * Import and spread: style={{ ...S.primaryBtn, width: '100%' }}
 */

import { C, FONT } from './tokens';

export const S = {
  /* ─── Buttons ─── */

  /** Purple filled button — primary actions */
  primaryBtn: {
    padding: '12px 20px',
    borderRadius: 10,
    border: 'none',
    background: C.purple,
    color: '#fff',
    fontSize: 15,
    fontWeight: 600 as const,
    cursor: 'pointer' as const,
    fontFamily: FONT.sans,
  },

  /** Outline button — secondary actions */
  outlineBtn: {
    padding: '12px 20px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.cardBg,
    color: C.textBody,
    fontSize: 14,
    cursor: 'pointer' as const,
  },

  /** Small purple subtle button — broadcast, expand */
  subtleBtn: {
    padding: '4px 12px',
    borderRadius: 5,
    border: `1px solid ${C.purpleFaint}`,
    background: C.purpleBgSubtle,
    color: C.purple,
    fontSize: 11,
    fontWeight: 600 as const,
    cursor: 'pointer' as const,
  },

  /** Close / X button */
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.cardBg,
    color: C.textSubtle,
    fontSize: 16,
    cursor: 'pointer' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 0,
  },

  /* ─── Cards ─── */

  /** Standard card container */
  card: {
    padding: '14px 16px',
    background: C.cardBg,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
  },

  /** Modal card (centered, with shadow) */
  modalCard: {
    padding: '40px 32px',
    background: C.cardBg,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    textAlign: 'center' as const,
  },

  /* ─── Inputs ─── */

  /** Dark-theme textarea (task workspace) */
  darkTextarea: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${C.borderDark}`,
    background: 'rgba(255,255,255,.03)',
    color: C.textDark,
    fontSize: 15,
    lineHeight: '1.9',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    outline: 'none',
  },

  /* ─── Typography ─── */

  /** Page heading (large) */
  heading: {
    fontSize: 22,
    fontWeight: 700 as const,
    color: C.text,
    fontFamily: FONT.sans,
  },

  /** Section label (small caps) */
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600 as const,
    color: C.purple,
    marginBottom: 6,
  },

  /* ─── Feedback ─── */

  /** AI feedback container (dark theme) */
  feedbackBox: {
    marginTop: 14,
    padding: 12,
    background: 'rgba(255,255,255,.025)',
    borderRadius: 8,
    border: '1px solid rgba(167,139,250,.12)',
  },

  /** Feedback header label */
  feedbackLabel: {
    fontSize: 12,
    fontWeight: 600 as const,
    color: C.purpleLight,
    marginBottom: 6,
  },

  /* ─── Overlay ─── */

  /** Modal backdrop */
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: C.backdrop,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 100,
  },
} as const;
