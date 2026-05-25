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
          <a href="#narrative" onClick={(e) => { e.preventDefault(); scrollTo('narrative') }}>
            <span className="zh">为什么选择即见</span>
            <span className="en">Why KedgeAgentic</span>
          </a>
          <a href="#dx" onClick={(e) => { e.preventDefault(); scrollTo('dx') }}>
            <span className="zh">方案交付</span>
            <span className="en">Solution Delivery</span>
          </a>
          <a href="#usecases" onClick={(e) => { e.preventDefault(); scrollTo('usecases') }}>
            <span className="zh">应用场景</span>
            <span className="en">Use Cases</span>
          </a>
          <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features') }}>
            <span className="zh">平台能力</span>
            <span className="en">Features</span>
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
