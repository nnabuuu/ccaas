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
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { T } from '@/components/shared/t'

/** Scopes available for selection (admin/builder are excluded — those are managed separately) */
const AVAILABLE_SCOPES = [
  { value: 'chat', label: 'Chat', description: 'Send messages to sessions' },
  { value: 'skills:read', label: 'Skills: Read', description: 'List and read skills' },
  { value: 'skills:write', label: 'Skills: Write', description: 'Create and update skills' },
  { value: 'skills:execute', label: 'Skills: Execute', description: 'Execute skills in sessions' },
  { value: 'skills:delete', label: 'Skills: Delete', description: 'Delete skills' },
  { value: 'mcp:read', label: 'MCP: Read', description: 'List MCP servers' },
  { value: 'mcp:write', label: 'MCP: Write', description: 'Configure MCP servers' },
  { value: 'analytics:read', label: 'Analytics: Read', description: 'View analytics data' },
] as const

const DEFAULT_SCOPES = ['chat', 'skills:read', 'skills:execute']

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
})

interface CreateApiKeyModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateApiKeyModal({ open, onClose, onSuccess }: CreateApiKeyModalProps) {
  const { selectedTenantId } = useTenantContext()
  const [rawKey, setRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedScopes, setSelectedScopes] = useState<string[]>(DEFAULT_SCOPES)

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  })

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    )
  }

  const onSubmit = async (data: z.infer<typeof schema>) => {
    if (selectedScopes.length === 0) {
      setError('Select at least one scope')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await apiClient.post('/admin/api-keys', {
        ...data,
        tenantId: selectedTenantId,
        scopes: selectedScopes,
      })
      setRawKey(response.data.rawKey)
      window.dispatchEvent(new CustomEvent('api-key-updated'))
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
    setSelectedScopes(DEFAULT_SCOPES)
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
              <Label>Scopes</Label>
              <p className="text-xs text-muted-foreground">
                <T
                  zh="这些密钥用于 SDK/前端使用。Admin 和 Builder 密钥通过 Builder Users API 创建。"
                  en="These keys are for SDK/frontend use. Admin and Builder keys are created via the Builder Users API."
                />
              </p>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_SCOPES.map(scope => (
                  <label
                    key={scope.value}
                    className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedScopes.includes(scope.value)}
                      onCheckedChange={() => toggleScope(scope.value)}
                    />
                    <div className="text-sm leading-tight">
                      <div className="font-medium">{scope.label}</div>
                      <div className="text-xs text-muted-foreground">{scope.description}</div>
                    </div>
                  </label>
                ))}
              </div>
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
              <Button type="submit" disabled={isSubmitting || selectedScopes.length === 0}>
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
