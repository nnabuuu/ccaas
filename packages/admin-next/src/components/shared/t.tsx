/**
 * Bilingual text component.
 * Renders both zh and en spans; CSS hides the inactive language via [data-lang] selectors.
 *
 * Usage: <T zh="仪表板" en="Dashboard" />
 */
export function T({ zh, en }: { zh: string; en: string }) {
  return (
    <>
      <span className="zh">{zh}</span>
      <span className="en">{en}</span>
    </>
  )
}
