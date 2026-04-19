import type { ReadingStep } from '../../types/reading'

interface Props {
  steps: ReadingStep[]
  current: number
  onSelect: (idx: number) => void
}

export default function StepTabs({ steps, current, onSelect }: Props) {
  return (
    <div className="stu-step-tabs">
      {steps.map((s, i) => (
        <button
          key={s.id}
          className={`stu-st${i < current ? ' done' : ''}${i === current ? ' act' : ''}`}
          onClick={() => onSelect(i)}
        >
          {i + 1}
        </button>
      ))}
    </div>
  )
}
