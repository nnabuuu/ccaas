import { useState } from 'react'

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (data: { username: string; password: string; name: string; school?: string }) => Promise<void>
  isLoading: boolean
  error: string | null
}

const inputClass = 'w-full px-3 py-2 text-[13px] outline-none edu-login-input'

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
    <>
      <style>{`
        .edu-login-input {
          background: var(--bg1);
          color: var(--t1);
          border: 0.5px solid var(--b1);
          border-radius: var(--r);
        }
        .edu-login-input:focus {
          border-color: var(--info-t);
        }
        .edu-login-input::placeholder {
          color: var(--t3);
        }
      `}</style>
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg2)' }}>
        <div
          className="w-[340px] p-6"
          style={{
            background: 'var(--bg1)',
            border: '0.5px solid var(--b1)',
            borderRadius: 'var(--rl)',
          }}
        >
          <h1
            className="text-[16px] font-medium mb-1"
            style={{ color: 'var(--t1)' }}
          >
            精准教学平台
          </h1>
          <p className="text-[12px] mb-5" style={{ color: 'var(--t3)' }}>
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
              <p className="text-[12px]" style={{ color: 'var(--danger-t)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 text-[13px] font-medium"
              style={{
                background: 'var(--t1)',
                color: 'var(--bg1)',
                border: '0.5px solid var(--t1)',
                borderRadius: 'var(--r)',
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
            </button>
          </form>

          <p className="mt-4 text-center text-[12px]" style={{ color: 'var(--t2)' }}>
            {mode === 'login' ? (
              <>
                没有账户？{' '}
                <button
                  onClick={() => setMode('register')}
                  className="underline"
                  style={{ color: 'var(--info-t)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                >
                  注册
                </button>
              </>
            ) : (
              <>
                已有账户？{' '}
                <button
                  onClick={() => setMode('login')}
                  className="underline"
                  style={{ color: 'var(--info-t)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                >
                  登录
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </>
  )
}
