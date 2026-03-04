import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface BundleInfo {
  id: string
  name: string
  description: string
  toolEventTriggers?: Array<{ toolName: string; eventType: string }>
  enabled?: boolean
}

export interface EditBundlesModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  tenantId: string
}

export function EditBundlesModal({
  open,
  onClose,
  onSuccess,
  tenantId,
}: EditBundlesModalProps) {
  const [bundles, setBundles] = useState<BundleInfo[]>([])
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setIsLoading(true)
    apiClient
      .get(`/admin/tenants/${tenantId}/bundles`)
      .then((res) => {
        const data = res.data as { available: BundleInfo[]; enabledBundles: string[] }
        setBundles(data.available)
        setEnabledIds(new Set(data.enabledBundles))
      })
      .catch(() => setError('Failed to load bundles'))
      .finally(() => setIsLoading(false))
  }, [open, tenantId])

  const handleToggle = (bundleId: string, checked: boolean) => {
    setEnabledIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(bundleId)
      else next.delete(bundleId)
      return next
    })
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      await apiClient.patch(`/admin/tenants/${tenantId}/bundles`, {
        enabledBundles: [...enabledIds],
      })
      toast.success('Bundles updated')
      onSuccess()
      onClose()
    } catch (err) {
      const message =
        err instanceof Error && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Failed to update bundles')
          : 'Failed to update bundles'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bundle Configuration</DialogTitle>
          <DialogDescription>
            Enable or disable platform bundles for this tenant.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {bundles.map((bundle) => (
              <div key={bundle.id} className="flex items-start justify-between gap-4 py-2">
                <div className="space-y-1 flex-1">
                  <Label htmlFor={`bundle-${bundle.id}`} className="font-medium">{bundle.name}</Label>
                  <p className="text-xs text-muted-foreground">{bundle.description}</p>
                  {bundle.toolEventTriggers && bundle.toolEventTriggers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {bundle.toolEventTriggers.map((t) => (
                        <Badge key={`${t.toolName}:${t.eventType}`} variant="outline" className="text-[10px]">
                          {t.toolName} → {t.eventType}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Switch
                  id={`bundle-${bundle.id}`}
                  checked={enabledIds.has(bundle.id)}
                  onCheckedChange={(checked) => handleToggle(bundle.id, checked)}
                />
              </div>
            ))}
            {bundles.length === 0 && !error && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No bundles available
              </p>
            )}
          </div>
        )}

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
          <Button onClick={handleSave} disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
