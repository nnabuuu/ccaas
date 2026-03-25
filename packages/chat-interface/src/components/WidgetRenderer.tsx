import type { JsonRenderSpec } from '@/types/widget'
import { useChatInterfaceContext } from '@/context/ChatInterfaceContext'

interface WidgetRendererProps {
  spec: JsonRenderSpec
  widgetState: Record<string, unknown>
  onStateChange?: (key: string, value: unknown) => void
  onSubmit?: (params: Record<string, unknown>) => void
}

export function WidgetRenderer({ spec, widgetState, onStateChange, onSubmit }: WidgetRendererProps) {
  const { widgetRegistry } = useChatInterfaceContext()
  const handleStateChange = onStateChange ?? (() => {})

  const renderElement = (elementId: string): React.ReactNode => {
    const element = spec.elements[elementId]
    if (!element) return null

    const Component = widgetRegistry[element.type]
    if (!Component) {
      return (
        <div className="text-xs text-ck-t3 p-2 border border-ck-b2 rounded-ck">
          Unknown widget: {element.type}
        </div>
      )
    }

    const children = element.children?.map(childId => renderElement(childId))

    return (
      <Component
        key={elementId}
        props={element.props}
        widgetState={widgetState}
        onStateChange={handleStateChange}
        onSubmit={onSubmit}
      >
        {children}
      </Component>
    )
  }

  return (
    <div className="my-[6px]">
      {renderElement(spec.root)}
    </div>
  )
}
