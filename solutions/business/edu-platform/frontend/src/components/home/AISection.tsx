import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AIBriefing } from '../../types/dashboard'

interface AISectionProps {
  briefing: AIBriefing | null
}

export function AISection({ briefing }: AISectionProps) {
  const [inputValue, setInputValue] = useState('')
  const navigate = useNavigate()

  const hasInsights = briefing && briefing.insights && briefing.insights.length > 0
  const title = hasInsights ? 'AI 助手发现了几件事' : 'AI 助手'

  const allChips = [
    ...(briefing?.insights?.flatMap((i) => i.suggested_actions) ?? []),
    ...(briefing?.common_actions ?? []),
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
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="ai">
      <div className="ai-body">
        <div className="ai-header">
          <div className="ai-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div className="ai-title">{title}</div>
        </div>

        {hasInsights ? (
          <div className="ai-items">
            {briefing.insights.map((insight, i) => (
              <div key={i} className="ai-item">
                <div className="ai-bullet" />
                <div dangerouslySetInnerHTML={{ __html: insight.summary }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="ai-empty">暂无新发现。你可以问我任何问题。</div>
        )}
      </div>

      {allChips.length > 0 && (
        <div className="ai-chips">
          {allChips.map((chip, i) => (
            <button
              key={i}
              className="ai-chip"
              onClick={() => handleChipClick(chip.prompt)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className="ai-input">
        <input
          type="text"
          placeholder="或者直接问..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="ai-send" onClick={handleSubmit}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
        <a className="ai-full" onClick={() => navigate('/chat')}>
          完整对话{' '}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </a>
      </div>

      <style>{`
        .ai {
          margin-bottom: 32px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
        }
        .ai-body { padding: 16px 20px 12px; }
        .ai-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
        }
        .ai-icon {
          width: 22px;
          height: 22px;
          border-radius: 5px;
          background: var(--purple-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ai-icon svg { color: var(--purple); }
        .ai-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--purple);
        }
        .ai-items {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ai-item {
          font-size: 12px;
          color: var(--t2);
          line-height: 1.5;
          display: flex;
          gap: 10px;
          padding: 4px 0;
        }
        .ai-item strong {
          color: var(--t1);
          font-weight: 500;
        }
        .ai-bullet {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--purple);
          flex-shrink: 0;
          margin-top: 7px;
          opacity: 0.5;
        }
        .ai-empty {
          font-size: 12px;
          color: var(--t3);
          padding: 4px 0;
        }
        .ai-chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          padding: 8px 20px 4px;
        }
        .ai-chip {
          font-size: 11px;
          color: var(--purple);
          padding: 5px 12px;
          border-radius: 6px;
          cursor: pointer;
          border: 1px solid var(--ai-chip-border);
          background: var(--purple-bg);
          font-family: inherit;
          transition: all 0.12s;
        }
        .ai-chip:hover { border-color: var(--purple); }
        .ai-input {
          padding: 8px 20px 14px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .ai-input input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 12px;
          font-family: inherit;
          background: var(--bg);
          color: var(--t1);
          transition: border-color 0.15s;
        }
        .ai-input input::placeholder { color: var(--t3); }
        .ai-input input:focus {
          outline: none;
          border-color: var(--focus-border);
        }
        .ai-send {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          background: var(--t1);
          color: var(--surface);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ai-send:hover { opacity: 0.85; }
        .ai-full {
          font-size: 11px;
          color: var(--t3);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 4px 8px;
          border-radius: 4px;
          flex-shrink: 0;
          white-space: nowrap;
          transition: all 0.12s;
          cursor: pointer;
        }
        .ai-full:hover {
          color: var(--purple);
          background: var(--purple-bg);
        }
      `}</style>
    </div>
  )
}
