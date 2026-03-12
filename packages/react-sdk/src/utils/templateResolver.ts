/**
 * @kedge-agentic/react-sdk/utils/templateResolver
 *
 * Session Template resolution utilities for frontend clients.
 * Template resolution now happens server-side; this module only
 * provides the ResolvedTemplateParams type for local param assembly.
 */

/**
 * Resolved template parameters ready for API consumption.
 * mcpServers and skillPath are no longer sent from frontend —
 * they are resolved server-side from the session template.
 */
export interface ResolvedTemplateParams {
  enabledSkills?: string[]
  appendSystemPrompt?: string
}
