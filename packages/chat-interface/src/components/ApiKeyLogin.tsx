import { useState, useCallback } from 'react'

export interface ApiKeyLoginProps {
  onLogin: (apiKey: string) => void
  serverUrl?: string
}

type Tab = 'credentials' | 'apikey'

export function ApiKeyLogin({ onLogin, serverUrl }: ApiKeyLoginProps) {
  const [tab, setTab] = useState<Tab>('credentials')

  // API Key state
  const [apiKeyValue, setApiKeyValue] = useState('')
  const [apiKeyError, setApiKeyError] = useState('')

  // Credentials state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [credError, setCredError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleApiKeySubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = apiKeyValue.trim()
      if (!trimmed) {
        setApiKeyError('请输入 API Key')
        return
      }
      if (trimmed.length < 8) {
        setApiKeyError('API Key 格式无效')
        return
      }
      setApiKeyError('')
      onLogin(trimmed)
    },
    [apiKeyValue, onLogin],
  )

  const handleCredSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!username.trim()) {
        setCredError('请输入用户名')
        return
      }
      if (!password) {
        setCredError('请输入密码')
        return
      }
      if (!serverUrl) {
        setCredError('serverUrl 未配置')
        return
      }
      setCredError('')
      setLoading(true)
      try {
        const res = await fetch(`${serverUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setCredError(data.message || `登录失败 (${res.status})`)
          return
        }
        const data = await res.json()
        if (data.apiKey) {
          onLogin(data.apiKey)
        } else {
          setCredError('返回数据缺少 apiKey')
        }
      } catch (err) {
        setCredError(`网络错误: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setLoading(false)
      }
    },
    [username, password, serverUrl, onLogin],
  )

  const tabClass = (t: Tab) =>
    `flex-1 py-2 text-sm font-medium text-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent ${
      tab === t
        ? 'bg-ck-bg1 text-ck-t1'
        : 'text-ck-t3 hover:text-ck-t2'
    }`

  return (
    <div className="min-h-dvh flex items-center justify-center bg-ck-bg2">
      <div className="w-full max-w-sm mx-4 p-6 rounded-xl bg-ck-bg1 border border-ck-b1">
        <h1 className="text-lg font-medium text-ck-t1 mb-1">
          开发调试
        </h1>
        <p className="text-sm text-ck-t3 mb-4">
          登录连接后端
        </p>

        {/* Tabs */}
        <div className="flex gap-1 p-1 mb-4 rounded-lg bg-ck-bg2">
          <button type="button" className={tabClass('credentials')} onClick={() => setTab('credentials')}>
            账号登录
          </button>
          <button type="button" className={tabClass('apikey')} onClick={() => setTab('apikey')}>
            API Key
          </button>
        </div>

        {tab === 'credentials' ? (
          <form onSubmit={handleCredSubmit}>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); if (credError) setCredError('') }}
              placeholder="用户名"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-ck-b1 bg-ck-bg1 text-ck-t1 text-sm placeholder:text-ck-t3 outline-none focus-visible:ring-2 focus-visible:ring-ck-accent"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (credError) setCredError('') }}
              placeholder="密码"
              className="w-full mt-3 px-3 py-2.5 rounded-lg border border-ck-b1 bg-ck-bg1 text-ck-t1 text-sm placeholder:text-ck-t3 outline-none focus-visible:ring-2 focus-visible:ring-ck-accent"
            />
            {credError && (
              <p className="mt-2 text-xs text-ck-danger-t">{credError}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium bg-ck-t1 text-ck-bg1 hover:opacity-90 transition-opacity ease-claude disabled:opacity-50 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleApiKeySubmit}>
            <input
              type="password"
              value={apiKeyValue}
              onChange={(e) => { setApiKeyValue(e.target.value); if (apiKeyError) setApiKeyError('') }}
              placeholder="sk-..."
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-ck-b1 bg-ck-bg1 text-ck-t1 text-sm placeholder:text-ck-t3 outline-none focus-visible:ring-2 focus-visible:ring-ck-accent"
            />
            {apiKeyError && (
              <p className="mt-2 text-xs text-ck-danger-t">{apiKeyError}</p>
            )}
            <button
              type="submit"
              disabled={!apiKeyValue.trim()}
              className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium bg-ck-t1 text-ck-bg1 hover:opacity-90 transition-opacity ease-claude disabled:opacity-50 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent"
            >
              连接
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
