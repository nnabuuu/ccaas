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
    `flex-1 py-2 text-sm font-medium text-center rounded-lg transition-colors ${
      tab === t
        ? 'bg-[var(--bg1)] text-[var(--t1)] shadow-sm'
        : 'text-[var(--t3)] hover:text-[var(--t2)]'
    }`

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--bg2)]">
      <div className="w-full max-w-sm mx-4 p-6 rounded-xl bg-[var(--bg1)] border border-[var(--b1)] shadow-sm">
        <h1 className="text-lg font-semibold text-[var(--t1)] mb-1">
          开发调试
        </h1>
        <p className="text-sm text-[var(--t3)] mb-4">
          登录连接后端
        </p>

        {/* Tabs */}
        <div className="flex gap-1 p-1 mb-4 rounded-lg bg-[var(--bg2)]">
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
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--b1)] bg-[var(--bg1)] text-[var(--t1)] text-sm placeholder:text-[var(--t3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t3)]/30"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (credError) setCredError('') }}
              placeholder="密码"
              className="w-full mt-3 px-3 py-2.5 rounded-lg border border-[var(--b1)] bg-[var(--bg1)] text-[var(--t1)] text-sm placeholder:text-[var(--t3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t3)]/30"
            />
            {credError && (
              <p className="mt-2 text-xs text-[var(--danger-t)]">{credError}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium bg-[var(--t1)] text-[var(--bg1)] hover:opacity-90 transition-opacity disabled:opacity-50"
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
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--b1)] bg-[var(--bg1)] text-[var(--t1)] text-sm placeholder:text-[var(--t3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t3)]/30"
            />
            {apiKeyError && (
              <p className="mt-2 text-xs text-[var(--danger-t)]">{apiKeyError}</p>
            )}
            <button
              type="submit"
              className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium bg-[var(--t1)] text-[var(--bg1)] hover:opacity-90 transition-opacity"
            >
              连接
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
