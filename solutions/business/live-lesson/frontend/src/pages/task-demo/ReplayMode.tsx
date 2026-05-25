// Placeholder — P3 replaces this with the submit-by-submit scrubber.
export function ReplayMode({ code, userParam }: { code: string; userParam: string }) {
  return (
    <PlaceholderFrame title="Replay 模式">
      <p>P3 will land here.</p>
      <code>code={code}, user={userParam || '(missing)'}</code>
    </PlaceholderFrame>
  )
}

// Inline frame so this stub stays self-contained.
function PlaceholderFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f3ef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ background: '#fbfaf7', padding: 32, borderRadius: 12, textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', margin: '0 0 12px' }}>{title}</h2>
        <div style={{ fontSize: 13, color: '#5c5b56' }}>{children}</div>
      </div>
    </div>
  )
}
