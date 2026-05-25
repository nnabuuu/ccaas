# @kedge-agentic/agentfs-runtime

Framework-free runtime for the agentfs overlay layer in ccaas. Phase A:
ships `BaseMaterializer` + the `ContentSource` port that decouples it
from any specific storage / DI framework.

## What this is

A pure TypeScript package. **Zero framework dependencies** — no NestJS,
no TypeORM, no Express. Just `node:fs`, `node:crypto`, `node:path`.

```ts
import { BaseMaterializer, ContentSource, Logger } from '@kedge-agentic/agentfs-runtime';

class MyContentSource implements ContentSource {
  async listActiveSkills() { /* read from anywhere */ }
  async listActiveMcpServers() { /* same */ }
}

const m = new BaseMaterializer(new MyContentSource(), '/path/to/_agentfs_base');
const result = await m.materialize();
// → { baseDir, skillsWritten, skillFilesWritten, mcpServersWritten, durationMs }
```

## What this is NOT

- **Not a NestJS module.** It exposes a class. Consumers wire it into
  their DI container (NestJS factory, InversifyJS binding, whatever).
- **Not a TypeORM thing.** Doesn't import or know about TypeORM. The
  consumer's adapter class is responsible for the storage details.
- **Not a complete WorkspaceProvider impl.** That's Phase B. Today this
  package only owns the "project content onto disk" stage that the
  agentfs `--base` overlay reads.

## Phases

| Phase | Scope | Status |
|---|---|---|
| **A** | `BaseMaterializer` + `ContentSource` port + `Logger` port | shipped |
| B | `WorkspaceProvider` interface + `LocalWorkspaceProvider` + `AgentfsWorkspaceProvider` (with an `AgentfsCliAdapter` port) | future |
| C | `SandboxService` + `just-bash-mcp/server.mjs` | future |

## ContentSource port

The single interface adapters must implement:

```ts
interface ContentSource {
  listActiveSkills(): Promise<ReadonlyArray<SkillContent>>;
  listActiveMcpServers(): Promise<ReadonlyArray<McpServerContent>>;
}
```

Value object shapes are in [`src/core/types.ts`](./src/core/types.ts).
Skills include their files inline (one method call returns everything
needed to write the skill tree), which lets adapters do efficient
`relations: ['files']`-style joins.

## Reference adapter

The ccaas backend's TypeORM adapter lives at
`packages/backend/src/sessions/workspace/typeorm-skill-content-source.ts`
and is the canonical example.

## Output layout

`materialize()` writes to:

```
${baseDir}/
└── tenants/
    └── {tenantId}/
        ├── skills/
        │   └── {slug}/
        │       ├── SKILL.md          ← skill.content
        │       ├── .skill.json       ← { id, name, description }
        │       └── <relativePath>    ← each SkillFileContent
        └── mcp-servers/
            └── {slug}/
                └── config.json       ← { name, type, config }
```

Writes are sha1-gated: a file is only re-written when its content
actually changed. Safe to run on every backend startup.

## Logger port

```ts
interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}
```

Default is `noopLogger`. Consumers pass their own bridge to NestJS
Logger / pino / etc.

## Design history

See [`packages/vfs-poc/docs/`](../vfs-poc/docs/) for the design rationale,
risk register, and v1/v2 validation results that backed this code.
