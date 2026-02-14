/**
 * Utilities for displaying tool information in a user-friendly format
 */

const MAX_OUTPUT_LENGTH = 500

/**
 * Strip MCP server prefix from tool name
 * @example "mcp__server__Read" -> "Read"
 */
export function stripMcpPrefix(toolName: string): string {
  return toolName.replace(/^mcp__[^_]+__/, '')
}

/**
 * Simplify tool input display - show only key information
 * @param toolName The tool name (with or without MCP prefix)
 * @param input The tool input object
 * @returns Simplified string representation
 */
export function simplifyToolInput(toolName: string, input: unknown): string {
  if (input == null) return '(无输入)'
  if (typeof input !== 'object') {
    return String(input)
  }

  const inputObj = input as Record<string, unknown>
  const name = stripMcpPrefix(toolName)

  // Extract key fields for different tools
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return `文件路径: ${inputObj.file_path || inputObj.path || 'unknown'}`

    case 'Bash':
      return `命令: ${inputObj.command || 'unknown'}`

    case 'Grep':
    case 'Glob':
      return `搜索模式: ${inputObj.pattern || 'unknown'}\n路径: ${inputObj.path || '.'}`

    case 'Task':
      return `描述: ${inputObj.description || inputObj.prompt || 'unknown'}`

    default:
      // Fallback: show full JSON
      return JSON.stringify(input, null, 2)
  }
}

/**
 * Simplify tool output display - limit length and truncate if necessary
 * @param output The tool output
 * @returns Simplified and truncated string representation
 */
export function simplifyToolOutput(output: unknown): string {
  if (output == null) return '(无输出)'

  if (typeof output === 'string') {
    // Limit string output length
    return output.length > MAX_OUTPUT_LENGTH
      ? output.slice(0, MAX_OUTPUT_LENGTH) + '\n\n... (输出已截断，共 ' + output.length + ' 字符)'
      : output
  }

  if (typeof output === 'object') {
    const outputStr = JSON.stringify(output, null, 2)
    return outputStr.length > MAX_OUTPUT_LENGTH
      ? outputStr.slice(0, MAX_OUTPUT_LENGTH) + '\n\n... (输出已截断)'
      : outputStr
  }

  return String(output)
}
