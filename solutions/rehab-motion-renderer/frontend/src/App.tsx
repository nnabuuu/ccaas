// ═══════════════════════════════════════════
// REHAB MOTION RENDERER — Main App
// Layout: Left (35%) ChatPanel | Right (65%) Form + Preview
// ═══════════════════════════════════════════

import { useRehabSession } from './hooks/useRehabSession'
import { ChatPanel } from './components/ChatPanel'
import { TrainingPlanForm } from './components/TrainingPlanForm'
import { TrainingPagePreview } from './components/TrainingPagePreview'
import { MONO_FONT } from './constants'

export default function App() {
  const session = useRehabSession()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080d16',
      color: '#cbd5e1',
      fontFamily: MONO_FONT,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── HEADER ── */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid #1a2332',
        background: '#0a1120',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 8, color: '#22d3ee', letterSpacing: 2.5 }}>LUMBAR SAFE · AI POWERED</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginTop: 1 }}>
            康复训练设计器
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#2a3a4a', borderLeft: '1px solid #1a2332', paddingLeft: 16 }}>
          即见Agentic Platform
        </div>
        {session.hasPendingUpdates && (
          <div style={{
            marginLeft: 'auto',
            background: '#22d3ee22',
            border: '1px solid #22d3ee44',
            borderRadius: 8,
            padding: '4px 12px',
            fontSize: 11,
            color: '#22d3ee',
          }}>
            {session.pendingUpdates.size} 个字段待同步
          </div>
        )}
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* LEFT: Chat Panel (35%) */}
        <div style={{
          width: '35%',
          minWidth: 300,
          maxWidth: 480,
          borderRight: '1px solid #1a2332',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <ChatPanel
            messages={session.messages}
            isProcessing={session.isProcessing}
            isThinking={session.isThinking}
            thinkingContent={session.thinkingContent}
            activeTools={session.activeTools}
            currentStreamContent={session.currentStreamContent}
            connected={session.connected}
            error={session.error}
            onSendMessage={session.sendMessage}
            onCancelProcessing={session.cancelProcessing}
            onClearConversation={session.clearConversation}
          />
        </div>

        {/* RIGHT: Form + Preview (65%) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Right scrollable content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}>
            {/* Training Plan Form */}
            <TrainingPlanForm
              plan={session.plan}
              pendingUpdates={session.pendingUpdates}
              onApplyField={session.applyField}
              onDiscardField={session.discardField}
              onUpdateField={session.updatePlanField}
              onApplyAll={session.applyAll}
            />

            {/* Divider */}
            <div style={{
              borderTop: '1px solid #1a2332',
              paddingTop: 20,
            }}>
              <div style={{
                fontSize: 9,
                color: '#22d3ee',
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}>
                SVG 动画预览
              </div>

              {/* Training Page Preview */}
              <TrainingPagePreview exercises={session.plan.exercises} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
