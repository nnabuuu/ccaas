import { Button } from '@/components/ui/button'

interface RangePreset {
  label: string
  range: [number, number]
}

interface RangePresetButtonsProps {
  presets: RangePreset[]
  current: [number, number]
  onChange: (range: [number, number]) => void
}

export function RangePresetButtons({ presets, current, onChange }: RangePresetButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map(({ label, range }) => (
        <Button
          key={label}
          variant={current[0] === range[0] && current[1] === range[1] ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(range)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

export type { RangePreset }
