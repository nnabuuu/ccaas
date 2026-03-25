import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { T } from '@/components/shared/t'

const schema = z.object({
  email: z.string().email('Valid email required'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'developer', 'viewer']),
})

interface CreateUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  const { selectedTenantId } = useTenantContext()
  const [rawKey, setRawKey] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '', role: 'viewer' },
  })

  const selectedRole = watch('role')

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await apiClient.post('/admin/users', {
        ...data,
        tenantId: selectedTenantId,
      })
      setRawKey(response.data.rawKey)
      setUserId(response.data.user.id)
      window.dispatchEvent(new CustomEvent('user-updated'))
    } catch (err) {
      const message = err instanceof Error && 'response' in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to create user')
        : 'Failed to create user'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (rawKey) {
      await navigator.clipboard.writeText(rawKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    const hadKey = rawKey !== null
    reset()
    setRawKey(null)
    setUserId(null)
    setCopied(false)
    setError(null)
    onClose()
    if (hadKey) {
      onSuccess()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {rawKey
              ? <T zh="用户创建成功" en="User Created" />
              : <T zh="创建用户" en="Create User" />
            }
          </DialogTitle>
          <DialogDescription>
            {rawKey
              ? <T zh="请保存此 API 密钥，它将不会再次显示。" en="Save this API key securely. It will not be shown again." />
              : <T zh="在当前租户下创建新用户，自动生成 Chat API 密钥。" en="Create a new user in the current tenant with an auto-generated Chat API key." />
            }
          </DialogDescription>
        </DialogHeader>

        {!rawKey ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name"><T zh="姓名" en="Name" /></Label>
              <Input
                id="name"
                placeholder="John Doe"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label><T zh="角色" en="Role" /></Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setValue('role', value as 'admin' | 'developer' | 'viewer')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
              <Button type="button" variant="outline" onClick={handleClose}>
                <T zh="取消" en="Cancel" />
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? <T zh="创建中..." en="Creating..." />
                  : <T zh="创建用户" en="Create User" />
                }
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <T
                  zh="这是唯一一次显示此密钥，请立即复制并安全保存。"
                  en="This is the only time you will see this key. Copy it now and store it securely."
                />
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">API Key</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <code className="flex-1 text-sm font-mono break-all">
                  {rawKey}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {userId && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">User ID</Label>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm font-mono break-all">{userId}</code>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>
                <T zh="完成" en="Done" />
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
