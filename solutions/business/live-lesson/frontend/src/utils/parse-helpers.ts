/** Coerce a check-item index (string | number) to a numeric index. */
export const toIdx = (v: unknown): number =>
  typeof v === 'number' ? v : parseInt(String(v), 10)
