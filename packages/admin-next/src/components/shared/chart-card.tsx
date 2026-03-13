import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ChartCardProps {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export function ChartCard({ title, description, children, className, action }: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
