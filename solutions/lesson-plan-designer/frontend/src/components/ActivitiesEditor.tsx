import { v4 as uuidv4 } from 'uuid'
import type { Activity } from '../types'
import { ACTIVITY_TYPES } from '../types'

interface ActivitiesEditorProps {
  activities: Activity[]
  onChange: (activities: Activity[]) => void
  isModified?: boolean
}

export function ActivitiesEditor({ activities, onChange, isModified }: ActivitiesEditorProps) {
  // Ensure activities is always an array
  const safeActivities = Array.isArray(activities) ? activities : []

  // Debug: log what we received
  console.log('📋 ActivitiesEditor received:', {
    activities,
    isArray: Array.isArray(activities),
    safeActivities,
    count: safeActivities.length,
    isModified
  })

  const addActivity = () => {
    onChange([
      ...safeActivities,
      {
        id: uuidv4(),
        title: '',
        description: '',
        duration: 10,
        type: 'direct-instruction',
        instructions: [],
      },
    ])
  }

  const updateActivity = (index: number, updates: Partial<Activity>) => {
    const updated = [...safeActivities]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const removeActivity = (index: number) => {
    onChange(safeActivities.filter((_, i) => i !== index))
  }

  const addInstruction = (activityIndex: number) => {
    const activity = safeActivities[activityIndex]
    if (!activity) return
    updateActivity(activityIndex, {
      instructions: [...(activity.instructions || []), ''],
    })
  }

  const updateInstruction = (activityIndex: number, instructionIndex: number, value: string) => {
    const activity = safeActivities[activityIndex]
    if (!activity) return
    const instructions = [...(activity.instructions || [])]
    instructions[instructionIndex] = value
    updateActivity(activityIndex, { instructions })
  }

  const removeInstruction = (activityIndex: number, instructionIndex: number) => {
    const activity = safeActivities[activityIndex]
    if (!activity) return
    updateActivity(activityIndex, {
      instructions: (activity.instructions || []).filter((_, i) => i !== instructionIndex),
    })
  }

  // Calculate total duration
  const totalDuration = safeActivities.reduce((sum, a) => sum + (a.duration || 0), 0)

  return (
    <div className="space-y-4">
      {/* Duration Summary */}
      {safeActivities.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg text-sm">
          <span className="text-blue-700">总时长</span>
          <span className="font-medium text-blue-900">{totalDuration} 分钟</span>
        </div>
      )}

      {safeActivities.length === 0 ? (
        <p className="text-gray-500 text-sm italic">暂无教学活动，点击下方按钮添加</p>
      ) : (
        safeActivities.map((activity, index) => (
          <div
            key={activity.id}
            className={`p-4 bg-gray-50 rounded-lg border ${
              isModified ? 'border-yellow-300' : 'border-gray-200'
            }`}
          >
            <div className="space-y-3">
              {/* Header Row */}
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                  {index + 1}
                </span>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Title */}
                  <input
                    type="text"
                    value={activity.title}
                    onChange={(e) => updateActivity(index, { title: e.target.value })}
                    placeholder="活动标题"
                    className="input-field"
                  />

                  {/* Type */}
                  <select
                    value={activity.type}
                    onChange={(e) => updateActivity(index, {
                      type: e.target.value as Activity['type']
                    })}
                    className="input-field"
                  >
                    {Object.entries(ACTIVITY_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>

                  {/* Duration */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={activity.duration}
                      onChange={(e) => updateActivity(index, { duration: parseInt(e.target.value) || 0 })}
                      min={1}
                      max={120}
                      className="input-field w-20"
                    />
                    <span className="text-sm text-gray-500">分钟</span>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeActivity(index)}
                  className="btn-icon text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Description */}
              <textarea
                value={activity.description}
                onChange={(e) => updateActivity(index, { description: e.target.value })}
                placeholder="活动描述..."
                rows={2}
                className="textarea-field ml-9"
              />

              {/* Instructions */}
              <div className="ml-9 space-y-2">
                <label className="text-sm font-medium text-gray-600">步骤说明:</label>
                {activity.instructions.map((instruction, iIndex) => (
                  <div key={iIndex} className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 w-5">{iIndex + 1}.</span>
                    <input
                      type="text"
                      value={instruction}
                      onChange={(e) => updateInstruction(index, iIndex, e.target.value)}
                      placeholder={`步骤 ${iIndex + 1}`}
                      className="input-field flex-1"
                    />
                    <button
                      onClick={() => removeInstruction(index, iIndex)}
                      className="btn-icon text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addInstruction(index)}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + 添加步骤
                </button>
              </div>

              {/* Teacher Notes */}
              <div className="ml-9">
                <input
                  type="text"
                  value={activity.teacherNotes || ''}
                  onChange={(e) => updateActivity(index, { teacherNotes: e.target.value })}
                  placeholder="教师备注（可选）"
                  className="input-field text-sm"
                />
              </div>
            </div>
          </div>
        ))
      )}

      {/* Add Button */}
      <button
        onClick={addActivity}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-500 transition-colors"
      >
        <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        添加教学活动
      </button>
    </div>
  )
}

export default ActivitiesEditor
