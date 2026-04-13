import { useState, useEffect, useCallback } from 'react'
import { HeroSection } from '../components/home/HeroSection'
import { FocusCard } from '../components/home/FocusCard'
import { AISection } from '../components/home/AISection'
import { WeekStrip } from '../components/home/WeekStrip'
import { ActivityTimeline } from '../components/home/ActivityTimeline'
import { SERVER_URL } from '../config'
import type { PendingData, AIBriefing, WeeklySummary, WeekDots, ActivityItem } from '../types/dashboard'

function getWeekStart(): string {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)
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

  useEffect(() => {
    const weekStart = getWeekStart()
    const todayStr = getTodayStr()

    Promise.all([
      fetch(`${SERVER_URL}/api/dashboard/pending`).then((r) => r.json()),
      fetch(`${SERVER_URL}/api/dashboard/ai-briefing`).then((r) => r.json()),
      fetch(`${SERVER_URL}/api/context/activity/weekly-summary`).then((r) => r.json()),
      fetch(`${SERVER_URL}/api/context/activity/week-dots?week_start=${weekStart}`).then((r) => r.json()),
      fetch(`${SERVER_URL}/api/context/activity?date=${todayStr}`).then((r) => r.json()),
    ])
      .then(([pendingData, briefingData, summaryData, dotsData, activityData]) => {
        setPending(pendingData)
        setBriefing(briefingData)
        setWeeklySummary(summaryData)
        setWeekDots(dotsData)
        setActivities(activityData.items ?? [])
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err)
        setError('数据加载失败')
        setLoading(false)
      })
  }, [])

  const handleSelectDate = useCallback(
    (date: string) => {
      setSelectedDate(date)
      setActivityLoading(true)
      fetch(`${SERVER_URL}/api/context/activity?date=${date}`)
        .then((r) => r.json())
        .then((data) => {
          setActivities(data.items ?? [])
          setActivityLoading(false)
        })
        .catch(() => {
          setActivities([])
          setActivityLoading(false)
        })
    },
    []
  )

  if (loading) {
    return (
      <div className="home-content">
        <div style={{ padding: '40px 0', fontSize: '13px', color: 'var(--t3)' }}>
          加载中...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="home-content">
        <HeroSection weeklySummary={null} />
        <div style={{ padding: '20px 0', fontSize: '13px', color: 'var(--t3)' }}>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="home-content">
      <HeroSection weeklySummary={weeklySummary} />
      <FocusCard pending={pending} />
      <AISection briefing={briefing} />
      <WeekStrip weekDots={weekDots} selectedDate={selectedDate} onSelectDate={handleSelectDate} />
      <ActivityTimeline activities={activities} selectedDate={selectedDate} loading={activityLoading} />

      <style>{`
        .home-content { max-width: 800px; }
      `}</style>
    </div>
  )
}
