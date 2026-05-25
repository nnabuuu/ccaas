/**
 * Test-only `ContentSource` implementation backed by in-memory arrays.
 * Exported via the `/testing` subpath so production builds don't see
 * it as part of the public surface.
 *
 *   import { InMemoryContentSource } from '@kedge-agentic/agent-runtime/testing';
 *
 * Useful for testing both the pure BaseMaterializer (this package's
 * own tests) and any adapter that wants to assert downstream behavior
 * without spinning up real storage.
 */

import type {
  ContentSource,
  McpServerContent,
  SkillContent,
} from '../workspace/types.js';

export class InMemoryContentSource implements ContentSource {
  constructor(
    private readonly skills: ReadonlyArray<SkillContent> = [],
    private readonly mcps: ReadonlyArray<McpServerContent> = [],
  ) {}

  async listActiveSkills(): Promise<ReadonlyArray<SkillContent>> {
    return this.skills;
  }

  async listActiveMcpServers(): Promise<ReadonlyArray<McpServerContent>> {
    return this.mcps;
  }
}
