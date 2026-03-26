export interface ClassInfo {
  id: string
  name: string
  grade: string
  subject: string
  school: string
}

export const MOCK_CLASSES: ClassInfo[] = [
  { id: 'c-8-2-math', name: '八(2)班', grade: '8', subject: '数学', school: '树人中学' },
  { id: 'c-8-1-math', name: '八(1)班', grade: '8', subject: '数学', school: '树人中学' },
  { id: 'c-8-3-math', name: '八(3)班', grade: '8', subject: '数学', school: '树人中学' },
  { id: 'c-7-1-math', name: '七(1)班', grade: '7', subject: '数学', school: '树人中学' },
  { id: 'c-9-2-physics', name: '九(2)班', grade: '9', subject: '物理', school: '树人中学' },
]

export const DEFAULT_CLASS = MOCK_CLASSES[0]
