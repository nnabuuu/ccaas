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
            marginTop: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 10,
            color: 'var(--t3)',
          }}
        >
          {toolEvents.map((t, i) => {
            // Special-cased tool calls get rich rendering. Anything
            // unrecognised falls through to the generic "调用/完成"
            // single-line label.
            if (isValidationToolEvent(t)) {
              return <ValidationCard key={`${t.toolId}-${i}`} event={t} />;
            }
            return (
              <div key={`${t.toolId}-${i}`} style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: 'var(--purple)' }}>✎</span>
                <span>
                  {t.phase === 'start' ? '调用' : '完成'}{' '}
                  <code style={{ fontFamily: 'inherit', fontWeight: 500 }}>{t.toolName}</code>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Validation card ─────────────────────────────────────────────────
//
// Detects agent calls to `bash scripts/validate-manifest.sh` (per the
// manifest-editor skill) and renders the parsed result as a distinct
// pass/fail card with issue list. The agent invokes this after every
// manifest edit (see SKILL.md "Self-check" section). Surfacing it
// prominently in the chat — instead of as another tiny "完成 Bash"
// line — is the whole point: the teacher should see at a glance
// whether the agent's last edit is publish-ready.
//
// Matches on toolName=Bash + command substring 'validate-manifest'.
// More tolerant than a strict regex; survives the agent invoking the
// script via different paths (relative / absolute / via bash explicitly).

interface ValidateResult {
  valid: boolean;
  stepCount?: number;
  issues?: Array<{ path: string; message: string }>;
}

function isValidationToolEvent(t: ToolEvent): boolean {
  if (t.toolName !== 'Bash') return false;
  const input = t.toolInput as { command?: string } | undefined;
  return typeof input?.command === 'string' && input.command.includes('validate-manifest');
}

function parseValidationOutput(output: unknown): ValidateResult | null {
  if (typeof output !== 'string') {
    // Some servers may already give parsed JSON; pass through.
    if (output && typeof output === 'object' && 'valid' in output) {
      return output as ValidateResult;
    }
    return null;
  }
  // The script's stdout may contain leading log lines, etc. Find the
  // first '{' and try parsing the rest.
  const start = output.indexOf('{');
  if (start < 0) return null;
  try {
    const parsed = JSON.parse(output.slice(start)) as ValidateResult;
    if (typeof parsed.valid !== 'boolean') return null;
    return parsed;
  } catch {
    return null;
  }
}

function ValidationCard({ event }: { event: ToolEvent }) {
  // Pre-completion: agent has called the validator but stdout hasn't
  // arrived yet. Show a tiny "校验中..." pill so the user sees the
  // intent immediately.
  if (event.phase !== 'end') {
    return (
      <div
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          background: 'var(--purple-bg)',
          color: 'var(--purple)',
          fontSize: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>✦</span>
        <span>校验中…</span>
      </div>
    );
  }

  const result = parseValidationOutput(event.toolOutput);
  if (!result) {
    // Output didn't parse — fall back to a neutral "完成校验" line so
    // the user at least knows the agent tried.
    return (
      <div style={{ display: 'flex', gap: 6, fontSize: 10, color: 'var(--t3)' }}>
        <span style={{ color: 'var(--purple)' }}>✦</span>
        <span>校验完成（无结构化输出）</span>
      </div>
    );
  }

  if (result.valid) {
    return (
      <div
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600 }}>✓</span>
        <span style={{ flex: 1 }}>
          Manifest 校验通过
          {typeof result.stepCount === 'number' && `（${result.stepCount} 个 step）`}
        </span>
      </div>
    );
  }

  // valid === false
  const issues = result.issues ?? [];
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#991b1b',
        fontSize: 11,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: issues.length > 0 ? 6 : 0 }}>
        <span style={{ fontWeight: 600 }}>✗</span>
        <span style={{ flex: 1 }}>校验失败（{issues.length} 处问题）</span>
      </div>
      {issues.length > 0 && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            fontSize: 10,
            lineHeight: 1.5,
            color: '#7f1d1d',
          }}
        >
          {issues.slice(0, 5).map((issue, i) => (
            <li key={i}>
              <code style={{ fontFamily: 'inherit', fontWeight: 500 }}>{issue.path}</code>
              {': '}
              {issue.message}
            </li>
          ))}
          {issues.length > 5 && (
            <li style={{ listStyle: 'none', color: '#9f1239', marginLeft: -14, marginTop: 2 }}>
              ……还有 {issues.length - 5} 处
            </li>
          )}
        </ul>
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
