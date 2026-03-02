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
import { Separator } from '@/components/ui/separator'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

export const editConfigSchema = z.object({
  defaultModel: z.string().optional().default(''),
  maxTokensPerRequest: z.coerce.number().int().positive('Must be positive').optional().or(z.literal('')),
  enableSubAgents: z.boolean(),
  enableCustomMcp: z.boolean(),
  enableAnalytics: z.boolean(),
  eventPersistenceEnabled: z.boolean(),
  persistTextDelta: z.boolean(),
  persistThinking: z.boolean(),
  persistToolEvents: z.boolean(),
  persistExploration: z.boolean(),
})

type FormValues = z.infer<typeof editConfigSchema>

interface ConfigData {
  defaultModel?: string
  maxTokensPerRequest?: number
  features?: Record<string, unknown> & {
    enableSubAgents?: boolean
    enableCustomMcp?: boolean
    enableAnalytics?: boolean
    eventPersistence?: {
      enabled?: boolean
      excludeTypes?: string[]
    }
  }
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
  const eventPersistenceEnabled = watch('eventPersistenceEnabled')
  const persistTextDelta = watch('persistTextDelta')
  const persistThinking = watch('persistThinking')
  const persistToolEvents = watch('persistToolEvents')
  const persistExploration = watch('persistExploration')

  useEffect(() => {
    if (open) {
      const ep = currentConfig?.features?.eventPersistence
      const excludeTypes = ep?.excludeTypes ?? []
      reset({
        defaultModel: currentConfig?.defaultModel ?? '',
        maxTokensPerRequest: currentConfig?.maxTokensPerRequest ?? ('' as unknown as undefined),
        enableSubAgents: currentConfig?.features?.enableSubAgents ?? false,
        enableCustomMcp: currentConfig?.features?.enableCustomMcp ?? false,
        enableAnalytics: currentConfig?.features?.enableAnalytics ?? false,
        eventPersistenceEnabled: ep?.enabled !== false,
        persistTextDelta: !excludeTypes.includes('text_delta'),
        persistThinking: !excludeTypes.includes('thinking_start'),
        persistToolEvents: !excludeTypes.includes('tool_start'),
        persistExploration: !excludeTypes.includes('exploration_activity'),
      })
      setError(null)
    }
  }, [open, currentConfig, reset])

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const excludeTypes = [
        ...(!data.persistTextDelta ? ['text_delta'] : []),
        ...(!data.persistThinking ? ['thinking_start', 'thinking_delta', 'thinking_end'] : []),
        ...(!data.persistToolEvents ? ['tool_start', 'tool_end'] : []),
        ...(!data.persistExploration ? ['exploration_activity'] : []),
      ]
      const config = {
        ...currentConfig,
        defaultModel: data.defaultModel || undefined,
        maxTokensPerRequest: typeof data.maxTokensPerRequest === 'number' ? data.maxTokensPerRequest : undefined,
        features: {
          ...currentConfig?.features,
          enableSubAgents: data.enableSubAgents,
          enableCustomMcp: data.enableCustomMcp,
          enableAnalytics: data.enableAnalytics,
          eventPersistence: {
            enabled: data.eventPersistenceEnabled,
            excludeTypes,
          },
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

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="eventPersistenceEnabled" className="text-sm font-medium">Event Persistence</Label>
              <Switch
                id="eventPersistenceEnabled"
                checked={eventPersistenceEnabled}
                onCheckedChange={(checked) => setValue('eventPersistenceEnabled', checked)}
              />
            </div>

            {eventPersistenceEnabled && (
              <div className="ml-4 space-y-3 border-l-2 pl-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="persistTextDelta" className="font-normal">text_delta</Label>
                    <Switch
                      id="persistTextDelta"
                      checked={persistTextDelta}
                      onCheckedChange={(checked) => setValue('persistTextDelta', checked)}
                    />
                  </div>
                  {persistTextDelta && (
                    <p className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      High volume. Content already stored in messages.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="persistThinking" className="font-normal">thinking</Label>
                  <Switch
                    id="persistThinking"
                    checked={persistThinking}
                    onCheckedChange={(checked) => setValue('persistThinking', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="persistToolEvents" className="font-normal">tool events</Label>
                  <Switch
                    id="persistToolEvents"
                    checked={persistToolEvents}
                    onCheckedChange={(checked) => setValue('persistToolEvents', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="persistExploration" className="font-normal">exploration</Label>
                  <Switch
                    id="persistExploration"
                    checked={persistExploration}
                    onCheckedChange={(checked) => setValue('persistExploration', checked)}
                  />
                </div>
              </div>
            )}
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
