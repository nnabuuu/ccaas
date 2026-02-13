/**
 * 工具名称到中文动词的映射
 */
export const TOOL_ACTIVITY_MAP: Record<string, string> = {
  'Read': '正在阅读',
  'Write': '正在生成',
  'Edit': '正在修改',
  'Grep': '正在搜索',
  'Glob': '正在查找文件',
  'Bash': '正在执行命令',
  'Task': '正在执行任务',
  'Skill': '正在调用技能',
  'WebSearch': '正在搜索网页',
  'computer': '正在操作浏览器',
  'screenshot': '正在截图',
  'navigate': '正在导航',
  '_default': '正在处理',
}

/**
 * 获取工具活动的中文描述
 */
export function getToolActivityDescription(
  toolName: string,
  description?: string
): string {
  if (description) return description
  return TOOL_ACTIVITY_MAP[toolName] || TOOL_ACTIVITY_MAP['_default']
}
