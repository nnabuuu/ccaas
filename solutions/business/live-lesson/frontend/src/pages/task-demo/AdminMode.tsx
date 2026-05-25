// Placeholder — P4 replaces this with the respondents overview table.
export function AdminMode({ code }: { code: string }) {
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
        <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', margin: '0 0 12px' }}>Admin 模式</h2>
        <div style={{ fontSize: 13, color: '#5c5b56' }}>
          <p>P4 will land here.</p>
          <code>code={code}</code>
        </div>
      </div>
    </div>
  )
}
