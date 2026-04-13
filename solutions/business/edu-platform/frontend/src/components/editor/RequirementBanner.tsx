import type { RequirementInfo } from '../../types/lesson-plan'

interface RequirementBannerProps {
  requirement?: RequirementInfo | null
  onLink: () => void
  onChange: () => void
}

export function RequirementBanner({ requirement, onLink, onChange }: RequirementBannerProps) {
  if (requirement) {
    return (
      <div
        style={{
          background: 'var(--teal-bg)',
          color: 'var(--teal-t)',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: 'var(--teal-t)',
            color: 'var(--bg1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          标
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '12px' }}>
            课标 {requirement.code} {requirement.text}
          </div>
          {requirement.interpretation && (
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
              {requirement.interpretation}
            </div>
          )}
        </div>

        {/* Change button */}
        <button
          onClick={onChange}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            borderRadius: '6px',
            border: 'none',
            background: 'var(--teal-t)',
            color: 'var(--bg1)',
            cursor: 'pointer',
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
        >
          更换
        </button>
      </div>
    )
  }

  return (
    <div
      onClick={onLink}
      style={{
        background: 'var(--warn-bg)',
        color: 'var(--warn-t)',
        borderRadius: '8px',
        padding: '12px 16px',
        border: '1px dashed var(--warn-t)',
        cursor: 'pointer',
        fontSize: '12px',
        marginBottom: '16px',
        textAlign: 'center',
      }}
    >
      点击关联学业要求
    </div>
  )
}
