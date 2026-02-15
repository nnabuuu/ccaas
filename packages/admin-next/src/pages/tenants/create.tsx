import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CreateTenantForm } from '@/components/tenants/create-form'
import { ApiKeySuccessModal } from '@/components/tenants/api-key-success-modal'

interface TenantData {
  id: string
  name: string
  slug: string
  plan: string
  status: string
}

interface ApiKeyData {
  name: string
  scopes: string[]
  rateLimitRpm: number
  rateLimitRpd: number
}

interface CreatedData {
  tenant: TenantData
  apiKey?: ApiKeyData
  rawKey?: string
}

export function CreateTenantPage() {
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [createdData, setCreatedData] = useState<CreatedData | null>(null)

  const handleSuccess = (data: CreatedData) => {
    setCreatedData(data)
    setShowSuccessModal(true)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Tenant</h1>
        <p className="text-muted-foreground">
          Create a new tenant for a solution or organization
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CreateTenantForm onSuccess={handleSuccess} />
        </CardContent>
      </Card>

      <ApiKeySuccessModal
        open={showSuccessModal}
        tenant={createdData?.tenant}
        apiKey={createdData?.apiKey}
        rawKey={createdData?.rawKey}
        onClose={() => setShowSuccessModal(false)}
      />
    </div>
  )
}
