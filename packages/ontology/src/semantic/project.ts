/**
 * `projectManifest` — discriminated entry point that picks an adapter
 * based on the requested format. Convenience wrapper around the
 * format-specific functions in `./formats/`.
 *
 * Why expose both: the discriminated wrapper is convenient for
 * call-site dynamic selection (e.g. "render this manifest in whatever
 * format the SDK wants"); the per-format functions are convenient when
 * the call site already knows the format and wants the precise return
 * type.
 *
 * @see ../../../docs/ontology/kedge-ontology-design.md (§7, §11)
 */

import type { ManifestDef } from '../manifest/index.js';
import type { OntologyRegistry } from '../registry/index.js';
import type { BoundaryRole } from '../types.js';
import {
  projectAsAnthropicTools,
  projectAsMcpTools,
  projectAsSystemPrompt,
  type AnthropicTool,
  type McpTool,
} from './formats/index.js';

export type ProjectionFormat = 'anthropic-tools' | 'mcp-tools' | 'system-prompt';

export interface ProjectionInput {
  readonly manifest: ManifestDef;
  readonly registry: OntologyRegistry;
  readonly role: BoundaryRole;
  readonly format: ProjectionFormat;
}

export type ProjectionResult =
  | { readonly format: 'anthropic-tools'; readonly tools: readonly AnthropicTool[] }
  | { readonly format: 'mcp-tools'; readonly tools: readonly McpTool[] }
  | { readonly format: 'system-prompt'; readonly text: string };

export function projectManifest(input: ProjectionInput): ProjectionResult {
  const { manifest, registry, role, format } = input;
  switch (format) {
    case 'anthropic-tools':
      return {
        format,
        tools: projectAsAnthropicTools(manifest, registry, role),
      };
    case 'mcp-tools':
      return { format, tools: projectAsMcpTools(manifest, registry, role) };
    case 'system-prompt':
      return {
        format,
        text: projectAsSystemPrompt(manifest, registry, role),
      };
    default: {
      const _exhaustive: never = format;
      throw new Error(`unknown projection format: ${String(_exhaustive)}`);
    }
  }
}
