import { useOne, useCreate, useUpdate } from '@refinedev/core'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTenantContext } from '@/hooks/use-tenant-context'

const templateSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'Invalid template name format'),
  template: z.object({
    description: z.string().optional(),
    appendSystemPrompt: z.string().optional(),
    enabledSkillSlugs: z.array(z.string()).optional(),
    mcpServers: z.record(z.any()).optional(),
    model: z.string().optional(),
    sessionTtlMs: z.number().int().min(60000).optional(),
    autoClose: z.boolean().optional(),
  }),
})

type TemplateFormData = z.infer<typeof templateSchema>

export function SessionTemplateFormPage() {
  const navigate = useNavigate()
  const { name } = useParams()
  const { selectedTenantId } = useTenantContext()
  const tenantId = selectedTenantId || 'default'
  const isEdit = !!name

  // Controlled state for non-standard inputs
  const [skillsValue, setSkillsValue] = useState('')
  const [mcpValue, setMcpValue] = useState('{}')
  const [mcpError, setMcpError] = useState<string | null>(null)
  const [ttlMinutes, setTtlMinutes] = useState('')
  const [autoClose, setAutoClose] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      template: {
        description: '',
        appendSystemPrompt: '',
        enabledSkillSlugs: [],
        mcpServers: {},
      },
    },
  })

  // Load existing template in edit mode
  const { data: templateData } = useOne<{ name: string; template: TemplateFormData['template'] }>({
    resource: 'session-templates',
    id: name!,
    queryOptions: { enabled: isEdit },
    meta: { tenantId },
  })

  useEffect(() => {
    if (templateData?.data) {
      const { name: loadedName, template } = templateData.data
      setValue('name', loadedName)
      setValue('template', template)
      setSkillsValue((template.enabledSkillSlugs || []).join(', '))
      setMcpValue(JSON.stringify(template.mcpServers || {}, null, 2))
      if ((template as any).sessionTtlMs) {
        setTtlMinutes(String(Math.round((template as any).sessionTtlMs / 60000)))
      }
      if ((template as any).autoClose) {
        setAutoClose(true)
        setValue('template.autoClose', true)
      }
    }
  }, [templateData, setValue])

  const { mutateAsync: createTemplate } = useCreate()
  const { mutateAsync: updateTemplate } = useUpdate()

  const onSubmit = async (data: TemplateFormData) => {
    try {
      if (isEdit) {
        await updateTemplate({
          resource: 'session-templates',
          id: name!,
          values: { template: data.template },
          meta: { tenantId },
        })
      } else {
        await createTemplate({
          resource: 'session-templates',
          values: data,
          meta: { tenantId },
        })
      }
      toast.success(isEdit ? 'Template updated' : 'Template created')
      navigate('/session-templates')
    } catch {
      toast.error('Failed to save template')
    }
  }

  const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSkillsValue(e.target.value)
    const slugs = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
    setValue('template.enabledSkillSlugs', slugs)
  }

  const handleMcpChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value
    setMcpValue(raw)
    try {
      const parsed = JSON.parse(raw)
      setValue('template.mcpServers', parsed)
      setMcpError(null)
    } catch {
      setMcpError('Invalid JSON')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-8">
      <h1 className="text-3xl font-bold">
        {isEdit ? 'Edit Template' : 'Create Template'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="teacher-analysis"
                disabled={isEdit}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('template.description')}
                placeholder="Teacher view - full analysis features"
              />
            </div>

            <div>
              <Label htmlFor="sessionTtlMinutes">Session Timeout (minutes)</Label>
              <Input
                id="sessionTtlMinutes"
                type="number"
                min={1}
                placeholder="Leave blank to use tenant default"
                value={ttlMinutes}
                onChange={(e) => {
                  const val = e.target.value
                  setTtlMinutes(val)
                  setValue(
                    'template.sessionTtlMs',
                    val ? Number(val) * 60000 : undefined,
                  )
                }}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Override session TTL for this template (max set by plan tier).
              </p>
            </div>

            <div>
              <Label htmlFor="model">Model Override (optional)</Label>
              <Input
                id="model"
                {...register('template.model')}
                placeholder="claude-opus-4-6 (leave blank to use tenant default)"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="autoClose">One-shot Mode (Auto-close after response)</Label>
                <p className="text-sm text-muted-foreground">
                  Session is destroyed after each response. Use for stateless, one-off API calls.
                </p>
              </div>
              <Switch
                id="autoClose"
                checked={autoClose}
                onCheckedChange={(checked) => {
                  setAutoClose(checked)
                  setValue('template.autoClose', checked || undefined)
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="prompt" className="mt-6">
          <TabsList>
            <TabsTrigger value="prompt">System Prompt</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
          </TabsList>

          <TabsContent value="prompt">
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="systemPrompt">Append System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  {...register('template.appendSystemPrompt')}
                  placeholder="You are an educational analyst..."
                  rows={10}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skills">
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="skills">Enabled Skill Slugs (comma-separated)</Label>
                <Input
                  id="skills"
                  placeholder="knowledge-matching, complete-analysis"
                  value={skillsValue}
                  onChange={handleSkillsChange}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mcp">
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="mcpServers">MCP Servers (JSON)</Label>
                <Textarea
                  id="mcpServers"
                  placeholder={`{\n  "server-name": {\n    "command": "node",\n    "args": ["server.js"]\n  }\n}`}
                  rows={10}
                  className="font-mono text-sm"
                  value={mcpValue}
                  onChange={handleMcpChange}
                />
                {mcpError && (
                  <p className="text-sm text-red-500 mt-1">{mcpError}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-4 mt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/session-templates')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
