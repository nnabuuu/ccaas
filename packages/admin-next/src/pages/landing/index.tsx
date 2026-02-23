import { useState, useEffect } from 'react'
import './landing.css'
import { LandingNav } from './components/LandingNav'
import { HeroSection } from './components/HeroSection'
import { NarrativeSection } from './components/NarrativeSection'
import { UseCasesSection } from './components/UseCasesSection'
import { FeaturesGrid } from './components/FeaturesGrid'
import { ArchitectureDiagram } from './components/ArchitectureDiagram'
import { PricingSection } from './components/PricingSection'
import { CTASection } from './components/CTASection'
import { LandingFooter } from './components/LandingFooter'

export function LandingPage() {
  const [lang, setLang] = useState<'zh' | 'en'>(() => {
    return (localStorage.getItem('ka-lang') as 'zh' | 'en') || 'zh'
  })

  function toggleLang() {
    const next = lang === 'zh' ? 'en' : 'zh'
    setLang(next)
    localStorage.setItem('ka-lang', next)
  }

  // Fade-in scroll animation
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible')
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )

    const elements = document.querySelectorAll('.landing-page .fade-in')
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing-page" data-lang={lang}>
      <LandingNav lang={lang} toggleLang={toggleLang} />
      <HeroSection />
      <NarrativeSection />
      <UseCasesSection />
      <FeaturesGrid />
      <ArchitectureDiagram />
      <PricingSection />
      <CTASection />
      <LandingFooter />
    </div>
  )
}
