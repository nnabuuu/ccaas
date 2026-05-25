import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { taskDemoApi, type Respondent } from './useTaskDemoApi'

/**
 * AdminMode — overview of every respondent for /task-demo/:code/admin.
 *
 * Currently unauthenticated (matches the /api/classroom/* posture); see the
 * plan's "out of scope" — add a ?token= guard before public deploy.
 */
export function AdminMode({ code }: { code: string }) {
  const [respondents, setRespondents] = useState<Respondent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setError(null)
    taskDemoApi
      .respondents(code)
      .then((rs) => { if (!cancelled) setRespondents(rs) })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)) })
    return () => { cancelled = true }
  }, [code])

  return (
    <Frame title={`Admin · ${code}`}>
      <ShareLinks code={code} />
      {error && <ErrorBlock message={error} />}
      {!error && !respondents && <Loading />}
      {respondents && respondents.length === 0 && (
        <Empty hint="尚无人答题。把上面的 URL 分享给客户即可。" />
      )}
      {respondents && respondents.length > 0 && (
        <RespondentTable
          respondents={respondents}
          onPick={(name) => navigate(`/task-demo/${code}/replay?user=${encodeURIComponent(name)}`)}
        />
      )}
    </Frame>
  )
}

function ShareLinks({ code }: { code: string }) {
  const answerUrl = `${window.location.origin}/task-demo/${code}`
  return (
    <div
      style={{
        background: '#fbfaf7',
        border: '1px solid rgba(28,28,26,.07)',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 18,
      }}
    >
      <div style={{ fontSize: 11, color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>
        分享给客户答题
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          readOnly
          value={answerUrl}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: 1,
            padding: '8px 10px',
            fontFamily: 'ui-monospace, "SF Mono", monospace',
            fontSize: 12,
            border: '1px solid rgba(28,28,26,.14)',
            borderRadius: 4,
            background: '#fff',
            color: '#1c1c1a',
          }}
        />
        <button
          onClick={() => navigator.clipboard?.writeText(answerUrl)}
          style={{
            padding: '8px 14px',
            background: '#1c1c1a',
            color: '#f0efe8',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          复制
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#9c9a92', marginTop: 8 }}>
        客户打开会被要求输入名字；也可以直接发 <code style={mono}>?user=alice</code> 跳过弹窗。
      </div>
    </div>
  )
}

function RespondentTable({
  respondents,
  onPick,
}: {
  respondents: Respondent[]
  onPick: (name: string) => void
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid rgba(28,28,26,.14)' }}>
          <Th>姓名</Th>
          <Th align="right">尝试次数</Th>
          <Th align="right">最新得分</Th>
          <Th align="right">最近提交</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {respondents.map((r) => (
          <tr
            key={r.studentId}
            style={{
              borderBottom: '1px solid rgba(28,28,26,.07)',
              cursor: 'pointer',
            }}
            onClick={() => onPick(r.name)}
          >
            <Td><strong style={{ color: '#1c1c1a' }}>{r.name}</strong></Td>
            <Td align="right">{r.attemptCount}</Td>
            <Td align="right"><ScoreBadge score={r.latestScore} /></Td>
            <Td align="right" style={{ color: '#9c9a92', fontSize: 11 }}>
              {r.latestSubmittedAt ? new Date(r.latestSubmittedAt).toLocaleString() : '—'}
            </Td>
            <Td align="right">
              <span style={{ color: '#0d5245', fontSize: 12, fontWeight: 600 }}>查看回放 →</span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ScoreBadge({ score }: { score: Record<string, unknown> | null }) {
  const total = typeof score?.total === 'number' ? (score.total as number) : null
  if (total === null) return <span style={{ color: '#9c9a92' }}>—</span>
  const color = total === 100 ? '#2d6612' : total === 0 ? '#942929' : '#7a4d0e'
  return (
    <span style={{ fontWeight: 700, color }}>{total}%</span>
  )
}

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", monospace',
  background: 'rgba(28,28,26,.06)',
  padding: '1px 5px',
  borderRadius: 3,
  fontSize: 11,
}

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      textAlign: align,
      padding: '8px 10px',
      fontSize: 11,
      fontWeight: 600,
      color: '#9c9a92',
      textTransform: 'uppercase',
      letterSpacing: '.4px',
    }}>{children}</th>
  )
}

function Td({
  children,
  align = 'left',
  style,
}: {
  children?: React.ReactNode
  align?: 'left' | 'right'
  style?: React.CSSProperties
}) {
  return (
    <td style={{ textAlign: align, padding: '10px', color: '#5c5b56', ...style }}>{children}</td>
  )
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f3ef',
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      }}
    >
      <header
        style={{
          padding: '10px 20px',
          background: '#fbfaf7',
          borderBottom: '1px solid rgba(28,28,26,.07)',
          fontSize: 13,
          color: '#5c5b56',
        }}
      >
        <strong style={{ color: '#1c1c1a' }}>Task Demo</strong> · {title}
      </header>
      <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

function Loading() {
  return <div style={{ padding: 40, color: '#9c9a92' }}>Loading…</div>
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div style={{ padding: 18, background: '#f5dada', borderRadius: 6, color: '#942929' }}>
      {message}
    </div>
  )
}

function Empty({ hint }: { hint: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9c9a92' }}>
      <div style={{ fontSize: 14 }}>{hint}</div>
    </div>
  )
}
