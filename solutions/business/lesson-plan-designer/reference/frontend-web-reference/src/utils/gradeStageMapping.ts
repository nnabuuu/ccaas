/**
 * Grade Level to Stage Mapping
 *
 * Maps numeric grade levels (1-12) to Chinese curriculum stage names.
 * Used for filtering curriculum standards by the appropriate stage.
 *
 * Stage mapping (matches database values):
 * - 义务教育阶段第一学段: grades 1-2
 * - 义务教育阶段第二学段: grades 3-4
 * - 义务教育阶段第三学段: grades 5-6
 * - 义务教育阶段第四学段: grades 7-9
 * - 高中阶段: grades 10-12
 */

/**
 * Convert numeric grade level to curriculum stage name
 * @param gradeLevel - Grade level (1-12)
 * @returns Stage name string for curriculum standard filtering
 */
export function gradeToStage(gradeLevel: number | undefined | null): string {
  if (!gradeLevel) {
    return '义务教育阶段第一学段' // Default
  }

  if (gradeLevel >= 1 && gradeLevel <= 2) {
    return '义务教育阶段第一学段'
  } else if (gradeLevel >= 3 && gradeLevel <= 4) {
    return '义务教育阶段第二学段'
  } else if (gradeLevel >= 5 && gradeLevel <= 6) {
    return '义务教育阶段第三学段'
  } else if (gradeLevel >= 7 && gradeLevel <= 9) {
    return '义务教育阶段第四学段'
  } else if (gradeLevel >= 10 && gradeLevel <= 12) {
    return '高中阶段'
  }

  return '义务教育阶段第一学段' // Default fallback
}

/**
 * Get display name for a stage
 * @param stage - Stage name
 * @returns Human-readable stage description
 */
export function getStageDisplayName(stage: string): string {
  const stageMap: Record<string, string> = {
    '义务教育阶段第一学段': '第一学段 (1-2年级)',
    '义务教育阶段第二学段': '第二学段 (3-4年级)',
    '义务教育阶段第三学段': '第三学段 (5-6年级)',
    '义务教育阶段第四学段': '第四学段 (7-9年级)',
    '高中阶段': '高中阶段 (10-12年级)'
  }
  return stageMap[stage] || stage
}
