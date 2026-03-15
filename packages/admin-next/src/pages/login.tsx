import { useState } from 'react'
import { useLogin } from '@refinedev/core'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { KeyRound } from 'lucide-react'
import { T } from '@/components/shared/t'

export function LoginPage() {
  const [apiKey, setApiKey] = useState('')
  const { mutate: login, isLoading, error } = useLogin()

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
          <CardDescription>
            <T zh="输入 API 密钥以访问管理后台" en="Enter your API key to access the admin dashboard" />
          </CardDescription>
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
              <p className="text-xs text-muted-foreground mt-1">
                <T zh="支持 Admin 和 Builder API 密钥" en="Supports Admin and Builder API keys" />
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive">{(error as Error).message}</p>
            )}
            <Button type="submit" className="w-full" disabled={!apiKey || isLoading}>
              {isLoading ? <T zh="认证中..." en="Authenticating..." /> : <T zh="登录" en="Sign In" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
