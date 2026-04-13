import type { RequirementLink } from '../../types/lesson-plan'

interface RequirementBannerProps {
  requirement?: RequirementLink
  onLink?: () => void
  onChange?: () => void
}

export function RequirementBanner({ requirement, onLink, onChange }: RequirementBannerProps) {
  if (requirement) {
    return (
      <div style={{
        background: 'var(--teal-bg)',
        borderRadius: '8px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}>
        <span style={{
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--teal)',
          color: 'var(--teal-bg)',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 700,
          flexShrink: 0,
          marginTop: '1px',
        }}>
          标
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--teal)',
            marginBottom: '2px',
          }}>
            课标 {requirement.code}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--t1)',
            lineHeight: 1.5,
          }}>
            {requirement.text}
          </div>
          {requirement.interpretation && (
            <div style={{
              fontSize: '11px',
              color: 'var(--t2)',
              marginTop: '4px',
              lineHeight: 1.4,
            }}>
              {requirement.interpretation}
            </div>
          )}
        </div>
        {onChange && (
          <button
            onClick={onChange}
            style={{
              border: 'none',
              background: 'var(--teal)',
              color: 'var(--teal-bg)',
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            更换
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={onLink}
      style={{
        border: '1px dashed var(--amber)',
        borderRadius: '8px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
      }}
    >
      <span style={{
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--amber-bg)',
        color: 'var(--amber)',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        flexShrink: 0,
      }}>
        !
      </span>
      <span style={{
        fontSize: '12px',
        color: 'var(--amber)',
        fontWeight: 500,
      }}>
        点击关联学业要求
      </span>
    </div>
  )
}
