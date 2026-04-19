import type { BoardStep } from '../../types/reading'

interface Props {
  open: boolean
  onClose: () => void
  steps: BoardStep[]
  currentStep: number
}

export default function BoardDrawer({ open, onClose, steps, currentStep }: Props) {
  return (
    <div className={`stu-board${open ? ' open' : ''}`}>
      <div className="stu-board-inner">
        <div className="stu-board-hd">
          <div className="stu-board-hd-dot" />
          <div className="stu-board-hd-title">Structure Map</div>
          <div className="stu-board-hd-badge">
            {currentStep + 1}/{steps.length} 步骤
          </div>
          <button className="stu-board-hd-close" onClick={onClose}>收起 ▲</button>
        </div>
        <div className="stu-bf">
          {steps.map((step, i) => {
            const state = i < currentStep ? 'rev' : i === currentStep ? 'pre' : 'lk'
            return (
              <div key={step.id} style={{ display: 'contents' }}>
                {i > 0 && (
                  <div className={`stu-bf-a${i <= currentStep ? ' act' : ''}`}>
                    <svg viewBox="0 0 16 16" width="22" height="22">
                      <line x1="2" y1="8" x2="10" y2="8" strokeWidth="1.5" strokeLinecap="round" stroke="currentColor" />
                      <polygon points="9,5 14,8 9,11" fill="currentColor" />
                    </svg>
                  </div>
                )}
                <div className="stu-bf-n">
                  <div className={`stu-bf-b ${state}`}>
                    <div className="stu-bf-p">{step.label}</div>
                    <div className="stu-bf-l">
                      {state === 'lk' ? '· · ·' : step.layout?.columns?.[0]?.title || step.label}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
