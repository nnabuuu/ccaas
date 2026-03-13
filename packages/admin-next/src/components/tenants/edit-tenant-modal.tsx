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
import { T } from '@/components/shared/t'

export const editTenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  plan: z.enum(['free', 'paid', 'starter', 'professional', 'enterprise']),
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
      toast.success(<T zh="租户更新成功" en="Tenant updated successfully" />)
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
          <DialogTitle><T zh="编辑租户" en="Edit Tenant" /></DialogTitle>
          <DialogDescription>
            <T zh="更新租户属性和资源限制" en="Update tenant properties and resource limits." />
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name"><T zh="名称" en="Name" /></Label>
            <Input id="name" {...register('name')} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description"><T zh="描述" en="Description" /></Label>
            <Input id="description" {...register('description')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan"><T zh="计划" en="Plan" /></Label>
            <Select
              value={plan}
              onValueChange={(v) => setValue('plan', v as FormValues['plan'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status"><T zh="状态" en="Status" /></Label>
            <Select
              value={status}
              onValueChange={(v) => setValue('status', v as FormValues['status'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active"><T zh="活跃" en="Active" /></SelectItem>
                <SelectItem value="suspended"><T zh="已暂停" en="Suspended" /></SelectItem>
                <SelectItem value="pending"><T zh="待处理" en="Pending" /></SelectItem>
                <SelectItem value="deleted"><T zh="已删除" en="Deleted" /></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingEmail"><T zh="账单邮箱" en="Billing Email" /></Label>
            <Input id="billingEmail" type="email" {...register('billingEmail')} />
            {errors.billingEmail && (
              <p className="text-sm text-destructive">{errors.billingEmail.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSessions"><T zh="最大会话数" en="Max Sessions" /></Label>
            <Input id="maxSessions" type="number" min={1} {...register('maxSessions')} />
            {errors.maxSessions && (
              <p className="text-sm text-destructive">{errors.maxSessions.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSkills"><T zh="最大技能数" en="Max Skills" /></Label>
            <Input id="maxSkills" type="number" min={1} {...register('maxSkills')} />
            {errors.maxSkills && (
              <p className="text-sm text-destructive">{errors.maxSkills.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionTtlMs"><T zh="会话 TTL (ms)" en="Session TTL (ms)" /></Label>
            <Input id="sessionTtlMs" type="number" min={60000} {...register('sessionTtlMs')} />
            {errors.sessionTtlMs && (
              <p className="text-sm text-destructive">{errors.sessionTtlMs.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              <T zh="最少 60000 毫秒（60 秒）" en="Minimum 60000 ms (60 seconds)" />
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
              <T zh="取消" en="Cancel" />
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <T zh="保存中..." en="Saving..." /> : <T zh="保存" en="Save" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
