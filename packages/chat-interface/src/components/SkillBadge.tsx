interface SkillBadgeProps {
  name: string
  /** 'solution' = green (built-in), 'custom' = orange (tenant-created). Defaults to 'solution'. */
  type?: 'solution' | 'custom'
}

const BADGE_STYLES = {
  solution: 'bg-ck-success-bg text-ck-success-t',
  custom: 'bg-ck-coral-bg text-ck-coral-t',
} as const

export function SkillBadge({ name, type = 'solution' }: SkillBadgeProps) {
  const style = BADGE_STYLES[type]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-[10px] ${style} mb-1.5 max-w-[200px]`} title={name}>
      <span className="w-[6px] h-[6px] rounded-full bg-current shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  )
}
