/**
 * ChatBubble — user / agent message rendering.
 *
 * Visual spec mirrors `design/surfaces/creator-v7-ai-left.jsx:140-188`.
 * Inline styles (not Tailwind) so the port stays 1:1 with the design
 * jsx; CSS vars provide the design tokens.
 */

import type { ToolEvent } from '../../hooks/useAgentChat';

interface BubbleBaseProps {
  text: string;
}

interface UserBubbleProps extends BubbleBaseProps {
  role: 'user';
}

interface AgentBubbleProps extends BubbleBaseProps {
  role: 'agent';
  toolEvents?: ToolEvent[];
  /** Render the "思考中" 3-dot indicator below text (when agent is mid-turn). */
  showThinking?: boolean;
}

export type ChatBubbleProps = UserBubbleProps | AgentBubbleProps;

export default function ChatBubble(props: ChatBubbleProps) {
  if (props.role === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '88%' }}>
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '12px 12px 2px 12px',
            background: 'var(--t1)',
            color: 'var(--surface)',
            fontSize: 12,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {props.text}
        </div>
      </div>
    );
  }

  // role === 'agent'
  const toolEvents = props.toolEvents ?? [];
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
      {/* Small "AI 助手" header above the bubble */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
          fontSize: 10,
          color: 'var(--t3)',
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            background: 'var(--purple)',
            display: 'inline-block',
          }}
        />
        <span>AI 助手</span>
      </div>
      <div
        style={{
          padding: '10px 14px',
          borderRadius: '12px 12px 12px 2px',
          background: 'var(--purple-bg)',
          color: 'var(--t1)',
          fontSize: 12,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {props.text || (
          <span style={{ color: 'var(--t3)' }}>
            {props.showThinking ? '' : '…'}
          </span>
        )}
        {props.showThinking && <ThinkingDots inline={Boolean(props.text)} />}
      </div>

      {toolEvents.length > 0 && (
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontSize: 10,
            color: 'var(--t3)',
          }}
        >
          {toolEvents.map((t, i) => (
            <div key={`${t.toolId}-${i}`} style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: 'var(--purple)' }}>✎</span>
              <span>
                {t.phase === 'start' ? '调用' : '完成'} <code style={{ fontFamily: 'inherit', fontWeight: 500 }}>{t.toolName}</code>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Three-dot bounce indicator. Inline=true compresses it for use inside a bubble. */
export function ThinkingDots({ inline = false }: { inline?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        gap: 3,
        marginLeft: inline ? 6 : 0,
        verticalAlign: 'middle',
      }}
    >
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--purple)',
            animation: 'aiDot 1.2s infinite',
            animationDelay: `${delay}s`,
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}
