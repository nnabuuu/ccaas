import { v4 as uuidv4 } from 'uuid'
import type { LearningObjective } from '../types'
import { BLOOM_LEVELS } from '../types'

interface ObjectivesEditorProps {
  objectives: LearningObjective[]
  onChange: (objectives: LearningObjective[]) => void
  isModified?: boolean
}

export function ObjectivesEditor({ objectives, onChange, isModified }: ObjectivesEditorProps) {
  // Ensure objectives is always an array
  const safeObjectives = Array.isArray(objectives) ? objectives : []

  // Debug: log what we received
  console.log('🎯 ObjectivesEditor received:', { objectives, safeObjectives, isModified })

  const addObjective = () => {
    onChange([
      ...safeObjectives,
      {
        id: uuidv4(),
        description: '',
        bloomLevel: 'understand',
      },
    ])
  }

  const updateObjective = (index: number, updates: Partial<LearningObjective>) => {
    const updated = [...safeObjectives]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const removeObjective = (index: number) => {
    onChange(safeObjectives.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {safeObjectives.length === 0 ? (
        <p className="text-gray-500 text-sm italic">暂无教学目标，点击下方按钮添加</p>
      ) : (
        safeObjectives.map((objective, index) => (
          <div
            key={objective.id}
            className={`p-4 bg-gray-50 rounded-lg border ${
              isModified ? 'border-yellow-300' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                {index + 1}
              </span>

              <div className="flex-1 space-y-3">
                {/* Description */}
                <textarea
                  value={objective.description}
                  onChange={(e) => updateObjective(index, { description: e.target.value })}
                  placeholder="描述教学目标..."
                  rows={2}
                  className="textarea-field"
                />

                <div className="flex flex-wrap gap-4">
                  {/* Bloom Level */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">认知层级:</label>
                    <select
                      value={objective.bloomLevel}
                      onChange={(e) => updateObjective(index, {
                        bloomLevel: e.target.value as LearningObjective['bloomLevel']
                      })}
                      className="input-field py-1 text-sm"
                    >
                      {Object.entries(BLOOM_LEVELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Assessment Criteria */}
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      value={objective.assessmentCriteria || ''}
                      onChange={(e) => updateObjective(index, { assessmentCriteria: e.target.value })}
                      placeholder="评估标准（可选）"
                      className="input-field py-1 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => removeObjective(index)}
                className="btn-icon text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))
      )}

      {/* Add Button */}
      <button
        onClick={addObjective}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-500 transition-colors"
      >
        <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        添加教学目标
      </button>
    </div>
  )
}

export default ObjectivesEditor
