import { LessonPlanCard } from './LessonPlanCard'
import { LESSON_FIELDS } from '../types'
import type { LessonSyncField, DisplayItem } from '../types'

interface LessonPlanPanelProps {
  displayData: Map<LessonSyncField, DisplayItem>
  isProcessing: boolean
}

export function LessonPlanPanel({ displayData, isProcessing }: LessonPlanPanelProps) {
  const hasAnyData = LESSON_FIELDS.some(f => displayData.has(f.field))

  return (
    <div className="h-full overflow-y-auto p-4 bg-gradient-to-b from-edu-blue-50/50 to-gray-50">
      {!hasAnyData && !isProcessing && (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="border-2 border-dashed border-edu-blue-200 rounded-2xl p-10 bg-gradient-to-b from-edu-blue-50/50 to-transparent">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-edu-blue-100 flex items-center justify-center mb-4">
                <span className="text-5xl">📝</span>
              </div>
              <p className="text-lg font-medium text-edu-blue-700 mb-2">教案输出面板</p>
              <p className="text-sm text-gray-400">在左侧对话中发起备课请求，生成的教案将显示在这里</p>
            </div>
          </div>
        </div>
      )}

      {(hasAnyData || isProcessing) && LESSON_FIELDS.map(({ field, title, icon }, index) => {
        const item = displayData.get(field)
        const isLoading = isProcessing && !item && hasAnyData

        return (
          <LessonPlanCard
            key={field}
            title={title}
            icon={icon}
            content={item?.value}
            isLoading={isLoading}
            index={index}
          />
        )
      })}
    </div>
  )
}
