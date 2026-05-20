import { useState, useEffect } from 'react'
import type { ReadingManifest } from '../../types/reading'
import { useT, type TFn, type Locale } from '../../i18n'

/* ── Reading strategy one-liner explanations ── */

function getStrategyDesc(t: TFn): Record<string, string> {
  return {
    Predict: t('strategy.predict'),
    Skim: t('strategy.skim'),
    Scan: t('strategy.scan'),
    Evaluate: t('strategy.evaluate'),
    Synthesizing: t('strategy.synthesizing'),
    Orientation: t('strategy.orientation'),
  }
}

/* ── SVG Illustrations (from student-guide.html design) ── */

function TaskAreaSvg({ t }: { t: TFn }) {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="16" y="8" width="248" height="26" rx="8" fill="#fbfaf7"/>
      <rect x="16" y="28" width="248" height="6" fill="#fbfaf7"/>
      <text x="30" y="26" fontFamily="Plus Jakarta Sans" fontSize="9" fontWeight="700" fill="#1c1c1a">{t('guide.svg.task', { n: 1 })}</text>
      <line x1="16" y1="34" x2="264" y2="34" stroke="#e4e2d8" strokeWidth=".5"/>
      <rect x="24" y="40" width="240" height="18" rx="4" fill="#edece7"/>
      <rect x="26" y="42" width="54" height="14" rx="3" fill="#1a6e5e"/>
      <text x="53" y="52" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#fff" textAnchor="middle">{t('guide.svg.listen')}</text>
      <text x="112" y="52" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#9c9a92" textAnchor="middle">{t('guide.svg.practice')}</text>
      <text x="172" y="52" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#9c9a92" textAnchor="middle">{t('guide.svg.discuss')}</text>
      <text x="232" y="52" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#9c9a92" textAnchor="middle">{t('guide.svg.takeaway')}</text>
      <rect x="30" y="68" width="224" height="32" rx="6" fill="#edece7"/>
      <text x="142" y="87" fontFamily="Plus Jakarta Sans" fontSize="8" fill="#5c5b56" textAnchor="middle">{t('guide.svg.readCarefully')}</text>
      <rect x="30" y="108" width="80" height="22" rx="6" fill="#1c1c1a"/>
      <text x="70" y="122" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="700" fill="#fff" textAnchor="middle">{t('guide.svg.iUnderstand')}</text>
    </svg>
  )
}

function TextPanelSvg({ t }: { t: TFn }) {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="130" height="140" rx="8" fill="#edece7" stroke="#e4e2d8"/>
      <rect x="28" y="28" width="106" height="6" rx="2" fill="#d8d6d0"/>
      <rect x="28" y="40" width="88" height="6" rx="2" fill="#d8d6d0"/>
      <rect x="28" y="52" width="96" height="6" rx="2" fill="#d8d6d0"/>
      <rect x="28" y="64" width="80" height="6" rx="2" fill="#d8d6d0"/>
      <rect x="150" y="8" width="28" height="140" rx="0" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="157" y="58" width="14" height="36" rx="4" fill="#dbeafe" stroke="#1a5fb4" strokeWidth=".8"/>
      <text x="164" y="81" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="800" fill="#1a5fb4" textAnchor="middle">T</text>
      <path d="M182 78 L198 78" stroke="#1a5fb4" strokeWidth="1.5" strokeDasharray="4,3"/>
      <polygon points="198,75 204,78 198,81" fill="#1a5fb4"/>
      <rect x="208" y="8" width="58" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="216" y="22" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#1c1c1a">{t('guide.svg.text')}</text>
      <text x="258" y="22" fontFamily="Plus Jakarta Sans" fontSize="9" fill="#9c9a92" textAnchor="end">&times;</text>
      <line x1="208" y1="28" x2="266" y2="28" stroke="#e4e2d8" strokeWidth=".5"/>
      <text x="214" y="40" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#d8d6d0">&#182;1</text>
      <rect x="226" y="34" width="32" height="4" rx="1" fill="#e4e2d8"/>
      <rect x="226" y="42" width="28" height="4" rx="1" fill="#e4e2d8"/>
      <rect x="211" y="54" width="52" height="38" rx="4" fill="#dbeafe" fillOpacity=".5"/>
      <text x="214" y="66" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#1a5fb4">&#182;2</text>
      <rect x="226" y="60" width="32" height="4" rx="1" fill="#1a5fb4" fillOpacity=".4"/>
      <rect x="226" y="68" width="28" height="4" rx="1" fill="#1a5fb4" fillOpacity=".4"/>
      <rect x="226" y="76" width="30" height="4" rx="1" fill="#1a5fb4" fillOpacity=".4"/>
      <rect x="226" y="84" width="26" height="4" rx="1" fill="#1a5fb4" fillOpacity=".4"/>
      <rect x="215" y="98" width="42" height="12" rx="4" fill="#dbeafe"/>
      <text x="236" y="107" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#1a5fb4" textAnchor="middle">{t('guide.svg.focusPara')}</text>
      <text x="214" y="122" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#d8d6d0">&#182;3</text>
      <rect x="226" y="116" width="30" height="4" rx="1" fill="#e4e2d8"/>
      <rect x="226" y="124" width="26" height="4" rx="1" fill="#e4e2d8"/>
    </svg>
  )
}

function ToolbarSvg({ t }: { t: TFn }) {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="88" rx="8" fill="#edece7" stroke="#e4e2d8"/>
      <rect x="56" y="36" width="168" height="20" rx="5" fill="#dbeafe" stroke="#1a5fb4" strokeWidth=".8"/>
      <text x="140" y="50" fontFamily="Plus Jakarta Sans" fontSize="8" fill="#1a5fb4" textAnchor="middle">a paradigm shift in thinking</text>
      <line x1="140" y1="58" x2="140" y2="96" stroke="#7a4d0e" strokeWidth="1" strokeDasharray="4,3"/>
      <polygon points="137,96 140,102 143,96" fill="#7a4d0e"/>
      <rect x="16" y="104" width="248" height="44" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <circle cx="42" cy="126" r="14" fill="#edece7"/>
      <text x="42" y="131" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="800" fill="#9c9a92" textAnchor="middle">?</text>
      <rect x="66" y="112" width="44" height="28" rx="7" fill="#f6edda" stroke="rgba(122,77,14,.15)"/>
      <text x="88" y="130" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="800" fill="#7a4d0e" textAnchor="middle">译</text>
      <rect x="120" y="112" width="44" height="28" rx="7" fill="#eceafe" stroke="rgba(58,49,133,.15)"/>
      <text x="142" y="130" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="800" fill="#3a3185" textAnchor="middle">&#x2726;</text>
      <text x="42" y="148" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92" textAnchor="middle">{t('guide.svg.help')}</text>
      <text x="88" y="148" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#7a4d0e" textAnchor="middle">{t('guide.svg.translate')}</text>
      <text x="142" y="148" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185" textAnchor="middle">{t('guide.svg.aiAsk')}</text>
    </svg>
  )
}

/* ── Card config ── */

function getCards(t: TFn) {
  return [
    {
      num: 1,
      title: t('guide.card1Title'),
      color: 'teal' as const,
      Svg: () => <TaskAreaSvg t={t} />,
      desc: t('guide.card1Desc'),
    },
    {
      num: 2,
      title: t('guide.card2Title'),
      color: 'blue' as const,
      Svg: () => <TextPanelSvg t={t} />,
      desc: t('guide.card2Desc'),
    },
    {
      num: 3,
      title: t('guide.card3Title'),
      color: 'amber' as const,
      Svg: () => <ToolbarSvg t={t} />,
      desc: t('guide.card3Desc'),
    },
  ]
}

/* ── Component ── */

interface Props {
  open: boolean
  onClose: () => void
  manifest: ReadingManifest
  locale?: Locale
}

export default function StudentGuide({ open, onClose, manifest, locale }: Props) {
  const t = useT(locale)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) setVisible(true)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!visible) return null

  const handleAnimEnd = () => {
    if (!open) setVisible(false)
  }

  // Extract reading strategy steps (filter out Orientation/Synthesizing)
  const steps = (manifest.readingSteps || []).filter(
    s => s.type === 'task' && s.strategy !== 'Orientation' && s.strategy !== 'Synthesizing',
  )

  return (
    <div
      className={`sd-guide-backdrop${open ? '' : ' closing'}`}
      onClick={onClose}
      onAnimationEnd={handleAnimEnd}
    >
      <div
        className={`sd-guide-popup${open ? '' : ' closing'}`}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        {/* Mission Box */}
        <div className="stu-guide-mission">
          <div className="stu-guide-mission-box">
            <div className="stu-guide-mission-title">{t('guide.mission')}</div>
            <div className="stu-guide-mission-topic">{manifest.title}</div>
            <div className="stu-guide-mission-meta">
              {manifest.article
                ? (() => { const parts = t('guide.missionMetaArticle', { title: '__TITLE__', count: steps.length }).split('__TITLE__'); return <>{parts[0]}<strong>{manifest.article.title}</strong>{parts[1] ?? ''}</> })()
                : t('guide.missionMetaNoArticle', { count: steps.length })
              }{t('guide.missionPhases')}
            </div>
            {steps.length > 0 && (
              <div className="stu-guide-mission-steps">
                {steps.map((s, i) => (
                  <span key={s.idx} className="stu-guide-step-tag">
                    <span className="num">{i + 1}</span>{' '}
                    {s.displayName || s.strategy}
                    {getStrategyDesc(t)[s.strategy] ? ` — ${getStrategyDesc(t)[s.strategy]}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cards */}
        <div className="sd-guide-cards">
          {getCards(t).map((c, i) => (
            <div key={c.num} className="sd-guide-card" style={{ animationDelay: `${i * 80 + 100}ms` }}>
              <div className="sd-guide-card-hd">
                <div className={`stu-guide-card-num ${c.color}`}>{c.num}</div>
                <h4>{c.title}</h4>
              </div>
              <div className="sd-guide-card-illust"><c.Svg /></div>
              <p className="sd-guide-card-desc">{c.desc}</p>
            </div>
          ))}
        </div>

        {/* AI + Reward strip */}
        <div className="stu-guide-strip">
          <div className="stu-guide-callout purple">
            <span className="stu-guide-callout-icon">&#x2726;</span>
            <span><strong>{t('guide.aiCalloutBold')}</strong> {t('guide.aiCalloutText')}</span>
          </div>
          <div className="stu-guide-callout amber">
            <span className="stu-guide-callout-icon">&#x1F3C6;</span>
            <span><strong>{t('guide.rewardCalloutBold')}</strong> {t('guide.rewardCalloutText')}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="sd-guide-footer">
          <button className="stu-btn pri" onClick={onClose}>{t('guide.startLearning')}</button>
        </div>
      </div>
    </div>
  )
}
