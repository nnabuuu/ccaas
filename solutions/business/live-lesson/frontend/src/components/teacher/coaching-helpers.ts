import type { ClassroomState } from '../../hooks/useClassroom'
import { computeWeakDimensions, buildStepMapping } from './summary/summary-helpers'

export interface CoachingTip {
  id: string
  priority: 'urgent' | 'important' | 'info'
  title: string
  detail: string
  action?: string
  stepNum?: number
}

type HealthCards = {
  fastest: { step: string; count: number }
  median: { step: string; pct: number }
  stuck: { count: number; where: string }
  ai: { rounds: number; people: number }
}

export function generateCoachingTips(
  state: ClassroomState | null,
  health: HealthCards,
  stepNames: Record<number, string>,
  taskSteps: Array<{ idx: number; duration?: number }>,
): CoachingTip[] {
  if (!state || !state.students.length) return []

  const tips: CoachingTip[] = []
  const { stepToTask, taskDurations } = buildStepMapping(taskSteps)

  // 1. stuck-cluster: many students stuck
  if (health.stuck.count >= 5) {
    tips.push({
      id: 'stuck-cluster',
      priority: 'urgent',
      title: `${health.stuck.count} 人卡住`,
      detail: `${health.stuck.count} 名学生已在 ${health.stuck.where || '当前步骤'} 停留超过 3 分钟`,
      action: '建议暂停，集中讲解该步骤的关键要点',
      stepNum: (() => {
        const entry = Object.entries(stepNames).find(([, v]) => v === health.stuck.where)
        return entry ? Number(entry[0]) : undefined
      })(),
    })
  }

  // 2. high-error: weak dimensions with >50% wrong rate
  const weakDims = computeWeakDimensions(state.stepMetrics, stepNames)
  if (weakDims.length > 0 && weakDims[0].wrongRate >= 50) {
    const top = weakDims[0]
    tips.push({
      id: 'high-error',
      priority: 'urgent',
      title: `${top.dimension} 错误率 ${top.wrongRate}%`,
      detail: `${top.stepName} 的 ${top.dimension} 错误率达 ${top.wrongRate}%`,
      action: '建议针对该知识点重新讲解',
      stepNum: top.stepNum,
    })
  }

  // 3. step-overtime: median time > 1.5× expected duration
  if (state.stepMetrics) {
    for (const [taskNumStr, sm] of Object.entries(state.stepMetrics)) {
      const taskNum = Number(taskNumStr)
      const expected = taskDurations[taskNum]
      if (!expected || !sm.medianTime) continue
      const expectedSec = expected * 60
      if (sm.medianTime > expectedSec * 1.5) {
        const ratio = Math.round((sm.medianTime / expectedSec) * 100)
        tips.push({
          id: `step-overtime-${taskNum}`,
          priority: 'important',
          title: `${stepNames[taskNum] || `T${taskNum}`} 超时`,
          detail: `中位用时为预期的 ${ratio}%`,
          action: '考虑简化该步骤或提供更多引导',
          stepNum: taskNum,
        })
      }
    }
  }

  // 4. pace-gap: fastest - median >= 2 steps
  const tasks = state.students.map(s => s.currentTask)
  const sorted = [...tasks].sort((a, b) => a - b)
  const medianTask = sorted[Math.floor(sorted.length / 2)] || 1
  const maxTask = Math.max(...tasks, 1)
  if (maxTask - medianTask >= 2) {
    tips.push({
      id: 'pace-gap',
      priority: 'important',
      title: '进度差距拉大',
      detail: `最快学生在 ${stepNames[maxTask] || `T${maxTask}`}，中位在 ${stepNames[medianTask] || `T${medianTask}`}，差距 ${maxTask - medianTask} 步`,
      action: '考虑给领先学生布置延伸任务，或暂停等待中位追上',
    })
  }

  // 5. ai-surge: AI rounds per student > 1.5
  const total = state.students.length
  if (total > 0 && health.ai.rounds > 0) {
    const avgAiPerStudent = health.ai.rounds / total
    if (avgAiPerStudent > 1.5) {
      tips.push({
        id: 'ai-surge',
        priority: 'important',
        title: 'AI 对话密集',
        detail: `人均 AI 对话 ${avgAiPerStudent.toFixed(1)} 轮，${health.ai.people} 人触发`,
        action: '学生可能对该部分理解困难，考虑集中答疑',
      })
    }
  }

  // 6. near-done: high completion
  if (state.stepMetrics) {
    for (const [taskNumStr, sm] of Object.entries(state.stepMetrics)) {
      const taskNum = Number(taskNumStr)
      if (sm.completionRate >= 90 && sm.completedCount >= 3) {
        tips.push({
          id: `near-done-${taskNum}`,
          priority: 'info',
          title: `${stepNames[taskNum] || `T${taskNum}`} 接近完成`,
          detail: `完成率 ${Math.round(sm.completionRate)}%，可推进下一步`,
          stepNum: taskNum,
        })
      }
    }
  }

  // Sort: urgent first, then important, then info
  const priorityOrder = { urgent: 0, important: 1, info: 2 }
  tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return tips
}
