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
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

export const editConfigSchema = z.object({
  defaultModel: z.string().optional().default(''),
  maxTokensPerRequest: z.coerce.number().int().positive('Must be positive').optional().or(z.literal('')),
  enableSubAgents: z.boolean(),
  enableCustomMcp: z.boolean(),
  enableAnalytics: z.boolean(),
})

type FormValues = z.infer<typeof editConfigSchema>

interface ConfigData {
  defaultModel?: string
  maxTokensPerRequest?: number
  features?: Record<string, boolean>
  [key: string]: unknown
}

export interface EditConfigModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  tenantId: string
  currentConfig?: ConfigData
}

export function EditConfigModal({
  open,
  onClose,
  onSuccess,
  tenantId,
  currentConfig,
}: EditConfigModalProps) {
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
    resolver: zodResolver(editConfigSchema),
  })

  const enableSubAgents = watch('enableSubAgents')
  const enableCustomMcp = watch('enableCustomMcp')
  const enableAnalytics = watch('enableAnalytics')

  useEffect(() => {
    if (open) {
      reset({
        defaultModel: currentConfig?.defaultModel ?? '',
        maxTokensPerRequest: currentConfig?.maxTokensPerRequest ?? ('' as unknown as undefined),
        enableSubAgents: currentConfig?.features?.enableSubAgents ?? false,
        enableCustomMcp: currentConfig?.features?.enableCustomMcp ?? false,
        enableAnalytics: currentConfig?.features?.enableAnalytics ?? false,
      })
      setError(null)
    }
  }, [open, currentConfig, reset])

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const config = {
        ...currentConfig,
        defaultModel: data.defaultModel || undefined,
        maxTokensPerRequest: typeof data.maxTokensPerRequest === 'number' ? data.maxTokensPerRequest : undefined,
        features: {
          ...currentConfig?.features,
          enableSubAgents: data.enableSubAgents,
          enableCustomMcp: data.enableCustomMcp,
          enableAnalytics: data.enableAnalytics,
        },
      }
      await apiClient.put(`/admin/tenants/${tenantId}/sdk-config`, { config })
      toast.success('Configuration updated successfully')
      onSuccess()
      onClose()
    } catch (err) {
      const message =
        err instanceof Error && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Failed to update configuration')
          : 'Failed to update configuration'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Configuration</DialogTitle>
          <DialogDescription>
            Update SDK configuration and feature flags.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultModel">Default Model</Label>
            <Input id="defaultModel" {...register('defaultModel')} placeholder="e.g. claude-sonnet-4-5-20250514" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTokensPerRequest">Max Tokens per Request</Label>
            <Input
              id="maxTokensPerRequest"
              type="number"
              min={1}
              {...register('maxTokensPerRequest')}
            />
            {errors.maxTokensPerRequest && (
              <p className="text-sm text-destructive">{errors.maxTokensPerRequest.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Features</Label>

            <div className="flex items-center justify-between">
              <Label htmlFor="enableSubAgents" className="font-normal">Enable Sub-Agents</Label>
              <Switch
                id="enableSubAgents"
                checked={enableSubAgents}
                onCheckedChange={(checked) => setValue('enableSubAgents', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enableCustomMcp" className="font-normal">Enable Custom MCP</Label>
              <Switch
                id="enableCustomMcp"
                checked={enableCustomMcp}
                onCheckedChange={(checked) => setValue('enableCustomMcp', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enableAnalytics" className="font-normal">Enable Analytics</Label>
              <Switch
                id="enableAnalytics"
                checked={enableAnalytics}
                onCheckedChange={(checked) => setValue('enableAnalytics', checked)}
              />
            </div>
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
