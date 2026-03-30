import { useState, Children, isValidElement, cloneElement } from 'react'
import type { WidgetComponentProps } from '@/types/widget'
import { cn } from '@/lib/utils'

interface StepWizardProps {
  title: string
  submit_action: string
  submit_label?: string
}

export function StepWizard({
  props,
  children,
  widgetState,
  onStateChange,
  onSubmit,
}: WidgetComponentProps<StepWizardProps>) {
  const [currentStep, setCurrentStep] = useState(0)
  const childArray = Children.toArray(children).filter(isValidElement)
  const totalSteps = childArray.length

  const stepLabels = childArray.map((child, index) => {
    const childProps = child.props as { props?: { label?: string } }
    return childProps.props?.label ?? `Step ${index + 1}`
  })

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = () => {
    onSubmit?.({
      ...widgetState,
      _action: props.submit_action,
    })
  }

  const isLastStep = currentStep === totalSteps - 1

  return (
    <div className="border border-ck-b1 rounded-ck-lg bg-ck-bg1 p-4">
      <div className="text-[15px] font-medium mb-4">{props.title}</div>

      {/* Step indicators */}
      <div className="flex gap-1 mb-5">
        {stepLabels.map((label, i) => (
          <button
            key={i}
            onClick={() => i <= currentStep && setCurrentStep(i)}
            className={cn(
              'flex-1 text-center py-2 text-xs border-b-2 transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent',
              i === currentStep
                ? 'text-ck-t1 font-medium border-ck-t1'
                : i < currentStep
                  ? 'text-ck-success-t border-ck-success-t cursor-pointer'
                  : 'text-ck-t3 border-ck-b1 cursor-default',
            )}
          >
            {i < currentStep ? '\u2713 ' : ''}{label}
          </button>
        ))}
      </div>

      {/* Current step content */}
      <div>
        {childArray.map((child, i) => (
          <div key={i} className={i === currentStep ? 'block' : 'hidden'}>
            {cloneElement(child as React.ReactElement<Record<string, unknown>>, {
              widgetState,
              onStateChange,
            })}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-2 justify-end mt-4">
        {currentStep > 0 && (
          <button
            onClick={handlePrev}
            className="text-[13px] px-4 py-[7px] rounded-ck border border-ck-b1 bg-transparent text-ck-t2 hover:bg-ck-bg2 transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent"
          >
            &larr; Previous
          </button>
        )}
        {isLastStep ? (
          <button
            onClick={handleSubmit}
            className="text-[13px] px-4 py-[7px] rounded-ck bg-ck-t1 text-ck-bg1 border border-ck-t1 transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent"
          >
            {props.submit_label ?? 'Confirm'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="text-[13px] px-4 py-[7px] rounded-ck bg-ck-t1 text-ck-bg1 border border-ck-t1 transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent"
          >
            Next &rarr;
          </button>
        )}
      </div>
    </div>
  )
}
