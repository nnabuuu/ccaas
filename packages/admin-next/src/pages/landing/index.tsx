import { useEffect } from 'react'
import './landing.css'
import { LandingNav } from './components/LandingNav'
import { HeroSection } from './components/HeroSection'
import { NarrativeSection } from './components/NarrativeSection'
import { SkipSection } from './components/SkipSection'
import { UseCasesSection } from './components/UseCasesSection'
import { FeaturesGrid } from './components/FeaturesGrid'
import { ArchitectureDiagram } from './components/ArchitectureDiagram'
import { PricingSection } from './components/PricingSection'
import { CTASection } from './components/CTASection'
import { LandingFooter } from './components/LandingFooter'
import { useLang } from '@/contexts/language-context'

export function LandingPage() {
  const { lang, toggleLang } = useLang()

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
      <SkipSection />
      <UseCasesSection />
      <FeaturesGrid />
      <ArchitectureDiagram />
      <PricingSection />
      <CTASection />
      <LandingFooter />
    </div>
  )
}
