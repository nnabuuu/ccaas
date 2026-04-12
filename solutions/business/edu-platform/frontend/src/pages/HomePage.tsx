import { useState, useEffect, useCallback } from 'react'
import { HeroSection } from '../components/home/HeroSection'
import { FocusCard } from '../components/home/FocusCard'
import { AISection } from '../components/home/AISection'
import { WeekStrip } from '../components/home/WeekStrip'
import { ActivityTimeline } from '../components/home/ActivityTimeline'
import type { PendingData, AIBriefing, WeeklySummary, WeekDots, ActivityItem } from '../types/dashboard'

const SOLUTION_URL = import.meta.env.VITE_SOLUTION_BACKEND_URL || 'http://localhost:3011'

function getWeekStart(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  return monday.toISOString().split('T')[0]
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function HomePage() {
  const [pending, setPending] = useState<PendingData | null>(null)
  const [briefing, setBriefing] = useState<AIBriefing | null>(null)
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null)
  const [weekDots, setWeekDots] = useState<WeekDots | null>(null)
  const [activities, setActivities] = useState<ActivityItem[] | null>(null)
  const [selectedDate, setSelectedDate] = useState(getTodayStr)
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initial parallel fetch
  useEffect(() => {
    const weekStart = getWeekStart()
    const today = getTodayStr()

    Promise.all([
      fetch(`${SOLUTION_URL}/api/dashboard/pending`).then(r => r.json()).catch(() => null),
      fetch(`${SOLUTION_URL}/api/dashboard/ai-briefing`).then(r => r.json()).catch(() => null),
      fetch(`${SOLUTION_URL}/api/context/activity/weekly-summary`).then(r => r.json()).catch(() => null),
      fetch(`${SOLUTION_URL}/api/context/activity/week-dots?week_start=${weekStart}`).then(r => r.json()).catch(() => null),
      fetch(`${SOLUTION_URL}/api/context/activity?date=${today}`).then(r => r.json()).catch(() => null),
    ])
      .then(([pendingData, briefingData, summaryData, dotsData, activityData]) => {
        setPending(pendingData)
        setBriefing(briefingData)
        setWeeklySummary(summaryData)
        setWeekDots(dotsData)
        setActivities(activityData?.items ?? null)
        setLoading(false)
      })
      .catch(() => {
        setError('数据加载失败')
        setLoading(false)
      })
  }, [])

  // Fetch activities when date changes
  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date)
    setActivityLoading(true)
    fetch(`${SOLUTION_URL}/api/context/activity?date=${date}`)
      .then(r => r.json())
      .then(data => {
        setActivities(data?.items ?? null)
        setActivityLoading(false)
      })
      .catch(() => {
        setActivities(null)
        setActivityLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '40px 24px 80px',
        fontFamily: '-apple-system, "SF Pro Text", "PingFang SC", sans-serif',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--t3)' }}>加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '40px 24px 80px',
        fontFamily: '-apple-system, "SF Pro Text", "PingFang SC", sans-serif',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--danger-t)' }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: '640px',
      margin: '0 auto',
      padding: '40px 24px 80px',
      fontFamily: '-apple-system, "SF Pro Text", "PingFang SC", sans-serif',
    }}>
      <HeroSection weeklySummary={weeklySummary} />
      <FocusCard pending={pending} />
      <AISection briefing={briefing} />
      <WeekStrip
        weekDots={weekDots}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
      />
      <ActivityTimeline
        activities={activities}
        selectedDate={selectedDate}
        loading={activityLoading}
      />
    </div>
  )
}
