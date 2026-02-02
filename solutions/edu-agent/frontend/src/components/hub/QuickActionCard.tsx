import type { LucideIcon } from 'lucide-react'

interface QuickActionCardProps {
  icon: LucideIcon
  title: string
  description: string
  accentColor: string
  bgColor: string
  onClick: () => void
}

export function QuickActionCard({ icon: Icon, title, description, accentColor, bgColor, onClick }: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-surface hover:shadow-float hover:border-transparent transition-all duration-panel text-left w-full"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgColor}`}>
        <Icon size={20} className={accentColor} strokeWidth={1.75} />
      </div>
      <div>
        <h3 className="font-semibold text-[15px] text-ink group-hover:text-accent transition-colors">{title}</h3>
        <p className="text-sm text-ink-secondary mt-0.5">{description}</p>
      </div>
    </button>
  )
}
