export function ThinkingDots({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-ck-t2 text-xs font-serif select-none pl-2 pr-2 pointer-events-none">
      {label && <span>{label}</span>}
      <span className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-ck-t3 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-ck-t3 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-ck-t3 animate-bounce [animation-delay:300ms]" />
      </span>
    </div>
  )
}
