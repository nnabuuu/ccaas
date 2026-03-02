import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

const schema = z.object({
  period: z.enum(['monthly', 'daily']),
  maxTokens: z.coerce.number().int().positive('Must be a positive integer'),
  maxSessions: z.coerce.number().int().positive('Must be a positive integer'),
  maxApiCalls: z.coerce.number().int().positive('Must be a positive integer'),
  alertThreshold: z.coerce.number().int().min(1, 'Min 1%').max(100, 'Max 100%'),
})

type FormValues = z.infer<typeof schema>

interface EditQuotaModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  tenantId: string
  currentQuotas?: {
    tokens: { limit: number }
    sessions: { limit: number }
    apiCalls: { limit: number }
    alertThreshold?: number
    period?: 'monthly' | 'daily'
  }
}

export function EditQuotaModal({
  open,
  onClose,
  onSuccess,
  tenantId,
  currentQuotas,
}: EditQuotaModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const period = watch('period')

  useEffect(() => {
    if (open) {
      reset({
        period: currentQuotas?.period ?? 'monthly',
        maxTokens: currentQuotas?.tokens.limit ?? 1000000,
        maxSessions: currentQuotas?.sessions.limit ?? 100,
        maxApiCalls: currentQuotas?.apiCalls.limit ?? 10000,
        alertThreshold: currentQuotas?.alertThreshold ?? 80,
      })
      setError(null)
    }
  }, [open, currentQuotas, reset])

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await apiClient.put(`/admin/tenants/${tenantId}/quotas`, data)
      toast.success('Quotas updated successfully')
      onSuccess()
      onClose()
    } catch (err) {
      const message =
        err instanceof Error && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Failed to update quotas')
          : 'Failed to update quotas'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Quotas</DialogTitle>
          <DialogDescription>
            Set usage limits and alert thresholds for this tenant.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="period">Period</Label>
            <Select
              value={period}
              onValueChange={(v) => setValue('period', v as 'monthly' | 'daily')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTokens">Token Limit</Label>
            <Input
              id="maxTokens"
              type="number"
              min={1}
              {...register('maxTokens')}
            />
            {errors.maxTokens && (
              <p className="text-sm text-destructive">{errors.maxTokens.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSessions">Session Limit</Label>
            <Input
              id="maxSessions"
              type="number"
              min={1}
              {...register('maxSessions')}
            />
            {errors.maxSessions && (
              <p className="text-sm text-destructive">{errors.maxSessions.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxApiCalls">API Call Limit</Label>
            <Input
              id="maxApiCalls"
              type="number"
              min={1}
              {...register('maxApiCalls')}
            />
            {errors.maxApiCalls && (
              <p className="text-sm text-destructive">{errors.maxApiCalls.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="alertThreshold">Alert Threshold (%)</Label>
            <Input
              id="alertThreshold"
              type="number"
              min={1}
              max={100}
              {...register('alertThreshold')}
            />
            {errors.alertThreshold && (
              <p className="text-sm text-destructive">{errors.alertThreshold.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Alert when usage exceeds this percentage of the limit
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
