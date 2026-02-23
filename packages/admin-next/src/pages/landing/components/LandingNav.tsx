import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

interface LandingNavProps {
  lang: 'zh' | 'en'
  toggleLang: () => void
}

export function LandingNav({ lang, toggleLang }: LandingNavProps) {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav ref={navRef} id="nav">
      <div className="nav-inner">
        <a href="#" className="nav-logo">
          <div className="nav-logo-mark">KA</div>
          <span className="nav-logo-text">KedgeAgentic</span>
        </a>
        <div className="nav-links">
          <a onClick={() => scrollTo('narrative')}>
            <span className="zh">为什么选择即见</span>
            <span className="en">Why KedgeAgentic</span>
          </a>
          <a onClick={() => scrollTo('features')}>
            <span className="zh">平台能力</span>
            <span className="en">Features</span>
          </a>
          <a onClick={() => scrollTo('architecture')}>
            <span className="zh">架构</span>
            <span className="en">Architecture</span>
          </a>
          <a onClick={() => scrollTo('usecases')}>
            <span className="zh">应用场景</span>
            <span className="en">Use Cases</span>
          </a>
          <a onClick={() => scrollTo('pricing')}>
            <span className="zh">定价</span>
            <span className="en">Pricing</span>
          </a>
          <button className="lang-toggle" onClick={toggleLang}>
            {lang === 'zh' ? 'EN' : 'ZH'}
          </button>
          <Link to="/login" className="nav-cta">
            <span className="zh">进入管理</span>
            <span className="en">Admin</span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
