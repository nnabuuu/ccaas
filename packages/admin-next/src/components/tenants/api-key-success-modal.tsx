import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'

interface ApiKeySuccessModalProps {
  open: boolean
  tenant: any
  apiKey?: any
  rawKey?: string
  onClose: () => void
}

export function ApiKeySuccessModal({
  open,
  tenant,
  apiKey,
  rawKey,
  onClose,
}: ApiKeySuccessModalProps) {
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const navigate = useNavigate()

  const handleCopy = async () => {
    if (rawKey) {
      await navigator.clipboard.writeText(rawKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('API key copied to clipboard')
    }
  }

  const handleDone = () => {
    onClose()
    navigate(`/tenants/${tenant.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && confirmed && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Tenant Created Successfully!
          </DialogTitle>
          <DialogDescription>
            Your new tenant has been created and is ready to use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tenant Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tenant Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{tenant.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Slug</p>
                <p className="font-mono text-sm">{tenant.slug}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <Badge className="capitalize">{tenant.plan}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="outline">{tenant.status}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* API Key (if created) */}
          {rawKey && (
            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  API Key - Save Now!
                </CardTitle>
                <CardDescription className="text-yellow-900 dark:text-yellow-100">
                  This is the <strong>only time</strong> this key will be displayed. Copy it now
                  and store it securely.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 rounded-md border">
                  <code className="flex-1 text-sm font-mono break-all">{rawKey}</code>
                  <Button size="icon" variant="ghost" onClick={handleCopy} className="shrink-0">
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {apiKey && (
                  <div className="text-sm space-y-1">
                    <p>
                      <strong>Key Name:</strong> {apiKey.name}
                    </p>
                    <p>
                      <strong>Scopes:</strong> {apiKey.scopes.join(', ')}
                    </p>
                    <p>
                      <strong>Rate Limit:</strong> {apiKey.rateLimitRpm} req/min,{' '}
                      {apiKey.rateLimitRpd} req/day
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="confirm-copied"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="confirm-copied" className="font-medium text-sm">
                    I have copied and saved the API key securely
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleDone} disabled={!!rawKey && !confirmed}>
            {rawKey ? 'Done - Go to Tenant' : 'View Tenant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
