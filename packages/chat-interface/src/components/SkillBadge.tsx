interface SkillBadgeProps {
  name: string
}

export function SkillBadge({ name }: SkillBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-[2px] rounded-[10px] bg-ck-success-bg text-ck-success-t mb-[6px]">
      <span className="w-[6px] h-[6px] rounded-full bg-ck-success-t" />
      {name}
    </span>
  )
}
