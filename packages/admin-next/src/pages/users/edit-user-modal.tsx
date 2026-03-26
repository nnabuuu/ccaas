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

const editUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['active', 'suspended']),
})

type FormValues = z.infer<typeof editUserSchema>

interface UserData {
  id: string
  name: string
  status: string
}

export interface EditUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  user: UserData
}

export function EditUserModal({ open, onClose, onSuccess, user }: EditUserModalProps) {
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
    resolver: zodResolver(editUserSchema),
  })

  const status = watch('status')

  useEffect(() => {
    if (open) {
      reset({
        name: user.name,
        status: user.status as FormValues['status'],
      })
      setError(null)
    }
  }, [open, user, reset])

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await apiClient.patch(`/admin/users/${user.id}`, data)
      toast.success(<T zh="用户更新成功" en="User updated successfully" />)
      onSuccess()
      onClose()
    } catch (err) {
      const message =
        err instanceof Error && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Failed to update user')
          : 'Failed to update user'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><T zh="编辑用户" en="Edit User" /></DialogTitle>
          <DialogDescription>
            <T zh="更新用户名称和状态" en="Update user name and status." />
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
              </SelectContent>
            </Select>
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
