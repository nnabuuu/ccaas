import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api-client'
import { useTenantContext } from '@/hooks/use-tenant-context'

const templateSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'Invalid template name format'),
  template: z.object({
    description: z.string().optional(),
    appendSystemPrompt: z.string().optional(),
    enabledSkillSlugs: z.array(z.string()).optional(),
    mcpServers: z.record(z.any()).optional(),
    model: z.string().optional(),
  }),
})

type TemplateFormData = z.infer<typeof templateSchema>

export function SessionTemplateFormPage() {
  const navigate = useNavigate()
  const { name } = useParams()
  const { selectedTenantId } = useTenantContext()
  const isEdit = !!name

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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

  // Load existing template for edit mode
  useEffect(() => {
    if (isEdit && name) {
      const loadTemplate = async () => {
        try {
          const { data } = await apiClient.get(
            `/admin/tenants/${selectedTenantId || 'default'}/session-templates/${name}`
          )
          setValue('name', data.name)
          setValue('template', data.template)
        } catch (error) {
          console.error('Failed to load template:', error)
          alert('Failed to load template')
        }
      }
      loadTemplate()
    }
  }, [isEdit, name, selectedTenantId, setValue])

  const onSubmit = async (data: TemplateFormData) => {
    try {
      const tenantId = selectedTenantId || 'default'
      if (isEdit) {
        await apiClient.put(
          `/admin/tenants/${tenantId}/session-templates/${name}`,
          { template: data.template }
        )
      } else {
        await apiClient.post(
          `/admin/tenants/${tenantId}/session-templates`,
          data
        )
      }
      navigate('/session-templates')
    } catch (error) {
      console.error('Failed to save template:', error)
      alert('Failed to save template')
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const slugs = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    setValue('template.enabledSkillSlugs', slugs)
                  }}
                  defaultValue={
                    // eslint-disable-next-line react-hooks/incompatible-library
                    watch('template.enabledSkillSlugs')?.join(', ')
                  }
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
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      setValue('template.mcpServers', parsed)
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  defaultValue={JSON.stringify(watch('template.mcpServers') || {}, null, 2)}
                />
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
