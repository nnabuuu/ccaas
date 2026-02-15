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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  name: z.string().min(1, 'Name is required'),
})

interface CreateApiKeyModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateApiKeyModal({ open, onClose, onSuccess }: CreateApiKeyModalProps) {
  const [rawKey, setRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: 'default',
      name: '',
    },
  })

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await apiClient.post('/admin/api-keys', {
        ...data,
        scopes: ['chat', 'skills:read'],
      })
      setRawKey(response.data.rawKey)
    } catch (err) {
      const message = err instanceof Error && 'response' in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to create API key')
        : 'Failed to create API key'
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
    reset()
    setRawKey(null)
    setCopied(false)
    setError(null)
    onClose()
    if (rawKey) {
      onSuccess()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {rawKey ? 'API Key Created' : 'Create API Key'}
          </DialogTitle>
          <DialogDescription>
            {rawKey
              ? 'Save this key securely. It will not be shown again.'
              : 'Create a new API key for accessing the platform.'}
          </DialogDescription>
        </DialogHeader>

        {!rawKey ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Production API Key"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenantId">Tenant ID</Label>
              <Input
                id="tenantId"
                placeholder="default"
                {...register('tenantId')}
              />
              {errors.tenantId && (
                <p className="text-sm text-destructive">{errors.tenantId.message}</p>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Key'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This is the only time you will see this key. Copy it now and store it securely.
              </AlertDescription>
            </Alert>

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

            <DialogFooter>
              <Button onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
