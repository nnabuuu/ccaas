import { useState, useEffect, useCallback, useRef } from 'react'
import type { ReadingManifest } from '../../types/reading'

interface RoleConfig {
  key: string
  label: string
  en: string
  route: string
  w: number
  h: number
}

const ROLES: Record<string, RoleConfig> = {
  student: { key: 'student', label: '学生端', en: 'Student · iPad', route: '/student/', w: 1400, h: 1050 },
  teacher: { key: 'teacher', label: '教师控制台', en: 'Teacher · MacBook', route: '/teacher/', w: 1600, h: 1000 },
  board:   { key: 'board',   label: '投屏黑板', en: 'Classroom Projector', route: '/board/', w: 1400, h: 1100 },
}
const ROLE_ORDER = ['teacher', 'student', 'board']

interface Props {
  manifest: ReadingManifest
}

export default function DemoShell({ manifest }: Props) {
  const [step, setStep] = useState(2)
  const [featured, setFeatured] = useState('teacher')
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const [layout, setLayout] = useState<'focus' | 'triptych'>('focus')
  const [bezel, setBezel] = useState<'device' | 'minimal'>('device')

  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map())
  const featBoxRef = useRef<HTMLDivElement>(null)

  const lessonId = manifest.id

  // Broadcast sync to all iframes
  const broadcast = useCallback((msg: Record<string, unknown>) => {
    iframeRefs.current.forEach((iframe) => {
      try { iframe.contentWindow?.postMessage(msg, '*') } catch { /* noop */ }
    })
  }, [])

  // Handle step change
  const goStep = useCallback((newStep: number) => {
    const s = Math.max(0, Math.min(manifest.readingSteps.length - 1, newStep))
    setStep(s)
    broadcast({ type: 'sync', step: s })
  }, [manifest.readingSteps.length, broadcast])

  // Listen for ready messages from iframes
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'ready') {
        setTimeout(() => broadcast({ type: 'sync', step }), 60)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [step, broadcast])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') { e.preventDefault(); goStep(step + 1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goStep(step - 1) }
      else if (e.key >= '1' && e.key <= '5') goStep(parseInt(e.key) - 1)
      else if (e.key === 't' || e.key === 'T') setTweaksOpen(v => !v)
      else if (e.key === 's' || e.key === 'S') setFeatured('student')
      else if (e.key === 'b' || e.key === 'B') setFeatured('board')
      else if (e.key === 'c' || e.key === 'C') setFeatured('teacher')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, goStep])

  // Scale featured iframe to fit container
  useEffect(() => {
    function scale() {
      const box = featBoxRef.current
      const dev = box?.querySelector('.orch-dev-large') as HTMLDivElement | null
      if (!box || !dev) return
      const R = ROLES[featured]
      dev.style.width = R.w + 'px'
      dev.style.height = R.h + 'px'
      const rect = box.getBoundingClientRect()
      const s = Math.min(rect.width / R.w, rect.height / R.h, 1)
      dev.style.transform = `scale(${s})`
    }
    scale()
    const timer = setTimeout(scale, 100)
    window.addEventListener('resize', scale)
    return () => { window.removeEventListener('resize', scale); clearTimeout(timer) }
  }, [featured, layout])

  // Cumulative minutes for timer display
  const cum = manifest.cumulativeMinutes || [0, 3, 9, 26, 38, 45]
  const nowSec = (cum[step] || 0) * 60 + Math.round(((cum[step + 1] || 45) - (cum[step] || 0)) * 60 * 0.35)
  const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

  const thumbRoles = ROLE_ORDER.filter(r => r !== featured)
  const featRole = ROLES[featured]

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#e8e6df', color: 'var(--rd-t1)', fontVariantNumeric: 'tabular-nums' }}>
      {/* ── Conductor Bar ── */}
      <div className="orch-conductor">
        <div className="orch-cnd-mark">R</div>
        <div className="orch-cnd-title">
          <div className="orch-cnd-title-a">{manifest.title} · 三端联动 Demo</div>
          <div className="orch-cnd-title-b">高一(3)班 · 阅读策略训练</div>
        </div>

        <div className="orch-cnd-rail">
          {manifest.readingSteps.map((s, i) => (
            <button
              key={s.id}
              className={`orch-cnd-step${i < step ? ' done' : ''}${i === step ? ' act' : ''}`}
              onClick={() => goStep(i)}
            >
              <span className="n">{i + 1}</span>
              {s.label}
              <span className="dur">{s.duration}&apos;</span>
            </button>
          ))}
        </div>

        <div className="orch-cnd-sep" />
        <button className="orch-cnd-btn ghost" onClick={() => goStep(step - 1)}>←</button>
        <button className="orch-cnd-btn pri" onClick={() => goStep(step + 1)}>下一步 →</button>

        <div className="orch-cnd-time">
          <span className="lb">课时</span>
          <span>{fmtTime(nowSec)}</span>
          <span className="sl">/</span>
          <span className="tot">45:00</span>
        </div>

        <button className="orch-cnd-btn ghost" onClick={() => setTweaksOpen(v => !v)} style={{ padding: '7px 9px' }}>⚙</button>
      </div>

      {/* ── Stage ── */}
      <div className={`orch-stage${layout === 'triptych' ? ' triptych' : ''}`}>
        {/* Featured */}
        <div className="orch-featured">
          <div className={`orch-featured-label ${featured}`}>
            <span className="dot" />
            <span className="role">{featRole.label}</span>
            <span className="role-en">· {featRole.en}</span>
            <span className="pulse" />
          </div>
          <div className="orch-featured-box" ref={featBoxRef}>
            <div className={`orch-dev-large ${featured}${bezel === 'minimal' ? ' minimal' : ''}`}>
              <iframe
                ref={el => { if (el) iframeRefs.current.set(featured, el) }}
                key={featured}
                src={`${ROLES[featured].route}${lessonId}?embed=1`}
                title={featRole.label}
              />
            </div>
          </div>
        </div>

        {/* Filmstrip */}
        <div className="orch-strip">
          <div className="orch-strip-h">其余两端 · 点击切换至主视图</div>
          {thumbRoles.map(role => {
            const R = ROLES[role]
            return (
              <button
                key={role}
                className={`orch-thumb ${role}`}
                onClick={() => setFeatured(role)}
              >
                <div className="orch-thumb-head">
                  <span className="orch-thumb-dot" />
                  <span className="orch-thumb-role">{R.label}</span>
                  <span className="orch-thumb-en">{R.en}</span>
                </div>
                <div className="orch-thumb-view">
                  <iframe
                    ref={el => { if (el) iframeRefs.current.set(`thumb-${role}`, el) }}
                    src={`${R.route}${lessonId}?embed=1`}
                    title={R.label}
                    style={{
                      width: R.w,
                      height: R.h,
                      transform: 'scale(0.15)',
                      transformOrigin: 'top left',
                      pointerEvents: 'none',
                    }}
                  />
                  <div className="orch-thumb-cover" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tweaks Panel ── */}
      {tweaksOpen && (
        <div className="orch-tweaks">
          <div className="orch-tw-hd">
            <span className="dot" /> Tweaks <span className="sp" style={{ flex: 1 }} />
            <button className="cls" onClick={() => setTweaksOpen(false)}>✕</button>
          </div>
          <div className="orch-tw-row">
            <div className="orch-tw-lb">布局 Layout</div>
            <div className="orch-tw-opts">
              <button className={layout === 'focus' ? 'act' : ''} onClick={() => setLayout('focus')}>主视图 + 缩略</button>
              <button className={layout === 'triptych' ? 'act' : ''} onClick={() => setLayout('triptych')}>三端并排</button>
            </div>
          </div>
          <div className="orch-tw-row">
            <div className="orch-tw-lb">外壳 Bezel</div>
            <div className="orch-tw-opts">
              <button className={bezel === 'device' ? 'act' : ''} onClick={() => setBezel('device')}>设备壳</button>
              <button className={bezel === 'minimal' ? 'act' : ''} onClick={() => setBezel('minimal')}>极简</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
