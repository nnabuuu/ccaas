import React from 'react';

/* ═══════ Join Flow Screens ═══════
 * Two screens for student session join:
 *   1. JoinCodeScreen — enter session code
 *   2. RosterScreen  — pick a name from the class roster
 */

/* ─── Types ─── */

interface RosterEntry {
  id: string;
  name: string;
  avatar?: string;
}

interface JoinCodeScreenProps {
  codeInput: string;
  onCodeChange: (v: string) => void;
  onSubmit: () => void;
  error?: string | null;
}

interface RosterScreenProps {
  sessionCode: string;
  roster: RosterEntry[];
  onSelect: (id: string, name: string) => void;
  error?: string | null;
}

/* ─── Shared wrapper ─── */

function CenterCard({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="flex h-dvh"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fdfcfa',
        fontFamily: "'Source Serif 4',Georgia,serif",
      }}
    >
      <div
        className={wide ? 'modal-card-wide' : 'modal-card'}
        style={{
          padding: '40px 32px',
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #ebe8e2',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      style={{
        marginTop: 12,
        fontSize: 13,
        color: '#ef4444',
        padding: '8px 12px',
        background: 'rgba(239,68,68,.06)',
        borderRadius: 8,
      }}
    >
      {message}
    </p>
  );
}

/* ═══════ JoinCodeScreen ═══════ */

export function JoinCodeScreen({
  codeInput,
  onCodeChange,
  onSubmit,
  error,
}: JoinCodeScreenProps) {
  return (
    <CenterCard>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: '#f5f3ff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <svg
          width="24"
          height="24"
          fill="none"
          stroke="#7c3aed"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
      </div>

      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#1a1a18',
          marginBottom: 6,
          fontFamily: "'DM Sans',system-ui,sans-serif",
        }}
      >
        Join lesson
      </h1>
      <p style={{ fontSize: 14, color: '#9e9c96', marginBottom: 24 }}>
        Enter the session code from your teacher
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (codeInput.trim()) onSubmit();
        }}
      >
        <label htmlFor="session-code" className="sr-only">
          Session code
        </label>
        <input
          id="session-code"
          value={codeInput}
          onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
          placeholder="e.g. ABC123"
          maxLength={10}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 10,
            border: '1px solid #ebe8e2',
            fontSize: 20,
            fontWeight: 600,
            textAlign: 'center',
            letterSpacing: 4,
            color: '#1a1a18',
            boxSizing: 'border-box',
            fontFamily: "'DM Sans',system-ui,sans-serif",
          }}
        />
        <button
          type="submit"
          disabled={!codeInput.trim()}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '12px 20px',
            borderRadius: 10,
            border: 'none',
            background: codeInput.trim() ? '#7c3aed' : '#e8e5de',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: codeInput.trim() ? 'pointer' : 'default',
          }}
        >
          Join
        </button>
      </form>

      {error && <ErrorBanner message={error} />}
    </CenterCard>
  );
}

/* ═══════ RosterScreen ═══════ */

export function RosterScreen({
  sessionCode,
  roster,
  onSelect,
  error,
}: RosterScreenProps) {
  return (
    <CenterCard wide>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#1a1a18',
          marginBottom: 6,
          fontFamily: "'DM Sans',system-ui,sans-serif",
        }}
      >
        Choose your name
      </h1>
      <p style={{ fontSize: 14, color: '#9e9c96', marginBottom: 4 }}>
        Session:{' '}
        <strong style={{ color: '#7c3aed' }}>{sessionCode}</strong>
      </p>
      <p style={{ fontSize: 13, color: '#b8b5ae', marginBottom: 20 }}>
        Click your name to join the class
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 8,
        }}
      >
        {roster.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id, r.name)}
            style={{
              padding: '14px 8px',
              borderRadius: 10,
              border: '1px solid #ebe8e2',
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              transition: 'border-color .15s, background .15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#a78bfa';
              (e.currentTarget as HTMLElement).style.background = '#f5f3ff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#ebe8e2';
              (e.currentTarget as HTMLElement).style.background = '#fff';
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#f5f3ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              {r.avatar || r.name.charAt(0)}
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: '#1a1a18',
              }}
            >
              {r.name}
            </span>
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}
    </CenterCard>
  );
}
