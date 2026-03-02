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

export const editTenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']),
  status: z.enum(['active', 'suspended', 'pending', 'deleted']),
  billingEmail: z.string().email('Invalid email').or(z.literal('')).optional(),
  maxSessions: z.coerce.number().int().min(1, 'Min 1'),
  maxSkills: z.coerce.number().int().min(1, 'Min 1'),
  sessionTtlMs: z.coerce.number().int().min(60000, 'Min 60 seconds'),
})

type FormValues = z.infer<typeof editTenantSchema>

interface TenantData {
  id: string
  name: string
  description?: string
  plan: string
  status: string
  billingEmail?: string
  maxSessions: number
  maxSkills: number
  sessionTtlMs?: number
}

export interface EditTenantModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  tenant: TenantData
}

export function EditTenantModal({
  open,
  onClose,
  onSuccess,
  tenant,
}: EditTenantModalProps) {
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
    resolver: zodResolver(editTenantSchema),
  })

  const plan = watch('plan')
  const status = watch('status')

  useEffect(() => {
    if (open) {
      reset({
        name: tenant.name,
        description: tenant.description ?? '',
        plan: tenant.plan as FormValues['plan'],
        status: tenant.status as FormValues['status'],
        billingEmail: tenant.billingEmail ?? '',
        maxSessions: tenant.maxSessions,
        maxSkills: tenant.maxSkills,
        sessionTtlMs: tenant.sessionTtlMs ?? 1800000,
      })
      setError(null)
    }
  }, [open, tenant, reset])

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await apiClient.put(`/admin/tenants/${tenant.id}`, data)
      toast.success('Tenant updated successfully')
      onSuccess()
      onClose()
    } catch (err) {
      const message =
        err instanceof Error && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Failed to update tenant')
          : 'Failed to update tenant'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Tenant</DialogTitle>
          <DialogDescription>
            Update tenant properties and resource limits.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register('description')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            <Select
              value={plan}
              onValueChange={(v) => setValue('plan', v as FormValues['plan'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setValue('status', v as FormValues['status'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingEmail">Billing Email</Label>
            <Input id="billingEmail" type="email" {...register('billingEmail')} />
            {errors.billingEmail && (
              <p className="text-sm text-destructive">{errors.billingEmail.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSessions">Max Sessions</Label>
            <Input id="maxSessions" type="number" min={1} {...register('maxSessions')} />
            {errors.maxSessions && (
              <p className="text-sm text-destructive">{errors.maxSessions.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSkills">Max Skills</Label>
            <Input id="maxSkills" type="number" min={1} {...register('maxSkills')} />
            {errors.maxSkills && (
              <p className="text-sm text-destructive">{errors.maxSkills.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionTtlMs">Session TTL (ms)</Label>
            <Input id="sessionTtlMs" type="number" min={60000} {...register('sessionTtlMs')} />
            {errors.sessionTtlMs && (
              <p className="text-sm text-destructive">{errors.sessionTtlMs.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Minimum 60000 ms (60 seconds)
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
