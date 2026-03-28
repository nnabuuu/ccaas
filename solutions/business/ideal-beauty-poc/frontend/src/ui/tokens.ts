/* ═══════ Design Tokens ═══════
 * Single source of truth for all visual constants.
 * Import from here instead of hard-coding hex values.
 */

/* ─── Colors ─── */

export const C = {
  // Purple palette
  purple: '#7c3aed',
  purpleMid: '#a78bfa',
  purpleLight: '#c4b5fd',
  purpleFaint: '#ede9fe',
  purpleBg: '#f5f3ff',
  purpleBgSubtle: '#faf5ff',
  purpleBgAlt: '#faf8ff',

  // Neutrals
  text: '#1a1a18',
  textBody: '#3d3b36',
  textMuted: '#6b6963',
  textSubtle: '#9e9c96',
  textFaint: '#b8b5ae',
  textDark: '#e2e0d8',
  textDarkMuted: '#8a8780',
  textDarkFaint: '#5c5a56',

  // Backgrounds
  pageBg: '#fdfcfa',
  pageBgAlt: '#f8f7f4',
  cardBg: '#fff',
  surfaceLight: '#fafaf8',
  surfaceDark: '#1e1d1b',

  // Borders
  border: '#ebe8e2',
  borderLight: '#f0eee8',
  borderDark: 'rgba(255,255,255,.08)',
  borderDarkSubtle: 'rgba(255,255,255,.05)',

  // Status — green
  green: '#34d399',
  greenDark: '#059669',
  greenLight: '#6ee7b7',
  greenBg: 'rgba(52,211,153,.08)',
  greenBgAlt: 'rgba(110,231,183,.12)',

  // Status — red
  red: '#ef4444',
  redBg: 'rgba(239,68,68,.06)',
  redBgAlt: 'rgba(239,68,68,.08)',

  // Status — amber
  amber: '#fbbf24',
  amberDark: '#d97706',
  amberBg: 'rgba(251,191,36,.06)',

  // Overlay
  backdrop: 'rgba(0,0,0,.6)',
} as const;

/* ─── Typography ─── */

export const FONT = {
  serif: "'Source Serif 4',Georgia,serif",
  sans: "'DM Sans',system-ui,sans-serif",
} as const;

/* ─── Score color helper ─── */

export function scoreColor(score: number): string {
  if (score >= 2) return C.greenDark;
  return C.red;
}

export function scoreColorLight(score: number): string {
  if (score >= 2) return C.greenLight;
  return C.red;
}

export function scoreBg(score: number): string {
  if (score >= 2) return C.greenBg;
  return C.redBg;
}
