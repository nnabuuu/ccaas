import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'
import { T } from '@/components/shared/t'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().optional(),
  plan: z.enum(['free', 'paid', 'starter', 'professional', 'enterprise']),
  maxSessions: z.number().min(1).default(100),
  maxSkills: z.number().min(1).default(50),
  autoCreateApiKey: z.boolean().default(true),
})

type FormData = z.infer<typeof schema>

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

interface CreateTenantFormProps {
  onSuccess: (data: { tenant: TenantData; apiKey?: ApiKeyData; rawKey?: string }) => void
}

export function CreateTenantForm({ onSuccess }: CreateTenantFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoCreateApiKey, setAutoCreateApiKey] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      plan: 'free',
      maxSessions: 100,
      maxSkills: 50,
      autoCreateApiKey: true,
    },
  })

  const name = watch('name')

  // Auto-generate slug from name
  useEffect(() => {
    if (name) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setValue('slug', generatedSlug)
    }
  }, [name, setValue])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await apiClient.post('/tenants', {
        ...data,
        autoCreateApiKey,
      })
      onSuccess(response.data)
    } catch (err) {
      const errorMessage = err instanceof Error && 'response' in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to create tenant')
        : 'Failed to create tenant'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name"><T zh="租户名称 *" en="Tenant Name *" /></Label>
        <Input
          id="name"
          placeholder="My Solution Company"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug *</Label>
        <Input
          id="slug"
          placeholder="my-solution-company"
          {...register('slug')}
        />
        <p className="text-sm text-muted-foreground">
          <T zh="从名称自动生成（可编辑）" en="Auto-generated from name (can be edited)" />
        </p>
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description"><T zh="描述" en="Description" /></Label>
        <textarea
          id="description"
          placeholder="Optional description..."
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('description')}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="plan"><T zh="计划" en="Plan" /></Label>
          <Select
            defaultValue="free"
            onValueChange={(value) =>
              setValue('plan', value as 'free' | 'paid' | 'starter' | 'professional' | 'enterprise')
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxSessions"><T zh="最大会话数" en="Max Sessions" /></Label>
          <Input
            id="maxSessions"
            type="number"
            {...register('maxSessions', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxSkills"><T zh="最大技能数" en="Max Skills" /></Label>
          <Input
            id="maxSkills"
            type="number"
            {...register('maxSkills', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="autoCreateApiKey"
          checked={autoCreateApiKey}
          onChange={(e) => setAutoCreateApiKey(e.target.checked)}
          className="mt-1"
        />
        <div>
          <Label htmlFor="autoCreateApiKey" className="font-medium">
            <T zh="自动创建 API 密钥" en="Auto-create API Key" />
          </Label>
          <p className="text-sm text-muted-foreground">
            <T zh="推荐：创建默认 API 密钥以立即使用" en="Recommended: Creates a default API key for immediate use" />
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
        >
          <T zh="取消" en="Cancel" />
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <T zh="创建中..." en="Creating..." /> : <T zh="创建租户" en="Create Tenant" />}
        </Button>
      </div>
    </form>
  )
}
