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
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
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

const editRoleSchema = z.object({
  role: z.enum(['admin', 'developer', 'viewer']),
  canCreateSkills: z.boolean(),
})

type FormValues = z.infer<typeof editRoleSchema>

interface TenantRoleData {
  userId: string
  role: string
  canCreateSkills: boolean
}

export interface EditRoleModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  data: TenantRoleData
}

export function EditRoleModal({ open, onClose, onSuccess, data }: EditRoleModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(editRoleSchema),
  })

  const role = watch('role')
  const canCreateSkills = watch('canCreateSkills')

  useEffect(() => {
    if (open) {
      reset({
        role: data.role as FormValues['role'],
        canCreateSkills: data.canCreateSkills,
      })
      setError(null)
    }
  }, [open, data, reset])

  // Auto-toggle canCreateSkills based on role
  useEffect(() => {
    if (role === 'admin' || role === 'developer') {
      setValue('canCreateSkills', true)
    } else if (role === 'viewer') {
      setValue('canCreateSkills', false)
    }
  }, [role, setValue])

  const onSubmit = async (formData: FormValues) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await apiClient.patch(`/admin/users/${data.userId}/role`, formData)
      toast.success(<T zh="角色更新成功" en="Role updated successfully" />)
      onSuccess()
      onClose()
    } catch (err) {
      const message =
        err instanceof Error && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Failed to update role')
          : 'Failed to update role'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><T zh="编辑角色" en="Edit Role" /></DialogTitle>
          <DialogDescription>
            <T zh="更新用户在当前租户的角色和权限" en="Update the user's role and permissions in this tenant." />
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label><T zh="角色" en="Role" /></Label>
            <Select
              value={role}
              onValueChange={(v) => setValue('role', v as FormValues['role'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label><T zh="可创建技能" en="Can Create Skills" /></Label>
              <p className="text-xs text-muted-foreground">
                <T zh="允许此用户创建和管理技能" en="Allow this user to create and manage skills" />
              </p>
            </div>
            <Switch
              checked={canCreateSkills}
              onCheckedChange={(checked) => setValue('canCreateSkills', checked)}
            />
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
