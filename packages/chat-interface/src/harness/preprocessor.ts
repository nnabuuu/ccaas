export interface SystemPromptParts {
  base: string
  skillPrompt: string | null
  widgetCatalog: string
  sessionContext: string
}

export function assembleSystemPrompt(parts: SystemPromptParts): string {
  const sections = [
    parts.base,
    parts.skillPrompt ? `\n## Active Skill\n${parts.skillPrompt}` : '',
    `\n## Available Widget Components\n${parts.widgetCatalog}`,
    `\n## Session Context\n${parts.sessionContext}`,
  ]
  return sections.filter(Boolean).join('\n')
}

export function sessionContextToPrompt(context: Record<string, unknown>): string {
  return Object.entries(context)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}
