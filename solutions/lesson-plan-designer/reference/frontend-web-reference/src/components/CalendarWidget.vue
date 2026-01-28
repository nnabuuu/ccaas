<script setup lang="ts">
/**
 * CalendarWidget - Monthly calendar display with navigation and schedule events
 *
 * Features:
 * - Dynamic calendar generation
 * - Month navigation
 * - Today highlighting
 * - Schedule event indicators
 *
 * @example
 * <CalendarWidget />
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { scheduleApi } from '../api'
import type { Schedule, ScheduleQuery } from '@/types'

const router = useRouter()

// Current view state
const currentDate = ref(new Date())
const schedules = ref<Schedule[]>([])
const loading = ref(false)

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

interface CalendarDay {
  day: number
  date: Date
  otherMonth?: boolean
  today?: boolean
  hasEvent?: boolean
}

// Format month display
const currentMonth = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1
  return `${year}年 ${month}月`
})

// Generate calendar days for current month view
const days = computed((): CalendarDay[] => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()

  // First day of the month
  const firstDay = new Date(year, month, 1)
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0)

  // Day of week for first day (0=Sunday, convert to Monday-based)
  let startDayOfWeek = firstDay.getDay()
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1 // Convert to Monday=0

  const result: CalendarDay[] = []
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  // Previous month days
  const prevMonth = new Date(year, month, 0)
  const prevMonthDays = prevMonth.getDate()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    result.push({
      day: prevMonthDays - i,
      date: new Date(year, month - 1, prevMonthDays - i),
      otherMonth: true
    })
  }

  // Current month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day)
    result.push({
      day,
      date,
      today: isCurrentMonth && today.getDate() === day,
      hasEvent: hasScheduleOnDate(date)
    })
  }

  // Next month days to fill the grid (6 rows * 7 days = 42)
  const remaining = 42 - result.length
  for (let day = 1; day <= remaining; day++) {
    result.push({
      day,
      date: new Date(year, month + 1, day),
      otherMonth: true
    })
  }

  return result
})

// Check if date has a schedule event
function hasScheduleOnDate(date: Date) {
  const dateStr = formatDateForComparison(date)
  return schedules.value.some((s: Schedule) => {
    if (s.scheduleDate) {
      return s.scheduleDate === dateStr
    }
    // For recurring schedules, check if date falls within range and matches dayOfWeek
    if (s.startDate && s.endDate && s.dayOfWeek) {
      const start = new Date(s.startDate)
      const end = new Date(s.endDate)
      if (date >= start && date <= end) {
        // Convert JavaScript day (0=Sunday) to schedule dayOfWeek (1=Monday)
        const jsDay = date.getDay()
        const scheduleDayOfWeek = jsDay === 0 ? 7 : jsDay
        return scheduleDayOfWeek === s.dayOfWeek
      }
    }
    return false
  })
}

function formatDateForComparison(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Navigation
function prevMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1
  )
}

function nextMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  )
}

function goToToday() {
  currentDate.value = new Date()
}

// Fetch schedules for the current month
async function fetchSchedules() {
  loading.value = true
  try {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth()

    // Get first and last day of month (with buffer for prev/next month days)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month + 2, 0)

    const params: ScheduleQuery = {
      startDateBegin: formatDateForComparison(startDate),
      startDateEnd: formatDateForComparison(endDate),
      pageSize: 100
    }

    const response = await scheduleApi.getList(params)
    const data = response as { rows?: Schedule[]; data?: { rows?: Schedule[] } }
    schedules.value = data.rows || data.data?.rows || []
  } catch (err) {
    console.error('[CalendarWidget] Failed to fetch schedules:', err)
    schedules.value = []
  } finally {
    loading.value = false
  }
}

// Handle day click
function handleDayClick(day: CalendarDay) {
  if (day.otherMonth) return
  // Could navigate to day view or show schedule details
  // For now, just log
  console.log('Clicked date:', day.date)
}

// Fetch schedules on mount and when month changes
onMounted(fetchSchedules)
watch(() => currentDate.value.getMonth(), fetchSchedules)
</script>

<template>
  <div class="calendar-widget">
    <div class="calendar-header">
      <span class="calendar-title" @click="goToToday" style="cursor: pointer;">
        {{ currentMonth }}
      </span>
      <div class="calendar-nav">
        <button class="calendar-nav-btn prev" @click="prevMonth" :disabled="loading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <button class="calendar-nav-btn next" @click="nextMonth" :disabled="loading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="calendar-grid">
      <div
        v-for="(weekday, index) in weekdays"
        :key="'weekday-' + index"
        :class="['calendar-weekday', { weekend: index >= 5 }]"
      >
        {{ weekday }}
      </div>
      <div
        v-for="(day, index) in days"
        :key="'day-' + index"
        :class="[
          'calendar-day',
          {
            'other-month': day.otherMonth,
            'today': day.today,
            'has-event': day.hasEvent
          }
        ]"
        @click="handleDayClick(day)"
      >
        <span class="calendar-day__number">{{ day.day }}</span>
        <span v-if="day.hasEvent && !day.otherMonth" class="calendar-day__event-dot"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-widget {
  background: var(--white);
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
  padding: var(--space-4);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.calendar-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--gray-800);
}

.calendar-title:hover {
  color: var(--primary);
}

.calendar-nav {
  display: flex;
  gap: var(--space-1);
}

.calendar-nav-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-full);
  color: var(--gray-500);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.calendar-nav-btn:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-300);
}

.calendar-nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.calendar-nav-btn.next {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--white);
}

.calendar-nav-btn.next:hover:not(:disabled) {
  background: var(--primary-hover);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
}

.calendar-weekday {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--gray-500);
  text-align: center;
  padding: var(--space-2) 0;
}

.calendar-weekday.weekend {
  color: var(--primary);
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  color: var(--gray-700);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}

.calendar-day:hover:not(.other-month) {
  background: var(--gray-100);
}

.calendar-day.other-month {
  color: var(--gray-300);
  cursor: default;
}

.calendar-day.today {
  background: var(--primary);
  color: var(--white);
  font-weight: 600;
}

.calendar-day.today:hover {
  background: var(--primary-hover);
}

.calendar-day__number {
  line-height: 1;
}

.calendar-day__event-dot {
  position: absolute;
  bottom: 4px;
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--primary);
}

.calendar-day.today .calendar-day__event-dot {
  background: var(--white);
}

.calendar-day.has-event:not(.today):not(.other-month) {
  font-weight: 500;
}
</style>
