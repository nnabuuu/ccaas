export const ENTITY_COLOR_MAP: Record<string, string> = {
  lesson_plan: 'var(--purple-t)',
  homework: 'var(--info-t)',
  submission: 'var(--info-t)',
  session: 'var(--success-t)',
  requirement: 'var(--warn-t)',
  classroom_record: 'var(--teal-t)',
  proposal: 'var(--coral-t)',
}

export function getEntityRoute(entityType: string, entityId: string): string {
  switch (entityType) {
    case 'lesson_plan':
      return `/lesson-plans/${entityId}`
    case 'homework':
    case 'submission':
      return `/homework/${entityId}`
    case 'session':
      return `/sessions/${entityId}`
    case 'requirement':
      return `/requirements/${entityId}`
    case 'classroom_record':
      return `/classroom/${entityId}`
    case 'proposal':
      return `/proposals/${entityId}`
    default:
      return '#'
  }
}
