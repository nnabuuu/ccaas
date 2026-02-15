import * as React from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { format } from 'date-fns'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DateRangePickerProps {
  value?: DateRange
  onChange: (range: DateRange | undefined) => void
  className?: string
}

/**
 * DateRangePicker - Date range selection component with calendar
 *
 * @param value - Selected date range
 * @param onChange - Callback when date range changes
 * @param className - Optional className for container
 */
export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(undefined)
  }

  const displayText = React.useMemo(() => {
    if (!value?.from) {
      return 'Pick a date range'
    }
    if (value.to) {
      return `${format(value.from, 'MMM d, yyyy')} - ${format(value.to, 'MMM d, yyyy')}`
    }
    return format(value.from, 'MMM d, yyyy')
  }, [value])

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayText}
            {value?.from && (
              <X
                className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={(range) => {
              onChange(range)
              // Close popover when both dates are selected
              if (range?.from && range?.to) {
                setIsOpen(false)
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
