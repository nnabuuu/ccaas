export type ChalkboardAction =
  | { type: 'write'; text: string; x: number; y: number; fontSize?: number; color?: string; duration?: number }
  | { type: 'draw_line'; x1: number; y1: number; x2: number; y2: number; color?: string; width?: number; duration?: number }
  | { type: 'draw_arc'; cx: number; cy: number; rx: number; ry: number; color?: string; duration?: number }
  | { type: 'draw_path'; points: [number, number][]; closed?: boolean; color?: string; duration?: number }
  | { type: 'highlight_box'; x: number; y: number; w: number; h: number; color?: string; duration?: number }
  | { type: 'transform_region'; regionId: string; scale: number; targetX: number; targetY: number; duration?: number }
  | { type: 'erase'; x: number; y: number; w: number; h: number; duration?: number }
  | { type: 'pause'; duration: number }
  | { type: 'clear'; duration?: number }

export interface TimelineItem {
  id: string
  type: 'narrator' | 'student_ack' | 'ai_response' | 'user_input'
  content: string
  beatId?: string
  timestamp: number
}
