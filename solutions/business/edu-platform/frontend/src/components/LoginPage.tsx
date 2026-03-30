import { useState } from 'react'

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (data: { username: string; password: string; name: string; school?: string }) => Promise<void>
  isLoading: boolean
  error: string | null
}

const inputClass = 'w-full px-3 py-2 text-[13px] outline-none bg-ck-bg1 text-ck-t1 border-[0.5px] border-ck-b1 rounded-ck placeholder:text-ck-t3 focus:border-ck-info-t transition-colors'

export function LoginPage({ onLogin, onRegister, isLoading, error }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [school, setSchool] = useState('树人中学')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      onLogin(username, password)
    } else {
      onRegister({ username, password, name, school: school || undefined })
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 bg-ck-bg2">
      <div className="w-full max-w-[340px] p-6 bg-ck-bg1 border-[0.5px] border-ck-b1 rounded-ck-lg">
        <h1 className="text-[16px] font-medium mb-1 text-ck-t1">
          精准教学平台
        </h1>
        <p className="text-[12px] mb-5 text-ck-t3">
          {mode === 'login' ? '登录账户' : '注册新账户'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={inputClass}
          />

          {mode === 'register' && (
            <>
              <input
                type="text"
                placeholder="姓名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="text"
                placeholder="学校"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className={inputClass}
              />
            </>
          )}

          {error && (
            <p className="text-[12px] text-ck-danger-t">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 text-[13px] font-medium bg-ck-t1 text-ck-bg1 border-[0.5px] border-ck-t1 rounded-ck cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            {isLoading ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-ck-t2">
          {mode === 'login' ? (
            <>
              没有账户？{' '}
              <button
                onClick={() => setMode('register')}
                className="underline text-[12px] text-ck-info-t bg-transparent border-none cursor-pointer"
              >
                注册
              </button>
            </>
          ) : (
            <>
              已有账户？{' '}
              <button
                onClick={() => setMode('login')}
                className="underline text-[12px] text-ck-info-t bg-transparent border-none cursor-pointer"
              >
                登录
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
