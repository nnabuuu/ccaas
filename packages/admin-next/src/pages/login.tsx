import { useState } from 'react'
import { useLogin } from '@refinedev/core'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { KeyRound } from 'lucide-react'

export function LoginPage() {
  const [apiKey, setApiKey] = useState('')
  const { mutate: login, isLoading } = useLogin()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login({ apiKey })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold">
            C
          </div>
          <CardTitle className="text-2xl">CCaaS Admin</CardTitle>
          <CardDescription>Enter your API key to access the admin dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={!apiKey || isLoading}>
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
