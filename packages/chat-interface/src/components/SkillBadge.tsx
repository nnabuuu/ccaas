interface SkillBadgeProps {
  name: string
}

export function SkillBadge({ name }: SkillBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[10px] bg-ck-success-bg text-ck-success-t mb-1.5 max-w-[200px]" title={name}>
      <span className="w-[6px] h-[6px] rounded-full bg-ck-success-t shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  )
}
