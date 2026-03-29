import type { WidgetComponentProps } from '@/types/widget'

interface TextSectionProps {
  content: string
}

export function TextSection({ props }: WidgetComponentProps<TextSectionProps>) {
  return <p className="text-xs text-ck-t2 whitespace-pre-wrap">{props.content}</p>
}
