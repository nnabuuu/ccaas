/**
 * 中文思考动词库，根据时长分阶段
 */
export const THINKING_VERBS = {
  // 0-30s: 初始阶段（轻量词汇）
  initial: ['思考', '琢磨', '分析', '梳理', '构思'],

  // 30-90s: 深入阶段（中等深度）
  moderate: ['推敲', '斟酌', '研究', '探索', '计划'],

  // 90s+: 深度阶段（重度词汇）
  deep: ['深思', '钻研', '规划', '设计', '论证'],
}

/**
 * 根据持续时间选择合适的动词
 * @param durationMs 持续时间（毫秒）
 * @returns 随机选择的动词
 */
export function getThinkingVerb(durationMs: number): string {
  const seconds = durationMs / 1000

  let verbs: string[]
  if (seconds < 30) {
    verbs = THINKING_VERBS.initial
  } else if (seconds < 90) {
    verbs = THINKING_VERBS.moderate
  } else {
    verbs = THINKING_VERBS.deep
  }

  return verbs[Math.floor(Math.random() * verbs.length)]
}
