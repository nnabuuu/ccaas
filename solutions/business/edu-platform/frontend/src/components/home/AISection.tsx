import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AIBriefing } from '../../types/dashboard'

interface AISectionProps {
  briefing: AIBriefing | null
}

export function AISection({ briefing }: AISectionProps) {
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')

  const hasInsights = briefing && briefing.insights && briefing.insights.length > 0

  const allChips = [
    ...(hasInsights
      ? briefing.insights.flatMap(i => i.suggested_actions || [])
      : []),
    ...(briefing?.common_actions || []),
  ]

  const handleChipClick = (prompt: string) => {
    navigate(`/chat?prompt=${encodeURIComponent(prompt)}`)
  }

  const handleSubmit = () => {
    if (!inputValue.trim()) return
    navigate(`/chat?prompt=${encodeURIComponent(inputValue.trim())}`)
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div style={{
      marginBottom: '32px',
      background: 'var(--bg1)',
      border: '1px solid var(--b1)',
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Body */}
      <div style={{ padding: '16px 20px 12px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '10px',
        }}>
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '5px',
            background: 'var(--purple-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple-t)" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--purple-t)',
          }}>
            {hasInsights ? 'AI 助手发现了几件事' : 'AI 助手'}
          </div>
        </div>

        {/* Insights */}
        {hasInsights ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {briefing.insights.map((insight, i) => (
              <div key={i} style={{
                fontSize: '12px',
                color: 'var(--t2)',
                lineHeight: 1.5,
                display: 'flex',
                gap: '10px',
                padding: '4px 0',
              }}>
                <div style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: 'var(--purple-t)',
                  flexShrink: 0,
                  marginTop: '7px',
                  opacity: 0.5,
                }} />
                <div>{insight.summary}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--t2)', padding: '4px 0' }}>
            暂无新发现。你可以问我任何问题。
          </div>
        )}
      </div>

      {/* Chips */}
      {allChips.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          padding: '8px 20px 4px',
        }}>
          {allChips.map((chip, i) => (
            <button
              key={i}
              onClick={() => handleChipClick(chip.prompt)}
              style={{
                fontSize: '11px',
                color: 'var(--purple-t)',
                padding: '5px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid rgba(58, 49, 133, 0.15)',
                background: 'var(--purple-bg)',
                fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{
        padding: '8px 20px 14px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <input
          type="text"
          placeholder="或者直接问..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid var(--b1)',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'inherit',
            background: 'var(--bg3)',
            color: 'var(--t1)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--t1)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
        <a
          href="/chat"
          onClick={e => { e.preventDefault(); navigate('/chat') }}
          style={{
            fontSize: '11px',
            color: 'var(--t3)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '4px 8px',
            borderRadius: '4px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            transition: 'all 0.12s',
          }}
        >
          完整对话{' '}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </a>
      </div>
    </div>
  )
}
